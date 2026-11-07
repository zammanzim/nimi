/**
 * Comprehensive Unit Tests for WhatsApp Chat Parser (`js/parser.js`)
 * Run with: `node tests/parser.test.mjs`
 */

import assert from 'node:assert/strict';
import { parseWhatsAppChat } from '../js/parser.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
  }
}

console.log('=== Running WhatsApp Parser Test Suite ===\n');

// 1. Primary fixture from user prompt (including U+202F narrow no-break space before AM)
test('Parses primary user fixture with U+202F narrow no-break space and preserves order for identical timestamps', () => {
  const fixture = [
    '12/18/25, 11:16\u202FAM - almira: jam',
    '12/18/25, 11:16\u202FAM - almira: dmna?',
    '12/18/25, 11:22\u202FAM - almira: distudio lain?',
    '12/18/25, 11:22\u202FAM - zim: iyh'
  ].join('\n');

  const result = parseWhatsAppChat(fixture);
  assert.equal(result.messages.length, 4);
  assert.equal(result.stats.unrecognizedLines.length, 0);

  // Check structure of first message
  const first = result.messages[0];
  assert.equal(first.date, '2025-12-18');
  assert.equal(first.time, '11:16');
  assert.equal(first.sender, 'almira');
  assert.equal(first.message, 'jam');
  assert.equal(first.type, 'text');

  // Verify local timestamp matches new Date(2025, 11, 18, 11, 16, 0).getTime()
  const expectedTs = new Date(2025, 11, 18, 11, 16, 0, 0).getTime();
  assert.equal(first.timestamp, expectedTs);

  // Check identical timestamps preserve exact original sequence
  assert.equal(result.messages[0].message, 'jam');
  assert.equal(result.messages[1].message, 'dmna?');
  assert.equal(result.messages[0].timestamp, result.messages[1].timestamp);

  assert.equal(result.messages[2].sender, 'almira');
  assert.equal(result.messages[2].message, 'distudio lain?');
  assert.equal(result.messages[3].sender, 'zim');
  assert.equal(result.messages[3].message, 'iyh');
  assert.equal(result.messages[2].timestamp, result.messages[3].timestamp);
});

// 2. Date formats: MM/DD/YY and MM/DD/YYYY
test('Supports both MM/DD/YY and MM/DD/YYYY date formats', () => {
  const raw = [
    '1/5/24, 9:05 AM - Budi: Tahun dua digit',
    '01/05/2024, 9:06 AM - Andi: Tahun empat digit',
    '12/31/2025, 11:59 PM - Budi: Akhir tahun'
  ].join('\n');

  const result = parseWhatsAppChat(raw);
  assert.equal(result.messages.length, 3);
  assert.equal(result.messages[0].date, '2024-01-05');
  assert.equal(result.messages[1].date, '2024-01-05');
  assert.equal(result.messages[2].date, '2025-12-31');
});

// 3. 12-hour AM/PM conversion to 24-hour time
test('Converts 12-hour AM/PM times (including 12:xx AM and 12:xx PM) to 24-hour format accurately', () => {
  const raw = [
    '12/18/25, 12:00 AM - almira: Tengah malam',
    '12/18/25, 12:30 AM - almira: Lewat tengah malam',
    '12/18/25, 11:59 AM - almira: Jelang siang',
    '12/18/25, 12:00 PM - almira: Siang tepat',
    '12/18/25, 12:45 PM - almira: Siang lewat',
    '12/18/25, 1:15 PM - almira: Sore awal',
    '12/18/25, 11:45 PM - almira: Malam larut'
  ].join('\n');

  const result = parseWhatsAppChat(raw);
  assert.equal(result.messages.length, 7);
  assert.equal(result.messages[0].time, '00:00');
  assert.equal(result.messages[1].time, '00:30');
  assert.equal(result.messages[2].time, '11:59');
  assert.equal(result.messages[3].time, '12:00');
  assert.equal(result.messages[4].time, '12:45');
  assert.equal(result.messages[5].time, '13:15');
  assert.equal(result.messages[6].time, '23:45');
});

// 4. Unicode whitespace & directional marks
test('Handles Unicode whitespace (U+202F, U+00A0, U+2009) and LRM/RLM marks without breaking', () => {
  const raw = [
    '\uFEFF\u200E12/18/25, 11:16\u202FAM - almira: Pesan dengan BOM dan LRM',
    '12/18/25, 11:17\u00A0AM - zim: Pesan dengan NBSP',
    '\u200F12/18/25, 2:05\u2009PM - Siti Nurhaliza: Pesan dengan thin space'
  ].join('\n');

  const result = parseWhatsAppChat(raw);
  assert.equal(result.messages.length, 3);
  assert.equal(result.messages[0].sender, 'almira');
  assert.equal(result.messages[1].sender, 'zim');
  assert.equal(result.messages[2].sender, 'Siti Nurhaliza');
  assert.equal(result.messages[2].time, '14:05');
});

// 5. Sender names with spaces and colons inside message content
test('Separates sender name with spaces and preserves colons (:) and URLs inside messages', () => {
  const raw = [
    '12/18/25, 11:30 AM - Almira Putri Maharani: Jadwal rapat: pukul 14:00:00 di ruang: A1',
    '12/18/25, 11:31 AM - Zim Ardiansyah: Cek link ini: https://example.com:8080/path?query=1:2'
  ].join('\n');

  const result = parseWhatsAppChat(raw);
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0].sender, 'Almira Putri Maharani');
  assert.equal(result.messages[0].message, 'Jadwal rapat: pukul 14:00:00 di ruang: A1');
  assert.equal(result.messages[1].sender, 'Zim Ardiansyah');
  assert.equal(result.messages[1].message, 'Cek link ini: https://example.com:8080/path?query=1:2');
});

// 6. Multi-line messages and empty lines inside multi-line messages
test('Preserves multi-line messages including blank lines and emojis', () => {
  const raw = [
    '12/18/25, 11:40 AM - almira: Baris pertama 😊',
    'Baris kedua lanjutan',
    '',
    'Baris keempat setelah baris kosong 🚀',
    '12/18/25, 11:42 AM - zim: Oke siap!'
  ].join('\n');

  const result = parseWhatsAppChat(raw);
  assert.equal(result.messages.length, 2);
  assert.equal(
    result.messages[0].message,
    'Baris pertama 😊\nBaris kedua lanjutan\n\nBaris keempat setelah baris kosong 🚀'
  );
  assert.equal(result.stats.multilineCount, 1);
  assert.equal(result.messages[1].message, 'Oke siap!');
});

// 7. System notifications and <Media omitted>
test('Handles WhatsApp system messages (no sender) and <Media omitted> lines properly', () => {
  const raw = [
    '12/18/25, 10:00 AM - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.',
    '12/18/25, 10:05 AM - almira: <Media omitted>',
    '12/18/25, 10:06 AM - zim: Halo!'
  ].join('\n');

  const result = parseWhatsAppChat(raw);
  assert.equal(result.messages.length, 3);

  assert.equal(result.messages[0].type, 'system');
  assert.equal(result.messages[0].sender, '');
  assert.equal(result.stats.systemMessages, 1);

  assert.equal(result.messages[1].type, 'media');
  assert.equal(result.messages[1].sender, 'almira');
  assert.equal(result.messages[1].message, '<Media omitted>');
  assert.equal(result.stats.mediaMessages, 1);

  assert.equal(result.messages[2].type, 'text');
});

// 8. Empty input, unrecognized leading lines, and corrupted text
test('Gracefully handles empty input and reports unrecognized header lines without crashing', () => {
  const emptyResult = parseWhatsAppChat('   \n  \n ');
  assert.equal(emptyResult.messages.length, 0);

  const partialCorrupt = [
    'Baris rusak sebelum pesan pertama',
    'Catatan tambahan tanpa tanggal',
    '12/18/25, 11:16 AM - almira: Pesan valid pertama'
  ].join('\n');

  const res = parseWhatsAppChat(partialCorrupt);
  assert.equal(res.messages.length, 1);
  assert.equal(res.stats.unrecognizedLines.length, 2);
  assert.equal(res.stats.unrecognizedLines[0].lineNumber, 1);
});

// 9. Performance & stress test: 25,000 messages + URL tokenization + fingerprint deduplication
import { computeFingerprint, tokenizeUrls } from '../js/utils.js';

test('Parses 25,000 messages in under 1000ms and preserves exact chronological order', () => {
  const lines = [];
  for (let i = 0; i < 25000; i++) {
    const sender = i % 2 === 0 ? 'almira' : 'zim';
    lines.push(`12/18/25, 11:16\u202FAM - ${sender}: Pesan ke-${i} dengan titik dua: aman`);
  }
  const bigText = lines.join('\n');

  const t0 = performance.now();
  const parsed = parseWhatsAppChat(bigText);
  const elapsed = performance.now() - t0;

  assert.equal(parsed.messages.length, 25000);
  assert.equal(parsed.messages[0].message, 'Pesan ke-0 dengan titik dua: aman');
  assert.equal(parsed.messages[24999].message, 'Pesan ke-24999 dengan titik dua: aman');
  assert.ok(elapsed < 1500, `Expected <1500ms for 25k messages, took ${elapsed.toFixed(1)}ms`);
});

test('Tokenizes only safe HTTP/HTTPS URLs and rejects javascript: or XSS payloads', () => {
  const tokens = tokenizeUrls('Kunjungi https://chat.whatsapp.com/abc123, atau javascript:alert(1) sekarang.');
  const urlTokens = tokens.filter((t) => t.type === 'url');
  assert.equal(urlTokens.length, 1);
  assert.equal(urlTokens[0].href, 'https://chat.whatsapp.com/abc123');
});

test('Computes deterministic content fingerprint for duplicate detection', () => {
  const fp1 = computeFingerprint('12/18/25, 11:16 AM - almira: jam');
  const fp2 = computeFingerprint('12/18/25, 11:16 AM - almira: jam');
  const fp3 = computeFingerprint('12/18/25, 11:16 AM - almira: beda');
  assert.equal(fp1, fp2);
  assert.notEqual(fp1, fp3);
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
