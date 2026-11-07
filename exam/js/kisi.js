// ============================================================
// KISI — halaman publik: jadwal di atas, kisi per hari di bawah.
// URL: kisi.html?id=xrpl1 (slug/angka/nama, default xrpl2)
// ============================================================

const KisiPage = {
    cls: null,
    classes: [],
    days: [],
    sched: {},
    shared: false,
    items: [],
    media: {},
    quizCounts: {},
    teachers: [],

    async boot() {
        // Kelas dari ?id=, profil tersimpan, atau default xrpl2.
        const param = new URLSearchParams(location.search).get("id")
            || (ExamDB.profile() || {}).slug || "xrpl2";
        try {
            KisiPage.cls = await ExamDB.resolveClass(param);
            KisiPage.classes = [];
        } catch (e) {
            document.getElementById("kisiBox").innerHTML =
                `<div class="pub-empty">Gagal nyambung ke database.<br>${ExamDB.esc(e.message || e)}</div>`;
            return;
        }
        document.title = `Kisi-Kisi ${KisiPage.cls.name} • Ujian`;
        const kt = document.getElementById("kelasTitle");
        if (kt) kt.textContent = KisiPage.cls.name;
        ExamDB.topUser();
        const qhref = "quiz?id=" + encodeURIComponent(KisiPage.cls.slug);
        const tq = document.getElementById("topQuizLink");
        if (tq) tq.href = qhref;
        const heroQuiz = document.getElementById("heroQuizLink");
        if (heroQuiz) heroQuiz.href = qhref;
        const heroNilai = document.getElementById("heroNilaiLink");
        if (heroNilai) heroNilai.href = "nilai?id=" + encodeURIComponent(KisiPage.cls.slug);

        try {
            const [days, sch, items, counts, teachers, subjects] = await Promise.all([
                ExamDB.examDays(KisiPage.cls.id),
                ExamDB.schedule(KisiPage.cls.id),
                ExamDB.kisi(KisiPage.cls.id),
                ExamDB.questionCount(KisiPage.cls.id),
                ExamDB.teachers(KisiPage.cls.id),
                ExamDB.subjects()
            ]);
            KisiPage.teachers = teachers;
            KisiPage.subjNames = {};
            (subjects || []).forEach(s => { KisiPage.subjNames[s.slug] = s.name; });
            KisiPage.days = days;
            KisiPage.sched = sch.map;
            KisiPage.shared = sch.shared;
            KisiPage.items = items;
            KisiPage.quizCounts = counts;
            KisiPage.media = await ExamDB.media(items.map(k => k.id));
        } catch (e) {
            document.getElementById("kisiBox").innerHTML =
                `<div class="pub-empty">Gagal ambil data.<br>${ExamDB.esc(e.message || e)}</div>`;
            return;
        }
        KisiPage.renderJadwal();
        KisiPage.renderKisi("");
        KisiPage.setupSearch();
        if (typeof ExamViewer !== "undefined") ExamViewer.bind();
        if (typeof Track !== "undefined") Track.page("kisi");
        ExamDB.confirmIdentity();
        ExamDB.watchVersion();
    },

    // norm buat nyocokin mapel jadwal <-> subject kisi <-> slug soal.
    norm(s) {
        return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    },

    kisiNorms() {
        return new Set(KisiPage.items.map(k => KisiPage.norm(k.subject)));
    },

    quizSlugFor(kisiSubject) {
        const n = KisiPage.norm(kisiSubject);
        const slugs = Object.keys(KisiPage.quizCounts);
        const hit = slugs.find(s => s.includes(n) || n.includes(s));
        if (hit) return hit;
        // Fallback: cocokin nama mapel (mis. slug mtk ↔ Matematika).
        return slugs.find(s => {
            const nm = KisiPage.norm((KisiPage.subjNames || {})[s]);
            return nm && (nm.includes(n) || n.includes(nm));
        }) || null;
    },

    // Cari guru mapel: cocokin norm dua arah lawan slug + nama.
    teacherFor(kisiSubject) {
        const n = KisiPage.norm(kisiSubject);
        if (!n) return "";
        const hit = (KisiPage.teachers || []).find(t => {
            const s = KisiPage.norm(t.slug);
            const nm = KisiPage.norm(t.name);
            return (s && (s.includes(n) || n.includes(s))) || (nm && (nm.includes(n) || n.includes(nm)));
        });
        return hit ? (hit.teacher || "") : "";
    },

    renderJadwal() {
        const box = document.getElementById("jadwalBox");
        const order = ExamDB.dayOrder(KisiPage.days);
        const norms = KisiPage.kisiNorms();
        let html = "";
        if (KisiPage.shared) {
            html += `<div class="jadwal-note"><i class="fa-solid fa-circle-info"></i> ` +
                `Kelas ini belum punya jadwal sendiri — nampilin <b>Jadwal Pusat (XI - RPL 2)</b>.</div>`;
        }
        const ada = order.filter(d => (KisiPage.sched[d] || []).length);
        if (!ada.length) {
            box.innerHTML = html + `<div class="pub-empty">Belum ada jadwal ujian.<br>Tunggu info dari admin ya.</div>`;
            return;
        }

        const dayHTML = (day, isToday) => {
            const list = KisiPage.sched[day] || [];
            const badge = isToday ? `<span class="today-badge">HARI INI</span>` : "";
            let h = `<section class="hari${isToday ? " is-today" : ""}">` +
                `<header class="hari-head"><h2>${day}</h2>${badge}</header><ol class="jadwal-list">`;
            list.forEach(e => {
                const has = norms.has(KisiPage.norm(e.mapel));
                const label = has
                    ? `<a class="jl-mapel has-kisi" href="#kisi-${KisiPage.norm(e.mapel)}">${ExamDB.esc(e.mapel)}</a>`
                    : `<span class="jl-mapel no-kisi">${ExamDB.esc(e.mapel)}</span>`;
                const jam = e.jam ? `<span class="jl-jam">${ExamDB.esc(e.jam)}</span>` : "";
                const cek = has ? `<i class="fa-solid fa-circle-check jl-cek" title="Ada kisi-kisi"></i>` : "";
                h += `<li class="jl-row">${jam}${label}${cek}</li>`;
            });
            return h + `</ol></section>`;
        };

        // Hari ini doang yang kebuka; sisanya ngumpet di balik tombol.
        html += dayHTML(ada[0], true);
        if (ada.length > 1) {
            html += `<button class="btn ghost" id="jadwalToggle" style="width:100%; justify-content:center; margin-top:2px;">` +
                `<i class="fa-solid fa-calendar-days"></i> Lihat jadwal hari lain (${ada.length - 1}) ` +
                `<i class="fa-solid fa-chevron-down"></i></button>` +
                `<div id="jadwalLain" style="display:none; margin-top:14px;">` +
                ada.slice(1).map(d => dayHTML(d, false)).join("") + `</div>`;
        }
        box.innerHTML = html;

        const toggle = document.getElementById("jadwalToggle");
        if (toggle) toggle.addEventListener("click", () => {
            const lain = document.getElementById("jadwalLain");
            const buka = lain.style.display === "none";
            lain.style.display = buka ? "block" : "none";
            toggle.innerHTML = buka
                ? `<i class="fa-solid fa-chevron-up"></i> Tutup jadwal hari lain`
                : `<i class="fa-solid fa-calendar-days"></i> Lihat jadwal hari lain (${ada.length - 1}) ` +
                  `<i class="fa-solid fa-chevron-down"></i>`;
        });
    },

    filtered(keyword) {
        const kw = KisiPage.norm(keyword);
        let items = KisiPage.items.filter(k => {
            if (!kw) return true;
            const hay = KisiPage.norm((k.subject || "") + " " + (k.content || "").replace(/<[^>]+>/g, " "));
            return hay.includes(kw);
        });
        // Urutan ngikut jadwal (bukan acak / terbaru).
        items = ExamDB.orderKisi(items, KisiPage.sched, KisiPage.days);
        const grouped = {};
        const other = [];
        items.forEach(k => {
            const d = k.day_name && KisiPage.days.includes(k.day_name) ? k.day_name : null;
            if (d) (grouped[d] = grouped[d] || []).push(k);
            else other.push(k);
        });
        return { grouped, other };
    },

    cardHTML(k) {
        const slug = KisiPage.quizSlugFor(k.subject);
        const guru = KisiPage.teacherFor(k.subject);
        const guruBadge = guru
            ? `<span class="kisi-guru"><i class="fa-solid fa-chalkboard-user"></i> ${ExamDB.esc(guru)}</span>` : "";
        const quizBtn = slug
            ? `<a class="kisi-quiz-btn" href="quiz?id=${ExamDB.esc(KisiPage.cls.slug)}&mapel=${ExamDB.esc(slug)}">` +
              `<i class="fa-solid fa-graduation-cap"></i> Latihan soal ` +
              `<small>(${KisiPage.quizCounts[slug]} soal)</small></a>`
            : "";
        return `<article class="kisi-card" id="kisi-${KisiPage.norm(k.subject)}">` +
            `<div class="kisi-top"><p class="kisi-eyebrow">Kisi-kisi • ${ExamDB.esc(k.day_name || "Umum")}</p>${guruBadge}</div>` +
            `<h3 class="kisi-subject">${ExamDB.esc(k.subject)}</h3>` +
            ExamMedia.galleryHTML(KisiPage.media[k.id]) +
            (k.content ? `<div class="kisi-body">${ExamDB.cleanHTML(k.content)}</div>` : "") +
            quizBtn + `</article>`;
    },

    renderKisi(keyword) {
        const box = document.getElementById("kisiBox");
        if (!KisiPage.items.length) {
            box.innerHTML = `<div class="pub-empty">Belum ada kisi-kisi buat kelas ini.<br>Cek berkala ya.</div>`;
            return;
        }
        const { grouped, other } = KisiPage.filtered(keyword);
        const order = ExamDB.dayOrder(KisiPage.days);
        let html = "";
        order.forEach((day, i) => {
            const list = grouped[day] || [];
            if (keyword && !list.length) return;
            const badge = i === 0 && !keyword ? `<span class="today-badge">HARI INI</span>` : "";
            html += `<section class="hari${i === 0 && !keyword ? " is-today" : ""}">` +
                `<header class="hari-head"><h2>${day}</h2>${badge}</header>`;
            html += list.length ? list.map(k => KisiPage.cardHTML(k)).join("")
                : `<p class="hari-empty">Belum ada kisi buat hari ${day}.</p>`;
            html += `</section>`;
        });
        if (other.length) {
            html += `<section class="hari hari-other"><header class="hari-head"><h2>Lainnya</h2></header>` +
                other.map(k => KisiPage.cardHTML(k)).join("") + `</section>`;
        }
        box.innerHTML = html || `<div class="pub-empty">Ga ketemu yang cocok sama "<b>${ExamDB.esc(keyword)}</b>".</div>`;
        KisiPage.clampCards();
        ExamDB.renderMath(box);
        if (typeof PdfView !== "undefined") PdfView.init();
    },

    // Lipet kartu yang isinya kepanjangan (>320px) + tombol selengkapnya.
    clampCards() {
        document.querySelectorAll("#kisiBox .kisi-card").forEach(card => {
            const body = card.querySelector(".kisi-body");
            if (!body || body.scrollHeight <= 320) return;
            card.classList.add("clamped");
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "kisi-more";
            btn.innerHTML = `Baca selengkapnya <i class="fa-solid fa-chevron-down"></i>`;
            btn.addEventListener("click", () => {
                const open = card.classList.toggle("open");
                btn.innerHTML = open
                    ? `Tutup <i class="fa-solid fa-chevron-up"></i>`
                    : `Baca selengkapnya <i class="fa-solid fa-chevron-down"></i>`;
            });
            body.after(btn);
        });
    },

    setupSearch() {
        const input = document.getElementById("kisiSearch");
        let t = null;
        input.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(() => KisiPage.renderKisi(input.value.trim()), 200);
        });
    }
};

document.addEventListener("DOMContentLoaded", () => KisiPage.boot());
