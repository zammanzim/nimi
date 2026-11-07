// ============================================================
// pub-exam.js — Shared helper halaman ujian publik (kisi-kisi & quiz)
// - Resolve ?id= (slug kayak xrpl1 ATAU angka) jadi class_id.
// - Fetch jadwal ujian (daily_schedules type='exam') + kisi_days.
// - Normalisasi nama mapel + urutan hari (hari-ini-dulu).
// Halaman ini PUBLIK: tanpa login, tanpa sidebar, tanpa SubjectApp.
// ============================================================

const PubExam = {

    MASTER_CLASS_ID: 2,

    // Kata non-mapel yang di-skip dari jadwal (istirahat, cek2an, dll).
    BLACKLIST: [
        'istirahat', 'upacara', 'senampagi', 'senam', 'pulang', 'sholat',
        'shalat', 'jumatan', 'makan', 'ishoma', 'ekskul', 'pembiasaan',
        'literasi', 'bersih', 'piket', 'dhuha', 'dzuhur', 'duhur', 'ashar',
        'masuk', 'apel', 'persiapkan', 'cektugas', 'cekhalaman', 'cek'
    ],

    norm(str) {
        return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    },

    isNoise(normName) {
        if (!normName || normName.length < 2) return true;
        return PubExam.BLACKLIST.some(b => normName.includes(b));
    },

    // "Kisi - Kisi Bahasa Indonesia" -> "Bahasa Indonesia".
    // Kalo ga cocok pola, balikin big_title apa adanya.
    extractSubject(bigTitle) {
        if (!bigTitle) return '';
        const m = String(bigTitle).match(/kisi\s*[-–—]?\s*kisi\s+(.+)/i);
        return (m ? m[1] : String(bigTitle)).trim();
    },

    // Pecah 1 entri jadwal "07.30 - 08.30 - Matematika" jadi { jam, mapel }.
    // Kalo ga ada jam ("Matematika" doang), jam = ''.
    parseEntry(raw) {
        const s = String(raw || '').trim();
        if (!s) return null;
        const idx = s.lastIndexOf('-');
        if (idx === -1) return { jam: '', mapel: s };
        const jam = s.substring(0, idx).trim();
        const mapel = s.substring(idx + 1).trim();
        // Jam valid kalo ada angka+titik/d titik dua ("07.30 - 08.30").
        // Kalo depannya bukan jam (mis. "17.32 - Cek halaman"), tetep simpen
        // tapi nanti ke-filter sebagai noise kalo mapelnya noise.
        if (!mapel) return null;
        return { jam: /[\d:?]/.test(jam) ? jam : '', mapel };
    },

    // Urutan hari: hari-ini-dulu (lewat jam 15:00 dianggap besok).
    // Weekend / ga ketemu -> urutan config apa adanya.
    dayOrder(days) {
        const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const now = new Date();
        let today = names[now.getDay()];
        if (now.getHours() >= 15) {
            const tom = new Date(now);
            tom.setDate(now.getDate() + 1);
            today = names[tom.getDay()];
        }
        const idx = days.indexOf(today);
        if (idx === -1) return [...days];
        return [...days.slice(idx), ...days.slice(0, idx)];
    },

    // Resolve ?id= jadi { id, row }. Dukung:
    // - angka ("2"), - slug ("xrpl1", "xirpl1", "rpl1"), - nama ("XI - RPL 1").
    // Ga ketemu -> default kelas 2 (XI - RPL 2).
    async resolveClass(param) {
        const fallbackId = 2;
        let classes = [];
        try {
            const { data, error } = await supabase
                .from('classes').select('id, name, is_active, academic_year')
                .eq('is_active', true).order('id');
            if (error) throw error;
            classes = data || [];
        } catch (e) {
            console.warn('Gagal fetch classes:', e);
        }
        if (!classes.length) {
            return { id: fallbackId, row: { id: fallbackId, name: 'XI - RPL 2' }, classes: [] };
        }

        const normParam = PubExam.norm(param);
        const numParam = parseInt(param, 10);
        let found = null;

        if (Number.isFinite(numParam)) {
            found = classes.find(c => Number(c.id) === numParam) || null;
        }
        if (!found && normParam) {
            // 1. Cocok nama dinormalisasi persis ("xirpl1").
            found = classes.find(c => PubExam.norm(c.name) === normParam) || null;
            // 2. Cocok angka buntut ("xrpl1" -> kelas yang namanya buntut "1").
            if (!found) {
                const digit = (normParam.match(/(\d+)\s*$/) || [])[1];
                if (digit) {
                    found = classes.find(c => {
                        const cn = PubExam.norm(c.name);
                        const cd = (cn.match(/(\d+)$/) || [])[1];
                        return cd === digit;
                    }) || null;
                }
            }
        }
        if (!found) found = classes.find(c => Number(c.id) === fallbackId) || classes[0];
        return { id: Number(found.id), row: found, classes };
    },

    // Ambil kisi_days + jadwal exam buat 1 kelas.
    // Return { days, map: {Senin: [{jam, mapel, norm}]}, fromMaster }.
    // Kalo kelas ga punya jadwal sendiri, fallback ke master (kelas 2).
    async loadSchedule(classId) {
        let days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
        let map = {};
        let fromMaster = false;

        const fetchFor = async (cid) => {
            const [cfgRes, schRes] = await Promise.all([
                supabase.from('daily_config').select('mode, kisi_days').eq('class_id', String(cid)).maybeSingle(),
                supabase.from('daily_schedules').select('day_name, lessons')
                    .eq('class_id', String(cid)).eq('type', 'exam')
            ]);
            return { cfg: cfgRes.data || null, sch: schRes.data || [] };
        };

        try {
            // Kalo master lagi mode exam global, semua kelas ikut master.
            let target = classId;
            try {
                const { data: masterCfg } = await supabase.from('daily_config')
                    .select('mode, kisi_days').eq('class_id', String(PubExam.MASTER_CLASS_ID)).maybeSingle();
                if (masterCfg && masterCfg.mode === 'exam' && Number(classId) !== PubExam.MASTER_CLASS_ID) {
                    target = PubExam.MASTER_CLASS_ID;
                    fromMaster = true;
                    if (masterCfg.kisi_days && masterCfg.kisi_days.length) days = masterCfg.kisi_days;
                }
            } catch (e) { /* abaikan, lanjut jadwal sendiri */ }

            let { cfg, sch } = await fetchFor(target);
            if (cfg && cfg.kisi_days && cfg.kisi_days.length) days = cfg.kisi_days;

            // Jadwal sendiri kosong -> fallback master biar ga kopong.
            if ((!sch || !sch.length) && Number(target) !== PubExam.MASTER_CLASS_ID) {
                const fb = await fetchFor(PubExam.MASTER_CLASS_ID);
                if (fb.sch && fb.sch.length) {
                    sch = fb.sch; fromMaster = true;
                    if (fb.cfg && fb.cfg.kisi_days && fb.cfg.kisi_days.length) days = fb.cfg.kisi_days;
                }
            }

            (sch || []).forEach(s => {
                const list = String(s.lessons || '').split(';')
                    .map(PubExam.parseEntry)
                    .filter(Boolean)
                    .map(e => ({ jam: e.jam, mapel: e.mapel, norm: PubExam.norm(e.mapel) }))
                    .filter(e => !PubExam.isNoise(e.norm));
                if (list.length) map[s.day_name] = list;
            });
        } catch (e) {
            console.warn('Gagal fetch jadwal:', e);
        }
        return { days, map, fromMaster };
    },

    // Cari hari ujian buat 1 norm mapel. Return nama hari / null.
    findDay(normSubject, schedMap, days) {
        if (!normSubject || normSubject.length < 2) return null;
        for (const day of days) {
            const list = schedMap[day] || [];
            if (list.some(e => subject.includes(e.norm) || e.norm.includes(subject))) return day;
        }
        return null;
    },

    // Bersihin HTML konten card: buang <script>/<iframe>, balikin aman.
    cleanHTML(html) {
        try {
            const tpl = document.createElement('template');
            tpl.innerHTML = String(html || '');
            tpl.content.querySelectorAll('script, iframe, object, embed').forEach(n => n.remove());
            tpl.content.querySelectorAll('*').forEach(n => {
                [...n.attributes].forEach(a => {
                    if (/^on/i.test(a.name)) n.removeAttribute(a.name);
                });
            });
            return tpl.innerHTML;
        } catch (e) { return String(html || ''); }
    },

    esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
};

if (typeof window !== "undefined") window.PubExam = PubExam;
