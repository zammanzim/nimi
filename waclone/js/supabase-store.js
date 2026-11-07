/**
 * Supabase (PostgREST) Cloud Storage Client for WhatsApp Archive Viewer
 *
 * Talks directly to the Supabase Data API using `fetch` — no SDK dependency,
 * no bundler. Every request carries:
 *   - `apikey` + `Authorization: Bearer <anon key>` (publishable key, safe for client)
 *   - `x-device-id` header, which Row Level Security (`wa_device_id()`) uses to
 *     scope every read/write to the current browser's device id.
 *
 * Tables:
 *   - `wa_archives` : one row per archive (metadata mirrors the app's meta object)
 *   - `wa_messages` : chunked message arrays, `MESSAGE_CHUNK_SIZE` messages per row,
 *                     so each request payload stays small regardless of archive size.
 *
 * Write ordering (important!): message chunks are written BEFORE the archive meta.
 * If a save fails halfway, the remote `updatedAt` is never advanced past the local
 * copy, so `syncWithCloud()` in database.js can reliably detect & re-push it.
 * (This is why there is no FK from wa_messages to wa_archives.)
 */

const SUPABASE_URL = 'https://eefdfaqcccgpfthdidzp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZmRmYXFjY2NncGZ0aGRpZHpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NzU1NzEsImV4cCI6MjEwMTE1MTU3MX0.QupX_C_jOzgsTkDmr678gD_vEJUPpYfzKKAeY6Hrod0';
const REST_BASE = `${SUPABASE_URL}/rest/v1`;

const DEVICE_STORAGE_KEY = 'waclone_device_id';
const REQUEST_TIMEOUT_MS = 10000;

/** Messages per `wa_messages` row. 500 x ~200 bytes ≈ 100 KB per row. */
export const MESSAGE_CHUNK_SIZE = 500;
/** Max chunk rows per write request (≈ 1 MB worst case, well within API limits). */
const MAX_CHUNKS_PER_REQUEST = 10;

let sessionDeviceId = null;

/**
 * Stable per-browser device id (persisted in localStorage, session-scoped fallback
 * when localStorage is unavailable e.g. private mode).
 * @returns {string}
 */
export function getDeviceId() {
  try {
    if (typeof localStorage !== 'undefined') {
      let id = localStorage.getItem(DEVICE_STORAGE_KEY);
      if (!id) {
        id = generateId();
        localStorage.setItem(DEVICE_STORAGE_KEY, id);
      }
      return id;
    }
  } catch {
    // storage blocked -> fall through to session-scoped id
  }
  if (!sessionDeviceId) sessionDeviceId = generateId();
  return sessionDeviceId;
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Low-level PostgREST request.
 * @param {string} path - path after `/rest/v1` (e.g. `/wa_archives?select=*`)
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {any} [options.body] - JSON-serializable payload
 * @param {string} [options.prefer] - `Prefer` header value
 * @returns {Promise<any>} parsed JSON body or null
 * @throws {Error} on network failure or non-2xx response
 */
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'x-device-id': getDeviceId()
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  let signal;
  try {
    signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  } catch {
    signal = undefined; // older browser: no timeout
  }

  const res = await fetch(REST_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      // ignore body read errors
    }
    throw new Error(`Supabase ${method} ${path} gagal (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Convert an app archive-meta object into a `wa_archives` row (explicit whitelist
 * so unknown/extra meta keys can never produce a 400 from the API).
 * @param {object} meta
 * @returns {object}
 */
export function metaToRow(meta) {
  return {
    id: meta.id,
    deviceId: getDeviceId(),
    name: meta.name || '',
    fileName: meta.fileName || '',
    fingerprint: meta.fingerprint || '',
    ownerSender: meta.ownerSender || '',
    messageCount: Number(meta.messageCount) || 0,
    senders: Array.isArray(meta.senders) ? meta.senders : [],
    dates: Array.isArray(meta.dates) ? meta.dates : [],
    firstDate: meta.firstDate || null,
    lastDate: meta.lastDate || null,
    lastMessage: meta.lastMessage || '',
    lastSender: meta.lastSender || '',
    lastTimestamp: Number(meta.lastTimestamp) || 0,
    lastTime: meta.lastTime || '',
    stats: meta.stats && typeof meta.stats === 'object' ? meta.stats : {},
    updatedAt: Number(meta.updatedAt) || 0
  };
}

/**
 * Convert a `wa_archives` row back into the app's archive-meta shape.
 * @param {object} row
 * @returns {object}
 */
export function rowToMeta(row) {
  return {
    id: row.id,
    name: row.name || '',
    fileName: row.fileName || '',
    fingerprint: row.fingerprint || '',
    ownerSender: row.ownerSender || '',
    messageCount: Number(row.messageCount) || 0,
    senders: Array.isArray(row.senders) ? row.senders : [],
    dates: Array.isArray(row.dates) ? row.dates : [],
    firstDate: row.firstDate || '',
    lastDate: row.lastDate || '',
    lastMessage: row.lastMessage || '',
    lastSender: row.lastSender || '',
    lastTimestamp: Number(row.lastTimestamp) || 0,
    lastTime: row.lastTime || '',
    stats: row.stats && typeof row.stats === 'object' ? row.stats : {},
    updatedAt: Number(row.updatedAt) || 0
  };
}

/**
 * List every archive belonging to this device (newest first).
 * @returns {Promise<Array<object>>} raw rows
 */
export async function cloudListArchives() {
  const rows = await rest('/wa_archives?select=*&order=updatedAt.desc');
  return Array.isArray(rows) ? rows : [];
}

/**
 * Find archives on this device by content fingerprint (dedup on re-import).
 * @param {string} fingerprint
 * @returns {Promise<Array<object>>} raw rows
 */
export async function cloudFindArchivesByFingerprint(fingerprint) {
  const rows = await rest(
    `/wa_archives?fingerprint=eq.${encodeURIComponent(fingerprint)}&select=*`
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Upsert an archive: message chunks first, metadata last (see file header).
 * @param {object} meta - archive metadata (app shape)
 * @param {Array<object>} messages - full message array
 */
export async function cloudSaveArchive(meta, messages) {
  const row = metaToRow(meta);
  const list = Array.isArray(messages) ? messages : [];

  const chunkCount = Math.max(1, Math.ceil(list.length / MESSAGE_CHUNK_SIZE));

  // 1) Drop stale tail chunks from a previous, longer version of this archive.
  await rest(
    `/wa_messages?archiveId=eq.${encodeURIComponent(row.id)}&chunkIndex=gte.${chunkCount}`,
    { method: 'DELETE', prefer: 'return=minimal' }
  );

  // 2) Upsert message chunks in small batches.
  const chunkRows = [];
  for (let i = 0; i < chunkCount; i++) {
    chunkRows.push({
      archiveId: row.id,
      chunkIndex: i,
      deviceId: row.deviceId,
      messages: list.slice(i * MESSAGE_CHUNK_SIZE, (i + 1) * MESSAGE_CHUNK_SIZE)
    });
  }
  for (let i = 0; i < chunkRows.length; i += MAX_CHUNKS_PER_REQUEST) {
    const batch = chunkRows.slice(i, i + MAX_CHUNKS_PER_REQUEST);
    await rest('/wa_messages', {
      method: 'POST',
      body: batch,
      prefer: 'resolution=merge-duplicates,return=minimal'
    });
  }

  // 3) Metadata last — its `updatedAt` acts as the "chunks are complete" marker.
  await rest('/wa_archives', {
    method: 'POST',
    body: row,
    prefer: 'resolution=merge-duplicates,return=minimal'
  });
}

/**
 * Read all messages of an archive (chunks concatenated in order).
 * @param {string} archiveId
 * @returns {Promise<Array<object>>} message array (empty when archive not in cloud)
 */
export async function cloudGetMessages(archiveId) {
  const rows = await rest(
    `/wa_messages?archiveId=eq.${encodeURIComponent(archiveId)}` +
      '&select=chunkIndex,messages&order=chunkIndex.asc'
  );
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out = [];
  for (const r of rows) {
    if (Array.isArray(r.messages)) out.push(...r.messages);
  }
  return out;
}

/**
 * Check whether the cloud has any message chunk for an archive.
 * @param {string} archiveId
 * @returns {Promise<boolean>}
 */
export async function cloudHasMessages(archiveId) {
  const rows = await rest(
    `/wa_messages?archiveId=eq.${encodeURIComponent(archiveId)}&select=chunkIndex&limit=1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Patch archive metadata. Returns false when the row does not exist in the
 * cloud yet (caller may then push the full archive instead).
 * @param {string} archiveId
 * @param {object} updates - partial meta (camelCase keys = column names)
 * @returns {Promise<boolean>} true when a row was updated
 */
export async function cloudUpdateMeta(archiveId, updates) {
  const patch = { ...updates };
  delete patch.id;
  delete patch.deviceId;
  if (Object.keys(patch).length === 0) return false;

  const rows = await rest(`/wa_archives?id=eq.${encodeURIComponent(archiveId)}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation'
  });
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Delete an archive's metadata and all of its message chunks.
 * @param {string} archiveId
 */
export async function cloudDeleteArchive(archiveId) {
  const id = encodeURIComponent(archiveId);
  // Messages first so a mid-way failure never leaves the meta pointing at stale chunks.
  await rest(`/wa_messages?archiveId=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  await rest(`/wa_archives?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
}

/**
 * Delete every archive + message chunk owned by this device.
 */
export async function cloudClearAll() {
  const device = encodeURIComponent(getDeviceId());
  await rest(`/wa_messages?deviceId=eq.${device}`, { method: 'DELETE', prefer: 'return=minimal' });
  await rest(`/wa_archives?deviceId=eq.${device}`, { method: 'DELETE', prefer: 'return=minimal' });
}
