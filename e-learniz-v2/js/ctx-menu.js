const ContextMenu = {
    providers: [],
    activeContext: null,
    _hideTimer: null,

    init() {
        if (!document.getElementById('customContextMenu')) {
            const menu = document.createElement('div');
            menu.id = 'customContextMenu';
            menu.className = 'context-menu';
            document.body.appendChild(menu);
        }

        if (this._ready) return;
        this._ready = true;

        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        document.addEventListener('click', () => this.hide());
        window.addEventListener('scroll', () => this.hide());
        window.addEventListener('resize', () => this.hide());
        this.initHoverIntent();
        this.initTouchEvents();
    },

    initHoverIntent() {
        const menu = document.getElementById('customContextMenu');
        if (!menu) return;

        menu.addEventListener('mouseleave', () => {
            this._hideTimer = setTimeout(() => this.hide(), 350);
        });

        menu.addEventListener('mouseenter', () => {
            clearTimeout(this._hideTimer);
            this._hideTimer = null;
        });
    },

    _attachSubmenuHandlers(menu) {
        menu.querySelectorAll('.has-submenu').forEach(li => {
            li.addEventListener('mouseenter', () => {
                clearTimeout(li._subTimer);
                li.classList.add('open');
            });
            li.addEventListener('mouseleave', (e) => {
                const sub = li.querySelector('.context-submenu');
                const delay = sub ? 350 : 0;
                li._subTimer = setTimeout(() => {
                    li.classList.remove('open');
                }, delay);
            });
            const sub = li.querySelector('.context-submenu');
            if (sub) {
                sub.addEventListener('mouseenter', () => {
                    clearTimeout(li._subTimer);
                    li.classList.add('open');
                });
                sub.addEventListener('mouseleave', () => {
                    li._subTimer = setTimeout(() => {
                        li.classList.remove('open');
                    }, 350);
                });
            }
        });
    },

    registerProvider(id, handler, priority = 0, handlerLongPress = null) {
        this.providers = this.providers.filter(p => p.id !== id);
        this.providers.push({ id, handler, priority, handlerLongPress });
        this.providers.sort((a, b) => b.priority - a.priority);
    },

    handleContextMenu(e) {
        for (const provider of this.providers) {
            const result = provider.handler(e);
            if (!result) continue;

            if (result.preventDefault !== false) e.preventDefault();
            if (result.html) this.openHtml(result.html, e.clientX, e.clientY, result.context);
            return;
        }
    },

    initTouchEvents() {
        let touchTimer;
        const longPressDuration = 500;

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return;
            if (e.target.closest('.admin-fab-container') ||
                e.target.closest('.daily-fab-container') ||
                e.target.closest('.updates-fab') ||
                e.target.closest('.drag-grip') ||
                [...e.target.classList].some(c => c.includes('fab'))) return;

            const touch = e.touches[0];
            touchTimer = setTimeout(() => this.handleLongPress(touch, e.target), longPressDuration);
        }, { passive: true });

        document.addEventListener('touchend', () => clearTimeout(touchTimer));
        document.addEventListener('touchmove', () => clearTimeout(touchTimer), { passive: true });
    },

    handleLongPress(touch, target) {
        for (const provider of this.providers) {
            if (!provider.handlerLongPress) continue;
            const result = provider.handlerLongPress(touch, target);
            if (!result) continue;

            if (navigator.vibrate) navigator.vibrate(50);
            if (result.html) this.openHtml(result.html, touch.clientX, touch.clientY, result.context);
            return;
        }
    },

    openHtml(html, x, y, context = null) {
        const menu = document.getElementById('customContextMenu');
        if (!menu) return;

        this.activeContext = context;
        menu.innerHTML = html;
        this._attachSubmenuHandlers(menu);
        this.show(x, y);
    },

    show(x, y) {
        const menu = document.getElementById('customContextMenu');
        if (!menu) return;

        menu.classList.remove('active');
        void menu.offsetWidth;

        menu.style.display = 'block';

        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        if (x + menuWidth > screenWidth) x -= menuWidth;
        if (y + menuHeight > screenHeight) y -= menuHeight;

        menu.style.left = `${Math.max(8, x)}px`;
        menu.style.top = `${Math.max(8, y)}px`;
        menu.classList.add('active');
    },

    hide() {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;

        const menu = document.getElementById('customContextMenu');
        if (!menu) return;

        menu.querySelectorAll('.has-submenu').forEach(li => {
            clearTimeout(li._subTimer);
            li.classList.remove('open');
        });

        menu.classList.remove('active');
        setTimeout(() => {
            if (!menu.classList.contains('active')) menu.style.display = 'none';
        }, 150);
    },

    toggleSubmenu(e, li) {
        e.stopPropagation();
        const isOpen = li.classList.contains('open');
        li.closest('ul').querySelectorAll('.has-submenu').forEach(el => el.classList.remove('open'));
        if (!isOpen) li.classList.add('open');
    }
};

window.ContextMenu = ContextMenu;

document.addEventListener('DOMContentLoaded', () => {
    ContextMenu.init();
});
