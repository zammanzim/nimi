// js/class-profil.js — Class Profile (Spotlight Grid, student-editable)
// Singleton pattern mirip SubjectApp. Data langsung dari table `users`.
// Owner bisa inline-edit quote/description + upload foto profil (sinkron ke users.avatar_url).
const ClassProfileApp = {
    state: {
        user: null,
        classId: null,
        students: [],        // semua siswa di kelas ini
        expandedId: null,    // id siswa yang card-nya lg di-expand
        editingId: null,     // id siswa yang lg di-mode edit (cuma owner)
        initialized: false,
    },

    // ── Boot ──────────────────────────────────────────────────
    init() {
        if (typeof supabase === 'undefined') {
            setTimeout(() => this.init(), 100);
            return;
        }

        // Reset biar ga carry-over
        this.state.expandedId = null;
        this.state.editingId = null;

        this.state.user = (typeof getUser === 'function') ? getUser() : null;
        if (!this.state.user) {
            window.location.href = 'login';
            return;
        }

        // Pake helper sidebar biar dapet effective class id (support class_override)
        this.state.classId = (typeof getEffectiveClassId === 'function')
            ? getEffectiveClassId()
            : String(this.state.user.class_id);

        this.updateHeader();
        this.loadStudents();
        this.setupShortcuts();
        this.state.initialized = true;
    },

    updateHeader() {
        const nameEl = document.getElementById('cpClassName');
        if (!nameEl) return;
        let className = '';
        if (typeof getEffectiveClassName === 'function') {
            className = getEffectiveClassName();
        } else {
            className = this.state.user.class_name || `${(typeof t === 'function' ? t('class') : 'Kelas')} ${this.state.classId}`;
        }
        nameEl.textContent = className || `Kelas ${this.state.classId}`;
    },

    // ── Data ──────────────────────────────────────────────────
    async loadStudents() {
        const grid = document.getElementById('cpGrid');
        if (!grid) return;
        grid.innerHTML = this.skeletonHTML();

        if (!this.state.classId) {
            grid.innerHTML = this.emptyHTML('Kelas belum diketahui.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, short_name, nickname, username, avatar_url, bio, role, quote, description, wa, ig, card_color, class_id')
                .eq('class_id', this.state.classId)
                .neq('role', 'guest')
                .order('role', { ascending: true })   // wali dulu kalo ada
                .order('short_name', { ascending: true, nullsFirst: false });

            if (error) throw error;
            this.state.students = data || [];
            this.render();
        } catch (e) {
            console.error('[ClassProfile] loadStudents:', e);
            grid.innerHTML = this.emptyHTML('Gagal memuat data: ' + (e.message || e));
        }
    },

    // ── Render ────────────────────────────────────────────────
    render() {
        const grid = document.getElementById('cpGrid');
        if (!grid) return;

        if (!this.state.students.length) {
            grid.innerHTML = this.emptyHTML('Belum ada siswa di kelas ini.');
            return;
        }

        grid.innerHTML = this.state.students.map(s => this.cardHTML(s)).join('');
        this.attachCardEvents();
    },

    cardHTML(s) {
        const isOwner = String(s.id) === String(this.state.user.id);
        const isExpanded = String(this.state.expandedId) === String(s.id);
        const isEditing = String(this.state.editingId) === String(s.id);
        const color = s.card_color || '';
        const colorStyle = color ? `--card-accent:${color};` : '';

        const displayName = s.short_name || s.nickname || s.full_name || 'Siswa';
        const initial = (s.short_name || s.full_name || '?').charAt(0).toUpperCase();
        const avatarUrl = s.avatar_url ? (s.avatar_url + (s.avatar_url.includes('?') ? '&' : '?') + 'v=' + Date.now()) : '';
        const avatarHTML = avatarUrl
            ? `<img class="cp-avatar" src="${this.escapeAttr(avatarUrl)}" alt="${this.escapeAttr(displayName)}" onerror="this.outerHTML='<div class=\\'cp-avatar-fallback\\'>${initial}</div>'">`
            : `<div class="cp-avatar-fallback">${initial}</div>`;

        const quote = s.quote || '';
        const description = s.description || '';
        const wa = s.wa || '';
        const ig = s.ig || '';

        // Role label readable
        const roleLabel = this.roleLabel(s.role);

        const classes = [
            'cp-card',
            isOwner ? 'cp-owner' : '',
            isExpanded ? 'cp-expanded' : '',
            isEditing ? 'cp-editing' : '',
        ].filter(Boolean).join(' ');

        // Edit button (owner only) — save icon kalo lagi editing
        const editBtnIcon = isEditing ? 'fa-check' : 'fa-pen';
        const editBtnHTML = isOwner
            ? `<button class="cp-edit-btn" data-action="edit" data-id="${this.escapeAttr(s.id)}" title="${isEditing ? 'Simpan' : 'Edit'}"><i class="fa-solid ${editBtnIcon}"></i></button>`
            : '';

        // Camera button (owner, only visible when editing)
        const cameraBtnHTML = `<button class="cp-camera-btn" data-action="camera" data-id="${this.escapeAttr(s.id)}" title="Ganti Foto"><i class="fa-solid fa-camera"></i></button>`;

        // Quote & description: editable kalo lagi editing & owner
        const quoteEditable = isEditing ? 'true' : 'false';
        const descEditable = isEditing ? 'true' : 'false';

        // Expanded body (deskripsi + sosmed)
        const linksHTML = `
            <div class="cp-links">
                <a href="${wa ? 'https://wa.me/' + this.escapeAttr(wa.replace(/[^0-9]/g, '')) : '#'}" target="_blank" class="cp-link wa ${wa ? '' : 'empty'}">
                    <i class="fa-brands fa-whatsapp"></i> WhatsApp
                </a>
                <a href="${ig ? 'https://instagram.com/' + this.escapeAttr(ig.replace(/^@/, '')) : '#'}" target="_blank" class="cp-link ig ${ig ? '' : 'empty'}">
                    <i class="fa-brands fa-instagram"></i> Instagram
                </a>
            </div>`;

        return `
        <div class="${classes}" data-id="${this.escapeAttr(s.id)}" style="${colorStyle}">
            ${editBtnHTML}
            <div class="cp-avatar-wrap">
                ${avatarHTML}
                ${cameraBtnHTML}
            </div>
            <div class="cp-main-info">
                <h3 class="cp-name">${this.escapeHTML(displayName)}</h3>
                ${roleLabel ? `<span class="cp-badge">${this.escapeHTML(roleLabel)}</span>` : ''}
                <div class="cp-quote cp-editable" data-field="quote" data-placeholder="Tulis quote singkat..." contenteditable="${quoteEditable}">${this.escapeHTML(quote)}</div>
            </div>
            <div class="cp-expanded-body">
                <div>
                    <div class="cp-desc-label">Deskripsi</div>
                    <div class="cp-desc cp-editable" data-field="description" data-placeholder="Cerita singkat tentang dirimu..." contenteditable="${descEditable}">${this.escapeHTML(description)}</div>
                </div>
                ${linksHTML}
            </div>
        </div>`;
    },

    skeletonHTML() {
        const items = Array.from({ length: 8 }).map(() => `
            <div class="cp-card" style="cursor:default;pointer-events:none;opacity:0.5;">
                <div class="cp-avatar-wrap"><div class="cp-avatar-fallback"><i class="fa-solid fa-spinner fa-pulse"></i></div></div>
                <div style="height:14px;width:70%;background:rgba(255,255,255,0.08);border-radius:4px;"></div>
                <div style="height:10px;width:50%;background:rgba(255,255,255,0.05);border-radius:4px;"></div>
            </div>`).join('');
        return items;
    },

    emptyHTML(msg) {
        return `<div class="cp-empty-state"><i class="fa-solid fa-users-slash"></i><div>${this.escapeHTML(msg)}</div></div>`;
    },

    roleLabel(role) {
        const map = {
            super_admin: 'Admin',
            teacher: 'Guru',
            class_admin: 'Pengurus',
            student: '',
            guest: '',
        };
        return map[role] || '';
    },

    // ── Events ────────────────────────────────────────────────
    attachCardEvents() {
        const grid = document.getElementById('cpGrid');
        if (!grid) return;

        // Delegasi: satu listener
        grid.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (btn) {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'edit') this.toggleEdit(id);
                else if (action === 'camera') this.triggerAvatarUpload(id);
                return;
            }

            // Klik area card (bukan contentEditable / button) → toggle expand
            // Skip kalo lg editing card itu
            const card = e.target.closest('.cp-card');
            if (!card) return;
            const id = card.dataset.id;
            if (String(this.state.editingId) === String(id)) return; // lagi edit, jangan collapse
            if (e.target.closest('.cp-editable[contenteditable="true"]')) return;
            if (e.target.closest('.cp-link:not(.empty)')) return; // biar link jalan
            this.toggleExpand(id);
        };
    },

    toggleExpand(id) {
        // Toggle: kalo lg sama, collapse. Kalo beda, expand yg baru.
        this.state.expandedId = (String(this.state.expandedId) === String(id)) ? null : id;
        this.render();
    },

    async toggleEdit(id) {
        // Cuma owner yg boleh
        if (String(id) !== String(this.state.user.id)) {
            if (typeof showPopup === 'function') showPopup('Kamu cuma bisa edit profilmu sendiri.', 'error');
            return;
        }

        // Kalo lagi editing → save
        if (String(this.state.editingId) === String(id)) {
            await this.saveStudent(id);
            this.state.editingId = null;
            this.render();
            return;
        }

        // Mulai edit → auto-expand biar deskripsi keliatan
        this.state.editingId = id;
        this.state.expandedId = id;
        this.render();

        // Focus ke quote
        setTimeout(() => {
            const card = document.querySelector(`.cp-card[data-id="${CSS.escape(id)}"]`);
            card?.querySelector('[data-field="quote"]')?.focus();
        }, 50);
    },

    // ── Save ──────────────────────────────────────────────────
    async saveStudent(id) {
        const card = document.querySelector(`.cp-card[data-id="${CSS.escape(id)}"]`);
        if (!card) return;

        // Tandai tombol saving
        const editBtn = card.querySelector('.cp-edit-btn');
        if (editBtn) {
            editBtn.classList.add('saving');
            editBtn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i>';
        }

        const getVal = (field) => {
            const el = card.querySelector(`[data-field="${field}"]`);
            // description pake innerText (preserve line break), quote juga
            return el ? (el.innerText || '').trim() : '';
        };

        const quote = getVal('quote');
        const description = getVal('description');

        try {
            const { error } = await supabase
                .from('users')
                .update({ quote, description })
                .eq('id', id);

            if (error) throw error;

            // Update state lokal biar ga perlu reload
            const s = this.state.students.find(x => String(x.id) === String(id));
            if (s) { s.quote = quote; s.description = description; }

            // Kalo edit diri sendiri → sync localStorage.user biar konsisten
            if (String(id) === String(this.state.user.id)) {
                this.state.user.quote = quote;
                this.state.user.description = description;
                try {
                    const merged = { ...JSON.parse(localStorage.getItem('user') || '{}'), quote, description };
                    localStorage.setItem('user', JSON.stringify(merged));
                } catch (e) {}
            }

            if (typeof showToast === 'function') showToast('Profil tersimpan', 'success');
        } catch (e) {
            console.error('[ClassProfile] saveStudent:', e);
            if (typeof showPopup === 'function') showPopup('Gagal simpan: ' + (e.message || e), 'error');
        }
    },

    // ── Avatar upload ─────────────────────────────────────────
    triggerAvatarUpload(id) {
        if (String(id) !== String(this.state.user.id)) {
            if (typeof showPopup === 'function') showPopup('Kamu cuma bisa ganti fotomu sendiri.', 'error');
            return;
        }

        // Bikin hidden input sementara
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) await this.uploadAvatar(id, file);
        };
        input.click();
    },

    async uploadAvatar(id, file) {
        if (typeof showToast === 'function') showToast('Mengunggah foto...', 'info');

        // Validasi size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            if (typeof showPopup === 'function') showPopup('Ukuran foto maksimal 5MB.', 'error');
            return;
        }

        const card = document.querySelector(`.cp-card[data-id="${CSS.escape(id)}"]`);
        const cameraBtn = card?.querySelector('.cp-camera-btn');
        if (cameraBtn) {
            cameraBtn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i>';
        }

        try {
            // Compress dulu (max 500px, q 0.7) — ikutin pattern settingacc
            const compressed = await this.compressImage(file, 500, 0.7);
            const fileName = `${id}.jpg`;

            // Upload ke bucket avatars (upsert biar ganti yg lama)
            const { error: uploadErr } = await supabase.storage
                .from('avatars')
                .upload(fileName, compressed, { upsert: true, contentType: 'image/jpeg' });

            if (uploadErr) throw uploadErr;

            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            // Cache-bust biar gambar langsung refresh
            const newUrl = `${urlData.publicUrl}?v=${Date.now()}`;

            // Update users.avatar_url
            const { error: updateErr } = await supabase
                .from('users')
                .update({ avatar_url: newUrl })
                .eq('id', id);

            if (updateErr) throw updateErr;

            // Update state lokal
            const s = this.state.students.find(x => String(x.id) === String(id));
            if (s) s.avatar_url = newUrl;

            // Sync localStorage.user biar sidebar, user.html, dll langsung ke-update
            if (String(id) === String(this.state.user.id)) {
                this.state.user.avatar_url = newUrl;
                try {
                    const merged = { ...JSON.parse(localStorage.getItem('user') || '{}'), avatar_url: newUrl };
                    localStorage.setItem('user', JSON.stringify(merged));
                } catch (e) {}
            }

            this.render();
            if (typeof showToast === 'function') showToast('Foto profil diperbarui', 'success');
        } catch (e) {
            console.error('[ClassProfile] uploadAvatar:', e);
            if (typeof showPopup === 'function') showPopup('Gagal upload foto: ' + (e.message || e), 'error');
            this.render();
        }
    },

    // ── Helpers ───────────────────────────────────────────────
    compressImage(file, maxW, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxW) {
                        height = Math.round((height * maxW) / width);
                        width = maxW;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(
                        (blob) => blob ? resolve(blob) : reject(new Error('Gagal kompresi gambar')),
                        'image/jpeg',
                        quality
                    );
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    escapeHTML(str) {
        return String(str ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    },

    escapeAttr(str) {
        return this.escapeHTML(str);
    },

    setupShortcuts() {
        if (this._shortcutBound) return;
        this._shortcutBound = true;
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter: save kalo lg editing
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (this.state.editingId) {
                    e.preventDefault();
                    this.toggleEdit(this.state.editingId);
                }
            }
            // Escape: cancel edit (tanpa save) atau collapse
            if (e.key === 'Escape') {
                if (this.state.editingId) {
                    this.state.editingId = null;
                    this.render();
                } else if (this.state.expandedId) {
                    this.state.expandedId = null;
                    this.render();
                }
            }
        });
    },
};

// Boot setelah DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ClassProfileApp.init());
} else {
    ClassProfileApp.init();
}

window.ClassProfileApp = ClassProfileApp;
