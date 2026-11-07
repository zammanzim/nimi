// ============================================================
// CONFIG — EXAM standalone (C:/nimi/exam)
// DB: Supabase (tabel exam_*). Media: R2-ready ala osistarpanone.
// - R2_ENABLED=true -> baca via R2_PUBLIC_BASE, upload via presigned
//   URL dari Worker (R2_PRESIGN_URL). Secret ga pernah di frontend.
//   DB nyimpen PATH RELATIF (mis. kisi/abc.jpg).
// Bucket: exam | Domain: https://media.e-learniz.my.id (live 2026-10-04)
// ============================================================

const SUPABASE_URL = "https://vttmwtlqzbbiaromohrp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dG13dGxxemJiaWFyb21vaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg4NTMsImV4cCI6MjA4MDg0NDg1M30.16SwOEqD5ZNAgk1oWhLrL41Eqw4kkeAKTyHxkSqmpiY";

// Bucket Supabase lama — JANGAN DIPAKAI (usage bengkak).
// Dibiarkan di sini biar url() tetap bisa baca URL absolut lama
// selama masa transisi migrasi ke R2. Upload SELALU ke R2.
const SB_BUCKET = "exam-media";

// --- R2 (live full: baca + upload via worker) ---
const R2_ENABLED = true;
const R2_PUBLIC_BASE = "https://media.e-learniz.my.id";
const R2_PRESIGN_URL = "https://exam-media-presign.nizzcuy.workers.dev/presign";
