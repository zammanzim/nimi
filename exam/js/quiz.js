// ============================================================
// QUIZ — halaman publik: strip jadwal + hub mapel + runner bernilai.
// URL: quiz.html?id=xrpl1&mapel=mtk
// Best-score per HP (localStorage exam_best_<slug>_<mapel>).
// ============================================================

const QuizPage = {
    cls: null,
    classes: [],
    days: [],
    sched: {},
    subjects: [],   // [{slug, name, icon, count}]
    mapel: null,
    questions: [],
    idx: 0,
    answers: [],
    autoNext: true,     // lanjut otomatis 5 dtk abis jawab (bisa dimatiin)
    _justAnswered: -1,  // idx soal yang BARU dijawab (timer cuma jalan di sini)
    _timer: null,
    _count: 0,

    async boot() {
        const params = new URLSearchParams(location.search);
        // Kelas dari ?id=, profil tersimpan, atau default xrpl2.
        try {
            QuizPage.cls = await ExamDB.resolveClass(params.get("id") || (ExamDB.profile() || {}).slug || "xrpl2");
            QuizPage.classes = [];
        } catch (e) {
            document.getElementById("quizRoot").innerHTML =
                `<div class="pub-empty">Gagal nyambung ke database.<br>${ExamDB.esc(e.message || e)}</div>`;
            return;
        }
        document.title = `Latihan Soal ${QuizPage.cls.name} • Ujian`;
        const kt = document.getElementById("kelasTitle");
        if (kt) kt.textContent = QuizPage.cls.name;
        ExamDB.topUser();
        const qhref = "quiz?id=" + encodeURIComponent(QuizPage.cls.slug);
        const khref = "kisi?id=" + encodeURIComponent(QuizPage.cls.slug);
        const tk = document.getElementById("topKisiLink");
        if (tk) tk.href = khref;
        const heroKisi = document.getElementById("heroKisiLink");
        if (heroKisi) heroKisi.href = khref;
        const heroNilai = document.getElementById("heroNilaiLink");
        if (heroNilai) heroNilai.href = "nilai?id=" + encodeURIComponent(QuizPage.cls.slug);

        try {
            const [days, sch, subjects, counts] = await Promise.all([
                ExamDB.examDays(QuizPage.cls.id),
                ExamDB.schedule(QuizPage.cls.id),
                ExamDB.subjects(),
                ExamDB.questionCount(QuizPage.cls.id)
            ]);
            QuizPage.days = days;
            QuizPage.sched = sch.map;
            QuizPage.subjects = subjects
                .filter(s => counts[s.slug])
                .map(s => ({ ...s, count: counts[s.slug] }));
        } catch (e) {
            document.getElementById("mapelBox").innerHTML =
                `<div class="pub-empty">Gagal ambil data.<br>${ExamDB.esc(e.message || e)}</div>`;
            return;
        }
        QuizPage.renderStrip();
        QuizPage.renderHub();
        if (typeof Track !== "undefined") Track.page("quiz");
        ExamDB.confirmIdentity();
        ExamDB.watchVersion();

        try {
            QuizPage.autoNext = localStorage.getItem("exam_autonext") !== "0";
        } catch (e) { QuizPage.autoNext = true; }

        const mp = (params.get("mapel") || "").toLowerCase();
        if (mp) {
            const hit = QuizPage.subjects.find(s => s.slug.toLowerCase() === mp);
            if (hit) QuizPage.openInfo(hit.slug);
        }
        QuizPage.bindNav();
    },

    norm(s) {
        return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    },

    bestKey(slug) {
        return `exam_best_${QuizPage.cls.slug}_${slug}`;
    },

    // Progres per HP: { idx, answers, total, at }. Tanpa login.
    progKey(slug) {
        return `exam_prog_${QuizPage.cls.slug}_${slug}`;
    },

    getProg(slug) {
        try {
            const v = JSON.parse(localStorage.getItem(QuizPage.progKey(slug)) || "null");
            if (v && Array.isArray(v.answers) && typeof v.idx === "number") return v;
        } catch (e) { /* abaikan */ }
        return null;
    },

    saveProg() {
        try {
            localStorage.setItem(QuizPage.progKey(QuizPage.mapel.slug), JSON.stringify({
                idx: QuizPage.idx,
                answers: QuizPage.answers,
                total: QuizPage.questions.length,
                at: Date.now()
            }));
        } catch (e) { /* abaikan */ }
    },

    clearProg(slug) {
        try { localStorage.removeItem(QuizPage.progKey(slug || (QuizPage.mapel && QuizPage.mapel.slug))); }
        catch (e) { /* abaikan */ }
    },

    getBest(slug) {
        try {
            const v = JSON.parse(localStorage.getItem(QuizPage.bestKey(slug)) || "null");
            return (v && typeof v.score === "number") ? v : null;
        } catch (e) { return null; }
    },

    saveBest(slug, score, benar, total) {
        try {
            const old = QuizPage.getBest(slug);
            if (!old || score > old.score) {
                localStorage.setItem(QuizPage.bestKey(slug),
                    JSON.stringify({ score, benar, total, at: Date.now() }));
            }
        } catch (e) { /* private mode — skip */ }
    },

    renderStrip() {
        const box = document.getElementById("jadwalStrip");
        const order = ExamDB.dayOrder(QuizPage.days);
        const ada = order.some(d => (QuizPage.sched[d] || []).length);
        if (!ada) {
            box.innerHTML = `<div class="strip-empty">Belum ada jadwal ujian.</div>`;
            return;
        }
        const noise = ["istirahat", "apel", "upacara", "sholat", "shalat", "makan", "ishoma", "pulang", "senam", "persiapan"];
        const isNoise = m => {
            const n = QuizPage.norm(m);
            return !n || noise.some(b => n.includes(b));
        };
        const clean = {};
        order.forEach(d => {
            const rows = (QuizPage.sched[d] || []).filter(e => !isNoise(e.mapel));
            if (rows.length) clean[d] = rows;
        });
        if (!Object.keys(clean).length) {
            box.innerHTML = `<div class="strip-empty">Belum ada jadwal ujian.</div>`;
            return;
        }
        box.innerHTML = Object.keys(clean).map((day, i) =>
            `<div class="strip-day${i === 0 ? " is-today" : ""}"><b>${day}</b><ul>` +
            clean[day].map(e => `<li>${ExamDB.esc(e.mapel)}</li>`).join("") +
            `</ul></div>`
        ).join("");
    },

    // Kelompokin mapel latihan ngikut hari jadwal (cocok norm dua arah).
    hubGroups() {
        const assigned = new Set();
        const groups = [];
        const order = ExamDB.dayOrder(QuizPage.days);
        order.forEach(day => {
            const rows = QuizPage.sched[day] || [];
            const hit = QuizPage.subjects.filter(s => {
                const ns = QuizPage.norm(s.slug);
                const nn = QuizPage.norm(s.name);
                const ok = rows.some(r => {
                    const nm = QuizPage.norm(r.mapel);
                    return (ns && (ns.includes(nm) || nm.includes(ns))) ||
                        (nn && (nn.includes(nm) || nm.includes(nn)));
                });
                if (ok) assigned.add(s.slug);
                return ok;
            });
            if (hit.length) groups.push({ day, list: hit, today: day === order[0] });
        });
        const rest = QuizPage.subjects.filter(s => !assigned.has(s.slug));
        if (rest.length) groups.push({ day: "Lainnya", list: rest, today: false });
        return groups;
    },

    renderHub() {
        QuizPage.show("viewHub");
        const box = document.getElementById("mapelBox");
        if (!QuizPage.subjects.length) {
            box.innerHTML = `<div class="pub-empty">Belum ada soal.<br>Cek berkala ya.</div>`;
            return;
        }
        box.innerHTML = QuizPage.hubGroups().map(g =>
            `<section class="hari${g.today ? " is-today" : ""}${g.day === "Lainnya" ? " hari-other" : ""}">` +
            `<header class="hari-head"><h2>${g.day}</h2>` +
            (g.today ? `<span class="today-badge">HARI INI</span>` : "") + `</header>` +
            `<div class="mapel-grid">` + g.list.map(s => {
                const best = QuizPage.getBest(s.slug);
                const prog = QuizPage.getProg(s.slug);
                const doing = prog && prog.total === s.count
                    && prog.answers.filter(a => a !== null && a !== undefined).length > 0;
                const badge = doing
                    ? `<span class="best proc">Lanjutin ${Math.min(prog.idx + 1, prog.total)}/${prog.total}</span>`
                    : (best ? `<span class="best">Terbaik: ${best.score}%</span>`
                        : `<span class="best none">Belum dicoba</span>`);
                return `<button class="mapel-card" data-mapel="${ExamDB.esc(s.slug)}">` +
                    `<i class="fa-solid ${ExamDB.esc(s.icon || "fa-book")}"></i>` +
                    `<b>${ExamDB.esc(s.name)}</b>` +
                    `<span class="count">${s.count} soal</span>${badge}</button>`;
            }).join("") + `</div></section>`
        ).join("");
        box.querySelectorAll(".mapel-card").forEach(b =>
            b.addEventListener("click", () => QuizPage.openInfo(b.dataset.mapel)));
    },

    openInfo(slug) {
        const s = QuizPage.subjects.find(x => x.slug === slug);
        if (!s) return;
        QuizPage.mapel = s;
        QuizPage.show("viewInfo");
        document.getElementById("infoIcon").className = `fa-solid ${s.icon || "fa-book"}`;
        document.getElementById("infoName").textContent = s.name;
        document.getElementById("infoCount").textContent = s.count;
        const best = QuizPage.getBest(s.slug);
        document.getElementById("infoBest").textContent = best
            ? `Terbaik kamu: ${best.score}% (${best.benar}/${best.total} benar)`
            : "Belum pernah dicoba di HP ini.";
        // Lanjutin progres yang kepotong?
        const prog = QuizPage.getProg(s.slug);
        const valid = prog && prog.total === s.count
            && prog.answers.filter(a => a !== null && a !== undefined).length > 0;
        const startBtn = document.getElementById("startBtn");
        const restartBtn = document.getElementById("restartBtn");
        if (valid) {
            startBtn.innerHTML = `LANJUTIN SOAL ${Math.min(prog.idx + 1, prog.total)}/${prog.total} <i class="fa-solid fa-play"></i>`;
            restartBtn.style.display = "inline-flex";
        } else {
            if (prog) QuizPage.clearProg(s.slug);
            startBtn.innerHTML = `MULAI <i class="fa-solid fa-play"></i>`;
            restartBtn.style.display = "none";
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    },

    async startQuiz(fresh) {
        if (!QuizPage.mapel) return;
        const box = document.getElementById("quizPlay");
        QuizPage.show("viewQuiz");
        box.innerHTML = `<div class="pub-empty">Wet, lagi nyiapin soal…</div>`;
        try {
            QuizPage.questions = await ExamDB.questions(QuizPage.mapel.slug, QuizPage.cls.id);
        } catch (e) {
            box.innerHTML = `<div class="pub-empty">Gagal ambil soal.<br>${ExamDB.esc(e.message || e)}</div>`;
            return;
        }
        if (!QuizPage.questions.length) {
            box.innerHTML = `<div class="pub-empty">Soalnya kosong.</div>`;
            return;
        }
        // Lanjutin progres kepotong (kecuali minta fresh).
        if (!fresh) {
            const prog = QuizPage.getProg(QuizPage.mapel.slug);
            if (prog && prog.total === QuizPage.questions.length
                && prog.answers.filter(a => a !== null && a !== undefined).length > 0) {
                QuizPage.idx = Math.max(0, Math.min(prog.idx, QuizPage.questions.length - 1));
                QuizPage.answers = QuizPage.questions.map((_, i) =>
                    (prog.answers[i] === undefined ? null : prog.answers[i]));
                if (typeof Track !== "undefined") Track.quizStart(QuizPage.mapel.slug, QuizPage.questions.length);
                QuizPage.renderQ();
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }
        }
        QuizPage.clearProg(QuizPage.mapel.slug);
        QuizPage.idx = 0;
        QuizPage.answers = new Array(QuizPage.questions.length).fill(null);
        if (typeof Track !== "undefined") Track.quizStart(QuizPage.mapel.slug, QuizPage.questions.length);
        QuizPage.renderQ();
        window.scrollTo({ top: 0, behavior: "smooth" });
    },

    renderQ() {
        QuizPage.clearTimer();
        const q = QuizPage.questions[QuizPage.idx];
        const total = QuizPage.questions.length;
        const box = document.getElementById("quizPlay");
        const answered = QuizPage.answers[QuizPage.idx] !== null
            && QuizPage.answers[QuizPage.idx] !== undefined;
        const prefix = ["A", "B", "C", "D", "E"];

        const opts = (q.options || []).map((opt, i) => {
            let cls = "opt";
            if (answered) {
                if (i === q.answer) cls += " correct";
                else if (i === QuizPage.answers[QuizPage.idx]) cls += " wrong";
                else cls += " dim";
            }
            return `<button class="${cls}" data-i="${i}"${answered ? " disabled" : ""}>` +
                `<span class="opt-pre">${prefix[i] || ""}</span><span>${ExamDB.esc(opt)}</span></button>`;
        }).join("");

        const expInner = (answered && q.explanation)
            ? `<b>Pembahasan:</b><br>${ExamDB.esc(q.explanation)}` : "";

        const nav = QuizPage.questions.map((qq, i) => {
            let cls = "nav-n";
            if (i === QuizPage.idx) cls += " active";
            else if (QuizPage.answers[i] !== null && QuizPage.answers[i] !== undefined) {
                cls += QuizPage.answers[i] === qq.answer ? " ok" : " bad";
            }
            return `<button class="${cls}" data-n="${i}">${i + 1}</button>`;
        }).join("");

        box.innerHTML =
            `<div class="q-top"><span>SOAL ${QuizPage.idx + 1}/${total}</span><span>${ExamDB.esc(QuizPage.mapel.name)}</span></div>` +
            `<div class="pbar"><div style="width:${(QuizPage.idx / total) * 100}%"></div></div>` +
            `<div class="quiz-split"><div class="quiz-main">` +
            `<div class="q-card"><p class="q-text">${ExamDB.esc(q.question)}</p>` +
            `<div class="opts">${opts}</div>` +
            `<div class="exp" id="qExp"${expInner ? "" : ' style="display:none"'}>${expInner}</div></div>` +
            `<div class="q-nav-row">` +
            `<button class="btn ghost" id="qPrev"${QuizPage.idx === 0 ? " disabled" : ""}>` +
            `<i class="fa-solid fa-arrow-left"></i> Kembali</button>` +
            `<button class="btn ghost sm q-auto${QuizPage.autoNext ? " on" : ""}" id="qAuto" title="Lanjut otomatis 5 detik abis jawab">` +
            `<i class="fa-solid fa-bolt"></i> ${QuizPage.autoNext ? "ON" : "OFF"}</button>` +
            (QuizPage.idx < total - 1
                ? `<button class="btn" id="qNext">Lanjut <i class="fa-solid fa-arrow-right"></i></button>`
                : `<button class="btn gold" id="qFinish">Lihat Nilai <i class="fa-solid fa-flag-checkered"></i></button>`) +
            `</div><div class="q-tools">` +
            `<span class="kbd-hint"><kbd>A</kbd>–<kbd>E</kbd> jawab • <kbd>Enter</kbd> lanjut • <kbd>Esc</kbd> kembali</span>` +
            `</div></div><aside class="quiz-side"><div class="q-nav">${nav}</div></aside></div>`;

        box.querySelectorAll(".opt").forEach(b =>
            b.addEventListener("click", () => QuizPage.answer(parseInt(b.dataset.i, 10))));
        box.querySelectorAll(".nav-n").forEach(b =>
            b.addEventListener("click", () => {
                QuizPage._justAnswered = -1;
                QuizPage.idx = parseInt(b.dataset.n, 10);
                QuizPage.saveProg();
                QuizPage.renderQ();
                window.scrollTo({ top: 0, behavior: "smooth" });
            }));
        const prev = document.getElementById("qPrev");
        if (prev) prev.addEventListener("click", () => {
            if (QuizPage.idx > 0) {
                QuizPage._justAnswered = -1;
                QuizPage.idx--;
                QuizPage.saveProg();
                QuizPage.renderQ();
            }
        });
        const next = document.getElementById("qNext");
        if (next) next.addEventListener("click", () => {
            QuizPage._justAnswered = -1;
            QuizPage.idx++; QuizPage.renderQ();
            QuizPage.saveProg();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
        const fin = document.getElementById("qFinish");
        if (fin) fin.addEventListener("click", () => {
            QuizPage._justAnswered = -1;
            QuizPage.finish();
        });
        const auto = document.getElementById("qAuto");
        if (auto) auto.addEventListener("click", () => QuizPage.setAuto(!QuizPage.autoNext));
        ExamDB.renderMath(box);
    },

    clearTimer() {
        if (QuizPage._timer) {
            clearInterval(QuizPage._timer);
            QuizPage._timer = null;
        }
    },

    setAuto(on) {
        QuizPage.autoNext = !!on;
        try { localStorage.setItem("exam_autonext", QuizPage.autoNext ? "1" : "0"); } catch (e) { /* abaikan */ }
        QuizPage.clearTimer();
        const btn = document.getElementById("qAuto");
        if (btn) {
            btn.classList.toggle("on", QuizPage.autoNext);
            btn.innerHTML = `<i class="fa-solid fa-bolt"></i> ${QuizPage.autoNext ? "ON" : "OFF"}`;
        }
        // Nyalain lagi timernya kalo posisi lagi di soal yang baru dijawab.
        if (QuizPage.autoNext && QuizPage.currentAnswered()
            && QuizPage.idx === QuizPage._justAnswered
            && document.getElementById("viewQuiz").style.display === "block") {
            QuizPage.startAuto();
        }
    },

    startAuto() {
        QuizPage.clearTimer();
        QuizPage._count = 5;
        const tick = () => {
            const isLast = QuizPage.idx >= QuizPage.questions.length - 1;
            const btn = document.getElementById(isLast ? "qFinish" : "qNext");
            if (!btn) { QuizPage.clearTimer(); return; }
            if (QuizPage._count <= 0) {
                QuizPage.clearTimer();
                QuizPage._justAnswered = -1;
                if (isLast) QuizPage.finish();
                else { QuizPage.idx++; QuizPage.renderQ(); window.scrollTo({ top: 0, behavior: "smooth" }); }
                return;
            }
            btn.innerHTML = isLast
                ? `Lihat Nilai (${QuizPage._count}) <i class="fa-solid fa-flag-checkered"></i>`
                : `Lanjut (${QuizPage._count}) <i class="fa-solid fa-arrow-right"></i>`;
            QuizPage._count--;
        };
        tick();
        QuizPage._timer = setInterval(tick, 1000);
    },

    currentAnswered() {
        const a = QuizPage.answers[QuizPage.idx];
        return a !== null && a !== undefined;
    },

    // Update in-place (tanpa re-render) biar card ga blink.
    answer(i) {
        if (QuizPage.currentAnswered()) return;
        QuizPage.answers[QuizPage.idx] = i;
        QuizPage._justAnswered = QuizPage.idx;
        const q = QuizPage.questions[QuizPage.idx];
        QuizPage.saveProg();
        if (typeof Track !== "undefined") Track.quizProgress(QuizPage.mapel.slug, QuizPage.idx + 1, QuizPage.questions.length);

        const box = document.getElementById("quizPlay");
        box.querySelectorAll(".opt").forEach(b => {
            const bi = parseInt(b.dataset.i, 10);
            b.disabled = true;
            if (bi === q.answer) b.classList.add("correct");
            else if (bi === i) b.classList.add("wrong");
            else b.classList.add("dim");
        });
        const exp = document.getElementById("qExp");
        if (exp && q.explanation) {
            exp.innerHTML = `<b>Pembahasan:</b><br>${ExamDB.esc(q.explanation)}`;
            exp.style.display = "block";
            ExamDB.renderMath(exp);
        }
        const navBtn = box.querySelector(`.nav-n[data-n="${QuizPage.idx}"]`);
        if (navBtn) {
            navBtn.classList.remove("active");
            navBtn.classList.add(i === q.answer ? "ok" : "bad");
        }
        if (QuizPage.autoNext) QuizPage.startAuto();
    },

    flash(msg) {
        const el = document.getElementById("quizFlash");
        if (!el) return;
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(QuizPage._t);
        QuizPage._t = setTimeout(() => el.classList.remove("show"), 1800);
    },

    finish() {
        const total = QuizPage.questions.length;
        let benar = 0;
        QuizPage.questions.forEach((q, i) => { if (QuizPage.answers[i] === q.answer) benar++; });
        const score = Math.round((benar / total) * 100);
        QuizPage.clearProg(QuizPage.mapel.slug);
        if (typeof Track !== "undefined") Track.quizFinish(QuizPage.mapel.slug, score, benar, total);
        const who = (ExamDB.profile() || {}).name || "";
        QuizPage.saveBest(QuizPage.mapel.slug, score, benar, total);
        // Catet ke exam_scores (riwayat per device, buat nilai pribadi).
        try {
            supa.from("exam_scores").insert({
                device_key: (typeof Track !== "undefined" ? Track.device() : "unknown"),
                name: who.trim() || "someone",
                class_slug: QuizPage.cls.slug,
                subject: QuizPage.mapel.slug,
                score, benar, total
            }).then(() => {}, () => {});
        } catch (e) { /* abaikan */ }

        const emoji = score === 100 ? "🏆" : score >= 80 ? "🔥" : score >= 60 ? "💪" : "📚";
        const msg = score === 100 ? "Sempurna! Pertahanin."
            : score >= 80 ? "Mantap! Dikit lagi sempurna."
            : score >= 60 ? "Lumayan, gas latihan lagi."
            : "Jangan nyerah — baca kisi-kisinya terus coba lagi.";

        const review = QuizPage.questions.map((q, i) => {
            const ok = QuizPage.answers[i] === q.answer;
            const opts = q.options || [];
            return `<details class="rev${ok ? " ok" : " bad"}">` +
                `<summary><b>${i + 1}.</b> ${ExamDB.esc(q.question)} ` +
                `<span class="rev-ic">${ok ? "✅" : "❌"}</span></summary>` +
                `<p>Jawabanmu: <b>${ExamDB.esc(opts[QuizPage.answers[i]] ?? "(kosong)")}</b><br>` +
                `Kunci: <b>${ExamDB.esc(opts[q.answer] ?? "-")}</b></p>` +
                (q.explanation ? `<p class="rev-exp">${ExamDB.esc(q.explanation)}</p>` : "") +
                `</details>`;
        }).join("");

        QuizPage.show("viewResult");
        document.getElementById("quizResult").innerHTML =
            `<div class="score-card"><div class="score-emoji">${emoji}</div>` +
            `<div class="score-num">${score}</div>` +
            `<p class="score-sub">${who ? ExamDB.esc(who) + " • " : ""}${benar}/${total} benar • ${ExamDB.esc(QuizPage.mapel.name)}</p>` +
            `<p class="score-msg">${msg}</p><div class="score-btns">` +
            `<button class="btn gold" id="rRetry"><i class="fa-solid fa-rotate-right"></i> Coba Lagi</button>` +
            `<button class="btn ghost" id="rHub"><i class="fa-solid fa-grid-2"></i> Mapel Lain</button>` +
            `<a class="btn ghost" href="kisi?id=${ExamDB.esc(QuizPage.cls.slug)}">` +
            `<i class="fa-solid fa-book-open"></i> Baca Kisi</a>` +
            `</div></div><h3 class="rev-title">Pembahasan</h3>${review}`;

        document.getElementById("rRetry").addEventListener("click", () => QuizPage.startQuiz(true));
        ExamDB.renderMath(document.getElementById("quizResult"));
        document.getElementById("rHub").addEventListener("click", () => {
            QuizPage.renderHub();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    },

    show(id) {
        QuizPage.clearTimer();
        QuizPage._justAnswered = -1;
        ["viewHub", "viewInfo", "viewQuiz", "viewResult"].forEach(v => {
            const el = document.getElementById(v);
            if (el) el.style.display = v === id ? "block" : "none";
        });
    },

    bindNav() {
        document.getElementById("backBtn").addEventListener("click", () => {
            const home = "kisi?id=" + encodeURIComponent(QuizPage.cls.slug);
            const vis = ["viewResult", "viewQuiz", "viewInfo", "viewHub"].find(v => {
                const el = document.getElementById(v);
                return el && el.style.display === "block";
            });
            // Hub (paling luar) -> balik ke kisi. Sisanya mundur satu level, tanpa reload.
            if (!vis || vis === "viewHub") { location.href = home; return; }
            if (vis === "viewInfo") { QuizPage.renderHub(); }
            else if (vis === "viewQuiz" && QuizPage.mapel) { QuizPage.openInfo(QuizPage.mapel.slug); }
            else { QuizPage.renderHub(); }
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
        document.getElementById("startBtn").addEventListener("click", () => QuizPage.startQuiz(false));
        const restartBtn = document.getElementById("restartBtn");
        if (restartBtn) restartBtn.addEventListener("click", () => QuizPage.startQuiz(true));
        document.addEventListener("keydown", QuizPage.onKey);
    },

    // Keyboard desktop: A–E / 1–5 jawab, Enter lanjut, Esc kembali.
    onKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = (e.target && e.target.tagName) || "";
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;

        const quizOn = document.getElementById("viewQuiz").style.display === "block";
        const resultOn = document.getElementById("viewResult").style.display === "block";
        if (!quizOn && !resultOn) return;

        // Biar Enter ga dobel sama tombol yang lagi kefokus.
        const focusedBtn = document.activeElement && document.activeElement.tagName === "BUTTON";

        if (quizOn) {
            const k = (e.key || "").toLowerCase();
            const letters = ["a", "b", "c", "d", "e"];
            const nums = ["1", "2", "3", "4", "5"];
            let pick = letters.indexOf(k);
            if (pick === -1) pick = nums.indexOf(k);
            if (pick !== -1) {
                const q = QuizPage.questions[QuizPage.idx];
                if (q && q.options && pick < q.options.length && !QuizPage.currentAnswered()) {
                    e.preventDefault();
                    QuizPage.answer(pick);
                }
                return;
            }
            if (e.key === "Enter" && !focusedBtn) {
                e.preventDefault();
                QuizPage.goNext();
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                if (QuizPage.idx > 0) {
                    QuizPage._justAnswered = -1;
                    QuizPage.idx--;
                    QuizPage.renderQ();
                } else if (QuizPage.mapel) {
                    QuizPage.openInfo(QuizPage.mapel.slug);
                }
            }
            return;
        }

        // Di layar nilai: Enter = coba lagi, Esc = mapel lain.
        if (e.key === "Enter" && !focusedBtn) {
            e.preventDefault();
            QuizPage.startQuiz();
        } else if (e.key === "Escape") {
            e.preventDefault();
            QuizPage.renderHub();
        }
    },

    // Lanjut ke soal berikut / lihat nilai (boleh kosong, dihitung salah).
    goNext() {
        QuizPage._justAnswered = -1;
        if (QuizPage.idx < QuizPage.questions.length - 1) {
            QuizPage.idx++;
            QuizPage.renderQ();
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            QuizPage.finish();
        }
    }
};

document.addEventListener("DOMContentLoaded", () => QuizPage.boot());
