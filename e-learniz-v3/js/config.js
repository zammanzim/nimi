// ============================================================
// CONFIG — e-learniz-v3
// Key di bawah ini ANON (publik, aman di frontend).
// Jangan taruh service_role di sini.
// ============================================================
const V3_SUPABASE_URL = "https://vttmwtlqzbbiaromohrp.supabase.co";
const V3_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dG13dGxxemJiaWFyb21vaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg4NTMsImV4cCI6MjA4MDg0NDg1M30.16SwOEqD5ZNAgk1oWhLrL41Eqw4kkeAKTyHxkSqmpiY";

// Kunci localStorage
const V3_USER_KEY = "v3_user"; // identitas siswa/staff yang sedang aktif

// Alias username staf -> email Supabase Auth.
// Login staf WAJIB lewat Supabase Auth; alias ini cuma memudahkan guru
// mengetik nama pendek. Tambahkan alias lain di sini kalau perlu.
const V3_STAFF_EMAIL_ALIASES = {
  nizam: "mizammm@e-learniz.my.id"
};

// Semua perhitungan tanggal/jam memakai WIB (lihat js/time.js).
const V3_TIMEZONE = "Asia/Jakarta";

// ── MEDIA (Cloudflare R2) ─────────────────────────────────────
// Foto lampiran card SIMPAN DI R2, bukan Supabase Storage — pola sama
// kyk OSIS TARPAN ONE: browser minta presigned URL ke Worker, terus
// PUT/DELETE langsung ke R2. Secret R2 cuma ada di Worker.
//   browser ──POST /presign──▶ Worker ──{url,publicUrl}──▶ browser
//   browser ──PUT────────────▶ R2        baca ──GET──▶ custom domain
// Ganti 2 URL di bawah kalo worker / domain R2-nya pindah.
const V3_R2_PUBLIC_BASE = "https://media-v3.e-learniz.my.id";                       // custom domain bucket R2
const V3_R2_PRESIGN_URL = "https://elearniz-media-presign.nizzcuy.workers.dev/presign"; // Worker penerbit presigned URL
const V3_R2_ENABLED = true; // false = upload mati (baca URL lama tetap jalan)

// Kelas default buat tamu (slug dari nama kelas, mis. "XI - RPL 2" → xirpl2).
// ?class=slug di URL bisa override.
const V3_DEFAULT_CLASS_SLUG = "xirpl2";
