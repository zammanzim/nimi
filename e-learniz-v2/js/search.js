document.addEventListener('DOMContentLoaded', initSearchPage);

let searchTimer;
let _allClasses = [];       // cache daftar kelas
let _activeClassId = null;  // kelas yang lagi dibuka

// ── INIT ─────────────────────────────────────────────────────────
async function initSearchPage() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) { window.location.href = 'index'; return; }

    const headerName = document.getElementById('headerName');
    const headerPP   = document.getElementById('headerPP');
    if (headerName) headerName.innerText = `${t('hi')}, ${user.full_name.split(' ')[0]}`;
    if (headerPP && headerPP.getAttribute('src') !== (user.avatar_url || 'icons/profpicture.png')) headerPP.src = user.avatar_url || 'icons/profpicture.png';

    await loadClasses();
    showClassList();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            const q = searchInput.value.trim();
            if (q === '') {
                if (_activeClassId) showStudents(_activeClassId);
                else showClassList();
                return;
            }
            searchTimer = setTimeout(() => searchUser(q), 200);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimer);
                const q = searchInput.value.trim();
                if (q) searchUser(q);
            }
        });
    }
}

// ── LOAD KELAS ───────────────────────────────────────────────────
async function loadClasses() {
    try {
        const { data, error } = await supabase
            .from('classes')
            .select('id, name')
            .order('name', { ascending: true });
        if (error) throw error;
        _allClasses = data || [];
    } catch (err) {
        console.error('Load classes gagal:', err);
    }
}

// ── RENDER DAFTAR KELAS ──────────────────────────────────────────
function getClassLevel(name) {
    // Deteksi angka di depan: "10", "11", "12" atau Roman: "X", "XI", "XII"
    const s = name.trim().toUpperCase();
    if (/^XII/.test(s) || /^12/.test(s)) return '12';
    if (/^XI/.test(s)  || /^11/.test(s)) return '11';
    if (/^X/.test(s)   || /^10/.test(s)) return '10';
    return 'lainnya';
}

async function showClassList() {
    _activeClassId = null;
    setBackBtn(false);

    const container = document.getElementById('userResultList');
    container.innerHTML = '';

    if (_allClasses.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:30px;color:#aaa;">Tidak ada kelas ditemukan.</p>';
        return;
    }

    // Fetch jumlah siswa per kelas
    let countMap = {};
    try {
        const { data } = await supabase.from('users').select('class_id');
        (data || []).forEach(u => {
            countMap[u.class_id] = (countMap[u.class_id] || 0) + 1;
        });
    } catch (_) {}

    const myClassId = String(getEffectiveClassId());
    const sorted = [..._allClasses].sort((a, b) => a.name.localeCompare(b.name));

    const label = document.createElement('div');
    label.className = 'class-divider animate-fade-in';
    label.innerHTML = '<span>SEMUA KELAS</span>';
    container.appendChild(label);

    // Group kelas per tingkat, kelas sendiri tetap di atas sendiri
    const myClass   = sorted.find(c => String(c.id) === myClassId);
    const others    = sorted.filter(c => String(c.id) !== myClassId);

    // Render kelas sendiri dulu (kalau ada)
    if (myClass) {
        renderClassCard(container, myClass, true, countMap[myClass.id] || 0);
    }

    // Group sisa kelas per tingkat
    const groups = {};
    others.forEach(cls => {
        const lvl = getClassLevel(cls.name);
        if (!groups[lvl]) groups[lvl] = [];
        groups[lvl].push(cls);
    });

    const levelOrder = ['10', '11', '12', 'lainnya'];
    levelOrder.forEach(lvl => {
        if (!groups[lvl] || groups[lvl].length === 0) return;
        const lvlLabel = lvl === 'lainnya' ? 'LAINNYA' : `KELAS ${lvl}`;
        const divider = document.createElement('div');
        divider.className = 'class-divider animate-fade-in';
        divider.innerHTML = `<span>${lvlLabel}</span>`;
        container.appendChild(divider);

        groups[lvl].forEach(cls => {
            renderClassCard(container, cls, false, countMap[cls.id] || 0);
        });
    });
}

function renderClassCard(container, cls, isMine, count) {
    const card = document.createElement('div');
    card.className = 'course-card animate-pop-in';
    card.style.cssText = 'display:flex;align-items:center;gap:15px;margin-bottom:12px;padding:15px;cursor:pointer;';
    card.onclick = () => showStudents(cls.id, cls.name);
    card.innerHTML = `
        <div style="width:48px;height:48px;border-radius:12px;flex-shrink:0;background:rgba(0,234,255,0.08);border:1px solid rgba(0,234,255,${isMine ? '0.5' : '0.15'});display:flex;align-items:center;justify-content:center;">
            <i class="fa-solid fa-users" style="margin:0;font-size:18px;color:${isMine ? 'var(--accent,#00eaff)' : 'rgba(255,255,255,0.3)'};"></i>
        </div>
        <div style="flex:1;min-width:0;">
            <h3 style="margin:0;font-size:15px;color:#fff;">
                ${cls.name}${isMine ? ` <span style="font-size:10px;color:var(--accent,#00eaff);font-weight:400;margin-left:6px;">${t('your_class_badge')}</span>` : ''}
            </h3>
            <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.35);">${count} siswa</p>
        </div>
        <i class="fa-solid fa-chevron-right" style="margin:0;color:rgba(255,255,255,0.2);font-size:13px;flex-shrink:0;"></i>
    `;
    container.appendChild(card);
}

// ── RENDER SISWA SATU KELAS ───────────────────────────────────────
async function showStudents(classId, className) {
    _activeClassId = classId;

    const cls  = _allClasses.find(c => String(c.id) === String(classId));
    const name = className || cls?.name || t('class') + ' ' + classId;

    setBackBtn(true);

    const container = document.getElementById('userResultList');
    container.innerHTML = `
        <div class="sk-card"><div class="skeleton sk-title"></div><div class="skeleton sk-text"></div></div>
        <div class="sk-card"><div class="skeleton sk-title"></div><div class="skeleton sk-text"></div></div>
        <div class="sk-card"><div class="skeleton sk-title"></div><div class="skeleton sk-text"></div></div>
    `;

    try {
        const user = JSON.parse(localStorage.getItem("user"));
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, short_name, username, avatar_url, class_id')
            .eq('class_id', classId)
            .order('full_name', { ascending: true });

        if (error) throw error;

        container.innerHTML = '';

        const divider = document.createElement('div');
        divider.className = 'class-divider animate-fade-in';
        divider.innerHTML = '<span>' + name.toUpperCase() + '</span>';
        container.appendChild(divider);

        if (!data || data.length === 0) {
            container.innerHTML += '<p style="text-align:center;padding:30px;color:#aaa;">' + t('no_students_in_class') + '</p>';
            return;
        }

        data.forEach(u => {
            const isSelf = String(u.id) === String(user.id);
            const card = document.createElement('div');
            card.className = 'course-card animate-pop-in';
            card.style.cssText = 'display:flex;align-items:center;gap:15px;margin-bottom:12px;padding:15px;cursor:pointer;';
            card.onclick = () => viewPublicProfile(u.id);
            card.innerHTML = `
                <img src="${u.avatar_url || 'icons/profpicture.png'}" style="width:55px;height:55px;border-radius:50%;border:2px solid var(--accent,#00eaff);object-fit:cover;flex-shrink:0;" onerror="this.src='icons/profpicture.png'">
                <div style="flex:1;min-width:0;">
                    <h3 style="margin:0;font-size:15px;color:#fff;">${u.full_name}${isSelf ? ' <span style="font-size:11px;color:var(--accent,#00eaff);font-weight:400;">(Anda)</span>' : ''}</h3>
                    <p style="margin:2px 0;font-size:12px;color:var(--accent,#00eaff);">@${u.username || u.short_name || '-'}</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="margin:0;color:rgba(255,255,255,0.25);font-size:13px;flex-shrink:0;"></i>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Load siswa gagal:', err);
        container.innerHTML = '<p style="color:#ff4757;text-align:center;padding:20px;">Gagal memuat data.</p>';
    }
}

// ── SEARCH QUERY ─────────────────────────────────────────────────
async function searchUser(query) {
    setBackBtn(false);

    const container = document.getElementById('userResultList');
    container.innerHTML = `
        <div class="sk-card"><div class="skeleton sk-title"></div><div class="skeleton sk-text"></div></div>
        <div class="sk-card"><div class="skeleton sk-title"></div><div class="skeleton sk-text"></div></div>
    `;

    try {
        const user = JSON.parse(localStorage.getItem("user"));
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, short_name, username, avatar_url, class_id, classes(name)')
            .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
            .limit(50);

        if (error) throw error;

        const myClassId = String(getEffectiveClassId() || user.class_id);
        data.sort((a, b) => {
            const aIsMine = String(a.class_id) === myClassId;
            const bIsMine = String(b.class_id) === myClassId;
            if (aIsMine && !bIsMine) return -1;
            if (!aIsMine && bIsMine) return 1;
            const aClass = a.classes?.name || '';
            const bClass = b.classes?.name || '';
            if (aClass !== bClass) return aClass.localeCompare(bClass);
            return a.full_name.localeCompare(b.full_name);
        });

        container.innerHTML = '';

        if (data.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:30px;color:#aaa;">' + t('account_not_found') + '</p>';
            return;
        }

        let lastClass = null;
        data.forEach(u => {
            const currentClass = u.classes?.name || 'UMUM';
            if (currentClass !== lastClass) {
                const divider = document.createElement('div');
                divider.className = 'class-divider animate-fade-in';
                divider.innerHTML = '<span>' + currentClass.toUpperCase() + '</span>';
                container.appendChild(divider);
                lastClass = currentClass;
            }
            const isSelf = String(u.id) === String(user.id);
            const card = document.createElement('div');
            card.className = 'course-card animate-pop-in';
            card.style.cssText = 'display:flex;align-items:center;gap:15px;margin-bottom:12px;padding:15px;cursor:pointer;';
            card.onclick = () => viewPublicProfile(u.id);
            card.innerHTML = `
                <img src="${u.avatar_url || 'icons/profpicture.png'}" style="width:55px;height:55px;border-radius:50%;border:2px solid var(--accent,#00eaff);object-fit:cover;flex-shrink:0;" onerror="this.src='icons/profpicture.png'">
                <div style="flex:1;min-width:0;">
                    <h3 style="margin:0;font-size:15px;color:#fff;">${u.full_name}${isSelf ? ' <span style="font-size:11px;color:var(--accent,#00eaff);font-weight:400;">(Anda)</span>' : ''}</h3>
                    <p style="margin:2px 0;font-size:12px;color:var(--accent,#00eaff);">@${u.username || u.short_name || '-'}</p>
                    <p style="margin:1px 0 0;font-size:11px;color:rgba(255,255,255,0.3);">${currentClass}</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="margin:0;color:rgba(255,255,255,0.25);font-size:13px;flex-shrink:0;"></i>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Search gagal:', err);
    }
}

// ── TOMBOL BACK ──────────────────────────────────────────────────
function setBackBtn(show) {
    let wrap = document.getElementById('searchBackWrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'searchBackWrap';
        wrap.style.cssText = 'display:none;margin-bottom:14px;';
        wrap.innerHTML = `
            <button onclick="backToClasses()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:10px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-arrow-left" style="margin:0;font-size:12px;"></i> ${t('all_classes')}
            </button>
        `;
        const list = document.getElementById('userResultList');
        if (list) list.before(wrap);
    }
    wrap.style.display = show ? 'block' : 'none';
}

function backToClasses() {
    document.getElementById('searchInput').value = '';
    showClassList();
}

function viewPublicProfile(id) {
    const me = JSON.parse(localStorage.getItem('user'));
    if (me && String(me.id) === String(id)) {
        window.location.href = 'user';
    } else {
        window.location.href = 'user?id=' + id;
    }
}