// ==========================================
// SCROLL LOCK — global, scroll position safe
// ==========================================
let _scrollLockCount = 0;
let _scrollLockY = 0;

window.lockScroll = function () {
    _scrollLockCount++;
    if (_scrollLockCount > 1) return;
    _scrollLockY = window.scrollY;
    
    const sbWidth = window.innerWidth - document.documentElement.clientWidth;
    if (sbWidth > 0) document.body.style.paddingRight = sbWidth + 'px';
    
    // Trik ampuh buat mobile: position fixed + top negative
    document.body.style.top = `-${_scrollLockY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
};

window.unlockScroll = function () {
    if (_scrollLockCount <= 0) return;
    _scrollLockCount = Math.max(0, _scrollLockCount - 1);
    if (_scrollLockCount > 0) return;

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    window.scrollTo(0, _scrollLockY);
};







// ==========================================
// 1. AUTO RUN SAAT HALAMAN DIMUAT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    syncHeaderProfile();

    // [GLOBAL FIX] HAPUS GARIS MERAH (SPELLCHECK)
    document.body.setAttribute('spellcheck', 'false');
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(el => {
        el.setAttribute('spellcheck', 'false');
    });
});

// ==========================================
// 2. SINKRONISASI HEADER
// ==========================================
function syncHeaderProfile() {
    try {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user) return;

        const headerName = document.getElementById("headerName");
        const headerPP = document.getElementById("headerPP");

        if (headerName) {
            headerName.innerText = `${t('hi')}, ${user.short_name || user.nickname || 'User'}`;
        }
        if (headerPP) {
            const isSubDir = /\/(a|admiii)\//.test(window.location.pathname);
            const defaultPP = isSubDir ? "../icons/profpicture.png" : "icons/profpicture.png";
            const targetSrc = user.avatar_url || defaultPP;
            
            if (headerPP.getAttribute('src') !== targetSrc) {
                headerPP.src = targetSrc;
            }
            headerPP.style.opacity = '1';
        }
    } catch (e) { console.error("Sync Profile Error:", e); }
}
// ==========================================
// 4. NAVIGATION & UI LOGIC
// ==========================================
function toggleMenu() {
    const sidebar = document.getElementById("sidebar");
    const hamburger = document.getElementById("hamburger");
    const overlay = document.getElementById("sidebarOverlay");

    if (window.innerWidth >= 1024) {
        sidebar.classList.toggle("closed");
        document.querySelector(".main-content")?.classList.toggle("shifted");
    } else {
        const isOpen = sidebar.classList.contains("open");
        if (!isOpen) {
            sidebar.classList.add("open");
            hamburger.classList.add("active");
            overlay.classList.add("show");
            overlay.onclick = toggleMenu;
            lockScroll();
            history.pushState({ type: 'overlay', target: 'sidebar' }, ''); // Catat di history
        } else {
            sidebar.classList.remove("open");
            hamburger.classList.remove("active");
            overlay.classList.remove("show");
            document.body.style.overflow = "";
            unlockScroll();
            // Jangan pushState di sini, popstate yang akan menangani jika user mencet back
        }
    }
}

document.addEventListener("click", (e) => {
    const trigger = document.getElementById("profileTrigger");
    const dropdown = document.getElementById("profileDropdown");
    if (trigger?.contains(e.target)) {
        dropdown.classList.toggle("show");
        trigger.classList.toggle("rotate");
    } else if (!dropdown?.contains(e.target)) {
        dropdown?.classList.remove("show");
        trigger?.classList.remove("rotate");
    }
});

function goAnnouncements() { window.location.href = "/"; }
function goProfile() { window.location.href = "settingacc"; }

// ==========================================
// 5. UNIVERSAL POPUP SYSTEM (Moved to js/show-popup.js)
// ==========================================

// --- NAVIGATION CONTROLLER (Back & Esc) ---
window.addEventListener('popstate', () => {
    closeActiveOverlays(false); // Tutup tanpa pindah history lagi
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const active = getActiveOverlay();
        if (active) history.back(); // Trigger popstate
    }
});

function getActiveOverlay() {
    return document.querySelector('.detail-overlay.active, .modal-overlay:not(.hidden), .uni-overlay.active, .visitor-overlay.active, #sidebar.open');
}

function closeActiveOverlays(shouldGoBack = true) {
    // 1. Detail Overlay
    const detail = document.getElementById('detailOverlay');
    if (detail?.classList.contains('active')) {
        if (typeof closeDetail === 'function') closeDetail();
        else detail.classList.remove('active');
        return;
    }
    // 2. Add Modal
    const addModal = document.getElementById('addModal');
    if (addModal && !addModal.classList.contains('hidden')) {
        addModal.classList.add('hidden');
        unlockScroll();
        if (typeof SubjectApp !== 'undefined') SubjectApp.clearForm();
        return;
    }
    // 3. Universal Popup (showPopup)
    const uni = document.getElementById('uniOverlay');
    if (uni?.classList.contains('active')) {
        if (typeof closePopup === 'function') closePopup();
        return;
    }
    // 4. Visitor Overlay
    const visitor = document.getElementById('visitorOverlay');
    if (visitor?.classList.contains('active')) {
        visitor.classList.remove('active');
        unlockScroll();
        return;
    }
    // 5. Sidebar (Mobile)
    const sidebar = document.getElementById("sidebar");
    if (sidebar?.classList.contains('open')) {
        toggleMenu();
        return;
    }
}

// Tambahkan pemicu history untuk Visitor Overlay (jika ada script bukanya)
document.getElementById('visitorTrigger')?.addEventListener('click', () => {
    const v = document.getElementById('visitorOverlay');
    v.classList.add('active');
    lockScroll();
    history.pushState({ type: 'overlay', target: 'visitor' }, '');
});
document.getElementById('closeVisitorPopup')?.addEventListener('click', () => {
    const v = document.getElementById('visitorOverlay');
    if (v?.classList.contains('active')) {
        v.classList.remove('active');
        unlockScroll();
        history.back();
    }
});

// ==========================================
// 6. FORM PERSISTENCE — sessionStorage
// ==========================================
// Nyimpen isi form ke sessionStorage biar ga ilang kalo pindah halaman
(function() {
    const KEY = 'form_persist_' + window.location.pathname.replace(/[/\\]/g, '_');

    function save() {
        const data = {};
        document.querySelectorAll('input:not([type="password"]):not([type="file"]), textarea, select, [contenteditable]').forEach(el => {
            const key = el.id || el.name;
            if (!key) return;
            if (el.isContentEditable) {
                data[key] = el.innerHTML;
            } else if (el.type === 'checkbox' || el.type === 'radio') {
                data[key] = el.checked;
            } else {
                data[key] = el.value;
            }
        });
        sessionStorage.setItem(KEY, JSON.stringify(data));
    }

    function restore() {
        const saved = sessionStorage.getItem(KEY);
        if (!saved) return;
        try {
            const data = JSON.parse(saved);
            document.querySelectorAll('input:not([type="password"]):not([type="file"]), textarea, select, [contenteditable]').forEach(el => {
                const key = el.id || el.name;
                if (!key || !(key in data)) return;
                if (el.isContentEditable) {
                    el.innerHTML = data[key];
                } else if (el.type === 'checkbox' || el.type === 'radio') {
                    el.checked = data[key];
                } else {
                    el.value = data[key];
                }
            });
        } catch(e) {}
    }

    document.addEventListener('DOMContentLoaded', restore);
    document.addEventListener('input', save);
    document.addEventListener('change', save);
    document.addEventListener('submit', () => setTimeout(() => sessionStorage.removeItem(KEY), 0));

    window.clearFormPersist = () => sessionStorage.removeItem(KEY);
})();