/**
 * SYSTEM-NOTICE.JS — Global System Notification Banner
 * Tampil di pojok kanan atas untuk pengumuman penting.
 * Support warna: yellow (warning), blue (info), red (danger), green (success).
 */

const SystemNotice = {
    config: {
        containerId: 'systemNoticeContainer',
        storageKeyPrefix: 'sn_dismissed_'
    },

    async init() {
        this.injectStyles();
        this.createContainer();
        
        // Cache-first: render langsung dari session storage kalau ada
        const cached = sessionStorage.getItem('_sn_cache');
        if (cached) {
            const container = document.getElementById(this.config.containerId);
            container.innerHTML = cached;
            // Disable animasi untuk banner yang di-restore dari cache
            container.querySelectorAll('.system-notice-card').forEach(el => el.classList.add('no-anim'));
        }
        
        await this.loadNotices();
    },

    injectStyles() {
        if (document.getElementById('system-notice-css')) return;
        const style = document.createElement('style');
        style.id = 'system-notice-css';
        style.textContent = `
            #systemNoticeContainer {
                position: fixed;
                top: 4.8rem;
                right: 1.2rem;
                z-index: 11000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
                max-width: 340px;
                width: calc(100% - 2.4rem);
            }

            .system-notice-card {
                pointer-events: auto;
                background: rgba(15, 15, 20, 0.98);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 18px;
                padding: 14px 18px;
                display: flex;
                align-items: flex-start;
                gap: 14px;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
                position: relative;
                animation: snSlideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }

            .system-notice-card.no-anim { animation: none !important; }

            @keyframes snSlideIn {
                from { opacity: 0; transform: translateX(40px) scale(0.95); }
                to { opacity: 1; transform: translateX(0) scale(1); }
            }

            .system-notice-card.hide {
                animation: snFadeOut 0.3s ease forwards;
            }

            @keyframes snFadeOut {
                to { opacity: 0; transform: translateX(20px); visibility: hidden; }
            }

            .sn-icon {
                font-size: 1.15rem;
                flex-shrink: 0;
                margin-top: 2px;
            }

            .sn-content {
                flex: 1;
                font-size: 0.84rem;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.95);
                font-weight: 500;
            }

            .sn-content a {
                color: inherit;
                text-decoration: underline;
                font-weight: 700;
                opacity: 0.8;
                transition: opacity 0.2s;
            }

            .sn-content a:hover {
                opacity: 1;
            }

            .sn-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.25);
                cursor: pointer;
                padding: 4px;
                margin: -4px -8px 0 0;
                font-size: 1rem;
                transition: color 0.2s, transform 0.2s;
            }

            .sn-close:hover { color: #fff; transform: scale(1.1); }

            /* Themes */
            .sn-yellow { border-left: 5px solid #f1c40f; }
            .sn-yellow .sn-icon { color: #f1c40f; }
            
            .sn-blue { border-left: 5px solid #00eaff; }
            .sn-blue .sn-icon { color: #00eaff; }
            
            .sn-red { border-left: 5px solid #ff4757; }
            .sn-red .sn-icon { color: #ff4757; }
            
            .sn-green { border-left: 5px solid #2ecc71; }
            .sn-green .sn-icon { color: #2ecc71; }

            @media (max-width: 480px) {
                #systemNoticeContainer { top: 1rem; right: 1rem; width: calc(100% - 2rem); }
            }
        `;
        document.head.appendChild(style);
    },

    createContainer() {
        if (document.getElementById(this.config.containerId)) return;
        const container = document.createElement('div');
        container.id = this.config.containerId;
        document.body.appendChild(container);
    },

    async loadNotices() {
        try {
            // Get user data for class filtering
            let userClassId = null;
            try {
                const user = JSON.parse(localStorage.getItem('user'));
                if (user) userClassId = user.class_id;
            } catch(e) {}

            let query = supabase
                .from('system_notifications')
                .select('*')
                .eq('is_active', true);
            
            // Filter by class: NULL (global) OR user's class
            if (userClassId) {
                query = query.or(`class_id.is.null,class_id.eq.${userClassId}`);
            } else {
                query = query.is('class_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;

            const activeIds = (data || []).map(item => String(item.id));

            // ── CLEANUP SYNC ──────────────────────────────────────────
            // Hapus notif yang ada di DOM tapi udah gak ada di DB (inactive/deleted)
            const displayedCards = document.querySelectorAll('.system-notice-card');
            displayedCards.forEach(card => {
                const cardId = card.id.replace('sn-card-', '');
                if (!activeIds.includes(cardId)) {
                    card.classList.add('hide');
                    setTimeout(() => {
                        card.remove();
                        // Update cache
                        const container = document.getElementById(this.config.containerId);
                        if (container) sessionStorage.setItem('_sn_cache', container.innerHTML);
                    }, 400);
                }
            });

            // Tampilkan notif yang baru
            (data || []).forEach(item => {
                if (!localStorage.getItem(this.config.storageKeyPrefix + item.id)) {
                    this.show(item);
                }
            });
        } catch (e) {
            console.warn('SystemNotice: Gagal fetch data dari DB.', e);
        }
    },

    show({ id, type, icon, message, text_color }) {
        if (document.getElementById(`sn-card-${id}`)) return;

        const container = document.getElementById(this.config.containerId);
        if (!container) return;

        const card = document.createElement('div');
        card.className = `system-notice-card sn-${type || 'blue'}`;
        card.id = `sn-card-${id}`;

        card.innerHTML = `
            <div class="sn-icon"><i class="fa-solid ${icon || 'fa-circle-info'}"></i></div>
            <div class="sn-content" style="${text_color ? `color: ${text_color};` : ''}">${message}</div>
            <button class="sn-close" onclick="SystemNotice.dismiss('${id}')"><i class="fa-solid fa-xmark"></i></button>
        `;

        container.appendChild(card);
        
        // Update cache setelah render
        sessionStorage.setItem('_sn_cache', container.innerHTML);
    },

    dismiss(id) {
        const el = document.getElementById(`sn-card-${id}`);
        if (el) {
            el.classList.add('hide');
            localStorage.setItem(this.config.storageKeyPrefix + id, '1');
            setTimeout(() => {
                el.remove();
                const container = document.getElementById(this.config.containerId);
                if (container) sessionStorage.setItem('_sn_cache', container.innerHTML);
            }, 400);
        }
    }
};

// Auto Init pas Supabase Ready
(function() {
    const check = setInterval(() => {
        if (typeof supabase !== 'undefined') {
            clearInterval(check);
            SystemNotice.init();
        }
    }, 100);
})();
