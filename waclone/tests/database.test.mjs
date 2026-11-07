/**
 * Integration Tests for the hybrid storage layer (`js/database.js`)
 *
 * - IndexedDB is replaced with a small in-memory fake (below) so the test runs
 *   anywhere without a browser.
 * - The Supabase part runs against the live API using a throwaway device id and
 *   cleans up after itself.
 * - A fetch interceptor simulates going offline to verify the fallback path,
 *   offline saves, sync-on-reconnect, and pending-delete retry.
 *
 * Requirements: Node.js 18+ (global fetch) and network access.
 *
 * Run with: node tests/database.test.mjs
 */

import assert from 'node:assert/strict';

/* ==========================================================================
   Minimal in-memory IndexedDB fake (only the API surface database.js uses)
   ========================================================================== */

class FakeRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}

class FakeStore {
  constructor(keyPath) {
    this.keyPath = keyPath;
    this.map = new Map();
  }
  put(value) {
    this.map.set(value[this.keyPath], value);
    return value[this.keyPath];
  }
  get(key) {
    return this.map.has(key) ? this.map.get(key) : undefined;
  }
  getAll() {
    return Array.from(this.map.values());
  }
  delete(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
  getAllByIndex(indexName, value) {
    return this.getAll().filter((row) => row[indexName] === value);
  }
}

class FakeTransaction {
  constructor(db, storeNames) {
    this.db = db;
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    this.pending = 0;
    this.error = null;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this._completionScheduled = false;
    this._completed = false;
  }

  objectStore(name) {
    if (!this.storeNames.includes(name)) {
      throw new Error(`Store "${name}" tidak termasuk dalam transaksi`);
    }
    const store = this.db.stores.get(name);
    if (!store) throw new Error(`Store "${name}" tidak ditemukan`);
    const tx = this;
    return {
      put: (value) => tx._request(() => store.put(value)),
      get: (key) => tx._request(() => store.get(key)),
      getAll: () => tx._request(() => store.getAll()),
      delete: (key) => tx._request(() => store.delete(key)),
      clear: () => tx._request(() => store.clear()),
      index: (indexName) => ({
        getAll: (value) => tx._request(() => store.getAllByIndex(indexName, value))
      })
    };
  }

  _request(operation) {
    const req = new FakeRequest();
    this.pending++;
    setTimeout(() => {
      try {
        req.result = operation();
        if (req.onsuccess) req.onsuccess({ target: req });
      } catch (err) {
        req.error = err;
        if (req.onerror) req.onerror({ target: req });
      } finally {
        this.pending--;
        this._scheduleCompletion();
      }
    }, 0);
    return req;
  }

  _scheduleCompletion() {
    if (this.pending !== 0 || this._completionScheduled || this._completed) return;
    this._completionScheduled = true;
    setTimeout(() => {
      this._completed = true;
      if (this.oncomplete) this.oncomplete({ target: this });
    }, 0);
  }
}

class FakeDatabase {
  constructor() {
    this.stores = new Map();
    this.objectStoreNames = { contains: (n) => this.stores.has(n) };
    this.onversionchange = null;
  }
  createObjectStore(name, options = {}) {
    const store = new FakeStore(options.keyPath);
    this.stores.set(name, store);
    return { createIndex: () => ({}) };
  }
  transaction(storeNames, mode) {
    void mode;
    return new FakeTransaction(this, storeNames);
  }
  close() {}
}

function installFakeIndexedDB() {
  const dbs = new Map();
  globalThis.window = globalThis;
  globalThis.indexedDB = {
    open(name) {
      const req = new FakeRequest();
      req.onupgradeneeded = null;
      setTimeout(() => {
        let db = dbs.get(name);
        const isNew = !db;
        if (isNew) {
          db = new FakeDatabase();
          dbs.set(name, db);
        }
        req.result = db;
        if (isNew && req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess({ target: req });
      }, 0);
      return req;
    }
  };
}

/* ==========================================================================
   Browser globals for the module under test
   ========================================================================== */

const fakeStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (fakeStorage.has(k) ? fakeStorage.get(k) : null),
  setItem: (k, v) => fakeStorage.set(k, String(v)),
  removeItem: (k) => fakeStorage.delete(k)
};

installFakeIndexedDB();

const TEST_DEVICE_ID = `waclone-dbtest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
fakeStorage.set('waclone_device_id', TEST_DEVICE_ID);

const db = await import('../js/database.js');
const cloud = await import('../js/supabase-store.js');

// --- Offline switch: reject every network call while `offline` is true -------
const realFetch = globalThis.fetch.bind(globalThis);
let offline = false;
globalThis.fetch = (...args) => {
  if (offline) return Promise.reject(new TypeError('fetch failed (simulated offline)'));
  return realFetch(...args);
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
  }
}

function makeMeta(overrides = {}) {
  return {
    id: `arch-db-${Math.random().toString(36).slice(2, 10)}`,
    name: 'DB Test',
    fileName: 'WhatsApp Chat with DB Test.txt',
    fingerprint: `fp-db-${Math.random().toString(36).slice(2, 12)}`,
    ownerSender: 'zim',
    messageCount: 2,
    senders: [
      { name: 'zim', count: 1 },
      { name: 'almira', count: 1 }
    ],
    dates: ['2025-12-18'],
    firstDate: '2025-12-18',
    lastDate: '2025-12-18',
    lastMessage: 'halo',
    lastSender: 'zim',
    lastTimestamp: 1766030400000,
    lastTime: '11:16',
    stats: { totalLines: 2, parsedMessages: 2, systemMessages: 0, mediaMessages: 0, multilineCount: 0, unrecognizedLines: [] },
    updatedAt: Date.now(),
    ...overrides
  };
}

function makeMessages(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: `msg-${i}`,
      date: '2025-12-18',
      timestamp: 1766030400000 + i * 1000,
      time: '11:16',
      sender: i % 2 === 0 ? 'almira' : 'zim',
      message: `Pesan ke-${i}`,
      type: 'text'
    });
  }
  return out;
}

console.log('=== Running Hybrid Database Layer Test Suite ===');
console.log(`Device: ${TEST_DEVICE_ID}\n`);

const metaOnline = makeMeta({ name: 'Online Archive' });
const metaOffline = makeMeta({ name: 'Offline Archive', fileName: 'offline.txt' });
const metaLater = makeMeta({ name: 'Later Archive', fileName: 'later.txt' });
const messagesOnline = makeMessages(750); // spans 2 chunks (750 > 500)

try {
  await db.openDatabase();

  await test('saveArchiveWithMessages online reports cloud:true and is readable back', async () => {
    const res = await db.saveArchiveWithMessages(metaOnline, messagesOnline, { syncToCloud: true });
    assert.equal(res.cloud, true);

    const list = await db.getAllArchives();
    const found = list.find((a) => a.id === metaOnline.id);
    assert.ok(found, 'arsip online harus muncul di getAllArchives');

    const msgs = await db.getArchiveMessages(metaOnline.id);
    assert.equal(msgs.length, 750);
    assert.equal(msgs[749].message, messagesOnline[749].message);
  });

  await test('findExistingArchive dedupes using the cloud fingerprint index', async () => {
    const hit = await db.findExistingArchive(metaOnline.fingerprint, metaOnline.fileName);
    assert.ok(hit, 'fingerprint harus ditemukan');
    assert.equal(hit.id, metaOnline.id);
    assert.equal(hit.name, 'Online Archive');
  });

  await test('while offline: save falls back to IndexedDB (cloud:false) and stays usable', async () => {
    offline = true;
    try {
      const res = await db.saveArchiveWithMessages(metaOffline, makeMessages(3));
      assert.equal(res.cloud, false, 'save offline harus melaporkan cloud:false');

      const list = await db.getAllArchives();
      assert.ok(list.find((a) => a.id === metaOffline.id), 'arsip offline tetap terdaftar');

      const msgs = await db.getArchiveMessages(metaOffline.id);
      assert.equal(msgs.length, 3, 'pesan offline terbaca dari fallback lokal');

      const hit = await db.findExistingArchive(metaOffline.fingerprint, metaOffline.fileName);
      assert.ok(hit, 'dedup tetap bekerja saat offline (jalur lokal)');
    } finally {
      offline = false;
    }
  });

  await test('syncWithCloud pushes archives that were created while offline', async () => {
    const result = await db.syncWithCloud();
    assert.equal(result.ok, true);
    assert.ok(result.pushed >= 1, `expected pushed >= 1, got ${result.pushed}`);

    const rows = await cloud.cloudListArchives();
    const pushed = rows.find((r) => r.id === metaOffline.id);
    assert.ok(pushed, 'arsip offline harus sudah ada di Supabase setelah sync');
    assert.equal(pushed.name, 'Offline Archive');

    // and its messages made it to the cloud too
    const msgs = await cloud.cloudGetMessages(metaOffline.id);
    assert.equal(msgs.length, 3);
  });

  await test('updateArchiveMeta updates both local and cloud copies', async () => {
    const updated = await db.updateArchiveMeta(metaOnline.id, { name: 'Online Renamed' });
    assert.ok(updated);
    assert.equal(updated.name, 'Online Renamed');

    const rows = await cloud.cloudListArchives();
    const remote = rows.find((r) => r.id === metaOnline.id);
    assert.equal(remote.name, 'Online Renamed');
  });

  await test('deleting while offline is remembered: no resurrection, retried on next sync', async () => {
    offline = true;
    try {
      await db.deleteArchive(metaOnline.id);
    } finally {
      offline = false;
    }

    // Cloud still has it (delete failed), but the app must not show it.
    const rowsBefore = await cloud.cloudListArchives();
    assert.ok(rowsBefore.find((r) => r.id === metaOnline.id), 'pre kondisi: cloud masih punya arsip');

    const list = await db.getAllArchives();
    assert.equal(list.find((a) => a.id === metaOnline.id), undefined, 'arsip terhapus tidak boleh muncul lagi');

    const result = await db.syncWithCloud();
    assert.ok(result.deleted >= 1, `expected deleted >= 1, got ${result.deleted}`);

    const rowsAfter = await cloud.cloudListArchives();
    assert.equal(rowsAfter.find((r) => r.id === metaOnline.id), undefined, 'sync harus menghapusnya dari cloud');
  });

  await test('clearAllData while offline wipes local data and sync removes the cloud rows', async () => {
    // metaLater exists only in the cloud+local from an earlier sync; make sure it is local too.
    await db.saveArchiveWithMessages(metaLater, makeMessages(2));

    offline = true;
    try {
      await db.clearAllData();
    } finally {
      offline = false;
    }

    const localAfter = await db.getAllArchives();
    assert.equal(localAfter.length, 0, 'data lokal harus kosong setelah clear');

    const result = await db.syncWithCloud();
    assert.ok(result.deleted >= 1, `pending clear harus dihapus saat sync (deleted=${result.deleted})`);

    const rows = await cloud.cloudListArchives();
    assert.equal(rows.length, 0, 'cloud device ini harus kosong setelah sync');
  });

  await test('getSetting/setSetting store device-local preferences', async () => {
    await db.setSetting('preferredOwnerSender', 'zim');
    assert.equal(await db.getSetting('preferredOwnerSender', null), 'zim');
    assert.equal(await db.getSetting('tidak-ada', 'default'), 'default');
  });
} finally {
  offline = false;
  try {
    await cloud.cloudClearAll();
  } catch {
    // ignore cleanup errors
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
