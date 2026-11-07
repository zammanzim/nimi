// =========================================================================
// WORKER: elearniz-media-presign — penerbit presigned URL R2 buat e-learniz v3
//
// Alur (pola sama kyk OSIS TARPAN ONE):
//   browser ──POST /presign──▶ Worker (validasi JWT + allowlist folder)
//      ◀──{url, method, publicUrl, path}──
//   browser ──PUT/DELETE langsung──▶ Cloudflare R2
//   baca     ──GET────────────────▶ custom domain R2 (public base)
//
// Secret (R2 key + service_role) TIDAK PERNAH ke frontend — semuanya di
// Worker. Frontend cuma megang V3_R2_PRESIGN_URL + V3_R2_PUBLIC_BASE.
//
// AUTH v3:
// - Semua op (put/delete) WAJIB JWT Supabase Auth yang valid DAN
//   terlink ke baris v3.users dengan role staff (teacher/class_admin/
//   super_admin). Siswa pick-name ga punya JWT → otomatis ditolak.
// - Tidak ada jalur publik: upload di UI pun tetap butuh login staff.
//
// DEPLOY (sekali):
//   1. Cloudflare → R2 → bucket "e-learniz-v3",
//      pasang custom domain (mis. https://media.e-learniz.my.id),
//      atur CORS di bucket:
//        AllowOrigin = https://e-learniz.my.id
//        AllowMethods = PUT, DELETE, GET, HEAD
//        AllowHeaders = Content-Type
//   2. R2 → Manage R2 API Tokens → create token (Object Read & Write)
//      → simpan sebagai secret worker (jangan taruh di file ini).
//   3. cd worker && npx wrangler secret put R2_ACCESS_KEY
//                    npx wrangler secret put R2_SECRET_KEY
//                    npx wrangler secret put SUPABASE_SERVICE_KEY
//      lalu npx wrangler deploy
//   4. Isi V3_R2_PRESIGN_URL + V3_R2_PUBLIC_BASE di ../js/config.js
// =========================================================================

// Folder yang boleh ditulis/dihapus. Kartu v3 cuma naro gambar di sini:
//   cards/<class_id>/<timestamp>_<random>_<namafile>
const FOLDER_BOLEH = new Set(["cards"]);

// Cuma gambar — tolak semua yang bisa dieksekusi.
const CONTENT_BOLEH = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
]);

const UMUR_PRESIGN_DETIK = 90; // presigned URL cuma berlaku 90 detik
const MAKS_PATH = 512;
const ROLE_STAFF = new Set(["teacher", "class_admin", "super_admin"]);

function originBoleh(origin, env) {
  if (!origin || origin === "null") return true; // "null" = dibuka via file:// pas testing lokal
  const daftar = String(env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (daftar.length === 0 || daftar.includes("*") || daftar.includes(origin)) return true;
  let host = "";
  try { host = new URL(origin).hostname; } catch { return false; }
  // localhost / 127.0.0.1 (port berapa pun) selalu boleh.
  if (host === "localhost" || host === "127.0.0.1") return true;
  return daftar.some((d) => {
    try {
      const h = new URL(d).hostname;
      return host === h || host.endsWith("." + h);
    } catch { return false; }
  });
}

function corsHeaders(env, req) {
  const origin = req.headers.get("Origin") || "";
  const boleh = originBoleh(origin, env);
  return {
    "Access-Control-Allow-Origin": boleh ? (origin || "*") : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(obj, status, env, req) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env, req) },
  });
}

function validasiPath(path) {
  if (typeof path !== "string" || !path || path.length > MAKS_PATH) return false;
  if (path.startsWith("/") || path.includes("..") || path.includes("\\")) return false;
  const seg = path.split("/");
  if (seg.length < 2) return false; // wajib folder/namafile
  if (!FOLDER_BOLEH.has(seg[0])) return false;
  if (seg.some((s) => !s || s === "." || s === "..")) return false;
  return /^[A-Za-z0-9._/-]+$/.test(path);
}

// --- Minimal SigV4 (Web Crypto, tanpa dependensi) buat presign S3/R2 ---
function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toHex(d);
}

async function hmacBytes(keyBuf, text) {
  const k = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
}

async function signingKey(secret, dateStamp, region, service) {
  const kDate = await hmacBytes(new TextEncoder().encode("AWS4" + secret), dateStamp);
  const kRegion = await hmacBytes(kDate, region);
  const kService = await hmacBytes(kRegion, service);
  return hmacBytes(kService, "aws4_request");
}

function encodeKey(key) {
  return key.split("/").map((s) => encodeURIComponent(s)).join("/");
}

// Presign PUT/DELETE tanpa signed content-type (UNSIGNED-PAYLOAD)
// biar browser bebas kirim Content-Type apa pun yang diizinkan.
async function presignUrl({ method, endpoint, bucket, key, accessKey, secretKey, region, expiresIn }) {
  const ep = new URL(endpoint);
  const host = ep.host;
  const canonicalUri = "/" + bucket + "/" + encodeKey(key);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"; // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  });
  const sortedQuery = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [method, canonicalUri, sortedQuery, canonicalHeaders, "host", payloadHash].join("\n");
  const hashedCanonical = await sha256Hex(canonicalRequest);
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashedCanonical].join("\n");
  const key2 = await signingKey(secretKey, dateStamp, region, "s3");
  const k = await crypto.subtle.importKey("raw", key2, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = toHex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(stringToSign)));
  return `${endpoint.replace(/\/$/, "")}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${sig}`;
}

// Validasi JWT via Supabase Auth API — tanpa perlu JWT secret di Worker.
// return { state, authUserId }. state: "ok" | "tanpa-token" | "token-basi"
async function jwtValid(env, req) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) return { state: "tanpa-token", authUserId: null };
  try {
    const r = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth },
    });
    if (!r.ok) return { state: "token-basi", authUserId: null };
    const me = await r.json();
    return { state: "ok", authUserId: (me && me.id) || null };
  } catch {
    return { state: "token-basi", authUserId: null };
  }
}

// Cek baris v3.users yang nyambung ke auth ini dan rolenya staff.
// Pakai service_role (tetap di Worker) — RLS baca v3.users yang terbuka
// juga sebenernya cukup, tapi sekalian lewat key server biar jelas.
// Balikin { ok, detail } — detail dipasang di pesan 403 biar gampang
// ngedebug (kenapa ditolak: query-nya error, rolenya bukan staff, dsb).
async function cekStaff(env, authUserId) {
  if (!authUserId) return { ok: false, detail: "JWT valid tapi tanpa user id." };
  const base = String(env.SUPABASE_URL).replace(/\/$/, "");
  const pakaiService = !!env.SUPABASE_SERVICE_KEY;
  const headers = pakaiService
    ? { apikey: env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY }
    : { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_ANON_KEY };
  try {
    // Schema v3 dikirim via header Accept-Profile, BUKAN nempel di path.
    // "rest/v1/v3.users" dibaca PostgREST sebagai tabel 'public.v3.users'
    // → 404 PGRST205 → cekStaff selalu false → 403 "bukan staff".
    const r = await fetch(
      `${base}/rest/v1/users?auth_user_id=eq.${authUserId}&select=role&limit=1`,
      { headers: { ...headers, "Accept-Profile": "v3" } },
    );
    let txt = await r.text();
    let status = r.status;
    // Fallback: kalau service key nolak (401/403 — salah tempel / ke-rotate),
    // query ulang pake anon. Query-nya cuma baca, dan RLS v3 memang ngasih
    // anon baca v3.users — jadi cek role tetap jalan.
    if (!r.ok && pakaiService) {
      const r2 = await fetch(
        `${base}/rest/v1/users?auth_user_id=eq.${authUserId}&select=role&limit=1`,
        { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_ANON_KEY, "Accept-Profile": "v3" } },
      );
      status = r2.status;
      txt = await r2.text();
    }
    if (status < 200 || status >= 300) {
      return { ok: false, detail: `query role HTTP ${status}: ${txt.slice(0, 160)}` };
    }
    let arr = null;
    try { arr = JSON.parse(txt); } catch { arr = null; }
    const role = arr && arr[0] && String(arr[0].role || "");
    if (!role) return { ok: false, detail: `baris v3.users ga ketemu utk auth_user_id tsb (query OK, hasil kosong)` };
    return { ok: ROLE_STAFF.has(role), detail: `role=${role}` };
  } catch (e) {
    return { ok: false, detail: "query role gagal jalan: " + (e && e.message) };
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, req) });
    }

    if (url.pathname !== "/presign" || req.method !== "POST") {
      return jsonResponse({ error: "Not found. Pakai POST /presign." }, 404, env, req);
    }

    if (!env.R2_ENDPOINT || !env.R2_BUCKET || !env.R2_ACCESS_KEY || !env.R2_SECRET_KEY) {
      return jsonResponse({ error: "Worker belum dikonfigurasi (R2 env hilang). Jalankan wrangler secret put R2_ACCESS_KEY / R2_SECRET_KEY." }, 500, env, req);
    }
    if (!env.SUPABASE_SERVICE_KEY) {
      return jsonResponse({ error: "Worker belum dikonfigurasi (service key hilang). Jalankan wrangler secret put SUPABASE_SERVICE_KEY." }, 500, env, req);
    }

    let body;
    try { body = await req.json(); }
    catch { return jsonResponse({ error: "Body harus JSON." }, 400, env, req); }

    const op = body.op === "delete" ? "delete" : "put";
    const path = String(body.path || "").replace(/^\/+/, "");

    if (!validasiPath(path)) {
      return jsonResponse({ error: "Path tidak diizinkan." }, 400, env, req);
    }

    // Semua operasi wajib staff — siswa pick-name ga punya JWT.
    const { state, authUserId } = await jwtValid(env, req);
    if (state === "tanpa-token") {
      return jsonResponse({ error: "Belum login — login sebagai staff dulu." }, 401, env, req);
    }
    if (state !== "ok") {
      return jsonResponse({ error: "Sesi tidak valid — login ulang dulu." }, 401, env, req);
    }
    const cek = await cekStaff(env, authUserId);
    if (!cek.ok) {
      return jsonResponse({
        error: "Akun ini bukan staff — ga boleh upload.",
        detail: `${cek.detail} • auth_user_id=${authUserId} • key=${env.SUPABASE_SERVICE_KEY ? "service" : "anon"}`,
      }, 403, env, req);
    }

    const region = env.R2_REGION || "auto";

    try {
      if (op === "put") {
        const contentType = String(body.contentType || "application/octet-stream");
        if (!CONTENT_BOLEH.has(contentType)) {
          return jsonResponse({ error: "Tipe file tidak diizinkan (cuma gambar)." }, 400, env, req);
        }
        const signed = await presignUrl({
          method: "PUT",
          endpoint: env.R2_ENDPOINT,
          bucket: env.R2_BUCKET,
          key: path,
          accessKey: env.R2_ACCESS_KEY,
          secretKey: env.R2_SECRET_KEY,
          region,
          expiresIn: UMUR_PRESIGN_DETIK,
        });
        const publicUrl = `${String(env.PUBLIC_BASE_URL).replace(/\/$/, "")}/${encodeKey(path)}`;
        return jsonResponse({ url: signed, method: "PUT", publicUrl, path, expiresIn: UMUR_PRESIGN_DETIK }, 200, env, req);
      }

      const signed = await presignUrl({
        method: "DELETE",
        endpoint: env.R2_ENDPOINT,
        bucket: env.R2_BUCKET,
        key: path,
        accessKey: env.R2_ACCESS_KEY,
        secretKey: env.R2_SECRET_KEY,
        region,
        expiresIn: UMUR_PRESIGN_DETIK,
      });
      return jsonResponse({ url: signed, method: "DELETE", path, expiresIn: UMUR_PRESIGN_DETIK }, 200, env, req);
    } catch (e) {
      return jsonResponse({ error: "Gagal membuat presigned URL." }, 500, env, req);
    }
  },
};
