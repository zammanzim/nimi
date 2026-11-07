// js/forum.js — IG/TikTok comment style
let forumChannel = null;
let activeTopicId = null;
let activeTopicReplyCount = 0;

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    if (!user) { window.location.href = 'index'; return; }

    // Set avatar di comment input bar
    const avatarEl = document.getElementById('commentUserAvatar');
    if (avatarEl) avatarEl.src = user.avatar_url || 'icons/profpicture.png';

    // Enter kirim komentar
    document.getElementById('commentInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); }
    });

    // Swipe down drawer untuk tutup
    setupDrawerSwipe();

    loadFeed();
    setupRealtime();
});

// ─────────────────────────────────────────
// REALTIME
// ─────────────────────────────────────────
function setupRealtime() {
    if (forumChannel) { forumChannel.unsubscribe(); forumChannel = null; }

    forumChannel = supabase.channel('forum_realtime')
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'forum_topics',
            filter: `class_id=eq.${getEffectiveClassId()}`
        }, () => loadFeed())
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'forum_replies'
        }, payload => {
            // Update comment count badge di post card
            const tid = String(payload.new.topic_id);
            const badge = document.getElementById(`comment-count-${tid}`);
            if (badge) badge.innerText = parseInt(badge.innerText || '0') + 1;

            // Kalau drawer lagi buka untuk topic ini, append komentar baru langsung
            if (activeTopicId === tid) {
                appendCommentRealtime(payload.new);
            }
        })
        .subscribe();
}

window.addEventListener('pagehide', () => {
    if (forumChannel) { forumChannel.unsubscribe(); forumChannel = null; }
});

// ─────────────────────────────────────────
// LOAD FEED
// ─────────────────────────────────────────
async function loadFeed() {
    const user = getUser();
    const feed = document.getElementById('forumFeed');

    try {
        const { data, error } = await supabase
            .from('forum_topics')
            .select('*, users(nickname, avatar_url)')
            .eq('class_id', getEffectiveClassId())
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            feed.innerHTML = `
                <div class="forum-empty">
                    <i class="fa-regular fa-comments"></i>
                    <p>${t('no_discussion')}</p>
                </div>`;
            return;
        }

        // Ambil reply count semua topic sekaligus
        const topicIds = data.map(t => t.id);
        const { data: replyCounts } = await supabase
            .from('forum_replies')
            .select('topic_id')
            .in('topic_id', topicIds);

        const countMap = {};
        (replyCounts || []).forEach(r => {
            countMap[r.topic_id] = (countMap[r.topic_id] || 0) + 1;
        });

        feed.innerHTML = '';
        data.forEach(topic => renderPost(topic, user, countMap[topic.id] || 0));

    } catch (err) {
        console.error('loadFeed error:', err);
    }
}

function renderPost(topic, user, commentCount) {
    const feed = document.getElementById('forumFeed');
    const isOwner = String(topic.user_id) === String(user.id) || user.role === 'super_admin' || user.role === 'class_admin';
    const timeStr = timeAgo(topic.created_at);
    const avatar = topic.users?.avatar_url || 'icons/profpicture.png';
    const name = topic.users?.nickname || 'Anonim';

    const card = document.createElement('div');
    card.className = 'forum-post animate-pop-in';
    card.id = `post-${topic.id}`;
    card.innerHTML = `
        <div class="post-header">
            <img class="post-avatar" src="${avatar}" onerror="this.src='icons/profpicture.png'">
            <div class="post-meta">
                <div class="post-username">${name}</div>
                <div class="post-time">${timeStr}</div>
            </div>
            ${isOwner ? `<button class="post-delete-btn" onclick="deleteTopic('${topic.id}')" title="${t('delete')}">
                <i class="fa-solid fa-trash-can"></i>
            </button>` : ''}
        </div>
        <div class="post-title">${escHtml(topic.title)}</div>
        <div class="post-body">${escHtml(topic.content)}</div>
        <div class="post-actions">
            <button class="action-btn" onclick="openCommentDrawer('${topic.id}', '${escAttr(topic.title)}')">
                <i class="fa-regular fa-comment"></i>
                <span id="comment-count-${topic.id}">${commentCount}</span> komentar
            </button>
        </div>
    `;
    feed.appendChild(card);
}

// ─────────────────────────────────────────
// COMMENT DRAWER
// ─────────────────────────────────────────
async function openCommentDrawer(topicId, topicTitle) {
    activeTopicId = String(topicId);

    document.getElementById('drawerTitle').innerText = `Komentar`;
    document.getElementById('commentList').innerHTML = `<div class="comment-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
    document.getElementById('commentInput').value = '';

    document.getElementById('commentBackdrop').classList.add('show');
    document.getElementById('commentDrawer').classList.add('show');
    document.body.style.overflow = 'hidden';

    await loadComments(topicId);
    setTimeout(() => document.getElementById('commentInput')?.focus(), 350);
}

function closeCommentDrawer() {
    activeTopicId = null;
    document.getElementById('commentBackdrop').classList.remove('show');
    document.getElementById('commentDrawer').classList.remove('show');
    document.body.style.overflow = '';
}

async function loadComments(topicId) {
    const user = getUser();
    const list = document.getElementById('commentList');

    const { data, error } = await supabase
        .from('forum_replies')
        .select('*, users(nickname, avatar_url)')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });

    if (error) { list.innerHTML = '<div class="comment-loading">Gagal memuat.</div>'; return; }

    if (!data || data.length === 0) {
        list.innerHTML = `<div class="forum-empty" style="padding:40px 0;">
            <i class="fa-regular fa-comment" style="font-size:28px;"></i>
            <p>${t('no_comment_forum')}</p>
        </div>`;
        return;
    }

    list.innerHTML = '';
    data.forEach(reply => list.appendChild(buildCommentEl(reply, user)));
    list.scrollTop = list.scrollHeight;
}

function buildCommentEl(reply, user) {
    const isOwner = user && (String(reply.user_id) === String(user.id) || user.role === 'super_admin' || user.role === 'class_admin');
    const avatar = reply.users?.avatar_url || 'icons/profpicture.png';
    const name = reply.users?.nickname || 'Anonim';

    const div = document.createElement('div');
    div.className = 'comment-item';
    div.id = `reply-${reply.id}`;
    div.innerHTML = `
        <img class="comment-avatar" src="${avatar}" onerror="this.src='icons/profpicture.png'">
        <div class="comment-body">
            <div class="comment-name">${name}</div>
            <div class="comment-text">${escHtml(reply.content)}</div>
            <div class="comment-time">${timeAgo(reply.created_at)}</div>
        </div>
        ${isOwner ? `<button class="comment-delete" onclick="deleteComment('${reply.id}')" title="${t('delete')}">
            <i class="fa-solid fa-trash-can"></i>
        </button>` : ''}
    `;
    return div;
}

async function appendCommentRealtime(newReply) {
    // Fetch user detail untuk reply baru
    const { data: replyWithUser } = await supabase
        .from('forum_replies')
        .select('*, users(nickname, avatar_url)')
        .eq('id', newReply.id)
        .single();

    if (!replyWithUser) return;

    const user = getUser();
    const list = document.getElementById('commentList');
    const emptyEl = list.querySelector('.forum-empty');
    if (emptyEl) emptyEl.remove();

    list.appendChild(buildCommentEl(replyWithUser, user));
    list.scrollTop = list.scrollHeight;
}

// ─────────────────────────────────────────
// SEND COMMENT
// ─────────────────────────────────────────
async function sendComment() {
    if (!activeTopicId) return;
    const input = document.getElementById('commentInput');
    const btn = document.getElementById('commentSendBtn');
    const content = input.value.trim();
    if (!content) return;

    const user = getUser();
    btn.disabled = true;
    input.disabled = true;

    const { error } = await supabase.from('forum_replies').insert({
        topic_id: activeTopicId,
        user_id: user.id,
        content: content
    });

    if (!error) {
        input.value = '';
        // Update count badge
        const badge = document.getElementById(`comment-count-${activeTopicId}`);
        if (badge) badge.innerText = parseInt(badge.innerText || '0') + 1;
    } else {
        showPopup('Gagal kirim komentar', 'error');
    }

    btn.disabled = false;
    input.disabled = false;
    input.focus();
}

// ─────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────
async function deleteTopic(topicId) {
    if (!confirm(t('confirm_delete_discussion'))) return;
    const { error } = await supabase.from('forum_topics').delete().eq('id', topicId);
    if (!error) {
        document.getElementById(`post-${topicId}`)?.remove();
        showPopup(t('discussion_deleted'), 'success');
    } else {
        showPopup('Gagal hapus', 'error');
    }
}

async function deleteComment(replyId) {
    if (!confirm(t('confirm_delete_comment'))) return;
    const { error } = await supabase.from('forum_replies').delete().eq('id', replyId);
    if (!error) {
        const el = document.getElementById(`reply-${replyId}`);
        el?.remove();
        // Update count badge
        if (activeTopicId) {
            const badge = document.getElementById(`comment-count-${activeTopicId}`);
            if (badge) badge.innerText = Math.max(0, parseInt(badge.innerText || '0') - 1);
        }
    } else {
        showPopup('Gagal hapus komentar', 'error');
    }
}

// ─────────────────────────────────────────
// POST NEW TOPIC
// ─────────────────────────────────────────
async function postNewTopic() {
    const user = getUser();
    const title = document.getElementById('topicTitle').value.trim();
    const content = document.getElementById('topicContent').value.trim();

    if (!title || !content) { showPopup('Judul dan isi wajib diisi!', 'error'); return; }

    const btn = document.querySelector('.compose-box .btn-glass-save');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';

    const { error } = await supabase.from('forum_topics').insert({
        user_id: user.id,
        class_id: getEffectiveClassId(),
        title: title,
        content: content
    });

    if (!error) {
        showToast(t('discussion_posted'), 'success');
        document.getElementById('topicTitle').value = '';
        document.getElementById('topicContent').value = '';
        loadFeed();
    } else {
        showPopup('Gagal posting: ' + error.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Posting';
}

// ─────────────────────────────────────────
// SWIPE DOWN TO CLOSE DRAWER
// ─────────────────────────────────────────
function setupDrawerSwipe() {
    const drawer = document.getElementById('commentDrawer');
    let startY = 0, isDragging = false;

    drawer.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
        isDragging = true;
    }, { passive: true });

    drawer.addEventListener('touchmove', e => {
        if (!isDragging) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) drawer.style.transform = `translateY(${dy}px)`;
    }, { passive: true });

    drawer.addEventListener('touchend', e => {
        if (!isDragging) return;
        isDragging = false;
        const dy = e.changedTouches[0].clientY - startY;
        drawer.style.transform = '';
        if (dy > 100) closeCommentDrawer();
    });
}

// ─────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────
function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'baru saja';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} menit lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} hari lalu`;
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'");
}