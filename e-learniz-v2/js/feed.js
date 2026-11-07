// ============================================================
// FEED APP — js/feed.js
// Nampilin user_posts dari halaman user
// Schema: user_posts { id, user_id, image_url, caption, created_at }
// Users:  { id, full_name, short_name, username, avatar_url, class_id }
// Like:   post_likes { id, post_id, user_id }
// Komen:  post_comments { id, post_id, user_id, content, created_at }
// ============================================================

const FeedApp = {
    state: {
        user: null,
        posts: [],
        page: 0,
        pageSize: 8,
        loading: false,
        hasMore: true,
        likedPosts: new Set(),
        expandedComments: new Set(),
        activeVideo: null,          // video element yang lagi main
    },

    async init() {
        if (typeof supabase === 'undefined') { setTimeout(() => this.init(), 150); return; }

        this.state.user = this.getUser();
        if (!this.state.user) { window.location.href = 'login'; return; }

        const nameEl = document.getElementById('headerName');
        const ppEl   = document.getElementById('headerPP');
        if (nameEl) nameEl.textContent = t('hi') + ', ' + (this.state.user.short_name || this.state.user.full_name?.split(' ')[0] || 'User');
        if (ppEl && ppEl.getAttribute('src') !== (this.state.user.avatar_url || 'icons/profpicture.png')) ppEl.src = this.state.user.avatar_url || 'icons/profpicture.png';

        this.bindScrollSentinel();
        await this.loadPosts();
        this.subscribeRealtime();
    },

    getUser() {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
    },

    async loadPosts() {
        if (this.state.loading || !this.state.hasMore) return;
        this.state.loading = true;
        this.setSkeleton(true);

        const from = this.state.page * this.state.pageSize;
        const to   = from + this.state.pageSize - 1;

        try {
            const { data, error } = await supabase
                .from('user_posts')
                .select('id, image_url, caption, created_at, user_id, users:user_id(id, full_name, short_name, username, avatar_url, class_id, is_private)')
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            if (!data || data.length < this.state.pageSize) this.state.hasMore = false;

            // Filter postingan dari akun privat
            const filtered = (data || []).filter(post => !post.users?.is_private);

            // Batch fetch likes + comment counts
            const postIds = filtered.map(p => p.id);
            let likeMap = {}, commentMap = {};
            if (postIds.length > 0) {
                const [{ data: likes }, { data: comments }] = await Promise.all([
                    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
                    supabase.from('post_comments').select('post_id').in('post_id', postIds),
                ]);
                (likes || []).forEach(l => {
                    likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1;
                    if (l.user_id === this.state.user.id) this.state.likedPosts.add(l.post_id);
                });
                (comments || []).forEach(c => {
                    commentMap[c.post_id] = (commentMap[c.post_id] || 0) + 1;
                });
            }

            filtered.forEach(post => {
                this.state.posts.push(post);
                this.renderPost(post, likeMap[post.id] || 0, commentMap[post.id] || 0);
            });

            this.state.page++;
        } catch (err) {
            console.error('loadPosts error:', err);
            showToast('Gagal memuat feed', 'error');
        }

        this.setSkeleton(false);
        this.checkEmpty();
        this.state.loading = false;
        // Re-evaluate video setelah post baru masuk
        if (this._pickBestVideo) setTimeout(this._pickBestVideo, 120);
    },

    isVideoUrl(url) {
        return url && /\.(mp4|mov|webm|mkv)(\?|$)/i.test(url);
    },

    renderPost(post, likeCount = 0, commentCount = 0, prepend = false) {
        const u        = post.users || {};
        const avatar   = u.avatar_url || 'icons/profpicture.png';
        const username = u.username || u.short_name || u.full_name?.split(' ')[0] || 'User';
        const liked    = this.state.likedPosts.has(post.id);
        const isOwn    = post.user_id === this.state.user.id;
        const isAdmin  = ['super_admin', 'class_admin'].includes(this.state.user.role);
        const canDel   = isOwn || isAdmin;
        const isVid    = this.isVideoUrl(post.image_url);

        const mediaHTML = post.image_url
            ? isVid
                ? `<div class="fc-image-wrap fc-video-wrap">
                    <video class="fc-video" src="${post.image_url}" loop playsinline preload="metadata"
                        style="width:100%;display:block;cursor:pointer;"></video>
                    <div class="fc-heart-burst hidden"><i class="fa-solid fa-heart"></i></div>
                    <button class="fc-mute-btn" aria-label="toggle mute">
                        <i class="fa-solid fa-volume-xmark"></i>
                    </button>
                   </div>`
                : `<div class="fc-image-wrap">
                    <img class="fc-image" src="${post.image_url}" alt="post" loading="lazy" onerror="this.parentElement.style.display='none'">
                    <div class="fc-heart-burst hidden"><i class="fa-solid fa-heart"></i></div>
                   </div>`
            : '';

        const card = document.createElement('article');
        card.className = 'feed-card';
        card.dataset.postId = post.id;
        card.innerHTML = `
            <div class="fc-header">
                <a class="fc-avatar-link" href="user?name=${u.username || u.short_name}">
                    <img class="fc-avatar" src="${avatar}" alt="${username}" onerror="this.src='icons/profpicture.png'">
                </a>
                <div class="fc-meta">
                    <a class="fc-username" href="user?name=${u.username || u.short_name}">${u.full_name || username}</a>
                    <span class="fc-time">${this.timeAgo(post.created_at)}</span>
                </div>
                ${canDel ? `
                <div class="fc-menu-wrap" style="position:relative">
                    <button class="fc-menu-btn"><i class="fa-solid fa-ellipsis"></i></button>
                    <div class="fc-dropdown hidden">
                        ${isOwn ? `<div class="fc-dd-item" data-action="edit"><i class="fa-regular fa-pen-to-square"></i> ${t('edit_caption')}</div>` : ''}
                        <div class="fc-dd-item fc-dd-del" data-action="delete"><i class="fa-solid fa-trash"></i> ${t('delete')}</div>
                    </div>
                </div>` : ''}
            </div>

            ${mediaHTML}

            <div class="fc-actions">
                <button class="fc-like-btn ${liked ? 'liked' : ''}" aria-label="like">
                    <i class="fa-${liked ? 'solid' : 'regular'} fa-heart"></i>
                </button>
                <button class="fc-comment-btn" aria-label="komentar">
                    <i class="fa-regular fa-comment"></i>
                    ${commentCount > 0 ? `<span class="fc-comment-badge">${commentCount}</span>` : ''}
                </button>
            </div>

            <div class="fc-likes"><span class="fc-like-count">${likeCount}</span> suka</div>

            ${post.caption ? `
            <div class="fc-caption">
                <a class="fc-cap-name" href="user?name=${u.username || u.short_name}">${username}</a>
                <span class="fc-cap-text">${this.escHtml(post.caption)}</span>
            </div>` : ''}

            <div class="fc-comments hidden">
                <div class="fc-comment-list"></div>
                <div class="fc-comment-form">
                    <img class="fc-self-avatar" src="${this.state.user.avatar_url || 'icons/profpicture.png'}" onerror="this.src='icons/profpicture.png'">
                    <input class="fc-comment-input" type="text" placeholder="${t('add_comment_placeholder')}">
                    <button class="fc-comment-send"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        `;

        const list = document.getElementById('feedList');
        if (prepend) list.prepend(card); else list.appendChild(card);
        this._bindCard(card, post);
        if (isVid) this._bindVideo(card);
    },


    // ── Centralized IG-style video manager ──────────────────
    // Dipanggil sekali saat init, lalu tiap scroll/resize
    _initVideoManager() {
        if (this._videoManagerReady) return;
        this._videoManagerReady = true;

        const pickBest = () => {
            const videos = [...document.querySelectorAll('.fc-video')];
            if (!videos.length) return;

            const vh     = window.innerHeight;
            const center = vh / 2;
            let best = null, bestScore = -Infinity;

            videos.forEach(v => {
                const r    = v.getBoundingClientRect();
                // Video harus minimal sedikit keliatan
                if (r.bottom < 0 || r.top > vh) return;

                // Seberapa banyak video keliatan (0–1)
                const visible  = Math.min(r.bottom, vh) - Math.max(r.top, 0);
                const visRatio = visible / r.height;
                if (visRatio < 0.5) return;          // kurang dari 50% skip

                // Jarak titik tengah video ke tengah layar
                const vidCenter = r.top + r.height / 2;
                const dist      = Math.abs(vidCenter - center);
                const score     = visRatio * 1000 - dist; // lebih visible + lebih tengah = lebih bagus

                if (score > bestScore) { bestScore = score; best = v; }
            });

            // Play yang terpilih, pause sisanya
            videos.forEach(v => {
                if (v === best) {
                    if (v.paused) this._playVideo(v);
                } else {
                    if (!v.paused) v.pause();
                }
            });
            this.state.activeVideo = best || null;
        };

        let ticking = false;
        const onScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => { pickBest(); ticking = false; });
                ticking = true;
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });

        // Jalankan sekali sekarang
        setTimeout(pickBest, 100);
        // Expose agar bisa dipanggil manual saat post baru di-render
        this._pickBestVideo = pickBest;
    },

    _playVideo(vid) {
        const muteBtn = vid.closest('.fc-video-wrap')?.querySelector('.fc-mute-btn');
        const updateMuteIcon = () => {
            if (!muteBtn) return;
            muteBtn.querySelector('i').className = vid.muted
                ? 'fa-solid fa-volume-xmark'
                : 'fa-solid fa-volume-high';
        };
        // Pertahankan mute state dari video sebelumnya (user experience)
        const prevMuted = this.state.activeVideo?.muted ?? false;
        vid.muted = prevMuted;
        vid.play().then(() => { updateMuteIcon(); })
           .catch(() => { vid.muted = true; vid.play().catch(() => {}); updateMuteIcon(); });
    },

    _bindVideo(card) {
        const vid     = card.querySelector('.fc-video');
        const muteBtn = card.querySelector('.fc-mute-btn');
        if (!vid) return;

        // Init manager sekali
        this._initVideoManager();

        const updateMuteIcon = () => {
            if (!muteBtn) return;
            muteBtn.querySelector('i').className = vid.muted
                ? 'fa-solid fa-volume-xmark'
                : 'fa-solid fa-volume-high';
        };

        // Tombol mute/unmute — apply ke semua video sekalian (kayak IG)
        muteBtn?.addEventListener('click', e => {
            e.stopPropagation();
            const newMuted = !vid.muted;
            // Sync semua video biar konsisten kalau nanti ganti video
            document.querySelectorAll('.fc-video').forEach(v => { v.muted = newMuted; });
            if (!vid.muted && vid.paused) vid.play().catch(() => { vid.muted = true; });
            updateMuteIcon();
        });

        // Single tap: play/pause — Double tap: like
        let tapTimer = null;
        vid.addEventListener('click', () => {
            if (tapTimer) {
                clearTimeout(tapTimer);
                tapTimer = null;
                this.toggleLike(card.dataset.postId, card, true);
            } else {
                tapTimer = setTimeout(() => {
                    tapTimer = null;
                    if (vid.paused) {
                        this._playVideo(vid);
                        this.state.activeVideo = vid;
                    } else {
                        vid.pause();
                        if (this.state.activeVideo === vid) this.state.activeVideo = null;
                    }
                }, 250);
            }
        });
    },

    _bindCard(card, post) {
        card.querySelector('.fc-like-btn')?.addEventListener('click', () => this.toggleLike(post.id, card));

        const imgWrap = card.querySelector('.fc-image-wrap:not(.fc-video-wrap)');
        if (imgWrap) {
            let lastTap = 0;
            imgWrap.addEventListener('click', () => {
                const now = Date.now();
                if (now - lastTap < 300) this.toggleLike(post.id, card, true);
                lastTap = now;
            });
        }

        card.querySelector('.fc-comment-btn')?.addEventListener('click', () => this.toggleComments(post.id, card));
        card.querySelector('.fc-comment-send')?.addEventListener('click', () => this.sendComment(post.id, card));
        card.querySelector('.fc-comment-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendComment(post.id, card); }
        });

        const menuBtn  = card.querySelector('.fc-menu-btn');
        const dropdown = card.querySelector('.fc-dropdown');
        menuBtn?.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.fc-dropdown').forEach(d => { if (d !== dropdown) d.classList.add('hidden'); });
            dropdown?.classList.toggle('hidden');
        });
        card.querySelectorAll('.fc-dd-item').forEach(item => {
            item.addEventListener('click', () => {
                dropdown?.classList.add('hidden');
                if (item.dataset.action === 'delete') this.deletePost(post.id, card);
                if (item.dataset.action === 'edit')   this.editCaption(post, card);
            });
        });
    },

    async toggleLike(postId, card, fromDblTap = false) {
        const liked   = this.state.likedPosts.has(postId);
        if (fromDblTap && liked) return;
        const btn     = card.querySelector('.fc-like-btn');
        const icon    = btn.querySelector('i');
        const countEl = card.querySelector('.fc-like-count');
        const prev    = parseInt(countEl.textContent) || 0;

        if (!liked) {
            this.state.likedPosts.add(postId);
            btn.classList.add('liked', 'like-pop'); icon.className = 'fa-solid fa-heart';
            countEl.textContent = prev + 1;
            setTimeout(() => btn.classList.remove('like-pop'), 350);
            if (fromDblTap) this._burst(card);
            const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: this.state.user.id });
            if (error) { this.state.likedPosts.delete(postId); btn.classList.remove('liked'); icon.className = 'fa-regular fa-heart'; countEl.textContent = prev; }
        } else {
            this.state.likedPosts.delete(postId);
            btn.classList.remove('liked'); icon.className = 'fa-regular fa-heart';
            countEl.textContent = Math.max(0, prev - 1);
            const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', this.state.user.id);
            if (error) { this.state.likedPosts.add(postId); btn.classList.add('liked'); icon.className = 'fa-solid fa-heart'; countEl.textContent = prev; }
        }
    },

    _burst(card) {
        const b = card.querySelector('.fc-heart-burst');
        if (!b) return;
        b.classList.remove('hidden', 'burst-out');
        b.classList.add('burst-in');
        setTimeout(() => { b.classList.remove('burst-in'); b.classList.add('burst-out'); }, 600);
        setTimeout(() => { b.classList.add('hidden'); b.classList.remove('burst-out'); }, 1050);
    },

    async toggleComments(postId, card) {
        const section  = card.querySelector('.fc-comments');
        const isHidden = section.classList.toggle('hidden');
        if (!isHidden && !this.state.expandedComments.has(postId)) {
            this.state.expandedComments.add(postId);
            await this.loadComments(postId, card);
        }
        if (!isHidden) card.querySelector('.fc-comment-input')?.focus();
    },

    async loadComments(postId, card) {
        const { data } = await supabase
            .from('post_comments')
            .select('id, content, created_at, user_id, users:user_id(short_name, full_name, avatar_url)')
            .eq('post_id', postId).order('created_at', { ascending: true });
        const list = card.querySelector('.fc-comment-list');
        if (!list) return;
        list.innerHTML = (!data || data.length === 0)
            ? '<p class="fc-no-comments">' + t('no_comments') + '</p>'
            : (data || []).map(c => this._commentHTML(c)).join('');
    },

    _commentHTML(c) {
        const u = c.users || {};
        return `<div class="fc-comment-item">
            <img class="fc-comment-avatar" src="${u.avatar_url || 'icons/profpicture.png'}" onerror="this.src='icons/profpicture.png'">
            <div class="fc-comment-body">
                <span class="fc-comment-name">${u.short_name || u.full_name?.split(' ')[0] || 'User'}</span>
                <span class="fc-comment-text">${this.escHtml(c.content)}</span>
                <span class="fc-comment-time">${this.timeAgo(c.created_at)}</span>
            </div>
        </div>`;
    },

    async sendComment(postId, card) {
        const input   = card.querySelector('.fc-comment-input');
        const sendBtn = card.querySelector('.fc-comment-send');
        const text    = input.value.trim();
        if (!text) return;
        sendBtn.disabled = true; input.value = '';

        const { data, error } = await supabase.from('post_comments')
            .insert({ post_id: postId, user_id: this.state.user.id, content: text })
            .select('id, content, created_at, user_id, users:user_id(short_name, full_name, avatar_url)')
            .single();

        sendBtn.disabled = false;
        if (error) { showToast('Gagal kirim komentar', 'error'); input.value = text; return; }

        const list = card.querySelector('.fc-comment-list');
        if (list) {
            list.querySelector('.fc-no-comments')?.remove();
            list.insertAdjacentHTML('beforeend', this._commentHTML(data));
        }

        // Increment badge
        const btn   = card.querySelector('.fc-comment-btn');
        let badge   = btn.querySelector('.fc-comment-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'fc-comment-badge';
            badge.textContent = '0';
            btn.appendChild(badge);
        }
        badge.textContent = parseInt(badge.textContent || '0') + 1;
        badge.classList.add('badge-bump');
        setTimeout(() => badge.classList.remove('badge-bump'), 350);
    },

    async deletePost(postId, card) {
        const ok = await showPopup(t('confirm_delete_post'), 'confirm');
        if (!ok) return;

        const post = this.state.posts.find(p => p.id === postId);
        if (post?.image_url) {
            const fileName = post.image_url.split('/post-photos/')[1]?.split('?')[0];
            if (fileName) await supabase.storage.from('post-photos').remove([fileName]);
        }

        const { error } = await supabase.from('user_posts').delete().eq('id', postId);
        if (error) { showToast('Gagal hapus', 'error'); return; }

        card.style.animation = 'fadeOutCard .3s ease forwards';
        setTimeout(() => card.remove(), 300);
        this.state.posts = this.state.posts.filter(p => p.id !== postId);
        showToast('Postingan dihapus');
        this.checkEmpty();
    },

    async editCaption(post, card) {
        const capDiv = card.querySelector('.fc-caption');
        const u      = post.users || {};
        const prev   = post.caption || '';
        if (!capDiv) return;

        capDiv.innerHTML = `
            <textarea class="fc-edit-ta">${prev}</textarea>
            <div class="fc-edit-controls">
                <button class="fc-btn-cancel-edit">${t('cancel')}</button>
                <button class="fc-btn-save-edit">${t('save')}</button>
            </div>`;

        capDiv.querySelector('.fc-edit-ta').focus();
        capDiv.querySelector('.fc-btn-cancel-edit').onclick = () => {
            capDiv.innerHTML = `<a class="fc-cap-name" href="user?name=${u.username || u.short_name}">${username(u)}</a><span class="fc-cap-text">${this.escHtml(prev)}</span>`;
        };
        capDiv.querySelector('.fc-btn-save-edit').onclick = async () => {
            const newCap = capDiv.querySelector('.fc-edit-ta').value.trim();
            const { error } = await supabase.from('user_posts').update({ caption: newCap }).eq('id', post.id);
            if (error) { showToast('Gagal simpan', 'error'); return; }
            post.caption = newCap;
            capDiv.innerHTML = `<a class="fc-cap-name" href="user?name=${u.username || u.short_name}">${username(u)}</a><span class="fc-cap-text">${this.escHtml(newCap)}</span>`;
            showToast('Caption diupdate!');
        };

        function username(u) { return u.username || u.short_name || u.full_name?.split(' ')[0] || 'User'; }
    },

    subscribeRealtime() {
        supabase.channel('feed_realtime_v2')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_posts' }, async payload => {
                if (payload.new.user_id === this.state.user.id) return;
                const { data } = await supabase
                    .from('user_posts')
                    .select('id, image_url, caption, created_at, user_id, users:user_id(id, full_name, short_name, username, avatar_url, is_private)')
                    .eq('id', payload.new.id).single();
                if (data && !data.users?.is_private) {
                    this.state.posts.unshift(data);
                    this.renderPost(data, 0, 0, true);
                    this.checkEmpty();
                }
            })
            .subscribe();
    },

    bindScrollSentinel() {
        const sentinel = document.getElementById('scrollSentinel');
        if (!sentinel) return;
        new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !this.state.loading && this.state.hasMore) this.loadPosts();
        }, { rootMargin: '300px' }).observe(sentinel);
    },

    setSkeleton(show) {
        const el = document.getElementById('feedSkeleton');
        if (!el) return;
        if (show) {
            el.innerHTML = SkeletonUI.feed();
        } else {
            el.innerHTML = '';
        }
    },

    checkEmpty() {
        const el = document.getElementById('feedEmpty');
        if (el) el.style.display = (this.state.posts.length === 0 && !this.state.hasMore) ? 'flex' : 'none';
    },

    escHtml(s = '') {
        return String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/\n/g, '<br>');
    },

    timeAgo(iso) {
        if (!iso) return '';
        const diff = (Date.now() - new Date(iso)) / 1000;
        if (diff < 60) return 'Baru saja';
        if (diff < 3600) return `${Math.floor(diff/60)} mnt lalu`;
        if (diff < 86400) return `${Math.floor(diff/3600)} jam lalu`;
        if (diff < 604800) return `${Math.floor(diff/86400)} hari lalu`;
        return new Date(iso).toLocaleDateString('id-ID', { day:'numeric', month:'short' });
    },
};

document.addEventListener('click', () => {
    document.querySelectorAll('.fc-dropdown').forEach(d => d.classList.add('hidden'));
});

document.addEventListener('DOMContentLoaded', () => FeedApp.init());