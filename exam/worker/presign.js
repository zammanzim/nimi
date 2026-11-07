// =========================================================================
// WORKER exam-media-presign — penerbit presigned URL R2 (disalin+ramping
// dari osistarpanone/worker/osis-media-presign.js).
// Belum dipakai sampai R2_ENABLED=true di js/config.js.
//
// DEPLOY (nanti, sekali):
//   1. Cloudflare R2: bikin bucket (mis. exam-media), pasang custom domain
//      (mis. https://media.e-learniz.my.id), atur CORS:
//      AllowOrigin=<domain exam>, AllowMethods=GET,PUT,DELETE,HEAD,
//      AllowHeaders=Content-Type.
//   2. R2 API token (S3-compatible) -> secret worker (lihat wrangler.toml).
//   3. cd worker && npx wrangler secret put R2_ACCESS_KEY (dst.)
//      && npx wrangler deploy
//   4. Isi R2_PRESIGN_URL + R2_PUBLIC_BASE di js/config.js, set true.
//   5. Upload BARU otomatis ke R2. File lama (URL Supabase absolut di
//      exam_media.path) tetap jalan tanpa migrasi.
// =========================================================================

// Cuma folder ini yang boleh ditulis/dihapus.
const FOLDER_BOLEH = new Set(["kisi", "nilai"]);

const CONTENT_BOLEH = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/webm",
]);

const UMUR_PRESIGN_DETIK = 90;
const MAKS_PATH = 512;

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
async function presignUrl({ method, endpoint, bucket, key, accessKey, secretKey, region, expiresIn }) {
  const ep = new URL(endpoint);
  const host = ep.host;
  const canonicalUri = "/" + bucket + "/" + encodeKey(key);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
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
  const canonicalRequest = [method, canonicalUri, sortedQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const key2 = await signingKey(secretKey, dateStamp, region, "s3");
  const k = await crypto.subtle.importKey("raw", key2, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = toHex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(stringToSign)));
  return `${endpoint.replace(/\/$/, "")}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${sig}`;
}

function corsHeaders(env, req) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function json(obj, status, env, req) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json", ...corsHeaders(env, req) },
  });
}
function validasiPath(path) {
  if (typeof path !== "string" || !path || path.length > MAKS_PATH) return false;
  if (path.startsWith("/") || path.includes("..") || path.includes("\\")) return false;
  const seg = path.split("/");
  if (seg.length < 2) return false;
  if (!FOLDER_BOLEH.has(seg[0])) return false;
  if (seg.some((s) => !s || s === "." || s === "..")) return false;
  return /^[A-Za-z0-9._\/-]+$/.test(path);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env, req) });
    if (url.pathname !== "/presign" || req.method !== "POST") {
      return json({ error: "Not found. Gunakan POST /presign." }, 404, env, req);
    }
    if (!env.R2_ENDPOINT || !env.R2_BUCKET || !env.R2_ACCESS_KEY || !env.R2_SECRET_KEY) {
      return json({ error: "Worker belum dikonfigurasi (R2 env hilang)." }, 500, env, req);
    }
    // NOTE: versi simpel tanpa cek JWT (halaman admin exam cuma gate PIN).
    // Pas R2 live, disarankan tambah validasi PIN/token di sini.
    let body;
    try { body = await req.json(); }
    catch { return json({ error: "Body harus JSON." }, 400, env, req); }
    const path = String(body.path || "").replace(/^\/+/, "");
    if (!validasiPath(path)) return json({ error: "Path tidak diizinkan." }, 400, env, req);
    const region = env.R2_REGION || "auto";
    const op = body.op === "delete" ? "delete" : "put";
    if (op === "delete") {
      const signed = await presignUrl({
        method: "DELETE", endpoint: env.R2_ENDPOINT, bucket: env.R2_BUCKET,
        key: path, accessKey: env.R2_ACCESS_KEY, secretKey: env.R2_SECRET_KEY,
        region, expiresIn: UMUR_PRESIGN_DETIK,
      });
      return json({ url: signed, method: "DELETE", path, expiresIn: UMUR_PRESIGN_DETIK }, 200, env, req);
    }
    try {
      const contentType = String(body.contentType || "application/octet-stream");
      if (!CONTENT_BOLEH.has(contentType)) return json({ error: "Tipe file tidak diizinkan." }, 400, env, req);
      const signed = await presignUrl({
        method: "PUT", endpoint: env.R2_ENDPOINT, bucket: env.R2_BUCKET,
        key: path, accessKey: env.R2_ACCESS_KEY, secretKey: env.R2_SECRET_KEY,
        region, expiresIn: UMUR_PRESIGN_DETIK,
      });
      const publicUrl = `${String(env.PUBLIC_BASE_URL).replace(/\/$/, "")}/${encodeKey(path)}`;
      return json({ url: signed, method: "PUT", publicUrl, path, expiresIn: UMUR_PRESIGN_DETIK }, 200, env, req);
    } catch (e) {
      return json({ error: "Gagal membuat presigned URL." }, 500, env, req);
    }
  },
};
