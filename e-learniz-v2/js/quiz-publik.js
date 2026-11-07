// ============================================================
// quiz-publik.js — Halaman Latihan Soal PUBLIK (tanpa login)
// URL: a/quiz.html?id=xrpl1&mapel=mtk
// Isi: strip jadwal di atas, hub mapel per hari, runner bernilai.
// Nilai & best-score cuma di HP masing-masing (localStorage).
// ============================================================

const QuizPub = {
    classId: 2,
    classRow: null,
    classes: [],
    days: [],
    sched: {},
    fromMaster: false,
    subjects: [],   // [{id, name, icon, count}]
    // runner state
    mapel: null,
    questions: [],
    idx: 0,
    answers: [],    // idx -> pilihan user (int / null)
    bestKey: '',

    async boot() {
        if (typeof supabase === 'undefined') {
            document.getElementById('quizRoot').innerHTML =
                `<div class="pub-empty">Gagal nyambung ke database.<br>Cek koneksi terus refresh.</div>`;
            return;
        }
        const params = new URLSearchParams(location.search);
        const resolved = await PubExam.resolveClass(params.get('id') || '');
        QuizPub.classId = resolved.id;
        QuizPub.classRow = resolved.row;
        QuizPub.classes = resolved.classes;

        QuizPub.renderChips();

        const [sched, qRes, confRes] = await Promise.all([
            PubExam.loadSchedule(QuizPub.classId),
            supabase.from('simulation_questions').select('subject_id')
                .in('class_id', [0, QuizPub.classId]),
            supabase.from('subjects_config').select('subject_id, subject_name, icon')
        ]);

        QuizPub.days = sched.days;
        QuizPub.sched = sched.map;
        QuizPub.fromMaster = sched.fromMaster;

        const counts = {};
        (qRes.data || []).forEach(q => { counts[q.subject_id] = (counts[q.subject_id] || 0) + 1; });
        QuizPub.subjects = Object.keys(counts).map(id => {
            const conf = (confRes.data || []).find(c => c.subject_id === id);
            return {
                id,
                name: conf ? conf.subject_name : QuizPub.pretty(id),
                icon: conf ? conf.icon : 'fa-book',
                count: counts[id]
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        document.title = `Latihan Soal ${QuizPub.classRow.name || ''} • E-Learning Nizam`;
        QuizPub.renderJadwalStrip();
        QuizPub.renderHub();

        const mapelParam = (params.get('mapel') || '').toLowerCase();
        if (mapelParam) {
            const hit = QuizPub.subjects.find(s => s.id.toLowerCase() === mapelParam);
            if (hit) QuizPub.openInfo(hit.id);
        }
        QuizPub.bindNav();
    },

    pretty(id) {
        return String(id || '').replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    },

    bestKeyFor(mapelId) {
        return `exam_best_${QuizPub.classId}_${mapelId}`;
    },

    getBest(mapelId) {
        try {
            const v = JSON.parse(localStorage.getItem(QuizPub.bestKeyFor(mapelId)) || 'null');
            return (v && typeof v.score === 'number') ? v : null;
        } catch (e) { return null; }
    },

    saveBest(mapelId, score, benar, total) {
        try {
            const old = QuizPub.getBest(mapelId);
            if (!old || score > old.score) {
                localStorage.setItem(QuizPub.bestKeyFor(mapelId),
                    JSON.stringify({ score, benar, total, at: Date.now() }));
            }
        } catch (e) { /* storage penuh / private mode — skip */ }
    },

    // ============ CHIPS + JADWAL STRIP ============
    renderChips() {
        const wrap = document.getElementById('kelasChips');
        if (!wrap) return;
        if (!QuizPub.classes.length) {
            wrap.innerHTML = `<span class="chip on">${PubExam.esc(QuizPub.classRow.name || 'Kelas')}</span>`;
            return;
        }
        wrap.innerHTML = QuizPub.classes.map(c => {
            const on = Number(c.id) === Number(QuizPub.classId) ? ' on' : '';
            return `<a class="chip${on}" href="quiz?id=${c.id}">${PubExam.esc(c.name)}</a>`;
        }).join('');
        const title = document.getElementById('kelasTitle');
        if (title) title.textContent = QuizPub.classRow.name || '';
        const kisi = document.getElementById('topKisiLink');
        if (kisi) kisi.href = 'kisi-kisi?id=' + QuizPub.classId;
    },

    renderJadwalStrip() {
        const box = document.getElementById('jadwalStrip');
        if (!box) return;
        const order = PubExam.dayOrder(QuizPub.days);
        const adaJadwal = order.some(d => (QuizPub.sched[d] || []).length);
        if (!adaJadwal) {
            box.innerHTML = `<div class="strip-empty">Belum ada jadwal ujian.</div>`;
            return;
        }
        box.innerHTML = order.filter(d => (QuizPub.sched[d] || []).length).map((day, i) => {
            const rows = QuizPub.sched[day].map(e =>
                `<li>${PubExam.esc(e.mapel)}</li>`).join('');
            return `<div class="strip-day${i === 0 ? ' is-today' : ''}">` +
                `<b>${day}</b><ul>${rows}</ul></div>`;
        }).join('');
    },

    // ============ HUB MAPEL ============
    hubGroups() {
        const assigned = new Set();
        const groups = [];
        const order = PubExam.dayOrder(QuizPub.days);
        order.forEach(day => {
            const norms = QuizPub.sched[day] || [];
            const hit = QuizPub.subjects.filter(s => {
                const ok = norms.some(n => s.id.includes(n.norm) || n.norm.includes(s.id));
                if (ok) assigned.add(s.id);
                return ok;
            });
            if (hit.length) groups.push({ day, list: hit, today: day === order[0] });
        });
        const rest = QuizPub.subjects.filter(s => !assigned.has(s.id));
        if (rest.length) groups.push({ day: 'Lainnya', list: rest, today: false });
        return groups;
    },

    renderHub() {
        QuizPub.show('viewHub');
        const box = document.getElementById('mapelBox');
        if (!QuizPub.subjects.length) {
            box.innerHTML = `<div class="pub-empty">Belum ada soal buat kelas ini.<br>Cek berkala ya.</div>`;
            return;
        }
        box.innerHTML = QuizPub.hubGroups().map(g =>
            `<section class="hari${g.today ? ' is-today' : ''}${g.day === 'Lainnya' ? ' hari-other' : ''}">` +
            `<header class="hari-head"><h2>${g.day}</h2>` +
            (g.today ? `<span class="today-badge">HARI INI</span>` : '') + `</header>` +
            `<div class="mapel-grid">` + g.list.map(s => {
                const best = QuizPub.getBest(s.id);
                const bestBadge = best
                    ? `<span class="best">Terbaik: ${best.score}%</span>`
                    : `<span class="best none">Belum dicoba</span>`;
                return `<button class="mapel-card" data-mapel="${PubExam.esc(s.id)}">` +
                    `<i class="fa-solid ${PubExam.esc(s.icon)}"></i>` +
                    `<b>${PubExam.esc(s.name)}</b>` +
                    `<span class="count">${s.count} soal</span>${bestBadge}</button>`;
            }).join('') + `</div></section>`
        ).join('');
        box.querySelectorAll('.mapel-card').forEach(btn =>
            btn.addEventListener('click', () => QuizPub.openInfo(btn.dataset.mapel)));
    },

    // ============ INFO MAPEL ============
    openInfo(mapelId) {
        const s = QuizPub.subjects.find(x => x.id === mapelId);
        if (!s) return;
        QuizPub.mapel = s;
        QuizPub.show('viewInfo');
        document.getElementById('infoIcon').className = `fa-solid ${s.icon}`;
        document.getElementById('infoName').textContent = s.name;
        document.getElementById('infoCount').textContent = s.count;
        const best = QuizPub.getBest(s.id);
        document.getElementById('infoBest').textContent =
            best ? `Terbaik kamu: ${best.score}% (${best.benar}/${best.total} benar)` : 'Belum pernah dicoba di HP ini.';
    },

    async startQuiz() {
        if (!QuizPub.mapel) return;
        const box = document.getElementById('quizPlay');
        QuizPub.show('viewQuiz');
        box.innerHTML = `<div class="pub-empty">Nyiapin soal…</div>`;
        try {
            const { data, error } = await supabase.from('simulation_questions').select('*')
                .eq('subject_id', QuizPub.mapel.id)
                .in('class_id', [0, QuizPub.classId])
                .order('id', { ascending: true });
            if (error) throw error;
            QuizPub.questions = data || [];
        } catch (e) {
            box.innerHTML = `<div class="pub-empty">Gagal ambil soal.<br>${PubExam.esc(e.message || e)}</div>`;
            return;
        }
        if (!QuizPub.questions.length) {
            box.innerHTML = `<div class="pub-empty">Soalnya kosong.</div>`;
            return;
        }
        QuizPub.idx = 0;
        QuizPub.answers = new Array(QuizPub.questions.length).fill(null);
        QuizPub.renderQ();
    },

    // ============ RUNNER ============
    renderQ() {
        const q = QuizPub.questions[QuizPub.idx];
        const total = QuizPub.questions.length;
        const box = document.getElementById('quizPlay');
        const answered = QuizPub.answers[QuizPub.idx];

        const prefix = ['A', 'B', 'C', 'D', 'E'];
        const opts = (q.options || []).map((opt, i) => {
            let cls = 'opt';
            if (answered !== null && answered !== undefined) {
                if (i === q.answer) cls += ' correct';
                else if (i === answered) cls += ' wrong';
                else cls += ' dim';
            }
            return `<button class="${cls}" data-i="${i}"${answered !== null && answered !== undefined ? ' disabled' : ''}>` +
                `<span class="opt-pre">${prefix[i] || ''}</span><span>${PubExam.esc(opt)}</span></button>`;
        }).join('');

        const exp = (answered !== null && answered !== undefined && q.explanation)
            ? `<div class="exp"><b>Pembahasan:</b><br>${PubExam.esc(q.explanation)}</div>` : '';

        const nav = QuizPub.questions.map((_, i) => {
            let cls = 'nav-n';
            if (i === QuizPub.idx) cls += ' active';
            else if (QuizPub.answers[i] !== null && QuizPub.answers[i] !== undefined) {
                cls += QuizPub.answers[i] === QuizPub.questions[i].answer ? ' ok' : ' bad';
            }
            return `<button class="${cls}" data-n="${i}">${i + 1}</button>`;
        }).join('');

        box.innerHTML =
            `<div class="q-top"><span>SOAL ${QuizPub.idx + 1}/${total}</span><span>${QuizPub.mapel.name}</span></div>` +
            `<div class="pbar"><div style="width:${(QuizPub.idx / total) * 100}%"></div></div>` +
            `<div class="q-card"><p class="q-text">${PubExam.esc(q.question)}</p>` +
            `<div class="opts">${opts}</div>${exp}</div>` +
            `<div class="q-nav-row">` +
            `<button class="btn ghost" id="qPrev"${QuizPub.idx === 0 ? ' disabled' : ''}>` +
            `<i class="fa-solid fa-arrow-left"></i> Kembali</button>` +
            (QuizPub.idx < total - 1
                ? `<button class="btn" id="qNext">Lanjut <i class="fa-solid fa-arrow-right"></i></button>`
                : `<button class="btn gold" id="qFinish">Lihat Nilai <i class="fa-solid fa-flag-checkered"></i></button>`) +
            `</div><div class="q-nav">${nav}</div>`;

        box.querySelectorAll('.opt').forEach(b =>
            b.addEventListener('click', () => QuizPub.answer(parseInt(b.dataset.i, 10))));
        box.querySelectorAll('.nav-n').forEach(b =>
            b.addEventListener('click', () => {
                QuizPub.idx = parseInt(b.dataset.n, 10);
                QuizPub.renderQ();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }));
        const prev = document.getElementById('qPrev');
        if (prev) prev.addEventListener('click', () => {
            if (QuizPub.idx > 0) { QuizPub.idx--; QuizPub.renderQ(); }
        });
        const next = document.getElementById('qNext');
        if (next) next.addEventListener('click', () => {
            if (QuizPub.answers[QuizPub.idx] === null || QuizPub.answers[QuizPub.idx] === undefined) {
                QuizPub.flash('Pilih dulu satu jawaban.');
                return;
            }
            QuizPub.idx++; QuizPub.renderQ();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        const fin = document.getElementById('qFinish');
        if (fin) fin.addEventListener('click', () => {
            if (QuizPub.answers[QuizPub.idx] === null || QuizPub.answers[QuizPub.idx] === undefined) {
                QuizPub.flash('Pilih dulu satu jawaban.');
                return;
            }
            QuizPub.finish();
        });
    },

    answer(i) {
        if (QuizPub.answers[QuizPub.idx] !== null && QuizPub.answers[QuizPub.idx] !== undefined) return;
        QuizPub.answers[QuizPub.idx] = i;
        QuizPub.renderQ();
    },

    flash(msg) {
        let el = document.getElementById('quizFlash');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(QuizPub._flashT);
        QuizPub._flashT = setTimeout(() => el.classList.remove('show'), 1800);
    },

    finish() {
        const total = QuizPub.questions.length;
        let benar = 0;
        QuizPub.questions.forEach((q, i) => { if (QuizPub.answers[i] === q.answer) benar++; });
        const score = Math.round((benar / total) * 100);
        QuizPub.saveBest(QuizPub.mapel.id, score, benar, total);

        const emoji = score === 100 ? '🏆' : score >= 80 ? '🔥' : score >= 60 ? '💪' : '📚';
        const msg = score === 100 ? 'Sempurna! Pertahanin.'
            : score >= 80 ? 'Mantap! Dikit lagi sempurna.'
            : score >= 60 ? 'Lumayan, gas latihan lagi.'
            : 'Jangan nyerah — baca kisi-kisinya terus coba lagi.';

        const review = QuizPub.questions.map((q, i) => {
            const ok = QuizPub.answers[i] === q.answer;
            const opts = q.options || [];
            return `<details class="rev${ok ? ' ok' : ' bad'}">` +
                `<summary><b>${i + 1}.</b> ${PubExam.esc(q.question)} ` +
                `<span class="rev-ic">${ok ? '✅' : '❌'}</span></summary>` +
                `<p>Jawabanmu: <b>${PubExam.esc(opts[QuizPub.answers[i]] ?? '(kosong)')}</b><br>` +
                `Kunci: <b>${PubExam.esc(opts[q.answer] ?? '-')}</b></p>` +
                (q.explanation ? `<p class="rev-exp">${PubExam.esc(q.explanation)}</p>` : '') +
                `</details>`;
        }).join('');

        QuizPub.show('viewResult');
        document.getElementById('quizResult').innerHTML =
            `<div class="score-card"><div class="score-emoji">${emoji}</div>` +
            `<div class="score-num">${score}</div>` +
            `<p class="score-sub">${benar}/${total} benar • ${PubExam.esc(QuizPub.mapel.name)}</p>` +
            `<p class="score-msg">${msg}</p>` +
            `<div class="score-btns">` +
            `<button class="btn gold" id="rRetry"><i class="fa-solid fa-rotate-right"></i> Coba Lagi</button>` +
            `<button class="btn ghost" id="rHub"><i class="fa-solid fa-grid-2"></i> Mapel Lain</button>` +
            `<a class="btn ghost" href="kisi-kisi?id=${QuizPub.classId}"><i class="fa-solid fa-book-open"></i> Baca Kisi</a>` +
            `</div></div>` +
            `<h3 class="rev-title">Pembahasan</h3>${review}`;

        document.getElementById('rRetry').addEventListener('click', () => QuizPub.startQuiz());
        document.getElementById('rHub').addEventListener('click', () => {
            QuizPub.renderHub();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ============ NAV VIEW ============
    show(id) {
        ['viewHub', 'viewInfo', 'viewQuiz', 'viewResult'].forEach(v => {
            const el = document.getElementById(v);
            if (el) el.style.display = v === id ? 'block' : 'none';
        });
    },

    bindNav() {
        const back = document.getElementById('backBtn');
        if (back) back.addEventListener('click', () => {
            const vis = ['viewResult', 'viewQuiz', 'viewInfo'].find(v => {
                const el = document.getElementById(v);
                return el && el.style.display === 'block';
            });
            if (vis === 'viewInfo' || !vis) {
                location.href = 'quiz?id=' + QuizPub.classId;
                return;
            }
            if (vis === 'viewQuiz') {
                const s = QuizPub.mapel;
                if (s) QuizPub.openInfo(s.id);
                return;
            }
            QuizPub.renderHub();
        });
        const start = document.getElementById('startBtn');
        if (start) start.addEventListener('click', () => QuizPub.startQuiz());
    }
};

document.addEventListener('DOMContentLoaded', () => QuizPub.boot());
