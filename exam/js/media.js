// ============================================================
// MEDIA — pola R2 osistarpanone, dipakai halaman exam.
// - DB (exam_media.path) nyimpen PATH RELATIF ("kisi/abc.jpg").
//   URL absolut lama tetap jalan (dibiarin apa adanya).
// - Baca: mediaUrl() -> R2_PUBLIC_BASE (kalo R2_ENABLED) atau
//   bucket Supabase `exam-media` (sementara).
// - Upload (admin): compressImage() dulu -> presign PUT ke R2.
//   Supabase Storage DILARANG (usage bengkak) — tanpa fallback.
// ============================================================

const ExamMedia = {

    // R2 hidup = base publik keisi. Worker presign cuma buat UPLOAD,
    // baca jalan duluan tanpa worker.
    r2Aktif() {
        return typeof R2_ENABLED !== "undefined" && R2_ENABLED
            && typeof R2_PUBLIC_BASE === "string" && R2_PUBLIC_BASE.startsWith("http");
    },

    // path DB -> URL tampil.
    // Relatif ("kisi/abc.jpg") -> R2 public base (WAJIB).
    // Absolut (URL Supabase lama) -> dibiarin, cuma masa transisi
    // sampai migrasi R2 beres (tools/migrate-exam-r2.mjs).
    url(path) {
        if (!path) return "";
        const s = String(path).trim();
        if (!s) return "";
        if (/^(https?:|blob:|data:)/i.test(s)) return s;
        const key = s.replace(/^\/+/, "");
        if (!ExamMedia.r2Aktif()) {
            throw new Error("R2 belum dikonfigurasi — isi R2_PUBLIC_BASE di js/config.js.");
        }
        return R2_PUBLIC_BASE.replace(/\/$/, "") + "/" + key;
    },

    kindOf(pathOrUrl) {
        const b = String(pathOrUrl || "").split("?")[0].toLowerCase();
        if (/\.(jpg|jpeg|png|webp|gif|bmp|svg)$/.test(b)) return "image";
        if (/\.pdf$/.test(b)) return "pdf";
        if (/\.(doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/.test(b)) return "doc";
        if (/\.(mp4|webm|ogg|mov)$/.test(b)) return "video";
        if (/\.(mp3|wav|ogg|m4a)$/.test(b)) return "audio";
        return "other";
    },

    fileName(pathOrUrl, maxLen) {
        try {
            const seg = String(pathOrUrl).split("?")[0].split("/");
            let nama = decodeURIComponent(seg[seg.length - 1] || "file");
            nama = nama.replace(/^\d{10,}_/, "");
            const max = maxLen || 42;
            if (nama.length > max) {
                const dot = nama.lastIndexOf(".");
                const ext = dot !== -1 ? nama.slice(dot) : "";
                nama = nama.slice(0, max - ext.length - 1) + "…" + ext;
            }
            return nama;
        } catch (e) { return "file"; }
    },

    iconFor(kind) {
        if (kind === "pdf") return "fa-solid fa-file-pdf";
        if (kind === "doc") return "fa-solid fa-file-word";
        if (kind === "video") return "fa-solid fa-file-video";
        if (kind === "audio") return "fa-solid fa-file-audio";
        return "fa-solid fa-file-arrow-down";
    },

    // Render lampiran 1 kisi. `items` = baris exam_media.
    galleryHTML(items) {
        const list = (items || []).filter(m => m && m.path);
        if (!list.length) return "";
        const imgs = list.filter(m => ExamMedia.kindOf(m.path) === "image");
        const files = list.filter(m => ExamMedia.kindOf(m.path) !== "image");
        let html = "";
        if (imgs.length) {
            const MAX = 6;
            html += `<div class="pub-galeri">` + imgs.map((m, i) => {
                const u = ExamMedia.url(m.path);
                const hidden = i >= MAX ? ` style="display:none;"` : "";
                const more = (imgs.length > MAX && i === MAX - 1)
                    ? `<span class="more-overlay">+${imgs.length - MAX + 1}<small>liat selengkapnya</small></span>` : "";
                return `<button type="button" class="pub-thumb${more ? " more" : ""}" data-full="${ExamDB.esc(u)}" title="Ketuk buat perbesar"${hidden}>` +
                    `<img src="${u}" alt="${ExamDB.esc(m.label || ("Lampiran " + (i + 1)))}" loading="lazy" decoding="async" draggable="false">` +
                    (more || `<span class="pub-zoom"><i class="fa-solid fa-expand"></i></span>`) + `</button>`;
            }).join("") + `</div>`;
        }
        if (files.length) {
            html += `<div class="pub-files">` + files.map(m => {
                const u = ExamMedia.url(m.path);
                const kind = ExamMedia.kindOf(m.path);
                // PDF dibuka di viewer popup (pager per halaman).
                if (kind === "pdf") {
                    return `<button type="button" class="pub-file" data-kind="pdf" data-src="${ExamDB.esc(u)}">` +
                        `<i class="${ExamMedia.iconFor(kind)}"></i>` +
                        `<span>${ExamDB.esc(m.label || ExamMedia.fileName(m.path))}</span>` +
                        `<i class="fa-solid fa-expand pub-open"></i></button>`;
                }
                return `<a class="pub-file" href="${ExamDB.esc(u)}" target="_blank" rel="noopener">` +
                    `<i class="${ExamMedia.iconFor(kind)}"></i>` +
                    `<span>${ExamDB.esc(m.label || ExamMedia.fileName(m.path))}</span>` +
                    `<i class="fa-solid fa-arrow-up-right-from-square pub-open"></i></a>`;
            }).join("") + `</div>`;
        }
        return html;
    },

    // Key R2/bucket buat upload baru: kisi/<kisiId>-<timestamp>-<nama>.
    // Folder "kisi" wajib ada di allowlist worker (lihat worker/presign.js).
    keyFor(kisiId, fileName) {
        const bersih = String(fileName || "file").toLowerCase()
            .replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-").slice(-80);
        return "kisi/" + kisiId + "-" + Date.now() + "-" + bersih;
    },

    compressImage(file, maxDim, quality) {
        return new Promise((resolve) => {
            if (!file || !file.type || !file.type.startsWith("image/")) return resolve(file);
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                try {
                    const max = maxDim || 1600;
                    const skala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
                    const w = Math.round(img.naturalWidth * skala);
                    const h = Math.round(img.naturalHeight * skala);
                    const cv = document.createElement("canvas");
                    cv.width = w; cv.height = h;
                    cv.getContext("2d").drawImage(img, 0, 0, w, h);
                    URL.revokeObjectURL(url);
                    cv.toBlob(b => {
                        if (!b) return resolve(file);
                        resolve(new File([b], file.name.replace(/\.[^.]+$/, ".jpg"),
                            { type: "image/jpeg", lastModified: Date.now() }));
                    }, "image/jpeg", quality || 0.82);
                } catch (e) { URL.revokeObjectURL(url); resolve(file); }
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    },

    async mintaPresign(path, contentType) {
        if (typeof R2_PRESIGN_URL !== "string" || !R2_PRESIGN_URL.startsWith("http")
            || R2_PRESIGN_URL.includes("example.")) {
            throw new Error("Worker presign belum dipasang — upload nunggu worker live.");
        }
        const res = await fetch(R2_PRESIGN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op: "put", path, contentType })
        });
        let body = null;
        try { body = await res.json(); } catch (e) { /* abaikan */ }
        if (!res.ok) throw new Error((body && body.error) || ("Presign gagal (" + res.status + ")"));
        if (!body || !body.url) throw new Error("Presign tidak mengembalikan URL.");
        return body;
    },

    // Hapus file R2 via presign DELETE (butuh worker versi delete).
    async r2Delete(path) {
        const key = String(path || "").replace(/^\/+/, "");
        if (!key) return;
        const res = await fetch(R2_PRESIGN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op: "delete", path: key })
        });
        let body = null;
        try { body = await res.json(); } catch (e) { /* abaikan */ }
        if (!res.ok) throw new Error((body && body.error) || ("Delete gagal (" + res.status + ")"));
        if (!body || !body.url) throw new Error("Presign tidak mengembalikan URL.");
        const del = await fetch(body.url, { method: "DELETE" });
        if (!del.ok && del.status !== 404) throw new Error("Delete R2 gagal (" + del.status + ")");
    },
    // Upload 1 file buat kisi. R2 WAJIB (tanpa fallback Supabase —
    // usage bengkak). Return PATH RELATIF buat exam_media.path.
    async upload(kisiId, file) {
        if (!ExamMedia.r2Aktif()) {
            throw new Error("R2 belum dikonfigurasi — setup dulu (lihat README).");
        }
        let up = file;
        if (file && file.type && file.type.startsWith("image/")) {
            try { up = await ExamMedia.compressImage(file); } catch (e) { /* pakai asli */ }
        }
        const tipe = up.type || file.type || "application/octet-stream";
        const key = ExamMedia.keyFor(kisiId, file.name);
        const pres = await ExamMedia.mintaPresign(key, tipe);
        const r = await fetch(pres.url, { method: "PUT", headers: { "Content-Type": tipe }, body: up });
        if (!r.ok) throw new Error("Upload R2 gagal (" + r.status + ")");
        return key;
    }
};

if (typeof window !== "undefined") window.ExamMedia = ExamMedia;
