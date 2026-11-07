/**
 * Integration Tests for the Supabase cloud layer (`js/supabase-store.js`)
 *
 * Runs against the live Supabase project using a throwaway device id, so it
 * verifies the real REST API + RLS policies end-to-end. All rows created by this
 * test are removed afterwards (cleanup runs even when a test fails).
 *
 * Requirements: Node.js 18+ (global fetch) and network access.
 *
 * Run with: node tests/supabase.test.mjs
 */

import assert from 'node:assert/strict';

// --- Minimal browser globals used by the module under test -------------------
const fakeStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (fakeStorage.has(k) ? fakeStorage.get(k) : null),
  setItem: (k, v) => fakeStorage.set(k, String(v)),
  removeItem: (k) => fakeStorage.delete(k)
};

const TEST_DEVICE_ID = `waclone-test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
fakeStorage.set('waclone_device_id', TEST_DEVICE_ID);

const {
  cloudListArchives,
  cloudFindArchivesByFingerprint,
  cloudSaveArchive,
  cloudGetMessages,
  cloudHasMessages,
  cloudUpdateMeta,
  cloudDeleteArchive,
  cloudClearAll,
  getDeviceId,
  setDeviceId,
  generateNewDeviceId,
  metaToRow,
  rowToMeta,
  MESSAGE_CHUNK_SIZE
} = await import('../js/supabase-store.js');

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
    id: `arch-test-${Math.random().toString(36).slice(2, 10)}`,
    name: 'Cloud Test',
    fileName: 'WhatsApp Chat with Cloud Test.txt',
    fingerprint: `fp-${Math.random().toString(36).slice(2, 12)}`,
    ownerSender: 'zim',
    messageCount: 0,
    senders: [
      { name: 'zim', count: 1 },
      { name: 'almira', count: 1 }
    ],
    dates: ['2025-12-18'],
    firstDate: '2025-12-18',
    lastDate: '2025-12-18',
    lastMessage: '',
    lastSender: 'zim',
    lastTimestamp: 1766030400000,
    lastTime: '11:16',
    stats: { totalLines: 0, parsedMessages: 0, systemMessages: 0, mediaMessages: 0, multilineCount: 0, unrecognizedLines: [] },
    updatedAt: Date.now(),
    ...overrides
  };
}

function makeMessages(count, offset = 0) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = i + offset;
    out.push({
      id: `msg-${n}`,
      date: '2025-12-18',
      timestamp: 1766030400000 + n * 1000,
      time: '11:16',
      sender: n % 2 === 0 ? 'almira' : 'zim',
      message: `Pesan ke-${n}: isi pesan untuk pengujian roundtrip cloud.`,
      type: 'text'
    });
  }
  return out;
}

console.log('=== Running Supabase Cloud Layer Test Suite ===');
console.log(`Device: ${TEST_DEVICE_ID}\n`);

try {
  await test('getDeviceId() returns the persisted device id', () => {
    assert.equal(getDeviceId(), TEST_DEVICE_ID);
  });

  await test('setDeviceId() updates active id and persists, generateNewDeviceId() creates new unique id', () => {
    const prev = getDeviceId();
    const customKey = 'custom-device-sync-key-123';
    const updated = setDeviceId(customKey);
    assert.equal(updated, customKey);
    assert.equal(getDeviceId(), customKey);
    assert.equal(fakeStorage.get('waclone_device_id'), customKey);

    const generated = generateNewDeviceId();
    assert.ok(generated && generated !== customKey);
    assert.equal(getDeviceId(), generated);

    // restore original test id
    setDeviceId(prev);
  });

  await test('metaToRow/rowToMeta roundtrip preserves the archive meta shape', () => {
    const meta = makeMeta();
    const row = rowToMeta(metaToRow(meta));
    assert.deepEqual(row, meta);
    // deviceId must never leak into the app-facing meta
    assert.equal(Object.hasOwn(row, 'deviceId'), false);
  });

  const metaA = makeMeta();
  const messagesA = makeMessages(1200); // spans multiple chunks (1200 > 500)

  await test('cloudSaveArchive stores 1200 messages across chunks and lists the archive', async () => {
    await cloudSaveArchive(metaA, messagesA);
    const rows = await cloudListArchives();
    const found = rows.find((r) => r.id === metaA.id);
    assert.ok(found, 'archive harus muncul di cloudListArchives');
    assert.equal(found.name, metaA.name);
    assert.ok(messagesA.length / MESSAGE_CHUNK_SIZE > 1, 'fixture harus lebih dari satu chunk');
  });

  await test('cloudGetMessages returns all messages in original order', async () => {
    const msgs = await cloudGetMessages(metaA.id);
    assert.equal(msgs.length, 1200);
    assert.equal(msgs[0].message, messagesA[0].message);
    assert.equal(msgs[1199].message, messagesA[1199].message);
    assert.equal(msgs[600].id, messagesA[600].id);
  });

  await test('cloudHasMessages detects an archive that exists in the cloud', async () => {
    assert.equal(await cloudHasMessages(metaA.id), true);
    assert.equal(await cloudHasMessages('arch-tidak-ada'), false);
  });

  await test('cloudFindArchivesByFingerprint finds the archive for dedup', async () => {
    const rows = await cloudFindArchivesByFingerprint(metaA.fingerprint);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, metaA.id);
    const none = await cloudFindArchivesByFingerprint('fp-yang-tidak-ada-sama-sekali');
    assert.equal(none.length, 0);
  });

  await test('shrinking an archive removes stale message chunks', async () => {
    const shorter = makeMessages(600); // 600 -> exactly 2 chunks; chunk index 2 must go
    await cloudSaveArchive(metaA, shorter);
    const msgs = await cloudGetMessages(metaA.id);
    assert.equal(msgs.length, 600);
    assert.equal(msgs[599].message, shorter[599].message);
  });

  await test('cloudUpdateMeta patches metadata and reports success', async () => {
    const ok = await cloudUpdateMeta(metaA.id, { name: 'Cloud Test Renamed', updatedAt: Date.now() });
    assert.equal(ok, true);
    const rows = await cloudListArchives();
    assert.equal(rows.find((r) => r.id === metaA.id)?.name, 'Cloud Test Renamed');
    const missing = await cloudUpdateMeta('arch-tidak-ada', { name: 'x' });
    assert.equal(missing, false);
  });

  await test('an archive with zero messages still reports as existing in cloud', async () => {
    const emptyMeta = makeMeta({ name: 'Empty Chat' });
    await cloudSaveArchive(emptyMeta, []);
    const msgs = await cloudGetMessages(emptyMeta.id);
    assert.equal(msgs.length, 0);
    assert.equal(await cloudHasMessages(emptyMeta.id), true);
    await cloudDeleteArchive(emptyMeta.id);
  });

  await test('a different device id cannot see this device\'s rows (RLS)', async () => {
    const own = TEST_DEVICE_ID;
    fakeStorage.set('waclone_device_id', `${own}-intruder`);
    try {
      const rows = await cloudListArchives();
      assert.equal(rows.length, 0, 'device lain tidak boleh melihat arsip kita');
      const msgs = await cloudGetMessages(metaA.id);
      assert.equal(msgs.length, 0, 'device lain tidak boleh membaca pesan kita');
    } finally {
      fakeStorage.set('waclone_device_id', own);
    }
  });

  await test('cloudDeleteArchive removes both the meta and its message chunks', async () => {
    await cloudDeleteArchive(metaA.id);
    const rows = await cloudListArchives();
    assert.equal(rows.find((r) => r.id === metaA.id), undefined);
    assert.equal(await cloudHasMessages(metaA.id), false);
  });

  await test('cloudClearAll wipes every row owned by this device', async () => {
    const m1 = makeMeta({ name: 'Clear 1' });
    const m2 = makeMeta({ name: 'Clear 2' });
    await cloudSaveArchive(m1, makeMessages(3));
    await cloudSaveArchive(m2, makeMessages(3));
    assert.equal((await cloudListArchives()).length, 2);
    await cloudClearAll();
    assert.equal((await cloudListArchives()).length, 0);
    assert.equal(await cloudHasMessages(m1.id), false);
    assert.equal(await cloudHasMessages(m2.id), false);
  });
} finally {
  // Best-effort cleanup of anything the suite may have left behind.
  try {
    await cloudClearAll();
  } catch {
    // ignore
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
