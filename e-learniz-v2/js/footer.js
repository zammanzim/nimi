// js/footer.js — Global footer (brand box + meta, tanpa nav shortcut)
// Brand kiri (logo + nama + tagline), meta kanan (versi · © · by).
// Punya struktur visual, tapi understated. Tanpa kolom navigasi.
(function () {
    'use strict';

    var path = window.location.pathname;
    // Skip di halaman yang ga butuh footer
    if (path.includes('/login') || path.includes('/studentsweb/')) return;

    // --- i18n helper (fallback ke text Indonesia kalo key ga ada) ---
    function tx(key, fallback) {
        try {
            var v = (typeof t === 'function') ? t(key) : key;
            return (v === key) ? fallback : v;
        } catch (e) { return fallback; }
    }

    var year = new Date().getFullYear();
    var APP_VERSION = 'v2.4';

    var footer = document.createElement('footer');
    footer.id = 'globalFooter';
    footer.innerHTML =
        '<div class="footer-inner">' +
            // Brand kiri
            '<div class="footer-brand">' +
                '<div class="footer-brand-logo"><i class="fa-solid fa-graduation-cap"></i></div>' +
                '<div class="footer-brand-text">' +
                    '<div class="footer-brand-name">' + tx('app_name', 'E-Learning Nizam') + '</div>' +
                    '<div class="footer-brand-tag">' + tx('footer_tagline', 'Platform belajar X RPL 2') + '</div>' +
                '</div>' +
            '</div>' +
            // Meta kanan
            '<div class="footer-meta">' +
                '<span class="footer-version">' + APP_VERSION + '</span>' +
                '<span class="footer-dot">·</span>' +
                '<span>© ' + year + '</span>' +
                '<span class="footer-dot">·</span>' +
                '<span>' + tx('footer_made_by', 'by') + ' <b>zam</b></span>' +
            '</div>' +
        '</div>';

    function appendFooter() {
        var nav = document.getElementById('bottomNav');
        if (nav && nav.parentNode) {
            nav.parentNode.insertBefore(footer, nav);
        } else {
            document.body.appendChild(footer);
        }
    }

    if (document.body) {
        appendFooter();
    } else {
        document.addEventListener('DOMContentLoaded', appendFooter);
    }

    // --- Override versi live dari DB (best-effort) ---
    if (typeof supabase !== 'undefined') {
        try {
            supabase
                .from('app_updates')
                .select('version')
                .order('created_at', { ascending: false })
                .limit(1)
                .then(function (res) {
                    var v = res && res.data && res.data[0] && res.data[0].version;
                    if (v) {
                        var el = footer.querySelector('.footer-version');
                        if (el) el.textContent = 'v' + v;
                    }
                })
                .catch(function () {});
        } catch (e) {}
    }
})();
