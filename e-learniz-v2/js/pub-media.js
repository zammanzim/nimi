// ============================================================
// pub-media.js — Helper media halaman publik (kisi-kisi & quiz)
// Nyontek pola osistarpanone (js/db.js):
// - DB nyimpen path/URL, frontend yang resolve jadi URL tampil.
// - getFoto(): path relatif -> URL publik, URL absolut dibiarin.
// - Gambar di-compress dulu sebelum upload (buat admin).
// Halaman publik ini read-only, jadi yang kepake: parse + render.
// ============================================================

const PubMedia = {

    // Base bucket Supabase lama (fallback kalo DB nyimpen path relatif).
    // Kalo nanti pindah R2 kayak osistar, cukup ganti konstanta ini
    // jadi R2_PUBLIC_BASE — isi DB (path relatif) ga perlu diubah.
    STORAGE_BASE: "https://vttmwtlqzbbiaromohrp.supabase.co/storage/v1/object/public/subject-photos",

    // Folder yang boleh di-render dari storage (allowlist ala worker osistar).
    // Di luar ini, render sebagai link biasa aja (jangan di-embed).
    FOLDER_BOLEH: ["kisi-kisi", "bahasajepang", "bahasa-jepang", "informatika", "new"],

    // DB -> URL tampil. Mirip getFoto() di osistar.
    resolve(raw) {
        if (!raw) return "";
        const s = String(raw).trim();
        if (!s) return "";
        if (s.startsWith("http") || s.startsWith("blob:") || s.startsWith("data:")) return s;
        const bersih = s.replace(/^\/+/, "");
        return PubMedia.STORAGE_BASE + "/" + bersih;
    },

    // Kolom photo_url di subject_announcements isinya string JSON array,
    // kadang single URL, kadang null. Normalisasi jadi array URL jadi.
    parseList(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map(u => PubMedia.resolve(u)).filter(Boolean);
        const s = String(raw).trim();
        if (!s) return [];
        try {
            const arr = JSON.parse(s);
            if (Array.isArray(arr)) return arr.map(u => PubMedia.resolve(u)).filter(Boolean);
            if (typeof arr === "string" && arr) return [PubMedia.resolve(arr)];
        } catch (e) { /* bukan JSON, anggap single URL */ }
        return [PubMedia.resolve(s)];
    },

    // Tebak jenis file dari ekstensi (tanpa fetch).
    kindOf(url) {
        const bersih = String(url || "").split("?")[0].toLowerCase();
        if (/\.(jpg|jpeg|png|webp|gif|bmp|svg)$/.test(bersih)) return "image";
        if (/\.pdf$/.test(bersih)) return "pdf";
        if (/\.(doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/.test(bersih)) return "doc";
        if (/\.(mp4|webm|ogg|mov)$/.test(bersih)) return "video";
        if (/\.(mp3|wav|ogg|m4a)$/.test(bersih)) return "audio";
        return "other";
    },

    // Nama file dari URL (decode %20 dll), dipotong kalo kepanjangan.
    fileName(url, maxLen) {
        try {
            const seg = String(url).split("?")[0].split("/");
            let nama = decodeURIComponent(seg[seg.length - 1] || "file");
            // Buang prefix timestamp upload (1780308545140_...) biar rapi.
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

    // Render gallery: gambar jadi thumbnail lazy (klik -> buka penuh di tab baru),
    // dokumen jadi tombol file. Return HTML string.
    galleryHTML(urls, prefix) {
        const list = (urls || []).filter(Boolean);
        if (!list.length) return "";
        const images = list.filter(u => PubMedia.kindOf(u) === "image");
        const files = list.filter(u => PubMedia.kindOf(u) !== "image");
        let html = "";

        if (images.length) {
            html += `<div class="pub-galeri">` + images.map((u, i) =>
                `<a class="pub-thumb" href="${u}" target="_blank" rel="noopener" title="Buka gambar ${i + 1}">` +
                `<img src="${u}" alt="Lampiran ${i + 1}" loading="lazy" decoding="async">` +
                `<span class="pub-zoom"><i class="fa-solid fa-expand"></i></span></a>`
            ).join("") + `</div>`;
        }
        if (files.length) {
            html += `<div class="pub-files">` + files.map(u => {
                const kind = PubMedia.kindOf(u);
                return `<a class="pub-file pub-file-${kind}" href="${u}" target="_blank" rel="noopener">` +
                    `<i class="${PubMedia.iconFor(kind)}"></i>` +
                    `<span>${PubMedia.fileName(u)}</span>` +
                    `<i class="fa-solid fa-arrow-up-right-from-square pub-open"></i></a>`;
            }).join("") + `</div>`;
        }
        return html;
    },

    // --- Compress gambar sebelum upload (salinan pola osistar db.js) ---
    // Dipake halaman admin; halaman publik ga manggil ini.
    // maxDim 1600px, kualitas 0.82, output jpeg.
    compressImage(file, maxDim, quality) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type || !file.type.startsWith("image/")) return resolve(file);
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                try {
                    const max = maxDim || 1600;
                    let w = img.naturalWidth, h = img.naturalHeight;
                    const skala = Math.min(1, max / Math.max(w, h));
                    w = Math.round(w * skala); h = Math.round(h * skala);
                    const canvas = document.createElement("canvas");
                    canvas.width = w; canvas.height = h;
                    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                    URL.revokeObjectURL(url);
                    canvas.toBlob(b => {
                        if (!b) return resolve(file);
                        resolve(new File([b], file.name.replace(/\.[^.]+$/, ".jpg"), {
                            type: "image/jpeg", lastModified: Date.now()
                        }));
                    }, "image/jpeg", quality || 0.82);
                } catch (e) { URL.revokeObjectURL(url); resolve(file); }
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    }
};

if (typeof window !== "undefined") window.PubMedia = PubMedia;
