// tools/migrate-exam-r2.mjs — pindahin lampiran exam_media
// dari Supabase Storage -> R2. Path DB jadi relatif (kisi/...).
// Idempotent: key deterministik (m<id>-<nama>), yang udah ada di-skip.
//
// PAKAI (PowerShell):
//   cd C:\nimi\exam\tools
//   npm init -y; npm i @aws-sdk/client-s3
//   $env:SUPABASE_URL="https://vttmwtlqzbbiaromohrp.supabase.co"
//   $env:SUPABASE_ANON_KEY="<anon key>"
//   $env:R2_ENDPOINT="https://<ACCOUNT>.r2.cloudflarestorage.com"
//   $env:R2_BUCKET="exam-media"
//   $env:R2_ACCESS_KEY="<r2 access>"
//   $env:R2_SECRET_KEY="<r2 secret>"
//   $env:DRY_RUN="1"; node migrate-exam-r2.mjs   # cek dulu
//   $env:DRY_RUN="0"; node migrate-exam-r2.mjs   # gas
//
// Abis beres + verifikasi baca via R2: hapus file lama di bucket
// Supabase `subject-photos` biar usage turun.

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET || "exam-media";
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const DRY_RUN = (process.env.DRY_RUN || "1") === "1";

for (const [nama, val] of Object.entries({
  SUPABASE_URL, SUPABASE_ANON_KEY, R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY,
})) {
  if (!val) { console.error(`ENV hilang: ${nama}`); process.exit(1); }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  forcePathStyle: false,
});

const rest = async (path, opts = {}) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`REST ${r.status}: ${await r.text()}`);
  return r.json();
};

const CT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword", mp4: "video/mp4" };

const hasil = { total: 0, disalin: 0, dilewati: 0, gagal: 0, gagalDaftar: [] };

const rows = await rest("exam_media?select=id,kisi_id,path&order=id");
console.log(`total baris exam_media: ${rows.length}${DRY_RUN ? " (DRY RUN)" : ""}`);

for (const [i, m] of rows.entries()) {
  const tag = `[${i + 1}/${rows.length}]`;
  hasil.total++;
  const p = String(m.path || "");
  if (!/^https?:/i.test(p)) {
    console.log(`  ${tag} SKIP (sudah relatif): ${p}`);
    hasil.dilewati++;
    continue;
  }
  try {
    const base = decodeURIComponent(p.split("?")[0].split("/").pop() || "file")
      .toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-").slice(-80) || "file";
    const key = `kisi/m${m.id}-${base}`;
    let ada = false;
    try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); ada = true; }
    catch { /* belum ada */ }
    if (!ada) {
      const dl = await fetch(p);
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      const ext = (base.split(".").pop() || "").toLowerCase();
      if (DRY_RUN) {
        console.log(`  ${tag} DRY: ${p.slice(0, 70)}... (${(buf.length / 1024).toFixed(0)} KB) -> ${key}`);
      } else {
        await s3.send(new PutObjectCommand({
          Bucket: R2_BUCKET, Key: key, Body: buf,
          ContentType: CT[ext] || "application/octet-stream",
          CacheControl: "public, max-age=31536000",
        }));
        console.log(`  ${tag} OK -> ${key}`);
      }
    } else {
      console.log(`  ${tag} SKIP (udah di R2): ${key}`);
    }
    if (!DRY_RUN) {
      await rest(`exam_media?id=eq.${m.id}`, { method: "PATCH", body: JSON.stringify({ path: key }) });
    }
    hasil.disalin++;
  } catch (e) {
    hasil.gagal++;
    hasil.gagalDaftar.push(`id ${m.id}: ${e.message}`);
    console.log(`  ${tag} GAGAL id ${m.id}: ${e.message}`);
  }
}

console.log("\n== RINGKASAN ==", hasil);
if (hasil.gagalDaftar.length) console.log(hasil.gagalDaftar.join("\n"));
