// ============================================================
// kisi-publik.js — Halaman Kisi-Kisi PUBLIK (tanpa login)
// URL: a/kisi-kisi.html?id=xrpl1  (slug ATAU angka, default XI - RPL 2)
// Isi: Jadwal ujian di atas, kisi-kisi per hari di bawah.
// Sumber: daily_schedules (exam) + subject_announcements (kisi-kisi).
// ============================================================

const KisiPub = {
    classId: 2,
    classRow: null,
    classes: [],
    days: [],
    sched: {},
    fromMaster: false,
    items: [],       // kisi rows (sudah dedupe)
    quizCounts: {},  // subject_id -> jumlah soal
    quizIds: [],     // subject_id yg ada soalnya

    COLOR_CLASS: {
        blue: 'acc-blue', orange: 'acc-orange', brown: 'acc-brown',
        purple: 'acc-purple', green: 'acc-green', red: 'acc-red'
    },

    async boot() {
        if (typeof supabase === 'undefined') {
            const fb = document.getElementById('kisiBox') || document.body;
            fb.innerHTML =
                `<div class="pub-empty">Gagal nyambung ke database.<br>Cek koneksi terus refresh.</div>`;
            return;
        }
        const param = new URLSearchParams(location.search).get('id') || '';
        const resolved = await PubExam.resolveClass(param);
        KisiPub.classId = resolved.id;
        KisiPub.classRow = resolved.row;
        KisiPub.classes = resolved.classes;

        KisiPub.renderChips();

        const [sched, kisiRes, quizRes] = await Promise.all([
            PubExam.loadSchedule(KisiPub.classId),
            supabase.from('subject_announcements').select('*')
                .eq('subject_id', 'kisi-kisi')
                .in('class_id', [KisiPub.classId, PubExam.MASTER_CLASS_ID])
                .order('display_order', { ascending: true }),
            supabase.from('simulation_questions').select('subject_id')
                .in('class_id', [0, KisiPub.classId])
        ]);

        KisiPub.days = sched.days;
        KisiPub.sched = sched.map;
        KisiPub.fromMaster = sched.fromMaster;
        KisiPub.items = KisiPub.dedupe(kisiRes.data || []);

        const counts = {};
        (quizRes.data || []).forEach(q => { counts[q.subject_id] = (counts[q.subject_id] || 0) + 1; });
        KisiPub.quizCounts = counts;
        KisiPub.quizIds = Object.keys(counts);

        document.title = `Kisi-Kisi ${KisiPub.classRow.name || ''} • E-Learning Nizam`;
        KisiPub.renderJadwal();
        KisiPub.renderKisi('');
        KisiPub.setupSearch();
    },

    // Kalo mapel yg sama ada di kelas sendiri + master, pake punya kelas sendiri.
    dedupe(rows) {
        const byNorm = {};
        rows.forEach(r => {
            const norm = PubExam.norm(PubExam.extractSubject(r.big_title));
            if (!norm) return;
            if (!byNorm[norm] || Number(r.class_id) === KisiPub.classId) byNorm[norm] = r;
        });
        return Object.values(byNorm);
    },

    accClass(color) {
        return KisiPub.COLOR_CLASS[color] || 'acc-blue';
    },

    // subject_id quiz yg paling cocok sama norm kisi (buat tombol latihan).
    matchQuizId(normSubject) {
        if (!normSubject) return null;
        const hit = KisiPub.quizIds.find(id =>
            id.includes(normSubject) || normSubject.includes(id));
        return hit || null;
    },

    // ============ CHIPS KELAS ============
    renderChips() {
        const wrap = document.getElementById('kelasChips');
        if (!wrap) return;
        if (!KisiPub.classes.length) {
            wrap.innerHTML = `<span class="chip on">${PubExam.esc(KisiPub.classRow.name || 'Kelas')}</span>`;
            return;
        }
        wrap.innerHTML = KisiPub.classes.map(c => {
            const on = Number(c.id) === Number(KisiPub.classId) ? ' on' : '';
            return `<a class="chip${on}" href="kisi-kisi?id=${c.id}">${PubExam.esc(c.name)}</a>`;
        }).join('');
        const title = document.getElementById('kelasTitle');
        if (title) title.textContent = KisiPub.classRow.name || '';
    },

    // ============ JADWAL (ATAS) ============
    renderJadwal() {
        const box = document.getElementById('jadwalBox');
        if (!box) return;
        const order = PubExam.dayOrder(KisiPub.days);
        const kisiNorms = new Set(KisiPub.items.map(k =>
            PubExam.norm(PubExam.extractSubject(k.big_title))));

        let html = '';
        if (KisiPub.fromMaster) {
            html += `<div class="jadwal-note"><i class="fa-solid fa-circle-info"></i> ` +
                `Kelas ini belum punya jadwal sendiri — nampilin <b>Jadwal Pusat (XI - RPL 2)</b>.</div>`;
        }

        const adaJadwal = order.some(d => (KisiPub.sched[d] || []).length);
        if (!adaJadwal) {
            box.innerHTML = html + `<div class="pub-empty">Belum ada jadwal ujian.<br>Tunggu info dari admin ya.</div>`;
            return;
        }

        order.forEach((day, i) => {
            const list = KisiPub.sched[day] || [];
            if (!list.length) return;
            const todayBadge = i === 0 ? `<span class="today-badge">HARI INI</span>` : '';
            html += `<section class="hari${i === 0 ? ' is-today' : ''}">` +
                `<header class="hari-head"><h2>${day}</h2>${todayBadge}</header><ol class="jadwal-list">`;
            list.forEach(e => {
                const hasKisi = kisiNorms.has(e.norm);
                const label = hasKisi
                    ? `<a class="jl-mapel has-kisi" href="#kisi-${e.norm}">${PubExam.esc(e.mapel)}</a>`
                    : `<span class="jl-mapel no-kisi">${PubExam.esc(e.mapel)}</span>`;
                const jam = e.jam ? `<span class="jl-jam">${PubExam.esc(e.jam)}</span>` : '';
                const cek = hasKisi ? `<i class="fa-solid fa-circle-check jl-cek" title="Ada kisi-kisi"></i>` : '';
                html += `<li class="jl-row">${jam}${label}${cek}</li>`;
            });
            html += `</ol></section>`;
        });
        box.innerHTML = html;
    },

    // ============ KISI-KISI (BAWAH) ============
    grouped(keyword) {
        const kw = PubExam.norm(keyword);
        const items = KisiPub.items.filter(k => {
            if (!kw) return true;
            const hay = PubExam.norm(
                (k.big_title || '') + ' ' + (k.title || '') + ' ' +
                (k.content || '').replace(/<[^>]+>/g, ' '));
            return hay.includes(kw);
        });
        const grouped = {};
        const unassigned = [];
        items.forEach(k => {
            const norm = PubExam.norm(PubExam.extractSubject(k.big_title));
            const day = PubExam.findDay(norm, KisiPub.sched, KisiPub.days);
            if (day) { (grouped[day] = grouped[day] || []).push(k); }
            else unassigned.push(k);
        });
        return { grouped, unassigned };
    },

    cardHTML(k) {
        const rawSubject = PubExam.extractSubject(k.big_title);
        const norm = PubExam.norm(rawSubject);
        const quizId = KisiPub.matchQuizId(norm);
        const quizBtn = quizId
            ? `<a class="kisi-quiz-btn" href="quiz?id=${KisiPub.classId}&mapel=${quizId}">` +
              `<i class="fa-solid fa-graduation-cap"></i> Latihan soal ` +
              `<small>(${KisiPub.quizCounts[quizId]} soal)</small></a>`
            : '';
        const media = PubMedia.galleryHTML(PubMedia.parseList(k.photo_url));
        const body = PubExam.cleanHTML(k.content || '');
        return `<article class="kisi-card ${KisiPub.accClass(k.card_color)}" id="kisi-${norm}">` +
            `<p class="kisi-eyebrow">${PubExam.esc(k.big_title || '')}</p>` +
            `<h3 class="kisi-subject">${PubExam.esc(rawSubject)}</h3>` +
            (k.title ? `<p class="kisi-title">${PubExam.esc(k.title)}</p>` : '') +
            (body ? `<div class="kisi-body">${body}</div>` : '') +
            media + quizBtn +
            (k.small ? `<p class="kisi-small">${PubExam.esc(k.small)}</p>` : '') +
            `</article>`;
    },

    renderKisi(keyword) {
        const box = document.getElementById('kisiBox');
        if (!box) return;
        const { grouped, unassigned } = KisiPub.grouped(keyword);
        const order = PubExam.dayOrder(KisiPub.days);
        let html = '';

        if (!KisiPub.items.length) {
            box.innerHTML = `<div class="pub-empty">Belum ada kisi-kisi buat kelas ini.<br>Cek berkala ya.</div>`;
            return;
        }

        order.forEach((day, i) => {
            const list = grouped[day] || [];
            if (keyword && !list.length) return;
            const todayBadge = i === 0 && !keyword ? `<span class="today-badge">HARI INI</span>` : '';
            html += `<section class="hari${i === 0 && !keyword ? ' is-today' : ''}">` +
                `<header class="hari-head"><h2>${day}</h2>${todayBadge}</header>`;
            html += list.length
                ? list.map(k => KisiPub.cardHTML(k)).join('')
                : `<p class="hari-empty">Belum ada kisi buat hari ${day}.</p>`;
            html += `</section>`;
        });

        if (unassigned.length) {
            html += `<section class="hari hari-other"><header class="hari-head"><h2>Lainnya</h2></header>` +
                unassigned.map(k => KisiPub.cardHTML(k)).join('') + `</section>`;
        }

        if (keyword && !html) {
            box.innerHTML = `<div class="pub-empty">Ga ketemu yang cocok sama "<b>${PubExam.esc(keyword)}</b>".</div>`;
            return;
        }
        box.innerHTML = html;
    },

    setupSearch() {
        const input = document.getElementById('kisiSearch');
        if (!input) return;
        let timer = null;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => KisiPub.renderKisi(input.value.trim()), 200);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => KisiPub.boot());
