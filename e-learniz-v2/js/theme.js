// ============================================================
// THEME LOADER — js/theme.js
// Dipanggil di semua halaman, load SEBELUM CSS render (di <head>)
// ============================================================

(function () {
    const theme = JSON.parse(localStorage.getItem('user_theme') || '{}');

    const DEFAULT_BG = `linear-gradient(90deg,rgba(255,255,255,0.15)1px,transparent 1px),linear-gradient(0deg,rgba(255,255,255,0.15)1px,transparent 1px),linear-gradient(180deg,#353a50 0%,#505a6a 40%,#404560 70%,#2a2a45 100%)`;

    const bg = theme.bg || DEFAULT_BG;
    const accent = theme.accent || '#00eaff';
    const fontSize = theme.fontSize || 'sedang';

    const style = document.createElement('style');
    style.id = 'user-theme-override';
    let css = '';

    // --- 1. FONT SIZE ---
    const fontMap = { kecil: '13px', sedang: '15px', besar: '18px' };
    css += `html { font-size: ${fontMap[fontSize] || '15px'} !important; }\n`;

    // --- 2. BACKGROUND ---
    const isImage = bg.startsWith('http') || bg.startsWith('url(');
    const finalBg = isImage && !bg.startsWith('url(') ? `url('${bg}')` : bg;

    css += `body {
    background-image: ${finalBg} !important;
    background-repeat: ${isImage ? 'no-repeat' : 'repeat, repeat, no-repeat'} !important;
    background-size: ${isImage ? 'cover' : '2.125rem 2.125rem, 2.125rem 2.125rem, cover'} !important;
    background-position: center !important;
    background-attachment: fixed !important;
}\n`;

    // --- 3. ACCENT COLOR ---
    const a = accent;
    // Set CSS variable supaya semua halaman bisa pakai var(--accent)
    document.documentElement.style.setProperty('--accent', a);
    const ar = parseInt(a.slice(1, 3), 16);
    const ag = parseInt(a.slice(3, 5), 16);
    const ab = parseInt(a.slice(5, 7), 16);
    const rgba = (op) => `rgba(${ar},${ag},${ab},${op})`;

    css += `
/* === ACCENT COLOR OVERRIDE === */
.sidebar li:hover i, .sidebar li:hover b,
.sidebar li.active a, .sidebar li.active i,
.glass-modal-box h3 i, .drop-icon,
.info-content-scroll h4,
.final-badge,
.hide-desk { color: ${a} !important; }

.sidebar li.active {
    background: linear-gradient(90deg, ${rgba('0.15')} 10%, ${rgba('0')} 100%) !important;
    border-left-color: ${a} !important;
}
.glass-input:focus {
    border-color: ${a} !important;
    box-shadow: 0 0 0 3px ${rgba('0.15')} !important;
}
.uni-btn, .glass-nav-btn.active,
input:checked + .slider,
input:focus + .slider { background: ${a} !important; }

.drop-area:hover, .drop-area.dragover,
.task-shortcut-box:hover { border-color: ${a} !important; }

.editable-active:focus,
.btn-add-inline:hover { background: ${rgba('0.1')} !important; }

.btn-tool:hover { color: ${a} !important; }

.color-opt.active { border-color: ${a} !important; }

/* welcomeText & glow ikut aksen */
#welcomeText {
    color: #e9f4ff !important;
    text-shadow: 0 0 4px ${a}, 0 0 8px ${a}, 0 0 12px ${a} !important;
}
.glow {
    text-shadow: 0 0 5px ${a}, 0 0 10px ${a}, 0 0 20px ${rgba('0.8')}, 0 0 40px ${rgba('0.5')} !important;
}

/* rgba overrides (background, shadow, border dengan opacity) */
.sidebar li.active {
    background: linear-gradient(90deg, ${rgba('0.15')} 10%, ${rgba('0')} 100%) !important;
}
.glass-input:focus {
    box-shadow: 0 0 0 3px ${rgba('0.15')} !important;
}
.btn-glass-save, btn-save {
    background: ${a} !important;
    box-shadow: 0 0 20px ${rgba('0.3')} !important;
}
.filter-slider-bg {
    background: ${a} !important;
    box-shadow: 0 0 25px ${rgba('0.5')} !important;
}
.btn-glass-save:hover, btn-save:hover {
    box-shadow: 0 0 30px ${rgba('0.5')} !important;
}
.current-pp {
    border-color: ${a} !important;
    box-shadow: 0 0 15px ${rgba('0.3')} !important;
}
.editable-active:focus { background: ${rgba('0.1')} !important; }
.btn-add-inline:hover  { background: ${rgba('0.1')} !important; }
.drop-area:hover, .drop-area.dragover { border-color: ${a} !important; }
.task-shortcut-box:hover { border-color: ${a} !important; }
.uni-btn { box-shadow: 0 4px 15px ${rgba('0.3')} !important; }
.final-badge { text-shadow: 0 0 10px ${rgba('0.8')}, 0 0 25px ${rgba('0.6')} !important; }

/* scrollbar */
::-webkit-scrollbar-thumb { background: ${a} !important; }

/* teks & highlight umum */
[style*="color:#00eaff"], [style*="color: #00eaff"] { color: ${a} !important; }
[style*="background:#00eaff"], [style*="background: #00eaff"],
[style*="border-color:#00eaff"] { background: ${a} !important; border-color: ${a} !important; }
`;

    style.textContent = css;

    // Inject sesegera mungkin supaya ga flicker
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.head.appendChild(style);
        });
    }
})();