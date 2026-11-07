// =====================================================
// USER.JS — IG-Style Profile Page
// /user           → profil sendiri
// /user?name=X    → view profil orang lain (read-only)
// =====================================================

const UserProfile = {
    state: {
        me: null,
        target: null,
        isOwnProfile: false,
        posts: [],
        currentPostIndex: 0,
        selectedFile: null,
    },

    async init() {
        await this.waitForSupabase();

        this.state.me = this.getLocalUser();
        if (!this.state.me) { window.location.href = 'login'; return; }

        const params = new URLSearchParams(window.location.search);
        const targetName = params.get('name');
        const targetId = params.get('id');

        // Cek apakah ini profil sendiri
        const me = this.state.me;
        const myName = me.username || me.short_name;
        this.state.isOwnProfile = (!targetName && !targetId)
            || targetName === myName
            || String(targetId) === String(me.id);

        if (this.state.isOwnProfile) {
            this.state.target = this.state.me;
            await this.refreshTargetFromDB(this.state.me.id);
        } else if (targetId) {
            await this.loadTargetById(targetId);
        } else {
            await this.loadTargetUser(targetName);
        }

        this.syncHeader();
        this.renderProfile();
        await this.loadPosts();
        this.setupUploadListeners();

        if (typeof logVisitor === 'function') logVisitor();
    },

    waitForSupabase() {
        return new Promise(resolve => {
            const check = () => typeof supabase !== 'undefined' ? resolve() : setTimeout(check, 60);
            check();
        });
    },

    getLocalUser() {
        try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
    },

    async refreshTargetFromDB(userId) {
        try {
            const { data } = await supabase
                .from('users')
                .select('id, full_name, short_name, username, avatar_url, bio, class_id, is_private, classes(name)')
                .eq('id', userId).single();
            if (data) this.state.target = data;
        } catch { /* pakai data lokal */ }
    },

    async loadTargetById(id) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, short_name, username, avatar_url, bio, class_id, is_private, classes(name)')
                .eq('id', id)
                .maybeSingle();

            if (error || !data) {
                document.getElementById('profilePageWrap').innerHTML =
                    `<div style="text-align:center;padding:4rem 1rem;color:#555;">
                        <i class="fa-solid fa-user-slash" style="font-size:2rem;display:block;margin-bottom:1rem;color:#333;"></i>
                        ${t('user_not_found')}
                    </div>`;
                return;
            }
            this.state.target = data;
        } catch (e) { console.error('Load user by id error:', e); }
    },

    async loadTargetUser(name) {
        try {
            // Coba match username dulu, kalau ga ada coba short_name
            let { data, error } = await supabase
                .from('users')
                .select('id, full_name, short_name, username, avatar_url, bio, class_id, is_private, classes(name)')
                .eq('username', name)
                .maybeSingle();

            // Fallback: coba short_name kalau username ga ketemu
            if (!data) {
                ({ data, error } = await supabase
                    .from('users')
                    .select('id, full_name, short_name, username, avatar_url, bio, class_id, is_private, classes(name)')
                    .eq('short_name', name)
                    .maybeSingle());
            }

            if (error || !data) {
                document.getElementById('profilePageWrap').innerHTML =
                    `<div style="text-align:center;padding:4rem 1rem;color:#555;">
                        <i class="fa-solid fa-user-slash" style="font-size:2rem;display:block;margin-bottom:1rem;color:#333;"></i>
                        ${t('user_not_found')}
                    </div>`;
                return;
            }
            this.state.target = data;
        } catch (e) { console.error('Load user error:', e); }
    },

    syncHeader() {
        const me = this.state.me;
        const el = document.getElementById('headerName');
        const pp = document.getElementById('headerPP');
        if (el) el.innerText = `Haii, ${me.short_name || me.full_name?.split(' ')[0] || 'User'}`;
        const _ppSrc = me.avatar_url || 'icons/profpicture.png';
        if (pp && pp.getAttribute('src') !== _ppSrc) pp.src = _ppSrc;
    },

    renderProfile() {
        const t = this.state.target;
        if (!t) return;

        const username = t.username || t.short_name || t.full_name?.split(' ')[0];
        const avatar = t.avatar_url || 'icons/profpicture.png';
        const bio = t.bio || '';
        const className = t.classes?.name || (t.class_id ? `${window.t('class')} ${t.class_id}` : '');

        document.title = `@${username}`;

        // Tombol edit avatar (hanya own)
        const editAvatarBtn = this.state.isOwnProfile
            ? `<button class="avatar-edit-btn" onclick="window.location.href='settingacc'" title="Ganti foto profil">
                <i class="fa-solid fa-pen" style="margin:0"></i>
               </button>`
            : '';

        // Tombol + upload — sejajar foto, HANYA own profile
        const addPostBtn = this.state.isOwnProfile
            ? `<button class="btn-add-post" onclick="openUploadModal()">
                <i class="fa-solid fa-plus"></i> Posting
               </button>`
            : '';

        // Tombol back — hanya view mode
        const backBtn = !this.state.isOwnProfile
            ? `<button onclick="history.back()" style="
                position:absolute;top:10px;left:10px;
                background:rgba(0,0,0,0.5);border:none;color:white;
                border-radius:50%;width:32px;height:32px;cursor:pointer;
                display:flex;align-items:center;justify-content:center;z-index:5;">
                <i class="fa-solid fa-arrow-left" style="margin:0;font-size:13px;"></i>
               </button>`
            : '';

        const html = `
        <div class="profile-header-card animate-pop-up">
            <div class="profile-cover">${backBtn}</div>

            <!-- Avatar + tombol + sejajar -->
            <div class="profile-avatar-row">
                <div class="profile-avatar-wrap">
                    <img class="profile-avatar" src="${avatar}" alt="${t.full_name}"
                         onerror="this.src='icons/profpicture.png'">
                    ${editAvatarBtn}
                </div>
                ${addPostBtn}
            </div>

            <!-- Info -->
            <div class="profile-info">
                <div class="profile-fullname">${t.full_name || username}</div>
                <div class="profile-username">@${username}</div>
                ${bio ? this.buildBioHTML(bio) : ''}
                ${className ? `<div class="profile-class-badge"><i class="fa-solid fa-school" style="margin:0;font-size:10px;"></i> ${className}</div>` : ''}
                <div class="profile-stats">
                    <div class="stat-item">
                        <span class="stat-num" id="postCountStat">–</span>
                        <span class="stat-label">Postingan</span>
                    </div>
                </div>

                ${this.state.isOwnProfile ? `
                <div class="privacy-toggle-row" style="margin-top:1rem;" onclick="event.stopPropagation()">
                    <div class="privacy-toggle-info">
                        <span class="privacy-toggle-label">
                            <i class="fa-solid fa-lock"></i> Akun Privat
                        </span>
                        <span class="privacy-toggle-desc">Postinganmu tidak muncul di Feed orang lain</span>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="profileTogglePrivate" ${t.is_private ? 'checked' : ''} onchange="UserProfile.savePrivacy(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>` : (t.is_private ? `
                <div style="margin-top:.75rem;display:inline-flex;align-items:center;gap:6px;font-size:0.73rem;color:#888;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);padding:4px 10px;border-radius:20px;">
                    <i class="fa-solid fa-lock" style="font-size:10px;margin:0;"></i> Akun Privat
                </div>` : '')}
            </div>
        </div>

        <div class="posts-section-label">
            <i class="fa-solid fa-grid-2" style="font-size:10px;margin:0;"></i>
            Postingan
        </div>

        <div class="posts-grid" id="postsGrid">
            ${[1, 2, 3, 4, 5, 6].map(() => `<div class="posts-skeleton"></div>`).join('')}
        </div>`;

        document.getElementById('profileSkeleton')?.remove();
        document.getElementById('profilePageWrap').innerHTML = html;
    },

    async loadPosts() {
        const t = this.state.target;
        if (!t) return;
        try {
            const { data, error } = await supabase
                .from('user_posts')
                .select('*')
                .eq('user_id', t.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.state.posts = data || [];
            this.renderPostsGrid();

            const el = document.getElementById('postCountStat');
            if (el) el.textContent = this.state.posts.length;
        } catch (err) {
            console.error('Load posts error:', err);
            const grid = document.getElementById('postsGrid');
            if (grid) grid.innerHTML = `<div class="posts-empty"><i class="fa-solid fa-triangle-exclamation"></i><p style="font-size:.85rem;">Gagal memuat postingan.</p></div>`;
        }
    },

    renderPostsGrid() {
        const grid = document.getElementById('postsGrid');
        if (!grid) return;

        if (this.state.posts.length === 0) {
            const msg = this.state.isOwnProfile
                ? `<i class="fa-regular fa-image"></i>
                   <p style="font-size:.85rem;">${t('no_posts')}</p>
                   <p style="color:#444;font-size:.78rem;">Tekan <b style="color:var(--accent,#00eaff)">+ Posting</b> untuk mulai!</p>`
                : `<i class="fa-regular fa-image"></i><p style="font-size:.85rem;">${t('no_posts')}</p>`;
            grid.innerHTML = `<div class="posts-empty">${msg}</div>`;
            return;
        }

        grid.innerHTML = this.state.posts.map((post, i) => {
            if (post.image_url) {
                const isVid = this.isVideoUrl(post.image_url);
                if (isVid) {
                    return `<div class="post-thumb animate-fade-in" onclick="UserProfile.openPostDetail(${i})">
                        <video src="${post.image_url}" style="width:100%;height:100%;object-fit:cover;display:block;" muted preload="metadata"></video>
                        <div class="post-thumb-overlay" style="opacity:1;background:rgba(0,0,0,0.25);">
                            <i class="fa-solid fa-circle-play" style="margin:0;font-size:2rem;color:rgba(255,255,255,0.9);filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));"></i>
                        </div>
                    </div>`;
                }
                return `<div class="post-thumb animate-fade-in" onclick="UserProfile.openPostDetail(${i})">
                    <img src="${post.image_url}" alt="" loading="lazy"
                         onerror="this.parentElement.style.background='rgba(255,255,255,0.04)'">
                    <div class="post-thumb-overlay">
                        <i class="fa-solid fa-expand" style="margin:0;"></i>
                    </div>
                </div>`;
            }
            // Text-only post
            const preview = (post.caption || '').slice(0, 60);
            return `<div class="post-thumb animate-fade-in post-thumb-text" onclick="UserProfile.openPostDetail(${i})"
                style="display:flex;align-items:center;justify-content:center;padding:8px;background:rgba(0,0,0,0.45);">
                <span style="font-size:0.7rem;color:#ccc;text-align:center;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${this.escapeHtml(preview)}${post.caption?.length > 60 ? '…' : ''}</span>
            </div>`;
        }).join('');
    },

    openPostDetail(index) {
        const post = this.state.posts[index];
        if (!post) return;
        this.state.currentPostIndex = index;

        const t = this.state.target;
        const username = t.username || t.short_name || t.full_name?.split(' ')[0];

        document.getElementById('detailUserAvatar').src = t.avatar_url || 'icons/profpicture.png';
        document.getElementById('detailUserName').textContent = `@${username}`;
        document.getElementById('detailPostTime').textContent = this.formatDate(post.created_at);
        document.getElementById('detailCapText').textContent = post.caption || '';

        // Media — gambar atau video
        const imgEl = document.getElementById('detailPostImg');
        const vidEl = document.getElementById('detailPostVid');
        const vidWrap = document.getElementById('detailVidWrap');

        if (post.image_url && this.isVideoUrl(post.image_url)) {
            // Video — pakai custom player
            if (vidEl) {
                vidEl.src = post.image_url;
                vidEl.load();
                vidEl.muted = false;
                vidEl.play().catch(() => { vidEl.muted = true; vidEl.play().catch(() => { }); });
            }
            if (vidWrap) vidWrap.style.display = 'block';
            if (imgEl) imgEl.style.display = 'none';
            this._initVideoPlayer();
        } else if (post.image_url) {
            // Gambar
            if (imgEl) { imgEl.src = post.image_url; imgEl.style.display = 'block'; }
            if (vidEl) { vidEl.pause?.(); vidEl.src = ''; }
            if (vidWrap) vidWrap.style.display = 'none';
        } else {
            if (imgEl) imgEl.style.display = 'none';
            if (vidEl) { vidEl.pause?.(); vidEl.src = ''; }
            if (vidWrap) vidWrap.style.display = 'none';
        }

        // Tombol hapus — HANYA own profile
        const actionsWrap = document.getElementById('detailActionsWrap');
        if (actionsWrap) {
            if (this.state.isOwnProfile) {
                actionsWrap.classList.remove('hidden');
            } else {
                actionsWrap.classList.add('hidden');
            }
        }

        document.getElementById('postDetailOverlay').classList.add('show');

        // Reset tombol hapus ke state normal (jaga-jaga dari delete sebelumnya)
        const btn = document.getElementById('btnDeletePost');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> ' + window.t('delete_post'); }

        lockScroll();
    },

    async deleteCurrentPost() {
        const post = this.state.posts[this.state.currentPostIndex];
        if (!post) return;

        const confirmed = await showPopup('Hapus postingan ini? Aksi ini tidak bisa dibatalkan.', 'confirm');
        if (!confirmed) return;

        const btn = document.getElementById('btnDeletePost');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menghapus...'; }

        try {
            if (post.image_url) {
                const fileName = post.image_url.split('/post-photos/')[1]?.split('?')[0];
                if (fileName) await supabase.storage.from('post-photos').remove([fileName]);
            }

            const { error } = await supabase.from('user_posts').delete().eq('id', post.id);
            if (error) throw error;

            closePostDetail();
            showPopup('Postingan dihapus!', 'success');
            await this.loadPosts();

            const el = document.getElementById('postCountStat');
            if (el) el.textContent = this.state.posts.length;

        } catch (err) {
            console.error('Delete error:', err);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> ' + window.t('delete_post'); }
            showPopup('Gagal menghapus: ' + (err?.message || 'Unknown error'), 'error');
        }
    },

    // ── Helpers ─────────────────────────────────────
    isVideo(file) {
        return file?.type?.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file?.name || '');
    },

    isVideoUrl(url) {
        return url && /\.(mp4|mov|webm|mkv)(\?|$)/i.test(url);
    },

    _initVideoPlayer() {
        const wrap = document.getElementById('detailVidWrap');
        if (!wrap || wrap._playerReady) return;
        wrap._playerReady = true;

        const vid = document.getElementById('detailPostVid');
        const playBtn = document.getElementById('detailVidPlayBtn');
        const muteBtn = document.getElementById('detailVidMuteBtn');
        const fsBtn = document.getElementById('detailVidFsBtn');
        const fill = document.getElementById('detailVidFill');
        const thumb = document.getElementById('detailVidThumb');
        const timeEl = document.getElementById('detailVidTime');
        const progWrap = document.getElementById('detailVidProgress');
        const tapArea = document.getElementById('detailVidTap');
        const tapRipple = document.getElementById('detailVidTapIcon');

        const fmt = s => {
            s = Math.floor(s || 0);
            return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        };

        const updateProgress = () => {
            const pct = vid.duration ? (vid.currentTime / vid.duration) * 100 : 0;
            fill.style.width = pct + '%';
            thumb.style.left = pct + '%';
            timeEl.textContent = `${fmt(vid.currentTime)} / ${fmt(vid.duration)}`;
        };

        const updatePlayBtn = () => {
            playBtn.querySelector('i').className = vid.paused
                ? 'fa-solid fa-play' : 'fa-solid fa-pause';
        };

        const updateMuteBtn = () => {
            muteBtn.querySelector('i').className = vid.muted
                ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
        };

        vid.addEventListener('timeupdate', updateProgress);
        vid.addEventListener('loadedmetadata', updateProgress);
        vid.addEventListener('play', updatePlayBtn);
        vid.addEventListener('pause', updatePlayBtn);
        vid.addEventListener('volumechange', updateMuteBtn);

        // Play / Pause button
        playBtn.addEventListener('click', e => {
            e.stopPropagation();
            vid.paused ? vid.play() : vid.pause();
        });

        // Mute toggle
        muteBtn.addEventListener('click', e => {
            e.stopPropagation();
            vid.muted = !vid.muted;
        });

        // Fullscreen
        fsBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                (wrap.requestFullscreen || wrap.webkitRequestFullscreen)?.call(wrap);
            } else {
                (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
            }
        });

        document.addEventListener('fullscreenchange', () => {
            fsBtn.querySelector('i').className = document.fullscreenElement
                ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        });

        // Progress bar scrub
        let scrubbing = false;
        const scrub = (e) => {
            const rect = progWrap.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (vid.duration) vid.currentTime = pct * vid.duration;
        };
        progWrap.addEventListener('mousedown', e => { scrubbing = true; scrub(e); e.stopPropagation(); });
        document.addEventListener('mousemove', e => { if (scrubbing) scrub(e); });
        document.addEventListener('mouseup', () => { scrubbing = false; });

        // Center tap — play/pause + ripple
        let rippleTimer;
        const showRipple = (playing) => {
            clearTimeout(rippleTimer);
            tapRipple.innerHTML = `<i class="fa-solid fa-${playing ? 'pause' : 'play'}" style="margin:0"></i>`;
            tapRipple.classList.remove('pop', 'pop-out');
            void tapRipple.offsetWidth; // reflow
            tapRipple.classList.add('pop');
            rippleTimer = setTimeout(() => {
                tapRipple.classList.remove('pop');
                tapRipple.classList.add('pop-out');
            }, 550);
        };

        tapArea.addEventListener('click', () => {
            if (vid.paused) { vid.play(); showRipple(true); }
            else { vid.pause(); showRipple(false); }
        });

        // Auto-show controls for a moment on any interaction
        let ctrlTimer;
        const flashControls = () => {
            wrap.classList.add('ctrl-show');
            clearTimeout(ctrlTimer);
            ctrlTimer = setTimeout(() => wrap.classList.remove('ctrl-show'), 2800);
        };
        wrap.addEventListener('pointermove', flashControls);
        wrap.addEventListener('pointerdown', flashControls);
        vid.addEventListener('play', flashControls);
        vid.addEventListener('pause', () => { clearTimeout(ctrlTimer); wrap.classList.add('ctrl-show'); });
    },
    setupUploadListeners() {
        const fileInput = document.getElementById('uploadFileInput');
        const dropZone = document.getElementById('uploadDropZone');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.previewFile(file);
        });

        dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith('image/') || file?.type.startsWith('video/')) this.previewFile(file);
        });
    },

    previewFile(file) {
        this.state.selectedFile = file;
        const previewImg = document.getElementById('uploadPreviewImg');
        const previewVid = document.getElementById('uploadPreviewVid');
        const dropZone = document.getElementById('uploadDropZone');
        const previewWrap = document.getElementById('uploadPreviewWrap');

        dropZone?.classList.add('hidden');
        previewWrap?.classList.remove('hidden');

        if (this.isVideo(file)) {
            const url = URL.createObjectURL(file);
            if (previewVid) {
                previewVid.src = url;
                previewVid.style.display = 'block';
            }
            if (previewImg) previewImg.style.display = 'none';
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (previewImg) {
                    previewImg.src = e.target.result;
                    previewImg.style.display = 'block';
                }
                if (previewVid) {
                    previewVid.src = '';
                    previewVid.style.display = 'none';
                }
            };
            reader.readAsDataURL(file);
        }
    },

    async submitPost() {
        const caption = document.getElementById('uploadCaption').value.trim();

        if (!this.state.selectedFile && !caption) {
            showPopup('Tulis caption atau pilih foto/video dulu!', 'error');
            return;
        }

        const btn = document.getElementById('btnPostSave');
        btn.disabled = true;

        try {
            let mediaUrl = null;

            if (this.state.selectedFile) {
                const file = this.state.selectedFile;
                const isVid = this.isVideo(file);

                btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${t('uploading_text')}`;

                if (isVid) {
                    // Video — upload as-is, no compress
                    const ext = file.name.split('.').pop() || 'mp4';
                    const fileName = `${this.state.me.id}/${Date.now()}.${ext}`;
                    const { error: uploadErr } = await supabase.storage
                        .from('post-photos')
                        .upload(fileName, file, { upsert: false, contentType: file.type });
                    if (uploadErr) throw uploadErr;
                    const { data: urlData } = supabase.storage.from('post-photos').getPublicUrl(fileName);
                    mediaUrl = urlData.publicUrl;
                } else {
                    // Gambar — compress dulu
                    const compressed = await this.compressImage(file, 1080, 0.82);
                    const ext = file.name.split('.').pop() || 'jpg';
                    const fileName = `${this.state.me.id}/${Date.now()}.${ext}`;
                    const { error: uploadErr } = await supabase.storage
                        .from('post-photos')
                        .upload(fileName, compressed, { upsert: false, contentType: 'image/jpeg' });
                    if (uploadErr) throw uploadErr;
                    const { data: urlData } = supabase.storage.from('post-photos').getPublicUrl(fileName);
                    mediaUrl = urlData.publicUrl;
                }
            }

            const { error: dbErr } = await supabase.from('user_posts').insert({
                user_id: this.state.me.id,
                image_url: mediaUrl,
                caption: caption || null,
            });

            if (dbErr) throw dbErr;

            showPopup('Post berhasil!', 'success');
            closeUploadModal();
            await this.loadPosts();

            const el = document.getElementById('postCountStat');
            if (el) el.textContent = this.state.posts.length;

        } catch (err) {
            console.error('Upload error:', err);
            const msg = err?.message || err?.error_description || JSON.stringify(err);
            showPopup('Error: ' + msg, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post';
        }
    },

    // Baca EXIF orientation dari raw bytes file
    _getExifOrientation(file) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const view = new DataView(e.target.result);
                if (view.getUint16(0, false) !== 0xFFD8) return resolve(1);
                let offset = 2;
                while (offset < view.byteLength) {
                    const marker = view.getUint16(offset, false);
                    offset += 2;
                    if (marker === 0xFFE1) {
                        if (view.getUint32(offset += 2, false) !== 0x45786966) return resolve(1);
                        const little = view.getUint16(offset += 6, false) === 0x4949;
                        offset += view.getUint32(offset + 4, little);
                        const tags = view.getUint16(offset, little);
                        offset += 2;
                        for (let i = 0; i < tags; i++) {
                            if (view.getUint16(offset + i * 12, little) === 0x0112) {
                                return resolve(view.getUint16(offset + i * 12 + 8, little));
                            }
                        }
                    } else if ((marker & 0xFF00) !== 0xFF00) break;
                    else offset += view.getUint16(offset, false);
                }
                resolve(1);
            };
            reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
        });
    },

    compressImage(file, maxSize = 1080, quality = 0.82) {
        return new Promise(async (resolve) => {
            const orientation = await this._getExifOrientation(file);
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let { width, height } = img;

                // Swap dimensi kalau rotate 90/270
                const swapped = [5, 6, 7, 8].includes(orientation);
                let dw = swapped ? height : width;
                let dh = swapped ? width : height;

                if (dw > maxSize || dh > maxSize) {
                    const r = Math.min(maxSize / dw, maxSize / dh);
                    dw = Math.round(dw * r);
                    dh = Math.round(dh * r);
                }

                const canvas = document.createElement('canvas');
                canvas.width = dw;
                canvas.height = dh;
                const ctx = canvas.getContext('2d');

                // Terapkan transformasi sesuai EXIF orientation
                ctx.save();
                switch (orientation) {
                    case 2: ctx.transform(-1, 0, 0, 1, dw, 0); break;
                    case 3: ctx.transform(-1, 0, 0, -1, dw, dh); break;
                    case 4: ctx.transform(1, 0, 0, -1, 0, dh); break;
                    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
                    case 6: ctx.transform(0, 1, -1, 0, dh, 0); break;
                    case 7: ctx.transform(0, -1, -1, 0, dh, dw); break;
                    case 8: ctx.transform(0, -1, 1, 0, 0, dw); break;
                    default: break;
                }

                // Draw dengan ukuran asli dulu, biar transform kena
                const sw = swapped ? dh : dw;
                const sh = swapped ? dw : dh;
                ctx.drawImage(img, 0, 0, sw, sh);
                ctx.restore();

                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            img.src = url;
        });
    },

    formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const diff = (Date.now() - d) / 1000;
        if (diff < 60) return 'Baru saja';
        if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    async savePrivacy(isPrivate) {
        const me = this.state.me;
        if (!me) return;
        try {
            const { error } = await supabase.from('users').update({ is_private: isPrivate }).eq('id', me.id);
            if (error) throw error;
            // Update localStorage
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            stored.is_private = isPrivate;
            localStorage.setItem('user', JSON.stringify(stored));
            this.state.target.is_private = isPrivate;
            showToast(isPrivate ? '🔒 Akun kamu sekarang privat' : '🌐 Akun kamu sekarang publik');
        } catch (err) {
            showToast('Gagal menyimpan pengaturan privasi', 'error');
            // Revert toggle
            const toggle = document.getElementById('profileTogglePrivate');
            if (toggle) toggle.checked = !isPrivate;
        }
    },

    buildBioHTML(bio) {
        const MAX = 100;
        // Konversi newline ke <br>, bukan pakai pre-wrap (biar gak kena indent template literal)
        const toHTML = (s) => this.escapeHtml(s).replace(/\n/g, '<br>');

        if (bio.length <= MAX) {
            return `<div class="profile-bio">${toHTML(bio)}</div>`;
        }
        // Potong di batas kata terdekat sebelum MAX
        let cutAt = MAX;
        while (cutAt > 0 && bio[cutAt] !== ' ' && bio[cutAt] !== '\n') cutAt--;
        const short = toHTML(bio.slice(0, cutAt || MAX));
        const full = toHTML(bio);
        // Semua inline — tidak ada whitespace aneh dari template literal
        return '<div class="profile-bio" id="profileBio">'
            + '<span id="bioShort">' + short + '…</span>'
            + '<span id="bioFull" style="display:none;">' + full + '</span>'
            + '<button onclick="toggleBio()" id="bioToggleBtn" style="background:none;border:none;color:var(--accent,#00eaff);font-size:0.78rem;cursor:pointer;padding:0;margin-left:4px;font-weight:600;">selengkapnya</button>'
            + '</div>';
    },

    escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
};

// ── Global helpers dipanggil dari HTML ───────────────

function openUploadModal() {
    const modal = document.getElementById('uploadModal');
    modal.classList.remove('hidden');
    lockScroll();

    // Reset form tiap kali buka — biar draft lama gak keliatan
    document.getElementById('uploadCaption').value = '';
    document.getElementById('captionCounter').textContent = '0/500';
    document.getElementById('uploadFileInput').value = '';
    document.getElementById('uploadPreviewWrap').classList.add('hidden');
    document.getElementById('uploadDropZone').classList.remove('hidden');
    UserProfile.state.selectedFile = null;

    // Klik area gelap = tutup
    modal.onclick = (e) => { if (e.target === modal) closeUploadModal(); };

    // Ctrl+Enter = submit
    document.addEventListener('keydown', _uploadKeyHandler);

    // Fokus ke textarea
    setTimeout(() => document.getElementById('uploadCaption')?.focus(), 100);
}

function _uploadKeyHandler(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitPost();
    }
    if (e.key === 'Escape') closeUploadModal();
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.add('hidden');
    document.getElementById('uploadCaption').value = '';
    document.getElementById('captionCounter').textContent = '0/500';
    document.getElementById('uploadFileInput').value = '';
    document.getElementById('uploadPreviewWrap').classList.add('hidden');
    document.getElementById('uploadDropZone').classList.remove('hidden');
    const vid = document.getElementById('uploadPreviewVid');
    if (vid) { vid.pause(); vid.src = ''; vid.style.display = 'none'; }
    const img = document.getElementById('uploadPreviewImg');
    if (img) img.style.display = 'block';
    UserProfile.state.selectedFile = null;
    document.removeEventListener('keydown', _uploadKeyHandler);
    unlockScroll();
}

function removeUploadPreview() {
    document.getElementById('uploadPreviewWrap').classList.add('hidden');
    document.getElementById('uploadDropZone').classList.remove('hidden');
    document.getElementById('uploadFileInput').value = '';
    const vid = document.getElementById('uploadPreviewVid');
    if (vid) { vid.pause(); vid.src = ''; vid.style.display = 'none'; }
    const img = document.getElementById('uploadPreviewImg');
    if (img) img.style.display = 'block';
    UserProfile.state.selectedFile = null;
}

function closePostDetail() {
    document.getElementById('postDetailOverlay').classList.remove('show');
    const vid = document.getElementById('detailPostVid');
    const wrap = document.getElementById('detailVidWrap');
    if (vid) { vid.pause(); vid.src = ''; }
    if (wrap) { wrap.classList.remove('ctrl-show'); }
    unlockScroll();
}

function handleDetailOverlayClick(e) {
    if (e.target === document.getElementById('postDetailOverlay')) closePostDetail();
}

function deleteCurrentPost() {
    UserProfile.deleteCurrentPost();
}

function submitPost() {
    UserProfile.submitPost();
}

function toggleBio() {
    const short = document.getElementById('bioShort');
    const full = document.getElementById('bioFull');
    const btn = document.getElementById('bioToggleBtn');
    const isOpen = full.style.display !== 'none';
    short.style.display = isOpen ? 'inline' : 'none';
    full.style.display = isOpen ? 'none' : 'inline';
    btn.textContent = isOpen ? 'selengkapnya' : 'sembunyikan';
}

// ── Boot ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => UserProfile.init());