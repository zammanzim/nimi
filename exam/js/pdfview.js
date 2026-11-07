// ============================================================
// PDFVIEW — render PDF inline per halaman (kayak galeri foto).
// PDF.js dimuat malas (UMD cdnjs) cuma kalo halaman ada PDF.
// Tiap .pdf-pager: canvas + prev/counter/next + link file asli.
// CORS R2 sudah "*" jadi fetch worker->canvas aman.
// ============================================================

const PdfView = {
    LIB: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js",
    WORKER: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js",
    _libPromise: null,

    ensureLib() {
        if (window.pdfjsLib) return Promise.resolve();
        if (PdfView._libPromise) return PdfView._libPromise;
        PdfView._libPromise = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = PdfView.LIB;
            s.onload = () => {
                try {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PdfView.WORKER;
                    resolve();
                } catch (e) { reject(e); }
            };
            s.onerror = () => reject(new Error("Gagal muat PDF.js"));
            document.head.appendChild(s);
        });
        return PdfView._libPromise;
    },

    // Panggil tiap render kisi beres (aman dipanggil ulang).
    init() {
        const pagers = [...document.querySelectorAll(".pdf-pager:not([data-done])")];
        if (!pagers.length) return;
        pagers.forEach(p => { p.dataset.done = "1"; });
        PdfView.ensureLib().then(() => {
            pagers.forEach(p => PdfView.setup(p));
        }).catch(() => {
            pagers.forEach(p => PdfView.fail(p, "PDF ga bisa dirender — buka file aslinya aja."));
        });
    },

    async setup(pager) {
        const url = pager.dataset.src;
        try {
            const doc = await window.pdfjsLib.getDocument({ url }).promise;
            pager._doc = doc;
            pager._page = 1;
            pager.querySelector(".pdf-count").textContent = `1 / ${doc.numPages}`;
            const prev = pager.querySelector(".pdf-prev");
            const next = pager.querySelector(".pdf-next");
            prev.addEventListener("click", () => PdfView.go(pager, -1));
            next.addEventListener("click", () => PdfView.go(pager, 1));
            await PdfView.render(pager);
        } catch (e) {
            PdfView.fail(pager, "PDF ga bisa dirender — buka file aslinya aja.");
        }
    },

    async go(pager, dir) {
        if (!pager._doc || pager._busy) return;
        const n = pager._page + dir;
        if (n < 1 || n > pager._doc.numPages) return;
        pager._page = n;
        pager.querySelector(".pdf-count").textContent = `${n} / ${pager._doc.numPages}`;
        await PdfView.render(pager);
    },

    async render(pager) {
        const canvas = pager.querySelector("canvas");
        pager._busy = true;
        pager.classList.add("loading");
        try {
            const page = await pager._doc.getPage(pager._page);
            const cssW = pager.clientWidth || 600;
            const vp1 = page.getViewport({ scale: 1 });
            const scale = cssW / vp1.width;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const vp = page.getViewport({ scale: scale * dpr });
            canvas.width = Math.floor(vp.width);
            canvas.height = Math.floor(vp.height);
            canvas.style.aspectRatio = `${vp.width} / ${vp.height}`;
            await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
            page.cleanup();
        } catch (e) {
            PdfView.fail(pager, "Halaman gagal dirender.");
        }
        pager._busy = false;
        pager.classList.remove("loading");
    },

    fail(pager, msg) {
        const err = pager.querySelector(".pdf-err");
        if (err) {
            err.hidden = false;
            err.querySelector("span").textContent = msg;
        }
    }
};

if (typeof window !== "undefined") window.PdfView = PdfView;
