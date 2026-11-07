// ============================================================
// VIEWER — contek photo viewer SubjectApp lama (versi ramping):
// overlay fullscreen + prev/next + counter + swipe + Esc.
// Thumbnail (.pub-thumb) jadi tombol; file non-gambar tetap link.
// ============================================================

const ExamViewer = {
    urls: [],
    idx: 0,
    _x0: 0, _y0: 0, _swiping: false,
    _pdfLib: null,
    _pdfDocs: {},
    _pdfPage: 1,
    _pdfBusy: false,

    el() {
        let ov = document.getElementById("examViewer");
        if (ov) return ov;
        ov = document.createElement("div");
        ov.id = "examViewer";
        ov.innerHTML =
            `<div class="xv-backdrop"></div>` +
            `<button class="xv-btn xv-close" title="Tutup"><i class="fa-solid fa-xmark"></i></button>` +
            `<span class="xv-count"></span>` +
            `<button class="xv-btn xv-prev" title="Sebelumnya"><i class="fa-solid fa-chevron-left"></i></button>` +
            `<img class="xv-img" alt="Lampiran">` +
            `<div class="xv-doc" hidden><canvas></canvas></div>` +
            `<button class="xv-btn xv-next" title="Berikutnya"><i class="fa-solid fa-chevron-right"></i></button>`;
        document.body.appendChild(ov);
        ov.querySelector(".xv-backdrop").addEventListener("click", () => ExamViewer.close());
        ov.querySelector(".xv-close").addEventListener("click", () => ExamViewer.close());
        ov.querySelector(".xv-prev").addEventListener("click", e => { e.stopPropagation(); ExamViewer.prev(); });
        ov.querySelector(".xv-next").addEventListener("click", e => { e.stopPropagation(); ExamViewer.next(); });
        ov.addEventListener("touchstart", e => {
            ExamViewer._x0 = e.touches[0].clientX;
            ExamViewer._y0 = e.touches[0].clientY;
            ExamViewer._swiping = true;
        }, { passive: true });
        ov.addEventListener("touchend", e => {
            if (!ExamViewer._swiping) return;
            ExamViewer._swiping = false;
            const dx = e.changedTouches[0].clientX - ExamViewer._x0;
            const dy = e.changedTouches[0].clientY - ExamViewer._y0;
            if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
            if (dx < 0) ExamViewer.next(); else ExamViewer.prev();
        }, { passive: true });
        return ov;
    },

    // Delegasi global: thumbnail + tombol PDF kebuka di viewer.
    // + popstate: tombol back HP nutup viewer (bukan pindah halaman).
    _popBound: false,

    bind() {
        document.addEventListener("click", e => {
            const t = e.target.closest(".pub-thumb");
            if (t) {
                e.preventDefault();
                const gal = t.closest(".pub-galeri");
                const thumbs = gal ? [...gal.querySelectorAll(".pub-thumb")] : [t];
                ExamViewer.open(thumbs.map(x => x.dataset.full || ""), thumbs.indexOf(t));
                return;
            }
            const f = e.target.closest('.pub-file[data-kind="pdf"]');
            if (f) {
                e.preventDefault();
                ExamViewer.open([f.dataset.src || ""], 0);
            }
        });
        document.addEventListener("keydown", e => {
            const ov = document.getElementById("examViewer");
            if (!ov || !ov.classList.contains("open")) return;
            if (e.key === "Escape") ExamViewer.close();
            else if (e.key === "ArrowRight") ExamViewer.next();
            else if (e.key === "ArrowLeft") ExamViewer.prev();
        });
        if (!ExamViewer._popBound) {
            ExamViewer._popBound = true;
            window.addEventListener("popstate", () => {
                const ov = document.getElementById("examViewer");
                if (ov && ov.classList.contains("open")) ExamViewer.close(true);
            });
        }
    },

    open(urls, idx) {
        const list = (urls || []).filter(Boolean);
        if (!list.length) return;
        ExamViewer.urls = list;
        ExamViewer.idx = Math.max(0, Math.min(idx || 0, list.length - 1));
        ExamViewer._pdfPage = 1;
        ExamViewer.el().classList.add("open");
        document.body.style.overflow = "hidden";
        // Nyantol ke history: back HP -> popstate -> close (bukan pindah halaman).
        try {
            if (!history.state || !history.state.xv) history.pushState({ xv: 1 }, "");
        } catch (e) { /* abaikan */ }
        ExamViewer.render();
    },

    close(fromPop) {
        // Tutup via tombol/klik/Esc: makan 1 history biar sinkron sama back HP.
        if (!fromPop) {
            try {
                if (history.state && history.state.xv) { history.back(); return; }
            } catch (e) { /* lanjut tutup manual */ }
        }
        const ov = document.getElementById("examViewer");
        if (ov) ov.classList.remove("open");
        document.body.style.overflow = "";
    },

    isPdf(url) {
        return /\.pdf($|\?)/i.test(String(url || ""));
    },

    next() {
        const cur = ExamViewer.urls[ExamViewer.idx];
        // Dalam PDF: panah pindah halaman dulu, ujung baru ganti file.
        if (ExamViewer.isPdf(cur)) {
            const doc = ExamViewer._pdfDocs[cur];
            if (doc && ExamViewer._pdfPage < doc.numPages) {
                ExamViewer._pdfPage++;
                ExamViewer.renderPdf();
                return;
            }
        }
        if (ExamViewer.idx < ExamViewer.urls.length - 1) {
            ExamViewer.idx++;
            ExamViewer._pdfPage = 1;
            ExamViewer.render();
        }
    },

    prev() {
        const cur = ExamViewer.urls[ExamViewer.idx];
        if (ExamViewer.isPdf(cur) && ExamViewer._pdfPage > 1) {
            ExamViewer._pdfPage--;
            ExamViewer.renderPdf();
            return;
        }
        if (ExamViewer.idx > 0) {
            ExamViewer.idx--;
            ExamViewer._pdfPage = 1;
            ExamViewer.render();
        }
    },

    ensurePdfLib() {
        if (window.pdfjsLib) return Promise.resolve();
        if (ExamViewer._pdfLib) return ExamViewer._pdfLib;
        ExamViewer._pdfLib = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
            s.onload = () => {
                try {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
                    resolve();
                } catch (e) { reject(e); }
            };
            s.onerror = () => reject(new Error("Gagal muat PDF.js"));
            document.head.appendChild(s);
        });
        return ExamViewer._pdfLib;
    },

    render() {
        const ov = ExamViewer.el();
        const url = ExamViewer.urls[ExamViewer.idx];
        const pdf = ExamViewer.isPdf(url);
        const img = ov.querySelector(".xv-img");
        const doc = ov.querySelector(".xv-doc");
        img.style.display = pdf ? "none" : "block";
        doc.hidden = !pdf;
        const multi = ExamViewer.urls.length > 1;
        ov.querySelector(".xv-prev").style.display = "";
        ov.querySelector(".xv-next").style.display = "";
        if (pdf) {
            ov.querySelector(".xv-count").textContent = "…";
            ExamViewer.renderPdf();
        } else {
            img.src = url;
            ov.querySelector(".xv-count").textContent = multi
                ? (ExamViewer.idx + 1) + " / " + ExamViewer.urls.length : "";
            ov.querySelector(".xv-prev").style.visibility = ExamViewer.idx === 0 ? "hidden" : "visible";
            ov.querySelector(".xv-next").style.visibility =
                ExamViewer.idx === ExamViewer.urls.length - 1 ? "hidden" : "visible";
        }
    },

    async renderPdf() {
        const ov = ExamViewer.el();
        const url = ExamViewer.urls[ExamViewer.idx];
        const canvas = ov.querySelector(".xv-doc canvas");
        const count = ov.querySelector(".xv-count");
        if (ExamViewer._pdfBusy) return;
        ExamViewer._pdfBusy = true;
        try {
            await ExamViewer.ensurePdfLib();
            let doc = ExamViewer._pdfDocs[url];
            if (!doc) {
                doc = await window.pdfjsLib.getDocument({ url }).promise;
                ExamViewer._pdfDocs[url] = doc;
            }
            const n = Math.max(1, Math.min(ExamViewer._pdfPage, doc.numPages));
            ExamViewer._pdfPage = n;
            const page = await doc.getPage(n);
            const maxW = Math.min(window.innerWidth * 0.94, 900);
            const vp1 = page.getViewport({ scale: 1 });
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const vp = page.getViewport({ scale: (maxW / vp1.width) * dpr });
            canvas.width = Math.floor(vp.width);
            canvas.height = Math.floor(vp.height);
            await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
            page.cleanup();
            count.textContent = `Hal ${n}/${doc.numPages}`;
            ov.querySelector(".xv-prev").style.visibility =
                (n === 1 && ExamViewer.idx === 0) ? "hidden" : "visible";
            ov.querySelector(".xv-next").style.visibility =
                (n === doc.numPages && ExamViewer.idx === ExamViewer.urls.length - 1) ? "hidden" : "visible";
        } catch (e) {
            count.textContent = "Gagal render — ";
            const a = document.createElement("a");
            a.href = url; a.target = "_blank"; a.rel = "noopener";
            a.textContent = "buka file";
            a.style.color = "#fff";
            count.appendChild(a);
        }
        ExamViewer._pdfBusy = false;
    }
};

if (typeof window !== "undefined") window.ExamViewer = ExamViewer;
