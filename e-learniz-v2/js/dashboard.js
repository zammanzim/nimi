// =====================================================
// DASHBOARD.JS — Academic & Productivity Dashboard
// =====================================================

async function getAcademicYear(classId) {
    if (!classId) return '2025/2026';
    try {
        const { data } = await supabase.from('classes').select('academic_year').eq('id', classId).single();
        return data?.academic_year || '2025/2026';
    } catch (e) { return '2025/2026'; }
}

const DashboardApp = {
    state: {
        user: null,
        posts: [],
        tasks: [],
        doneIds: [],
        schedule: [],
        currentPostIndex: 0,
        selectedFile: null,
    },

    async init() {
        await this.waitForSupabase();
        this.state.user = this.getLocalUser();
        if (!this.state.user) { window.location.href = 'login'; return; }

        // Render Instan dari Cache
        this.renderCachedUserInfo();
        this.renderCachedStats();
        
        // Parallel load data & update
        await Promise.all([
            this.loadStatsAndPosts(),
            this.loadTaskProgress(),
            this.loadTodaySchedule()
        ]);

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

    renderCachedUserInfo() {
        const u = this.state.user;
        const cachedName = sessionStorage.getItem('dash_name');
        const cachedAvatar = sessionStorage.getItem('dash_avatar');
        const displayName = cachedName || u.full_name || u.short_name || 'User';
        const displayAvatar = cachedAvatar || u.avatar_url || '../icons/profpicture.png';
        
        // Update Dashboard Elements
        const nameEl = document.getElementById('dashFullName');
        const avatarEl = document.getElementById('dashAvatar');
        const userEl = document.getElementById('dashUsername');

        if (nameEl) nameEl.textContent = displayName;
        if (avatarEl) avatarEl.src = displayAvatar;
        if (userEl) userEl.textContent = `@${u.username || u.short_name || 'user'}`;
        
        // Update Header Elements
        const hName = document.getElementById('headerName');
        const hPP = document.getElementById('headerPP');
        if (hName) hName.textContent = `${t('hi')}, ${displayName.split(' ')[0]}`;
        if (hPP && hPP.getAttribute('src') !== displayAvatar) hPP.src = displayAvatar;
        
        // Update data asli
        this.renderUserInfo();
    },

    renderUserInfo() {
        const u = this.state.user;
        const name = u.full_name || u.short_name || 'User';
        const avatar = u.avatar_url || '../icons/profpicture.png';
        
        document.getElementById('dashFullName').textContent = name;
        document.getElementById('dashAvatar').src = avatar;
        
        sessionStorage.setItem('dash_name', name);
        sessionStorage.setItem('dash_avatar', avatar);
    },

    renderCachedStats() {
        const posts = sessionStorage.getItem('dash_posts');
        const tasks = sessionStorage.getItem('dash_tasks');
        const pEl = document.getElementById('statPosts');
        const tEl = document.getElementById('statTasks');
        if (pEl && posts) pEl.textContent = posts;
        if (tEl && tasks) tEl.textContent = tasks;
    },

    async loadStatsAndPosts() {
        try {
            const { data: posts, error } = await supabase
                .from('user_posts')
                .select('*')
                .eq('user_id', this.state.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.state.posts = posts || [];
            
            document.getElementById('statPosts').textContent = this.state.posts.length;
            sessionStorage.setItem('dash_posts', this.state.posts.length);
            
            this.renderPostsGrid();
        } catch (e) { console.error('Dash stats error:', e); }
    },

    renderPostsGrid() {
        const grid = document.getElementById('dashPostGrid');
        if (!grid) return;

        if (this.state.posts.length === 0) {
            grid.innerHTML = `<div class="posts-empty" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: #555;">
                <i class="fa-regular fa-image" style="font-size: 2.5rem; margin-bottom: 0.75rem; display: block; color: rgba(0, 234, 255, 0.18);"></i>
                <p style="font-size:.85rem;">${t('no_posts')}</p>
            </div>`;
            return;
        }

        grid.innerHTML = this.state.posts.map((post, i) => {
            const isVid = post.image_url && /\.(mp4|mov|webm|mkv)(\?|$)/i.test(post.image_url);
            if (isVid) {
                return `<div class="post-thumb animate-fade-in" onclick="DashboardApp.openPostDetail(${i})">
                    <video src="${post.image_url}" style="width:100%;height:100%;object-fit:cover;display:block;" muted preload="metadata"></video>
                    <div class="post-thumb-overlay" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.25);">
                        <i class="fa-solid fa-circle-play" style="margin:0;font-size:2rem;color:rgba(255,255,255,0.9);filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));"></i>
                    </div>
                </div>`;
            }
            if (post.image_url) {
                return `<div class="post-thumb animate-fade-in" onclick="DashboardApp.openPostDetail(${i})">
                    <img src="${post.image_url}" alt="" loading="lazy" style="width:100%; height:100%; object-fit:cover;">
                    <div class="post-thumb-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0); transition:background 0.2s; display:flex; align-items:center; justify-content:center; opacity:0;">
                        <i class="fa-solid fa-expand" style="color:white; font-size:1.2rem;"></i>
                    </div>
                </div>`;
            }
            const preview = (post.caption || '').slice(0, 60);
            return `<div class="post-thumb animate-fade-in post-thumb-text" onclick="DashboardApp.openPostDetail(${i})"
                style="display:flex;align-items:center;justify-content:center;padding:8px;background:rgba(0,0,0,0.45); aspect-ratio:1/1;">
                <span style="font-size:0.7rem;color:#ccc;text-align:center;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${this.escapeHtml(preview)}${post.caption?.length > 60 ? '…' : ''}</span>
            </div>`;
        }).join('');
    },

    async loadTaskProgress() {
        try {
            const classId = this.state.user.class_id;
            const uid = this.state.user.id;
            const academicYear = await getAcademicYear(classId);

            const [{ data: tasks }, { data: progress }] = await Promise.all([
                supabase.from('subject_announcements').select('id, is_done').eq('class_id', classId).eq('is_lesson', true).eq('academic_year', academicYear),
                supabase.from('user_progress').select('announcement_id').eq('user_id', uid)
            ]);

            const allTasks = tasks || [];
            const activeTasks = allTasks.filter(t => !t.is_done);
            const doneFromProgress = (progress || []).map(p => String(p.announcement_id));
            const finishedActiveTasks = activeTasks.filter(t => doneFromProgress.includes(String(t.id)));
            
            const total = activeTasks.length;
            const doneCount = finishedActiveTasks.length;
            const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

            document.getElementById('statTasks').textContent = doneCount;
            sessionStorage.setItem('dash_tasks', doneCount);
            
            document.getElementById('dashTaskPercent').textContent = `${percent}%`;
            document.getElementById('dashTaskBar').style.width = `${percent}%`;
            
            const archivedCount = allTasks.filter(t => t.is_done).length;
            const infoText = `kamu udah ngerjain ${doneCount} dari ${total} tugas (${archivedCount} diarsipkan)`;
            document.getElementById('dashTaskText').textContent = total > 0 ? infoText : `Gak ada tugas aktif.`;

        } catch (e) { console.error('Dash tasks error:', e); }
    },

    async loadTodaySchedule() {
        try {
            const now = new Date();
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            let dayName = days[now.getDay()];
            let label = 'Hari Ini';

            if (now.getHours() >= 15) {
                const tomorrow = new Date(now);
                tomorrow.setDate(now.getDate() + 1);
                dayName = days[tomorrow.getDay()];
                label = 'Besok';
            }

            document.getElementById('dashTodayName').textContent = `${label} (${dayName})`;

            const { data, error } = await supabase
                .from('daily_schedules')
                .select('lessons')
                .eq('class_id', this.state.user.class_id)
                .eq('day_name', dayName)
                .single();

            const container = document.getElementById('dashScheduleList');
            if (error || !data || !data.lessons) {
                container.innerHTML = `<div style="padding:1rem 0; text-align:center; color:#555; font-size:0.8rem;">Tidak ada jadwal untuk ${dayName.toLowerCase()}.</div>`;
                return;
            }

            const items = data.lessons.split(';').map(l => l.trim()).filter(l => l);
            container.innerHTML = items.map(item => {
                const dashIdx = item.lastIndexOf('-');
                const time = dashIdx !== -1 ? item.substring(0, dashIdx).trim() : '';
                const name = dashIdx !== -1 ? item.substring(dashIdx + 1).trim() : item;
                
                return `
                    <div class="mini-sched-item">
                        <div class="mini-sched-time">${time}</div>
                        <div class="mini-sched-name">${name}</div>
                    </div>
                `;
            }).join('');

        } catch (e) { console.error('Dash schedule error:', e); }
    },

    // --- Post Management ---
    setupUploadListeners() {
        const fileInput = document.getElementById('uploadFileInput');
        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) this.previewFile(file);
            };
        }
    },

    previewFile(file) {
        this.state.selectedFile = file;
        const img = document.getElementById('uploadPreviewImg');
        const vid = document.getElementById('uploadPreviewVid');
        const wrap = document.getElementById('uploadPreviewWrap');
        const zone = document.getElementById('uploadDropZone');

        wrap.classList.remove('hidden');
        zone.classList.add('hidden');

        if (file.type.startsWith('video/')) {
            vid.src = URL.createObjectURL(file);
            vid.style.display = 'block';
            img.style.display = 'none';
        } else {
            const reader = new FileReader();
            reader.onload = (e) => { img.src = e.target.result; };
            reader.readAsDataURL(file);
            img.style.display = 'block';
            vid.style.display = 'none';
        }
    },

    async submitPost() {
        const caption = document.getElementById('uploadCaption').value.trim();
        const file = this.state.selectedFile;
        if (!file && !caption) return;

        const btn = document.getElementById('btnPostSave');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Post';

        try {
            let mediaUrl = null;
            if (file) {
                const fileName = `${this.state.user.id}/${Date.now()}_${file.name}`;
                const { error: upErr } = await supabase.storage.from('post-photos').upload(fileName, file);
                if (upErr) throw upErr;
                const { data } = supabase.storage.from('post-photos').getPublicUrl(fileName);
                mediaUrl = data.publicUrl;
            }

            await supabase.from('user_posts').insert({
                user_id: this.state.user.id,
                image_url: mediaUrl,
                caption: caption || null
            });

            showToast(t('success_generic'));
            closeUploadModal();
            await this.loadStatsAndPosts();
        } catch (e) {
            showToast(t('failed_generic'), 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post';
        }
    },

    openPostDetail(index) {
        const post = this.state.posts[index];
        if (!post) return;
        this.state.currentPostIndex = index;

        const u = this.state.user;
        const username = u.username || u.short_name || 'user';

        document.getElementById('detailUserAvatar').src = u.avatar_url || '../icons/profpicture.png';
        document.getElementById('detailUserName').textContent = `@${username}`;
        document.getElementById('detailPostTime').textContent = this.formatDate(post.created_at);
        document.getElementById('detailCapText').textContent = post.caption || '';

        const imgEl = document.getElementById('detailPostImg');
        const vidEl = document.getElementById('detailPostVid');
        const vidWrap = document.getElementById('detailVidWrap');

        const isVid = post.image_url && /\.(mp4|mov|webm|mkv)(\?|$)/i.test(post.image_url);

        if (post.image_url && isVid) {
            if (vidEl) { vidEl.src = post.image_url; vidEl.load(); vidEl.play().catch(() => { vidEl.muted = true; vidEl.play().catch(() => { }); }); }
            if (vidWrap) vidWrap.style.display = 'block';
            if (imgEl) imgEl.style.display = 'none';
        } else if (post.image_url) {
            if (imgEl) { imgEl.src = post.image_url; imgEl.style.display = 'block'; }
            if (vidEl) { vidEl.pause?.(); vidEl.src = ''; }
            if (vidWrap) vidWrap.style.display = 'none';
        } else {
            if (imgEl) imgEl.style.display = 'none';
            if (vidEl) { vidEl.pause?.(); vidEl.src = ''; }
            if (vidWrap) vidWrap.style.display = 'none';
        }

        const actionsWrap = document.getElementById('detailActionsWrap');
        if (actionsWrap) actionsWrap.classList.remove('hidden');

        document.getElementById('postDetailOverlay').classList.add('show');
        lockScroll();
    },

    async deleteCurrentPost() {
        const post = this.state.posts[this.state.currentPostIndex];
        if (!post) return;

        const confirmed = await showPopup(t('confirm_delete_post'), 'confirm');
        if (!confirmed) return;

        const btn = document.getElementById('btnDeletePost');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
            if (post.image_url) {
                const fileName = post.image_url.split('/post-photos/')[1]?.split('?')[0];
                if (fileName) await supabase.storage.from('post-photos').remove([fileName]);
            }
            await supabase.from('user_posts').delete().eq('id', post.id);
            closePostDetail();
            showToast('Dihapus!');
            await this.loadStatsAndPosts();
        } catch (err) {
            console.error(err);
            showToast(t('failed_generic'), 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-trash"></i> ${t('delete_post')}`;
        }
    },

    formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const diff = (Date.now() - d) / 1000;
        if (diff < 60) return 'Baru saja';
        if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    },

    escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
};

// Global Handlers
function openUploadModal() {
    document.getElementById('uploadModal').classList.remove('hidden');
    document.getElementById('uploadPreviewWrap').classList.add('hidden');
    document.getElementById('uploadDropZone').classList.remove('hidden');
    document.getElementById('uploadCaption').value = '';
    document.getElementById('captionCounter').textContent = '0/500';
    lockScroll();
}
function closeUploadModal() { document.getElementById('uploadModal').classList.add('hidden'); unlockScroll(); }
function removeUploadPreview() {
    document.getElementById('uploadPreviewWrap').classList.add('hidden');
    document.getElementById('uploadDropZone').classList.remove('hidden');
    DashboardApp.state.selectedFile = null;
}
function submitPost() { DashboardApp.submitPost(); }
function closePostDetail() { 
    document.getElementById('postDetailOverlay').classList.remove('show'); 
    const vid = document.getElementById('detailPostVid');
    if (vid) { vid.pause(); vid.src = ''; }
    unlockScroll(); 
}
function deleteCurrentPost() { DashboardApp.deleteCurrentPost(); }
function handleDetailOverlayClick(e) { if (e.target.classList.contains('post-modal-overlay')) closePostDetail(); }

document.addEventListener('DOMContentLoaded', () => DashboardApp.init());
