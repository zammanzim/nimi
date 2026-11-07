/**
 * Hybrid Storage Layer for WhatsApp Archive Viewer
 *
 * Primary  : Supabase (`wa_archives` / `wa_messages`) — cloud, scoped per device
 *            through Row Level Security + the `x-device-id` request header.
 * Fallback : IndexedDB (`WhatsAppArchiveDB`) — local cache so the app keeps working
 *            offline and while the cloud is unreachable.
 *
 * Strategy
 * - Write : always to IndexedDB first (fast, offline-safe), then best-effort to the
 *           cloud. `saveArchiveWithMessages()` resolves `{ cloud: boolean }` so the
 *           UI can tell the user where the archive ended up.
 * - Read  : cloud first, fall back to IndexedDB when offline / not yet synced.
 * - Sync  : `syncWithCloud()` reconciles both sides using `updatedAt` (newest wins),
 *           re-pushes local-only archives (made offline) and pulls remote-only ones.
 * - Deletes that fail against the cloud are remembered in `pendingCloudDeletes`
 *           so a later sync retries them instead of "resurrecting" the archive.
 *
 * IndexedDB stores (schema v1, unchanged):
 * - `archives` : archive metadata objects (keyPath 'id')
 * - `messages` : `{ archiveId, messages }` (keyPath 'archiveId')
 * - `settings` : `{ key, value }` — app preferences + sync bookkeeping (device-local)
 */

import {
  cloudListArchives,
  cloudFindArchivesByFingerprint,
  cloudSaveArchive,
  cloudGetMessages,
  cloudHasMessages,
  cloudUpdateMeta,
  cloudDeleteArchive,
  cloudClearAll,
  rowToMeta,
  getDeviceId,
  setDeviceId,
  generateNewDeviceId
} from './supabase-store.js';

const DB_NAME = 'WhatsAppArchiveDB';
const DB_VERSION = 1;
const PENDING_DELETES_KEY = 'pendingCloudDeletes';

let dbInstance = null;

/* ==========================================================================
   IndexedDB primitives (local source of truth, unchanged schema)
   ========================================================================== */

/**
 * Open and initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Browser Anda tidak mendukung IndexedDB.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('archives')) {
        const archiveStore = db.createObjectStore('archives', { keyPath: 'id' });
        archiveStore.createIndex('fingerprint', 'fingerprint', { unique: false });
        archiveStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'archiveId' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error || new Error('Gagal membuka database lokal IndexedDB.'));
    };
  });
}

function idbTransaction(storeNames, mode) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction(storeNames, mode);
        } catch (err) {
          reject(err);
          return;
        }
        resolve(tx);
      })
  );
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaksi IndexedDB dibatalkan.'));
  });
}

async function idbGetAllArchives() {
  const tx = await idbTransaction('archives', 'readonly');
  const req = tx.objectStore('archives').getAll();
  const list = await requestToPromise(req);
  await txDone(tx);
  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return list || [];
}

async function idbPutArchive(meta, messages) {
  const tx = await idbTransaction(['archives', 'messages'], 'readwrite');
  tx.objectStore('archives').put(meta);
  tx.objectStore('messages').put({ archiveId: meta.id, messages: messages || [] });
  await txDone(tx);
}

/** Put archive metadata without touching its messages row. */
async function idbPutMeta(meta) {
  const tx = await idbTransaction('archives', 'readwrite');
  tx.objectStore('archives').put(meta);
  await txDone(tx);
}

async function idbPutMessages(archiveId, messages) {
  const tx = await idbTransaction('messages', 'readwrite');
  tx.objectStore('messages').put({ archiveId, messages: messages || [] });
  await txDone(tx);
}

async function idbGetMessages(archiveId) {
  const tx = await idbTransaction('messages', 'readonly');
  const req = tx.objectStore('messages').get(archiveId);
  const rec = await requestToPromise(req);
  await txDone(tx);
  return rec ? rec.messages || [] : [];
}

async function idbFindByFingerprint(fingerprint, fileName) {
  const tx = await idbTransaction('archives', 'readonly');
  const index = tx.objectStore('archives').index('fingerprint');
  const req = index.getAll(fingerprint);
  const matches = await requestToPromise(req);
  await txDone(tx);
  if (!matches || matches.length === 0) return null;
  // Prefer exact fileName match if multiple share fingerprint, otherwise first match
  return matches.find((a) => a.fileName === fileName) || matches[0];
}

async function idbUpdateMeta(archiveId, patch) {
  const tx = await idbTransaction('archives', 'readwrite');
  const store = tx.objectStore('archives');
  const getReq = store.get(archiveId);

  let updatedRecord = null;
  getReq.onsuccess = () => {
    const existing = getReq.result;
    if (!existing) return;
    updatedRecord = { ...existing, ...patch };
    store.put(updatedRecord);
  };

  await txDone(tx);
  return updatedRecord;
}

async function idbDeleteArchive(archiveId) {
  const tx = await idbTransaction(['archives', 'messages'], 'readwrite');
  tx.objectStore('archives').delete(archiveId);
  tx.objectStore('messages').delete(archiveId);
  await txDone(tx);
}

async function idbClearAll() {
  const tx = await idbTransaction(['archives', 'messages', 'settings'], 'readwrite');
  tx.objectStore('archives').clear();
  tx.objectStore('messages').clear();
  tx.objectStore('settings').clear();
  await txDone(tx);
}

/* ==========================================================================
   Pending cloud deletions (offline delete must not be undone by a later sync)
   ========================================================================== */

async function getPendingDeletes() {
  try {
    const list = await getSetting(PENDING_DELETES_KEY, []);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function setPendingDeletes(list) {
  try {
    await setSetting(PENDING_DELETES_KEY, list);
  } catch (err) {
    console.warn('Gagal menyimpan daftar hapus tertunda:', err);
  }
}

async function addPendingDelete(archiveId) {
  const list = await getPendingDeletes();
  if (!list.includes(archiveId)) {
    list.push(archiveId);
    await setPendingDeletes(list);
  }
}

async function removePendingDelete(archiveId) {
  const list = await getPendingDeletes();
  if (list.includes(archiveId)) {
    await setPendingDeletes(list.filter((id) => id !== archiveId));
  }
}

/* ==========================================================================
   Public API (same signatures as the previous IndexedDB-only layer)
   ========================================================================== */

/**
 * Find an existing archive by content fingerprint in local IndexedDB first,
 * falling back to cloud only if needed.
 * @param {string} fingerprint
 * @param {string} fileName
 * @returns {Promise<object|null>} archive metadata
 */
export async function findExistingArchive(fingerprint, fileName) {
  const localMatch = await idbFindByFingerprint(fingerprint, fileName);
  if (localMatch) return localMatch;
  try {
    const rows = await cloudFindArchivesByFingerprint(fingerprint);
    if (rows.length > 0) {
      const exact = rows.find((r) => r.fileName === fileName) || rows[0];
      return { ...rowToMeta(exact), cloudSynced: true };
    }
  } catch {
    // cloud unreachable
  }
  return null;
}

/**
 * Save or update an archive and its messages locally in IndexedDB ONLY by default.
 * Cloud upload is now an explicit user action via `pushArchiveToSupabase()` / `syncWithCloud()`,
 * or when `{ syncToCloud: true }` is explicitly passed.
 * @param {object} archiveMeta
 * @param {Array<object>} messages
 * @param {object} [options]
 * @param {boolean} [options.syncToCloud=false]
 * @returns {Promise<{ cloud: boolean }>}
 */
export async function saveArchiveWithMessages(archiveMeta, messages, { syncToCloud = false } = {}) {
  const metaToStore = {
    ...archiveMeta,
    cloudSynced: Boolean(syncToCloud)
  };
  await idbPutArchive(metaToStore, messages);

  // Re-importing / re-saving an archive cancels any pending cloud deletion for it.
  await removePendingDelete(archiveMeta.id);

  if (!syncToCloud) {
    return { cloud: false };
  }

  try {
    await cloudSaveArchive(metaToStore, messages);
    metaToStore.cloudSynced = true;
    await idbPutMeta(metaToStore);
    return { cloud: true };
  } catch (err) {
    console.warn('Simpan ke Supabase gagal (tersimpan lokal):', err);
    return { cloud: false, error: err };
  }
}

/**
 * Explicitly upload/sync a single local archive and its messages to Supabase.
 * @param {string} archiveId
 * @returns {Promise<{ ok: boolean, error?: Error }>}
 */
export async function pushArchiveToSupabase(archiveId) {
  const allLocal = await idbGetAllArchives();
  const meta = allLocal.find((a) => a.id === archiveId);
  if (!meta) {
    return { ok: false, error: new Error('Arsip tidak ditemukan di penyimpanan lokal.') };
  }
  const messages = await idbGetMessages(archiveId);
  try {
    await cloudSaveArchive(meta, messages);
    const updatedMeta = { ...meta, cloudSynced: true, cloudSyncedAt: Date.now() };
    await idbPutMeta(updatedMeta);
    await removePendingDelete(archiveId);
    return { ok: true, meta: updatedMeta };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * List all archives: cloud ∪ local (newest version of each wins), sorted by
 * `updatedAt` descending. Falls back to local-only when offline.
 * @returns {Promise<Array<object>>}
 */
export async function getAllArchives() {
  const local = await idbGetAllArchives();
  const pending = await getPendingDeletes();

  let remoteRows = null;
  try {
    remoteRows = await cloudListArchives();
  } catch {
    return local.filter((a) => !pending.includes(a.id));
  }

  const pendingSet = new Set(pending);
  const remoteById = new Map();
  for (const row of remoteRows) {
    if (pendingSet.has(row.id)) continue;
    remoteById.set(row.id, { ...rowToMeta(row), cloudSynced: true });
  }

  // Cache remote metas locally when they are newer than (or missing from) the local copy,
  // so the archive list still works offline after this first successful load.
  for (const meta of remoteById.values()) {
    const lm = local.find((a) => a.id === meta.id);
    if (!lm || (meta.updatedAt || 0) > (lm.updatedAt || 0)) {
      try {
        await idbPutMeta(meta);
      } catch (err) {
        console.warn('Gagal cache meta arsip lokal:', err);
      }
    }
  }

  const merged = [];
  const seen = new Set();

  for (const lm of local) {
    if (pendingSet.has(lm.id)) continue;
    const rm = remoteById.get(lm.id);
    if (!rm) {
      merged.push({ ...lm, cloudSynced: false }); // local-only (not yet uploaded to Supabase)
    } else {
      const chosen = (lm.updatedAt || 0) >= (rm.updatedAt || 0) ? lm : rm;
      const isSynced = (lm.updatedAt || 0) <= (rm.updatedAt || 0);
      merged.push({ ...chosen, cloudSynced: isSynced });
      seen.add(lm.id);
    }
  }

  for (const [id, rm] of remoteById) {
    if (!seen.has(id)) merged.push({ ...rm, cloudSynced: true }); // remote-only
  }

  merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return merged;
}

/**
 * Get messages for a specific archive: check local IndexedDB first so local edits/additions
 * are never overwritten by stale cloud rows, then fall back to Supabase if missing locally.
 * @param {string} archiveId
 * @returns {Promise<Array<object>>}
 */
export async function getArchiveMessages(archiveId) {
  const localMsgs = await idbGetMessages(archiveId);
  if (localMsgs && localMsgs.length > 0) {
    return localMsgs;
  }

  try {
    const rows = await cloudGetMessages(archiveId);
    if (rows.length > 0) {
      try {
        await idbPutMessages(archiveId, rows);
      } catch (err) {
        console.warn('Gagal cache pesan lokal:', err);
      }
      return rows;
    }
    const exists = await cloudHasMessages(archiveId);
    if (exists) {
      await idbPutMessages(archiveId, []);
      return [];
    }
  } catch {
    // cloud unreachable
  }
  return localMsgs || [];
}

/**
 * Update metadata of an existing archive locally.
 * Only updates Supabase if the archive was already synced to cloud (`cloudSynced === true`).
 * @param {string} archiveId
 * @param {Partial<object>} updates
 * @returns {Promise<object|null>} updated local record
 */
export async function updateArchiveMeta(archiveId, updates) {
  const patch = { ...updates, updatedAt: Date.now() };
  const updatedRecord = await idbUpdateMeta(archiveId, patch);
  if (!updatedRecord) return null;

  if (updatedRecord.cloudSynced) {
    try {
      await cloudUpdateMeta(archiveId, patch);
    } catch (err) {
      console.warn('Update meta di Supabase gagal (tersimpan lokal):', err);
    }
  }

  return updatedRecord;
}

/**
 * Delete a single archive locally; a failed cloud delete is retried on next sync.
 * @param {string} archiveId
 * @returns {Promise<void>}
 */
export async function deleteArchive(archiveId) {
  await idbDeleteArchive(archiveId);
  try {
    await cloudDeleteArchive(archiveId);
    await removePendingDelete(archiveId);
  } catch (err) {
    console.warn('Hapus di Supabase gagal (akan dicoba lagi saat sinkronisasi):', err);
    await addPendingDelete(archiveId);
  }
}

/**
 * Clear all local data (archives, messages, settings). Cloud rows of this device
 * are removed too; if that fails the ids are remembered for retry on next sync.
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  const ids = (await idbGetAllArchives()).map((a) => a.id);
  await idbClearAll();
  try {
    await cloudClearAll();
  } catch (err) {
    console.warn('Hapus data cloud gagal (akan dicoba lagi saat sinkronisasi):', err);
    if (ids.length > 0) await setPendingDeletes(ids);
  }
}

/**
 * Reconcile IndexedDB with Supabase (called once at app start).
 *
 * 1. Retry any deletions that failed earlier.
 * 2. Push local archives that are newer than (or missing from) the cloud —
 *    this uploads everything imported/edited while offline.
 * 3. Pull cloud archives that are newer than (or missing from) the local copy.
 *
 * @returns {Promise<{ ok: boolean, pushed: number, pulled: number, deleted: number, offline: boolean }>}
 */
export async function syncWithCloud() {
  const pending = await getPendingDeletes();

  let remoteRows;
  try {
    remoteRows = await cloudListArchives();
  } catch {
    return { ok: false, pushed: 0, pulled: 0, deleted: 0, offline: true };
  }

  // 1) Retry failed deletions first.
  const stillPending = [];
  let deleted = 0;
  for (const id of pending) {
    try {
      await cloudDeleteArchive(id);
      deleted++;
    } catch {
      stillPending.push(id);
    }
  }
  if (stillPending.length !== pending.length) await setPendingDeletes(stillPending);
  const pendingSet = new Set(stillPending);

  const local = await idbGetAllArchives();
  let pushed = 0;
  let pulled = 0;

  // 2) Push local-newer or local-only archives (meta + messages in one shot).
  const remoteById = new Map();
  for (const row of remoteRows) {
    if (!pendingSet.has(row.id)) remoteById.set(row.id, row);
  }

  for (const lm of local) {
    if (pendingSet.has(lm.id)) continue;
    const rr = remoteById.get(lm.id);
    if (!rr || (lm.updatedAt || 0) > (Number(rr.updatedAt) || 0)) {
      try {
        const messages = await idbGetMessages(lm.id);
        await cloudSaveArchive(lm, messages);
        await idbPutMeta({ ...lm, cloudSynced: true, cloudSyncedAt: Date.now() });
        pushed++;
      } catch (err) {
        console.warn(`Gagal push arsip "${lm.id}" ke Supabase:`, err);
      }
    }
  }

  // 3) Pull remote-newer or remote-only archives into IndexedDB.
  const localById = new Map(local.map((a) => [a.id, a]));
  for (const rr of remoteById.values()) {
    const lm = localById.get(rr.id);
    if (!lm || (Number(rr.updatedAt) || 0) > (lm.updatedAt || 0)) {
      try {
        const meta = { ...rowToMeta(rr), cloudSynced: true };
        const messages = await cloudGetMessages(rr.id);
        await idbPutArchive(meta, messages);
        pulled++;
      } catch (err) {
        console.warn(`Gagal pull arsip "${rr.id}" dari Supabase:`, err);
      }
    }
  }

  return { ok: true, pushed, pulled, deleted, offline: false };
}

/**
 * Get a setting value by key (device-local, stored in IndexedDB only).
 * @param {string} key
 * @param {any} defaultValue
 * @returns {Promise<any>}
 */
export async function getSetting(key, defaultValue = null) {
  const tx = await idbTransaction('settings', 'readonly');
  const req = tx.objectStore('settings').get(key);
  const rec = await requestToPromise(req);
  await txDone(tx);
  return rec !== undefined ? rec.value : defaultValue;
}

/**
 * Save a setting value by key (device-local, stored in IndexedDB only).
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  const tx = await idbTransaction('settings', 'readwrite');
  tx.objectStore('settings').put({ key, value });
  await txDone(tx);
}

/**
 * Clear local IndexedDB records without deleting from cloud.
 * Used when switching device sync key and choosing to replace local archives.
 * @returns {Promise<void>}
 */
export async function clearLocalDataOnly() {
  await idbClearAll();
}

export { getDeviceId, setDeviceId, generateNewDeviceId };
