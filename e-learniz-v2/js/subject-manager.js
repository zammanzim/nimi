// Helper untuk dapatkan academic_year berdasarkan class_id
async function getAcademicYear(classId) {
    if (!classId) return '2025/2026';
    try {
        const { data } = await supabase.from('classes').select('academic_year').eq('id', classId).single();
        return data?.academic_year || '2025/2026';
    } catch (e) { return '2025/2026'; }
}

const SubjectApp = {
    state: {
        editMode: false,
        isToggling: false,
        user: null,
        subjectId: null,
        subjectName: null,
        isLessonMode: false,
        completedTasks: [],
        announcements: [],
        tempFiles: [],
        bookmarks: [],
        selectedColor: 'default',
    },

    // Helper internal untuk nentuin data ini harus ditarik/disimpan ke kelas mana
    async _getTargetClassId() {
        let currentClassId = getEffectiveClassId() || (SubjectApp.state.user ? SubjectApp.state.user.class_id : null);

        // --- LOGIC GLOBAL KISI-KISI ---
        if (SubjectApp.state.subjectId === 'kisi-kisi') {
            const MASTER_ID = 2;
            if (currentClassId != MASTER_ID) {
                // Cek Master Config (pake cache biar hemat bandwidth)
                const masterCacheKey = `dc_config_${MASTER_ID}`;
                let masterConfig = null;
                try {
                    const raw = localStorage.getItem(masterCacheKey);
                    if (raw) masterConfig = JSON.parse(raw).data;
                } catch (e) { }

                if (!masterConfig) {
                    try {
                        const { data } = await supabase.from('daily_config').select('mode').eq('class_id', MASTER_ID).single();
                        masterConfig = data;
                    } catch (e) { }
                }

                // Kalo Master lagi Mode Exam, paksa pake data punya Master (Class 2)
                if (masterConfig && masterConfig.mode === 'exam') {
                    return MASTER_ID;
                }
            }
        }
        return currentClassId;
    },

    init(subjectId, subjectName, title, isLesson = false) {
        if (typeof supabase === 'undefined') return;

        // Reset state biar gak carry-over dari page sebelumnya
        this.state.editMode = false;
        this.state.isToggling = false;
        this.tempFiles = [];
        this.state.announcements = [];
        this.state.completedTasks = [];

        this.state.subjectId = subjectId;
        this.state.subjectName = subjectName;
        this.state.title = title;
        this.state.isLessonMode = isLesson;
        this.state.user = this.getUserData();

        if (!this.state.user) {
            if (this.state.subjectId === 'guest') {
                this.state.user = { id: 'guest', role: '', class_id: 2 };
            } else {
                window.location.href = "login";
                return;
            }
        }


        this.updatePageTitle();
        this.updateWelcomeText();
        this.setupAdminControls();
        this.setupEventListeners();
        this.loadAnnouncements();
        this.setupShortcuts();
        this.initAdd();
        this.setupAutoList();
    },

    getUserData() {
        try {
            if (typeof getUser === 'function') return getUser();
            const userData = localStorage.getItem("user");
            return userData ? JSON.parse(userData) : null;
        } catch (e) {
            console.error("Failed to parse user data:", e);
            return null;
        }
    },

    // Update baris 44
    updatePageTitle() {
        document.title = `${this.state.subjectName.replace(/<[^>]*>/g, '')} • E-Learning Nizam`; // Strip HTML tags
        const pageTitle = document.getElementById("pageTitle");
        if (pageTitle) pageTitle.innerHTML = this.state.subjectName;
    },

    updateWelcomeText() {
        const welcomeEl = document.getElementById("welcomeText");
        if (welcomeEl) welcomeEl.innerHTML = `${this.state.subjectName}`;
    },

    setupAdminControls() {
        const isAdmin = (this.state.user.role === "class_admin" || this.state.user.role === "super_admin");
        const editControls = document.getElementById("editControls");
        if (editControls) editControls.style.display = 'contents';

        if (isAdmin && editControls) {
            editControls.innerHTML = `
                <div id="adminFabContainer" class="admin-fab-container">
                    <button id="addAnnouncementBtn" class="fab-add">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button id="toggleEditMode" class="fab-main state-edit">
                        <i class="fa-solid fa-pen-to-square fab-icon"></i>
                        <span class="fab-label">${t('edit_material')}</span>
                    </button>
                </div>
            `;
            this.initDraggableFAB();
        }
    },

    initDraggableFAB() {
        const fab = document.getElementById("adminFabContainer");
        if (!fab) return;

        let isDragging = false;
        let dragTimer = null;
        let startX, startY, initialRight, initialBottom;
        let hasMoved = false;

        // Load saved position
        const savedPos = localStorage.getItem('fab_pos_subject');
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                fab.style.setProperty('bottom', pos.bottom, 'important');
                fab.style.setProperty('right', pos.right, 'important');
            } catch (e) { }
        }

        fab.style.cursor = 'grab';
        fab.style.touchAction = 'none'; // FIX: Matiin scroll browser pas lagi drag FAB

        fab.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;

            startX = e.clientX;
            startY = e.clientY;

            const rect = fab.getBoundingClientRect();
            initialRight = window.innerWidth - rect.right;
            initialBottom = window.innerHeight - rect.bottom;

            hasMoved = false;

            // Timer dipercepat biar gak capek nunggu pas mau drag
            dragTimer = setTimeout(() => {
                isDragging = true;
                fab.setPointerCapture(e.pointerId);
                fab.style.transition = 'none';
                fab.style.cursor = 'grabbing';
                if (window.navigator.vibrate) window.navigator.vibrate(50);
            }, 200);
        });

        fab.addEventListener("pointermove", (e) => {
            if (!isDragging) {
                // Kalo geser kejauhan sebelum 1 detik, batalin niat drag (mungkin lagi scroll)
                if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
                    clearTimeout(dragTimer);
                }
                return;
            }

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            hasMoved = true;
            const newRight = initialRight - dx;
            const newBottom = initialBottom - dy;

            fab.style.setProperty('right', `${newRight}px`, 'important');
            fab.style.setProperty('bottom', `${newBottom}px`, 'important');
        });

        fab.addEventListener("pointerup", (e) => {
            clearTimeout(dragTimer);
            if (!isDragging) return;

            isDragging = false;
            fab.releasePointerCapture(e.pointerId);
            fab.style.transition = 'all 0.3s ease'; // Tambah transisi pas snap
            fab.style.cursor = 'grab';

            // LOGIC SNAP KE KIRI BAWAH (Default)
            const rect = fab.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            // Posisi Default (kiri bawah): right kira-kira width layar - padding, bottom kira-kira 0
            // Kita hitung threshold snap (misal 60px)
            const snapThreshold = 60;
            const currentBottom = winH - rect.bottom;
            const currentRight = winW - rect.right;

            // Asumsi default kiri bawah: right = winW - 80, bottom = 20 (sesuaikan CSS lo)
            // Tapi biar general, kita cek apakah dia deket pojok kiri bawah layar
            if (rect.left < snapThreshold && (winH - rect.bottom) < snapThreshold) {
                fab.style.setProperty('bottom', '20px', 'important');
                fab.style.setProperty('right', `${winW - 80}px`, 'important'); // Sesuaikan dengan posisi default di CSS
                localStorage.removeItem('fab_pos_subject');
            } else if (hasMoved) {
                localStorage.setItem('fab_pos_subject', JSON.stringify({
                    right: fab.style.right,
                    bottom: fab.style.bottom
                }));
            }

            if (hasMoved) {
                // Kill next click event biar tombol gak kepencet pas abis drag
                const killClick = (ev) => {
                    ev.stopImmediatePropagation();
                    ev.preventDefault();
                };
                window.addEventListener('click', killClick, { capture: true, once: true });
            }

            setTimeout(() => fab.style.transition = '', 300);
        });

        // Anti nyangkut kalo pointer keluar jendela
        fab.addEventListener("pointercancel", () => {
            clearTimeout(dragTimer);
            isDragging = false;
            fab.style.cursor = 'grab';
        });
    },

    setupEventListeners() {
        if (this._eventsInitialized) return;
        this._eventsInitialized = true;

        const self = this;

        // Handle Klik Background (Area Kosong)
        const detailOverlay = document.getElementById('detailOverlay');
        if (detailOverlay) {
            detailOverlay.onclick = (e) => {
                if (e.target === detailOverlay) {
                    const info = document.getElementById('detailInfoSection');
                    const isMobile = window.innerWidth <= 768;
                    if (isMobile && info && !info.classList.contains('hidden-mobile')) {
                        toggleMobileInfo();
                    } else {
                        closeDetail();
                    }
                }
            };
        }

        // Handle Klik Area Gambar/Media
        const mediaSection = document.querySelector('.detail-media-section');
        if (mediaSection) {
            mediaSection.onclick = () => {
                const info = document.getElementById('detailInfoSection');
                const isMobile = window.innerWidth <= 768;
                if (isMobile && info && !info.classList.contains('hidden-mobile')) {
                    toggleMobileInfo();
                }
            };
        }

        // Tutup Modal Tambah Materi saat klik background gelap
        const addModal = document.getElementById('addModal');
        if (addModal) {
            addModal.onclick = (e) => {
                if (e.target === addModal) {
                    addModal.classList.add('hidden');
                    unlockScroll();
                    self.clearForm();
                }
            };
        }

        // FIX: Scroll listener dipasang SEKALI di sini, bukan di dalam click handler
        const scrollContent = document.querySelector('.info-content-scroll');
        if (scrollContent) {
            scrollContent.addEventListener('scroll', () => {
                const info = document.getElementById('detailInfoSection');
                const isMobile = window.innerWidth <= 768;
                if (isMobile && info && !info.classList.contains('full-screen') && !info.classList.contains('hidden-mobile')) {
                    const isAtBottom = scrollContent.scrollTop + scrollContent.clientHeight >= scrollContent.scrollHeight - 5;
                    if (isAtBottom) toggleSheetHeight();
                }
            });
        }

        // Global Click Handler
        document.addEventListener("click", function (e) {
            // Handle Klik Kartu
            const card = e.target.closest(".course-card");
            if (card && card.classList.contains("clickable-card")) {
                const isInteractive =
                    self.state.editMode ||
                    e.target.closest("button") ||
                    e.target.closest("input") ||
                    e.target.closest(".delete-photo-btn") ||
                    e.target.closest(".reorder-handle") ||
                    e.target.closest("a");

                if (!isInteractive) {
                    const id = card.dataset.id;
                    const data = self.state.announcements.find(a => a.id == id);
                    if (data) {
                        const photoWrapper = e.target.closest('.photo-wrapper');
                        const idx = photoWrapper ? parseInt(photoWrapper.dataset.index) || 0 : 0;
                        openDetail(data, idx);
                    }
                }
            }

            // Handle FAB Buttons
            if (e.target.closest("#toggleEditMode")) { e.preventDefault(); self.toggleEditMode(); }

            // Handle Card Actions
            if (e.target.closest(".delete-btn")) { e.preventDefault(); self.deleteAnnouncement(e.target.closest(".course-card")); }
            if (e.target.closest(".bookmark-btn")) { e.preventDefault(); self.toggleBookmark(e.target.closest(".course-card")); }
            if (e.target.closest(".camera-btn")) { e.preventDefault(); self.triggerPhotoUpload(e.target.closest(".course-card")); }
            if (e.target.closest(".delete-photo-btn")) { e.preventDefault(); self.deletePhoto(e.target.closest(".course-card"), e.target.closest(".delete-photo-btn").dataset.url); }

            // Handle Task Checklist
            const taskBtn = e.target.closest(".task-btn");
            if (taskBtn) {
                e.preventDefault(); e.stopPropagation();
                // Task wajib kumpul → redirect, bukan toggle status
                if (taskBtn.classList.contains('task-wajib') || taskBtn.classList.contains('done')) return;
                self.toggleTaskStatus(taskBtn.closest(".course-card"), taskBtn);
            }

            // Handle Tombol Copy Kode
            const copyBtn = e.target.closest(".code-copy-btn");
            if (copyBtn) {
                e.preventDefault();
                const body = copyBtn.closest('.code-block-wrap')?.querySelector('.code-block-body');
                if (body) {
                    const text = body.innerText;
                    const done = () => {
                        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${t('copied')}`;
                        setTimeout(() => { copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> ${t('copy_code')}`; }, 1600);
                        if (typeof showToast === 'function') showToast(t('copied'), 'success');
                    };
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(text).then(done).catch(() => _copyTextFallback(text, done));
                    } else {
                        _copyTextFallback(text, done);
                    }
                }
            }
        });
    },

    async toggleTaskStatus(card, btn) {
        const id = card.dataset.id;

        // Block kalau task sudah diarsipkan
        const ann = this.state.announcements.find(a => String(a.id) === String(id));
        if (ann?.is_done === true) return;

        const isDone = btn.classList.contains("done");

        if (isDone) {
            btn.classList.remove("done"); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        } else {
            btn.classList.add("done"); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            if (isDone) {
                await supabase.from("user_progress").delete().eq("user_id", this.state.user.id).eq("announcement_id", id);
                this.state.completedTasks = this.state.completedTasks.filter(tid => tid !== id);
                btn.innerHTML = `<i class="fa-regular fa-circle"></i> ${t('markasdone')}`;
            } else {
                await supabase.from("user_progress").insert({ user_id: this.state.user.id, announcement_id: id });
                this.state.completedTasks.push(id);
                btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${t('done')}`;

                // LOG ACTIVITY: User menandai tugas selesai (+10 poin)
                if (typeof logActivity === 'function') {
                    const taskTitle = ann?.big_title || 'Tugas';
                    logActivity(`Menyelesaikan Tugas: ${taskTitle}`, "Tugas", 10, String(id));
                }

                // Setelah insert, DB trigger akan auto-arsip kalau semua siswa selesai.
                // Re-fetch status is_done setelah jeda singkat biar UI sinkron kalau diarsipkan
                setTimeout(() => this._syncArchivedStatus(id, btn, card), 1500);
            }

            // Sync dengan tugas.js progress UI jika ada
            if (typeof updateProgressUI === 'function') {
                // doneIds di tugas.js perlu di-sync
                if (typeof doneIds !== 'undefined') {
                    if (isDone) {
                        const idx = doneIds.indexOf(String(id));
                        if (idx > -1) doneIds.splice(idx, 1);
                    } else {
                        if (!doneIds.includes(String(id))) doneIds.push(String(id));
                    }
                }
                updateProgressUI();
            }

        } catch (err) {
            console.error("Task toggle error:", err);
            if (isDone) btn.classList.add("done"); else btn.classList.remove("done");
            btn.innerHTML = isDone ? `<i class="fa-solid fa-circle-check"></i> ${t('done')}` : `<i class="fa-regular fa-circle"></i> ${t('markasdone')}`;
            showPopup("Gagal update status tugas", "error");
        }
    },

    // Cek apakah task sudah diarsipkan oleh trigger DB setelah siswa terakhir selesai
    async _syncArchivedStatus(id, btn, card) {
        try {
            const { data } = await supabase
                .from("subject_announcements")
                .select("is_done")
                .eq("id", id)
                .single();
            if (data?.is_done === true) {
                // Update state lokal
                const ann = this.state.announcements.find(a => String(a.id) === String(id));
                if (ann) ann.is_done = true;
                // Ganti tombol jadi locked
                btn.disabled = true;
                btn.style.opacity = "0.6";
                btn.style.cursor = "default";
                btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${t('done')}`;
                btn.classList.add("done");
                if (typeof showToast === "function") showToast(t('confirm_archive_task'), "success");
            }
        } catch (e) { /* silent fail */ }
    },

    async loadBookmarks() {
        try {
            const { data, error } = await supabase.from("bookmarks").select("announcement_id").eq("user_id", this.state.user.id);
            if (!error) this.state.bookmarks = data.map(b => String(b.announcement_id));
        } catch (err) { console.error("Bookmark load error:", err); }
    },

    async toggleBookmark(card) {
        const id = card.dataset.id;
        const btn = card.querySelector(".bookmark-btn");
        const icon = btn.querySelector("i");
        const isBookmarked = this.state.bookmarks.includes(id);

        try {
            if (isBookmarked) {
                await supabase.from("bookmarks").delete().eq("user_id", this.state.user.id).eq("announcement_id", id);
                this.state.bookmarks = this.state.bookmarks.filter(b => b !== id);
                btn.classList.remove("active"); icon.className = "fa-regular fa-bookmark";
            } else {
                await supabase.from("bookmarks").insert({ user_id: this.state.user.id, announcement_id: id });
                this.state.bookmarks.push(id);
                btn.classList.add("active"); icon.className = "fa-solid fa-bookmark";
            }
        } catch (err) { console.error("Bookmark toggle error:", err); showPopup("Gagal koneksi", "error"); }
    },

    async loadAnnouncements() {
        const container = document.getElementById("announcements");
        if (!container) return;
        container.innerHTML = `<h3 style='margin-top: 30px; margin-bottom: 20px;'>${t('materi_title')}</h3><div class='sk-card'><div style='display: flex; gap: 12px; align-items: center; margin-bottom: 15px;'><div class='skeleton' style='width: 40px; height: 40px; border-radius: 50%;'></div><div class='skeleton' style='width: 100px; height: 12px;'></div></div><div class='skeleton sk-title'></div><div class='skeleton sk-text'></div></div><div class='sk-card'><div style='display: flex; gap: 12px; align-items: center; margin-bottom: 15px;'><div class='skeleton' style='width: 40px; height: 40px; border-radius: 50%;'></div><div class='skeleton' style='width: 100px; height: 12px;'></div></div><div class='skeleton sk-title'></div><div class='skeleton sk-text'></div></div><div class='sk-card'><div style='display: flex; gap: 12px; align-items: center; margin-bottom: 15px;'><div class='skeleton' style='width: 40px; height: 40px; border-radius: 50%;'></div><div class='skeleton' style='width: 100px; height: 12px;'></div></div><div class='skeleton sk-title'></div><div class='skeleton sk-text'></div></div>`;

        try {
            let targetClassId = getEffectiveClassId() || this.state.user.class_id;

            // --- GLOBAL EXAM LOGIC FOR KISI-KISI ---
            if (this.state.subjectId === 'kisi-kisi') {
                const MASTER_ID = 2;
                if (targetClassId != MASTER_ID) {
                    // Cek cache config master dulu biar gak fetch terus
                    const masterCacheKey = `dc_config_${MASTER_ID}`;
                    let masterConfig = null;
                    try {
                        const raw = localStorage.getItem(masterCacheKey);
                        if (raw) masterConfig = JSON.parse(raw).data;
                    } catch (e) { }

                    if (!masterConfig) {
                        const { data } = await supabase.from('daily_config').select('mode').eq('class_id', MASTER_ID).single();
                        masterConfig = data;
                    }

                    if (masterConfig && masterConfig.mode === 'exam') {
                        targetClassId = MASTER_ID;
                    }
                }
            }

            const academicYear = await getAcademicYear(targetClassId);

            let query = supabase.from("subject_announcements").select("*").eq("subject_id", this.state.subjectId);
            query = query.eq("class_id", targetClassId).eq("academic_year", academicYear);

            // Key cache sekarang include class + tahun biar ga ketuker antar kelas
            const cacheKey = `announcements_${this.state.subjectId}_${targetClassId}_${academicYear}`;
            // Simpan key di state biar pas save nulis ke cache yang sama persis
            this.state._announcementsCacheKey = cacheKey;
            // Helper read cache dgn TTL 10 menit
            const readCache = () => {
                try {
                    const raw = localStorage.getItem(cacheKey);
                    if (!raw) return null;
                    const parsed = JSON.parse(raw);
                    if (!parsed.ts) return null; // format lama → skip
                    return parsed;
                } catch (e) { return null; }
            };
            const writeCache = (data) => {
                try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (e) { }
            };
            let data, error;
            try {
                // Balikin ke logic asal miz: 
                // Lessons = Newest First, Announcements = Ikut display_order
                const res = this.state.isLessonMode
                    ? await query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false })
                    : await query.order("is_pinned", { ascending: false }).order("display_order", { ascending: true }).order("created_at", { ascending: false });

                data = res.data; error = res.error;
                if (error) throw error;
                this.state.announcements = (data || []).map(item => ({
                    ...item,
                    content: item.content ? processCardLinks(item.content) : item.content
                }));
                writeCache(this.state.announcements);
            } catch (err) {
                console.error("Load announcements failed, using cache if available:", err);
                const cached = readCache();
                if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
                    // TTL 10 menit atau offline fallback (stale tetap dipake biar ga kosong)
                    this.state.announcements = cached.data.map(item => ({
                        ...item,
                        content: item.content ? processCardLinks(item.content) : item.content
                    }));
                } else {
                    // Fallback: format lama (no ts) atau cache kosong
                    const raw = localStorage.getItem(cacheKey);
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            const arr = Array.isArray(parsed) ? parsed : (parsed.data ? parsed.data : []);
                            this.state.announcements = arr.map(item => ({
                                ...item,
                                content: item.content ? processCardLinks(item.content) : item.content
                            }));
                        } catch (e) { this.state.announcements = []; }
                    } else {
                        throw err;
                    }
                }
            }

            if (this.state.isLessonMode) {
                // FIX: Jalankan progress + bookmarks bersamaan, bukan sekuensial
                const [progressRes] = await Promise.all([
                    supabase.from("user_progress").select("announcement_id").eq("user_id", this.state.user.id),
                    this.loadBookmarks()
                ]);
                const progressIds = (progressRes.data || []).map(p => String(p.announcement_id));
                // Task yang is_done=true → otomatis selesai untuk siswa, meski progress row sudah dihapus
                const archivedIds = this.state.announcements
                    .filter(a => a.is_done === true)
                    .map(a => String(a.id));
                this.state.completedTasks = [...new Set([...progressIds, ...archivedIds])];
            } else {
                await this.loadBookmarks();
            }
            this.renderAnnouncements();

        } catch (err) {
            console.error("Load error:", err);
            container.innerHTML = "<p>Gagal memuat.</p>";
        }
    },

    renderAnnouncements() {
        const container = document.getElementById("announcements");
        if (!container) return;

        const header = document.createElement("h3");
        header.style.marginTop = "30px";
        header.textContent = this.state.isLessonMode ? t('tasks_list') : t('materi_title');

        if (this.state.announcements.length === 0) {
            const emptyState = document.createElement("div");
            if (this.state.isLessonMode) {
                emptyState.className = "empty-state success";
                emptyState.innerHTML = `
                    <i class="fa-solid fa-circle-check"></i>
                    <p>${t('empty_tasks')}</p>
                `;
            } else {
                emptyState.className = "empty-state";
                emptyState.innerHTML = `
                    <i class="fa-solid fa-folder-open"></i>
                    <p>${t('empty_materials')}</p>
                `;
            }
            container.replaceChildren(header, emptyState);
            return;
        }

        const fragment = document.createDocumentFragment();
        fragment.appendChild(header);
        this.state.announcements.forEach((item) => {
            fragment.appendChild(this.createCardElement(item));
        });
        container.replaceChildren(fragment);

        // Re-apply edit mode kalau sebelumnya aktif (misal habis delete)
        if (this.state.editMode) {
            document.querySelectorAll(".course-card").forEach(card => {
                card.classList.add("editable-mode");
                card.querySelectorAll(".editable").forEach(f => {
                    f.contentEditable = "true";
                    f.style.pointerEvents = "auto";
                    f.style.cursor = "text";
                });
                const deleteBtn = card.querySelector(".delete-btn");
                if (deleteBtn) deleteBtn.style.display = "inline-block";
                const colorTools = card.querySelector(".card-color-tools");
                if (colorTools) colorTools.style.display = "flex";
                const formatTools = card.querySelector(".card-format-tools");
                if (formatTools) formatTools.style.display = "flex";
                const reorderHandle = card.querySelector(".reorder-handle");
                if (reorderHandle) {
                    const isStaticPage = this.state.isLessonMode || this.state.subjectId === 'kisi-kisi';
                    reorderHandle.style.display = isStaticPage ? "none" : "flex";
                }
                const cameraBtn = card.querySelector(".camera-btn");
                if (cameraBtn) cameraBtn.style.display = "flex";
                card.querySelectorAll(".delete-photo-btn").forEach(b => b.style.display = "flex");
            });
        }
    },

    createCardElement(data, options = {}) {
        const card = document.createElement("div");
        card.dataset.id = data.id;
        card.dataset.subjectId = data.subject_id || this.state.subjectId;
        card.dataset.photoUrl = this._serializePhotoUrls(this._parsePhotoUrls(data.photo_url)) || "";
        card.style.position = "relative";
        card.draggable = false;

        const bigTitle = data.big_title || "";
        const title = data.title || "";
        const content = data.content || "";
        const small = data.small || "";

        // Tentukan class warna dari DB
        let colorClass = data.card_color && data.card_color !== 'default' ? `color-${data.card_color}` : "";
        if (options.statusClass) colorClass = options.statusClass; // Override if statusClass provided

        card.className = `course-card ${colorClass}${data.is_pinned ? ' is-pinned' : ''}`;

        // DEFINISI isAdmin BIAR GAK ERROR "NOT DEFINED"
        const isAdmin = this.state.user && (this.state.user.role === 'class_admin' || this.state.user.role === 'super_admin');

        const photos = this._parsePhotoUrls(data.photo_url);

        let photoHTML = '';
        if (photos.length > 0) {
            photoHTML = this._buildPhotoGridHTML(photos);
            card.classList.add('clickable-card');
        } else {
            card.classList.remove('clickable-card');
            card.style.cursor = 'default';
        }

        const isSaved = this.state.bookmarks.includes(String(data.id));
        const btnClass = isSaved ? "bookmark-btn active" : "bookmark-btn";
        const iconClass = isSaved ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark";

        let taskBtnHTML = "";
        // PERUBAHAN: Cek is_lesson per kartu, bukan per halaman
        const isLessonCard = data.is_lesson === true;
        const isTaskCard = data.is_task === true;

        if (isTaskCard) {
            const isDone = this.state.completedTasks.includes(String(data.id));
            if (data.is_done === true) {
                taskBtnHTML = `<button class="task-btn done" disabled><i class="fa-solid fa-circle-check"></i> ${t('done')}</button>`;
            } else if (isDone) {
                taskBtnHTML = `<button class="task-btn done" onclick="event.stopPropagation();window.location.href='kirim-tugas.html?tugas=${data.id}'"><i class="fa-solid fa-circle-check"></i> Sudah Dikumpul</button>`;
            } else {
                taskBtnHTML = `<button class="task-btn task-wajib" onclick="event.stopPropagation();window.location.href='kirim-tugas.html?tugas=${data.id}'"><i class="fa-solid fa-paper-plane"></i> ${t('collect_task')}</button>`;
            }
        } else if (isLessonCard) {
            const isDone = this.state.completedTasks.includes(String(data.id));
            if (data.is_done === true) {
                // Diarsipkan — semua siswa selesai, tombol dikunci
                taskBtnHTML = `<button class="task-btn done" disabled><i class="fa-solid fa-circle-check"></i> ${t('done')}</button>`;
            } else {
                taskBtnHTML = `
<button class="${isDone ? 'task-btn done' : 'task-btn'}">
  ${isDone
                        ? `<i class="fa-solid fa-circle-check"></i> ${t('done')}`
                        : `<i class="fa-regular fa-circle"></i> ${t('markasdone')}`
                    }
</button>`;
            }
        }

        const formatTools = `
<div class="card-format-tools" style="display:none; gap:4px; align-items:center; background:rgba(0,0,0,0.3); padding:4px 6px; border-radius:20px; border:1px solid rgba(255,255,255,0.1);">
    <button onclick="cardFormatBold(event)" class="fmt-btn" style="font-weight:700;">B</button>
    <button onclick="cardFormatItalic(event)" class="fmt-btn" style="font-style:italic;">I</button>
    <button onclick="cardFormatUnderline(event)" class="fmt-btn" style="text-decoration:underline;">U</button>
    <span style="width:1px;height:14px;background:rgba(255,255,255,0.15);margin:0 4px;"></span>
    <button onclick="cardFormatText(event,'5')" class="fmt-btn" style="font-size:10px;">XL</button>
    <button onclick="cardFormatText(event,'3')" class="fmt-btn" style="font-size:10px;">L</button>
    <button onclick="cardFormatText(event,'2')" class="fmt-btn" style="font-size:10px;">M</button>
    <span style="width:1px;height:14px;background:rgba(255,255,255,0.15);margin:0 4px;"></span>
    <button onclick="cardFormatLink(event)" class="fmt-btn" title="${t('add_link')}"><i class="fa-solid fa-link" style="font-size:11px;"></i></button>
</div>`;

        const colorTools = `
<div class="card-color-tools" style="display:none; gap:5px; align-items:center; background:rgba(0,0,0,0.3); padding:5px 8px; border-radius:20px; border:1px solid rgba(255,255,255,0.1);">
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'default')" style="width:14px; height:14px; border-radius:50%; background:#333; border:1px solid white; cursor:pointer;" title="${t('default')}"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'red')" style="width:14px; height:14px; border-radius:50%; background:#ff4757; cursor:pointer;" title="Merah"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'orange')" style="width:14px; height:14px; border-radius:50%; background:#ff9f43; cursor:pointer;" title="Jingga"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'yellow')" style="width:14px; height:14px; border-radius:50%; background:#ffd32a; cursor:pointer;" title="Kuning"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'green')" style="width:14px; height:14px; border-radius:50%; background:#2ed573; cursor:pointer;" title="Hijau"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'blue')" style="width:14px; height:14px; border-radius:50%; background:#00c8ff; cursor:pointer;" title="Biru"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'purple')" style="width:14px; height:14px; border-radius:50%; background:#a55eea; cursor:pointer;" title="Ungu"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'pink')" style="width:14px; height:14px; border-radius:50%; background:#ff9ff3; cursor:pointer;" title="Pink"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'brown')" style="width:14px; height:14px; border-radius:50%; background:#8b4513; cursor:pointer;" title="Coklat"></div>
</div>`;

        // Logic display title with subject name if on tugas page
        let displayTitleHTML = `<h4 style="color:rgba(255,255,255,0.7); font-size:13px; font-weight: normal; margin-bottom:12px;">`;
        if (this.state.subjectId === 'tugas' && data.subject_id && data.subject_id !== 'tugas') {
            const subjName = (typeof subjectNameMap !== 'undefined' && subjectNameMap[data.subject_id]) || data.subject_id;
            displayTitleHTML += `${subjName} — `;
        }
        displayTitleHTML += `<span contenteditable="false" spellcheck="false" class="editable" data-field="title">${title}</span></h4>`;

        card.innerHTML = `
        <input type="file" class="photo-input" multiple style="display:none;">
        <div class="reorder-handle" style="display:none; position:absolute; top:10px; right:10px; z-index:50;">
            <div class="drag-grip" title="Tahan & geser untuk pindah urutan" style="
                background:rgba(0,234,255,0.15);
                border:1px solid rgba(0,234,255,0.3);
                color:var(--accent,#00eaff);
                width:32px; height:32px;
                border-radius:8px;
                cursor:grab;
                display:flex; align-items:center; justify-content:center;
                user-select:none; -webkit-user-select:none;
                touch-action:none;
            ">
                <i class="fa-solid fa-grip-vertical" style="pointer-events:none; font-size:14px;"></i>
            </div>
        </div>
        <div class="pin-badge" style="display:${data.is_pinned ? 'flex' : 'none'}; position:absolute; top:10px; right:10px; z-index:55; background:var(--accent,#00eaff); color:#000; width:28px; height:28px; border-radius:50%; align-items:center; justify-content:center; font-size:11px; box-shadow:0 2px 8px rgba(0,0,0,0.3);">
            <i class="fa-solid fa-thumbtack"></i>
        </div>
        ${photoHTML}
        <div class="pending-photo-preview" style="display:none; margin-bottom:12px;"></div>
        <h3 contenteditable="false" spellcheck="false" class="editable" data-field="big_title">${bigTitle}</h3>
        ${isTaskCard ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#ffd32a;background:rgba(255,211,42,0.12);padding:3px 10px;border-radius:20px;margin-bottom:8px;border:1px solid rgba(255,211,42,0.2);">📋 Wajib Dikumpul</span>` : ''}
        ${displayTitleHTML}
        <div contenteditable="false" spellcheck="false" class="editable" data-field="content" style="margin-bottom: 15px;">${processCodeBlocks(processCardLinks(content))}</div>
        <small contenteditable="false" spellcheck="false" class="editable" data-field="small">${small}</small>
        
        <div class="card-actions" style="margin-top:15px; display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
            <div style="flex-shrink: 0; display:flex; gap:8px; align-items:center;">
                ${taskBtnHTML}
                ${isAdmin ? `
                <button class="camera-btn" style="display:none; background:rgba(0,234,255,0.12); border:1px solid rgba(0,234,255,0.3); color:var(--accent,#00eaff); padding:7px 12px; border-radius:8px; cursor:pointer; font-size:13px; align-items:center; gap:6px;">
                    <i class="fa-solid fa-camera" style="pointer-events:none;"></i>
                </button>` : ''}
            </div>
            
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; flex:1; position:relative;">
                ${isAdmin ? formatTools : ''}
                ${isAdmin ? colorTools : ''}
                ${isAdmin ? `
                <button class="pin-btn" onclick="event.stopPropagation();SubjectApp.togglePin('${data.id}')" style="display:none; background:${data.is_pinned ? 'var(--accent,#00eaff)' : 'rgba(0,234,255,0.12)'}; border:1px solid rgba(0,234,255,0.3); color:${data.is_pinned ? '#000' : 'var(--accent,#00eaff)'}; padding:7px 12px; border-radius:8px; cursor:pointer; font-size:13px;" title="${data.is_pinned ? 'Unpin' : 'Pin ke atas'}">
                    <i class="fa-solid fa-thumbtack" style="pointer-events:none;"></i>
                </button>` : ''}

                <button class="delete-btn" style="display:none; background:#f44336; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; margin-top:0 !important;">
                    <i class="fa-solid fa-trash" style="margin-right:0;"></i>
                </button>
            </div>
            
            ${options.autoNumber ? `
                <div class="card-number" style="
                    font-size: 11px; 
                    font-weight: 800; 
                    color: white; 
                    background: rgba(255,255,255,0.25);
                    padding: 4px 8px;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.12);
                    letter-spacing: 0.5px;
                    margin-left: 8px;
                ">
                    #${options.autoNumber}
                </div>` : ''}
        </div>
    `;
        return card;
    },


    async changeCardColor(id, color) {
        const card = document.querySelector(`.course-card[data-id="${id}"]`);
        if (!card) return;

        // Hapus SEMUA class warna yang mungkin ada
        card.classList.remove('color-red', 'color-orange', 'color-yellow', 'color-green', 'color-blue', 'color-purple', 'color-pink', 'color-brown');

        // Tambah warna baru jika bukan default
        if (color !== 'default') card.classList.add(`color-${color}`);

        try {
            const { error } = await supabase.from("subject_announcements").update({ card_color: color }).eq("id", id);
            if (error) throw error;
        } catch (err) {
            console.error("Gagal update warna:", err);
            showPopup("Gagal menyimpan warna ke database", "error");
        }
    },

    togglePin(id) {
        const card = document.querySelector(`.course-card[data-id="${id}"]`);
        if (!card) return;
        const ann = this.state.announcements.find(a => String(a.id) === String(id));
        if (!ann) return;

        const newPinned = !ann.is_pinned;
        ann.is_pinned = newPinned;

        card.classList.toggle('is-pinned', newPinned);

        const badge = card.querySelector('.pin-badge');
        if (badge) badge.style.display = newPinned ? 'flex' : 'none';

        const pinBtn = card.querySelector('.pin-btn');
        if (pinBtn) {
            pinBtn.style.background = newPinned ? 'var(--accent,#00eaff)' : 'rgba(0,234,255,0.12)';
            pinBtn.style.color = newPinned ? '#000' : 'var(--accent,#00eaff)';
            pinBtn.title = newPinned ? 'Unpin' : 'Pin ke atas';
        }

        // Tandai pending biar pas save nanti ikut ke-upsert
        this._pendingPinChanges = this._pendingPinChanges || new Set();
        this._pendingPinChanges.add(String(id));
    },

    async toggleEditMode() {
        if (this.state.isToggling) return;
        this.state.isToggling = true;

        const container = document.getElementById("adminFabContainer");
        const toggleBtn = document.getElementById("toggleEditMode");
        const cards = document.querySelectorAll(".course-card");

        if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        // Tunggu animasi sebentar biar smooth
        await new Promise(resolve => setTimeout(resolve, 800));

        this.state.editMode = !this.state.editMode;

        // 1. UPDATE UI TOMBOL (FAB)
        if (toggleBtn && container) {
            if (this.state.editMode) {
                container.classList.add("active");
                toggleBtn.className = "fab-main state-done";
                toggleBtn.innerHTML = `<i class="fa-solid fa-check fab-icon"></i><span class="fab-label">${t('save')}</span>`;
            } else {
                container.classList.remove("active");
                toggleBtn.className = "fab-main state-edit";
                toggleBtn.innerHTML = `<i class="fa-solid fa-pen-to-square fab-icon"></i><span class="fab-label">${t('edit_material')}</span>`;
            }
        }

        // 2. UPDATE SEMUA KARTU (UI Mode)
        cards.forEach(card => {
            const fields = card.querySelectorAll(".editable");
            const deleteBtn = card.querySelector(".delete-btn");
            const colorTools = card.querySelector(".card-color-tools");
            const formatTools = card.querySelector(".card-format-tools");
            const reorderHandle = card.querySelector(".reorder-handle");
            const cameraBtn = card.querySelector(".camera-btn");
            const pinBtn = card.querySelector(".pin-btn");
            const deletePhotoBtns = card.querySelectorAll(".delete-photo-btn");

            if (this.state.editMode) {
                card.classList.add("editable-mode");
                // draggable diatur dinamis oleh grip mousedown/touchstart — jangan set true di sini
                fields.forEach(f => {
                    f.contentEditable = "true";
                    f.style.pointerEvents = "auto";
                    f.style.cursor = "text";
                });
                if (deleteBtn) deleteBtn.style.display = "inline-block";
                if (colorTools) colorTools.style.display = "flex";
                if (formatTools) formatTools.style.display = "flex";
                if (reorderHandle) {
                    // Reorder handle HANYA tampil di Announcements
                    // (Lessons pake sorting created_at, Kisi-kisi dipetakan ke hari)
                    const isStaticPage = this.state.isLessonMode || this.state.subjectId === 'kisi-kisi';
                    const isPinnedCard = card.classList.contains('is-pinned');
                    reorderHandle.style.display = (isStaticPage || isPinnedCard) ? "none" : "flex";

                }
                if (cameraBtn) cameraBtn.style.display = "flex";
                if (pinBtn) pinBtn.style.display = "inline-flex";
                deletePhotoBtns.forEach(b => b.style.display = "flex");
            } else {
                card.classList.remove("editable-mode");
                fields.forEach(f => { f.contentEditable = "false"; f.style.cursor = ""; });
                if (deleteBtn) deleteBtn.style.display = "none";
                if (colorTools) colorTools.style.display = "none";
                if (formatTools) formatTools.style.display = "none";
                if (reorderHandle) reorderHandle.style.display = "none";
                if (cameraBtn) cameraBtn.style.display = "none";
                if (pinBtn) pinBtn.style.display = "none";
                deletePhotoBtns.forEach(b => b.style.display = "none");
                card.draggable = false;
            }
        });

        // 3. KONVERSI LINK & CODE BLOCK: revert pas edit, balikin pas simpan
        cards.forEach(card => {
            const contentEl = card.querySelector('[data-field="content"]');
            if (!contentEl) return;
            contentEl.innerHTML = this.state.editMode
                ? revertCodeBlocks(revertCardLinks(contentEl.innerHTML))
                : processCardLinks(contentEl.innerHTML);
        });

        // 4. SIMPAN DATA (Hanya saat keluar dari mode edit)
        if (!this.state.editMode) {
            await this.saveAllChanges();
            // Re-apply code block wrapper (visual doang — data yg disimpan tetap raw)
            cards.forEach(card => {
                const contentEl = card.querySelector('[data-field="content"]');
                if (contentEl) contentEl.innerHTML = processCodeBlocks(processCardLinks(contentEl.innerHTML));
            });
        } else {
            this._initDragDrop();
        }

        this.state.isToggling = false;

        window.dispatchEvent(new CustomEvent('editmodetoggle', {
            detail: { editMode: this.state.editMode }
        }));
    },

    async saveAllChanges() {
        const toggleBtn = document.getElementById("toggleEditMode");
        toggleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin fab-icon"></i><span class="fab-label">Menyimpan...</span>';
        toggleBtn.disabled = true;

        const cards = document.querySelectorAll(".course-card");
        const dirtyCardIds = new Set(); // Lacak mana yang beneran berubah

        try {
            // 1. Upload semua foto pending per card sebelum upsert
            for (const card of cards) {
                const pending = card._pendingFiles;
                if (!pending || pending.length === 0) continue;

                dirtyCardIds.add(card.dataset.id); // Tandai sebagai dirty karena ada upload baru

                const id = card.dataset.id;
                const ann = this.state.announcements.find(a => String(a.id) === String(id));

                // Existing URLs — parse dulu biar selalu array bersih
                const existingUrls = this._parsePhotoUrls(ann?.photo_url);

                const newUrls = [];
                for (const { file, objUrl } of pending) {
                    try {
                        const fileName = `${this.state.subjectId}/${id}/${Date.now()}_${file.name}`;
                        const { error: uploadErr } = await supabase.storage.from('subject-photos').upload(fileName, file);
                        if (uploadErr) throw uploadErr;
                        const { data: urlData } = supabase.storage.from('subject-photos').getPublicUrl(fileName);
                        newUrls.push(urlData.publicUrl);
                    } catch (err) {
                        console.error('Upload gagal untuk satu foto:', err);
                    }
                    URL.revokeObjectURL(objUrl);
                }

                // Merge dan simpan ke state
                const mergedUrls = [...existingUrls, ...newUrls];
                if (ann) ann.photo_url = mergedUrls;

                // Bersihkan pending
                card._pendingFiles = [];
                const preview = card.querySelector('.pending-photo-preview');
                if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }

                // Re-render grid langsung di DOM tanpa refresh
                const oldGrid = card.querySelector('.photo-grid');
                if (oldGrid) oldGrid.remove();
                if (mergedUrls.length > 0) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = this._buildPhotoGridHTML(mergedUrls, this.state.editMode);
                    const newGrid = tempDiv.firstElementChild;
                    const anchor = card.querySelector('.pending-photo-preview') || card.querySelector('h3');
                    card.insertBefore(newGrid, anchor);
                    card.classList.add('clickable-card');
                    card.style.cursor = '';
                }
            }

            // 2. Bangun array updates (Hanya yang berubah saja yang di-update)
            const updatesPromises = Array.from(cards).map(async (card, index) => {
                const id = card.dataset.id;
                const ann = this.state.announcements.find(a => String(a.id) === String(id));
                const getVal = (f) => card.querySelector(`[data-field="${f}"]`)?.innerText.trim() || "";
                const getContent = () => card.querySelector(`[data-field="content"]`)?.innerHTML || "";

                // Metadata fallback dari DOM dataset
                const fallbackSubjectId = card.dataset.subjectId;
                const fallbackPhotoUrl = card.dataset.photoUrl;

                const photoArray = this._parsePhotoUrls(ann ? ann.photo_url : fallbackPhotoUrl);
                const serializedPhotos = this._serializePhotoUrls(photoArray);
                const currentOrder = index + 1;

                // LOGIC DIRTY CHECK: Bandingkan data UI vs data asli di state
                // Jika ID ada di dirtyCardIds (karena upload foto), otomatis true
                const hasPinChange = this._pendingPinChanges && this._pendingPinChanges.has(id);
                const isChanged = dirtyCardIds.has(id) || hasPinChange || !ann ||
                    getVal("big_title") !== (ann.big_title || "") ||
                    getVal("title") !== (ann.title || "") ||
                    getContent() !== (ann.content || "") ||
                    getVal("small") !== (ann.small || "") ||
                    serializedPhotos !== (this._serializePhotoUrls(this._parsePhotoUrls(ann.photo_url))) ||
                    (ann.subject_id && ann.subject_id !== (fallbackSubjectId || this.state.subjectId)) ||
                    (!this.state.isLessonMode && ann.display_order !== currentOrder);

                if (!isChanged) return null; // Skip kalau gak ada perubahan

                return {
                    id,
                    ...(this.state.isLessonMode ? {} : { display_order: currentOrder }),
                    is_pinned: ann ? ann.is_pinned : false,
                    big_title: getVal("big_title"),
                    title: getVal("title"),
                    content: getContent(),
                    small: getVal("small"),
                    photo_url: serializedPhotos,
                    subject_id: ann?.subject_id || fallbackSubjectId || this.state.subjectId,
                    class_id: await this._getTargetClassId()
                };
            });

            const updates = (await Promise.all(updatesPromises)).filter(Boolean); // Buang yang null

            if (updates.length === 0) {
                showToast("Tidak ada perubahan", "default");
                return;
            }

            const { error } = await supabase
                .from("subject_announcements")
                .upsert(updates, { onConflict: 'id' });
            if (error) throw error;

            // 3. Sync state lokal
            updates.forEach(u => {
                const ann = this.state.announcements.find(a => String(a.id) === String(u.id));
                if (ann) Object.assign(ann, u);
            });
            try {
                const cacheKey = this.state._announcementsCacheKey || `announcements_${this.state.subjectId}`;
                localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: this.state.announcements }));
            } catch (e) { }

            this._pendingPinChanges = new Set();

            if (typeof showPopup === 'function') showToast(t('all_changes_saved'), "success");
        } catch (err) {
            console.error("Save failed:", err);
            showPopup(t('failed_save_data'), "error");
        } finally {
            toggleBtn.innerHTML = `<i class="fa-solid fa-pen-to-square fab-icon"></i><span class="fab-label">${t('edit_material')}</span>`;
            toggleBtn.disabled = false;
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // DRAG & DROP — Desktop (HTML5) + Mobile (Touch)
    // ═══════════════════════════════════════════════════════════════

    _initDragDrop() {
        // DISABLE DRAG UNTUK KISI-KISI & TUGAS
        if (this.state.subjectId === 'kisi-kisi' || this.state.isLessonMode) return;

        const container = document.getElementById('announcements');
        if (!container || container._dragInitialized) return;
        container._dragInitialized = true;

        // ── AUTO-SCROLL (shared desktop + mobile) ────────────────────
        const SCROLL_ZONE = 100;
        const SCROLL_MAX = 20;
        let scrollRafId = null;
        let cursorY = 0;

        const startAutoScroll = () => {
            if (scrollRafId) return;
            const loop = () => {
                const vh = window.innerHeight;
                let speed = 0;
                if (cursorY < SCROLL_ZONE) {
                    // Quadratic: makin deket ujung makin kenceng
                    const t = 1 - cursorY / SCROLL_ZONE;
                    speed = -(SCROLL_MAX * t * t);
                } else if (cursorY > vh - SCROLL_ZONE) {
                    const t = 1 - (vh - cursorY) / SCROLL_ZONE;
                    speed = SCROLL_MAX * t * t;
                }
                if (speed !== 0) window.scrollBy(0, speed);
                scrollRafId = requestAnimationFrame(loop);
            };
            scrollRafId = requestAnimationFrame(loop);
        };
        const stopAutoScroll = () => {
            if (scrollRafId) { cancelAnimationFrame(scrollRafId); scrollRafId = null; }
        };

        // ── DESKTOP: HTML5 Drag & Drop ──────────────────────────────
        let dragSrcCard = null;
        let gripClicked = false;

        container.addEventListener('mousedown', (e) => {
            gripClicked = !!e.target.closest('.drag-grip');
            // Set draggable hanya pada card yang grip-nya diklik
            const card = e.target.closest('.course-card');
            if (card) card.draggable = gripClicked;
        });

        container.addEventListener('dragstart', (e) => {
            if (!gripClicked) { e.preventDefault(); return; }
            const card = e.target.closest('.course-card');
            if (!card) return;
            dragSrcCard = card;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.dataset.id);

            // Custom drag image: cuma big_title (konsisten sama mobile ghost)
            const title = card.querySelector('[data-field="big_title"]')?.innerText || '';
            const dragImg = document.createElement('div');
            dragImg.innerHTML = `<i class="fa-solid fa-grip-vertical" style="margin-right:10px;color:rgba(0,234,255,0.8);"></i>${title}`;
            dragImg.style.cssText = `
                position:absolute;top:-9999px;left:-9999px;
                padding:12px 24px;background:rgba(0,20,30,0.85);
                border:2px solid rgba(0,234,255,0.7);border-radius:14px;
                color:rgba(255,255,255,0.85);font-size:15px;font-weight:600;
                display:flex;align-items:center;gap:10px;white-space:nowrap;
            `;
            document.body.appendChild(dragImg);
            e.dataTransfer.setDragImage(dragImg, dragImg.offsetWidth / 2, dragImg.offsetHeight / 2);
            requestAnimationFrame(() => dragImg.remove());

            requestAnimationFrame(() => {
                // Collapse semua card biar keliatan urutannya
                container.querySelectorAll('.course-card').forEach(c => c.classList.add('dragging'));
            });
            startAutoScroll();
        });

        let prevDragY = 0;
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!dragSrcCard) return;
            e.dataTransfer.dropEffect = 'move';
            const dragDir = e.clientY < prevDragY ? 'up' : 'down';
            prevDragY = e.clientY;
            cursorY = e.clientY;
            const target = e.target.closest('.course-card');
            if (target && target !== dragSrcCard) {
                this._showDropIndicator(container, target, e.clientY, dragDir, dragSrcCard);
            }
        });

        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) this._removeDropIndicator();
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            stopAutoScroll();
            if (!dragSrcCard) return;
            const indicator = document.getElementById('_dnd_indicator');
            if (indicator) container.insertBefore(dragSrcCard, indicator);
            dragSrcCard.draggable = false;
            this._cleanupDrag(dragSrcCard);
            dragSrcCard = null; gripClicked = false;
        });

        container.addEventListener('dragend', () => {
            stopAutoScroll();
            if (dragSrcCard) {
                this._cleanupDrag(dragSrcCard);
                dragSrcCard.draggable = false;
            }
            dragSrcCard = null; gripClicked = false;
        });

        // ── MOBILE: Touch Drag — lightweight ghost ──────────────────
        let touchCard = null;
        let ghost = null;
        let lastTarget = null;
        let ghostInitX = 0, ghostInitY = 0;

        container.addEventListener('touchstart', (e) => {
            const grip = e.target.closest('.drag-grip');
            if (!grip) return;
            const card = grip.closest('.course-card');
            if (!card) return;

            touchCard = card;
            lastTarget = null;
            const touch = e.touches[0];

            // Ghost ringan: cuma big_title (konsisten sama desktop)
            const title = card.querySelector('[data-field="big_title"]')?.innerText || '';
            ghost = document.createElement('div');
            ghost.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                padding: 12px 24px;
                background: rgba(0,20,30,0.85);
                border: 2px solid rgba(0,234,255,0.7);
                border-radius: 14px;
                box-shadow: 0 16px 40px rgba(0,0,0,0.5), 0 0 20px rgba(0,234,255,0.2);
                display: flex;
                align-items: center;
                gap: 10px;
                white-space: nowrap;
                pointer-events: none;
                z-index: 9999;
                will-change: transform;
                color: rgba(255,255,255,0.85);
                font-size: 15px;
                font-weight: 600;
            `;
            ghost.innerHTML = `<i class="fa-solid fa-grip-vertical" style="color:rgba(0,234,255,0.8);"></i>${title}`;
            document.body.appendChild(ghost);

            const ghostRect = ghost.getBoundingClientRect();
            ghostInitX = -ghostRect.width / 2;
            ghostInitY = -ghostRect.height / 2;
            ghost.style.transform = `translate(${touch.clientX + ghostInitX}px, ${touch.clientY + ghostInitY}px)`;

            card.style.opacity = '0.3';
            card.style.transition = 'opacity 0.15s';
            // Collapse semua card biar keliatan urutannya (sama kayak desktop)
            container.querySelectorAll('.course-card').forEach(c => c.classList.add('dragging'));
            e.preventDefault();
            startAutoScroll();
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            if (!touchCard || !ghost) return;
            const touch = e.touches[0];
            cursorY = touch.clientY;

            // Gerak ghost via transform — zero reflow
            const dx = touch.clientX + ghostInitX;
            const dy = touch.clientY + ghostInitY;
            ghost.style.transform = `translate(${dx}px, ${dy}px)`;

            // Drop indicator — throttle via lastTarget
            ghost.style.visibility = 'hidden';
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            ghost.style.visibility = '';
            const target = el?.closest('.course-card');
            if (target && target !== touchCard && target !== lastTarget) {
                lastTarget = target;
                this._showDropIndicator(container, target, touch.clientY, 'down', touchCard);
            }
            e.preventDefault();
        }, { passive: false });

        const onTouchEnd = () => {
            stopAutoScroll();
            if (!touchCard) return;
            const indicator = document.getElementById('_dnd_indicator');
            if (indicator) container.insertBefore(touchCard, indicator);
            if (ghost) { ghost.remove(); ghost = null; }
            touchCard.style.opacity = '';
            touchCard.style.transition = '';
            this._cleanupDrag(touchCard);
            touchCard = null; lastTarget = null;
        };

        container.addEventListener('touchend', onTouchEnd);
        container.addEventListener('touchcancel', onTouchEnd);
    },

    _showDropIndicator(container, target, clientY, dragDir = 'down', sourceCard = null) {
        this._removeDropIndicator();

        const allCards = [...container.querySelectorAll('.course-card')];
        const sourceIsPinned = sourceCard && sourceCard.classList.contains('is-pinned');

        // Cari index card pinned terakhir
        let lastPinnedIdx = -1;
        for (let i = allCards.length - 1; i >= 0; i--) {
            if (allCards[i].classList.contains('is-pinned')) {
                lastPinnedIdx = i;
                break;
            }
        }

        // Kalo source unpinned & ada pinned card, restrict drop area
        if (!sourceIsPinned && lastPinnedIdx >= 0) {
            const targetIdx = allCards.indexOf(target);
            const rect = target.getBoundingClientRect();
            const threshold = dragDir === 'up'
                ? rect.top + rect.height * 0.9
                : rect.top + rect.height * 0.5;
            const insertBefore = clientY < threshold;
            const insertIdx = insertBefore ? targetIdx : targetIdx + 1;

            if (insertIdx <= lastPinnedIdx) {
                // Redirect indicator ke setelah pinned card terakhir
                const line = document.createElement('div');
                line.id = '_dnd_indicator';
                line.style.cssText = `
                    height: 3px;
                    background: var(--accent, #00eaff);
                    border-radius: 3px;
                    margin: 2px 0;
                    box-shadow: 0 0 10px var(--accent, #00eaff), 0 0 20px rgba(0,234,255,0.4);
                    pointer-events: none;
                    animation: dndPulse 0.8s ease-in-out infinite alternate;
                `;
                if (!document.getElementById('_dnd_style')) {
                    const s = document.createElement('style');
                    s.id = '_dnd_style';
                    s.textContent = `@keyframes dndPulse { from { opacity:0.6; } to { opacity:1; } }`;
                    document.head.appendChild(s);
                }
                allCards[lastPinnedIdx].after(line);
                return;
            }
        }

        const line = document.createElement('div');
        line.id = '_dnd_indicator';
        line.style.cssText = `
            height: 3px;
            background: var(--accent, #00eaff);
            border-radius: 3px;
            margin: 2px 0;
            box-shadow: 0 0 10px var(--accent, #00eaff), 0 0 20px rgba(0,234,255,0.4);
            pointer-events: none;
            animation: dndPulse 0.8s ease-in-out infinite alternate;
        `;
        // Inject keyframe sekali
        if (!document.getElementById('_dnd_style')) {
            const s = document.createElement('style');
            s.id = '_dnd_style';
            s.textContent = `@keyframes dndPulse { from { opacity:0.6; } to { opacity:1; } }`;
            document.head.appendChild(s);
        }
        const rect = target.getBoundingClientRect();
        // Drag ke atas: cursor masuk dari bawah, langsung trigger di 90% height
        // Drag ke bawah: cursor masuk dari atas, threshold normal 50%
        const threshold = dragDir === 'up'
            ? rect.top + rect.height * 0.9
            : rect.top + rect.height * 0.5;
        if (clientY < threshold) {
            container.insertBefore(line, target);
        } else {
            target.after(line);
        }
    },

    _removeDropIndicator() {
        document.getElementById('_dnd_indicator')?.remove();
    },

    _cleanupDrag(card) {
        const container = document.getElementById('announcements');
        if (container) {
            container.querySelectorAll('.course-card.dragging').forEach(c => c.classList.remove('dragging'));
        }
        this._removeDropIndicator();
        this.updateDisplayOrder();
    },

    moveCard(card, direction) {
        const container = document.getElementById("announcements");
        const cards = [...container.querySelectorAll(".course-card")];
        const index = cards.indexOf(card);

        if (direction === 'up' && index > 0) {
            container.insertBefore(card, cards[index - 1]);
        } else if (direction === 'down' && index < cards.length - 1) {
            container.insertBefore(cards[index + 1], card);
        } else {
            return; // Sudah di ujung, gak perlu ngapa-ngapain
        }

        // Update tombol panah (disable kalau udah di ujung)
        this.updateArrowButtons();
        this.updateDisplayOrder();
    },

    updateArrowButtons() {
        const container = document.getElementById("announcements");
        const cards = [...container.querySelectorAll(".course-card")];
        cards.forEach((card, i) => {
            const upBtn = card.querySelector(".move-up-btn");
            const downBtn = card.querySelector(".move-down-btn");
            if (upBtn) upBtn.style.opacity = i === 0 ? '0.3' : '1';
            if (downBtn) downBtn.style.opacity = i === cards.length - 1 ? '0.3' : '1';
        });
    },

    updateDisplayOrder() {
        // JANGAN sync urutan ke state lokal di sini.
        // Biar saveAllChanges bisa bandingin posisi kartu di DOM vs data asli di state.
        // Cukup update UI tombol panah saja jika ada.
        this.updateArrowButtons();
    },

    _escapeHTML(str = '') {
        return String(str).replace(/[&<>"']/g, (m) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m]));
    },

    _escapeAttr(str = '') {
        return this._escapeHTML(str);
    },

    _getFileNameFromUrl(url = '') {
        try {
            const clean = decodeURIComponent(String(url).split('?')[0]);
            return clean.split('/').pop() || 'file';
        } catch (e) {
            return 'file';
        }
    },

    _getFileExt(name = '') {
        const clean = String(name).split('?')[0];
        const parts = clean.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    },

    _isImageFile(file) {
        return file?.type?.startsWith('image/');
    },

    _isImageUrl(url = '') {
        return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(String(url).split('?')[0]);
    },

    _getFileIcon(name = '') {
        const ext = this._getFileExt(name);
        if (ext === 'pdf') return 'fa-solid fa-file-pdf';
        if (['zip', 'rar', '7z'].includes(ext)) return 'fa-solid fa-file-zipper';
        if (['doc', 'docx'].includes(ext)) return 'fa-solid fa-file-word';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-solid fa-file-excel';
        if (['ppt', 'pptx'].includes(ext)) return 'fa-solid fa-file-powerpoint';
        return 'fa-solid fa-file-lines';
    },

    _getFileTypeClass(name = '') {
        const ext = this._getFileExt(name);
        if (ext === 'pdf') return 'file-type-pdf';
        if (['doc', 'docx'].includes(ext)) return 'file-type-word';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'file-type-excel';
        return 'file-type-document';
    },

    _buildFilePreviewHTML(url) {
        const name = this._getFileNameFromUrl(url);
        return `
            <div class="file-tile-preview ${this._getFileTypeClass(name)}">
                <i class="${this._getFileIcon(name)}"></i>
                <span>${this._escapeHTML(name)}</span>
            </div>`;
    },

    // Bangun innerHTML photo-grid dari array URL — dipakai di createCardElement & re-render setelah delete
    _buildPhotoGridHTML(photos, editMode = false) {
        if (!photos || photos.length === 0) return '';
        const deleteBtnStyle = editMode
            ? 'display:flex; position:absolute; top:4px; left:4px; background:rgba(200,0,0,0.85); color:white; border:none; width:24px; height:24px; border-radius:6px; cursor:pointer; align-items:center; justify-content:center; font-size:11px; z-index:5;'
            : 'display:none; position:absolute; top:4px; left:4px; background:rgba(200,0,0,0.85); color:white; border:none; width:24px; height:24px; border-radius:6px; cursor:pointer; align-items:center; justify-content:center; font-size:11px; z-index:5;';

        let photoIdx = 0;
        const makeSlot = (url, extraHTML = '') => {
            const idx = photoIdx++;
            return `
            <div class="photo-item photo-wrapper ${this._isImageUrl(url) ? '' : 'file-wrapper'}" data-index="${idx}" style="position:relative;">
                ${this._isImageUrl(url) ? `<img src="${this._escapeAttr(url)}" loading="lazy">` : this._buildFilePreviewHTML(url)}
                ${extraHTML}
                <button class="delete-photo-btn" data-url="${this._escapeAttr(url)}" style="${deleteBtnStyle}">
                    <i class="fa-solid fa-trash" style="pointer-events:none;"></i>
                </button>
            </div>`;
        };

        let gridClass, imgsHTML;

        if (photos.length <= 4) {
            // Semua foto tampil penuh, semua bisa dihapus
            gridClass = `grid-${photos.length}`;
            imgsHTML = photos.map(makeSlot).join('');
        } else {
            // Slot 1-3: foto biasa + tombol hapus
            // Slot 4: foto ke-4 tampil, sisanya jadi overlay "+N"
            gridClass = 'grid-4';
            imgsHTML = photos.slice(0, 3).map(url => makeSlot(url)).join('');
            // Slot 4 tetap bisa dihapus, overlay cuma teks
            imgsHTML += makeSlot(photos[3], `<div class="more-overlay" style="pointer-events:none;">+${photos.length - 4}</div>`);
        }

        return `<div class="photo-grid ${gridClass}${photos.some(url => !this._isImageUrl(url)) ? ' has-file-items' : ''}">${imgsHTML}</div>`;
    },


    // apapun formatnya (string JSON, plain string, array, null)
    _parsePhotoUrls(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.startsWith('[')) {
                try { return JSON.parse(trimmed); } catch (e) { }
            }
            return [trimmed];
        }
        return [];
    },

    // Supabase menyimpan photo_url sebagai teks JSON — selalu kirim sebagai string
    _serializePhotoUrls(arr) {
        if (!arr || arr.length === 0) return null;
        return JSON.stringify(arr);
    },

    triggerPhotoUpload(card) {
        const fileInput = card.querySelector(".photo-input");
        if (!fileInput) return;
        fileInput.value = ''; // reset biar bisa pilih file yang sama
        fileInput.click();
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;

            if (!card._pendingFiles) card._pendingFiles = [];

            for (let file of files) {
                if (this._isImageFile(file)) {
                    try { file = await this.compressImage(file); } catch (err) { }
                    if (file.size > 5 * 1024 * 1024) { showPopup("Max 5MB per foto", "error"); continue; }
                }
                const objUrl = URL.createObjectURL(file);
                card._pendingFiles.push({ file, objUrl });
            }

            this._renderPendingPreviews(card);
        };
    },

    _renderPendingPreviews(card) {
        const container = card.querySelector('.pending-photo-preview');
        if (!container) return;
        const pending = card._pendingFiles || [];
        if (pending.length === 0) { container.style.display = 'none'; container.innerHTML = ''; return; }

        container.style.display = 'flex';
        container.style.cssText += 'flex-wrap:wrap; gap:6px; margin-bottom:12px;';
        container.innerHTML = pending.map((p, i) => `
            <div style="position:relative; width:72px; height:72px; border-radius:8px; overflow:hidden; border:2px solid rgba(0,234,255,0.5);">
                ${this._isImageFile(p.file) ? `<img src="${p.objUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<div class="pending-file-preview ${this._getFileTypeClass(p.file.name)}"><i class="${this._getFileIcon(p.file.name)}"></i><span>${this._escapeHTML(this._getFileExt(p.file.name) || 'file')}</span></div>`}
                <div style="position:absolute; inset:0; background:rgba(0,0,0,0.35); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;">
                    <i class="fa-solid fa-clock" style="color:#00eaff; font-size:10px;"></i>
                    <span style="font-size:8px; color:#00eaff; font-weight:700;">PENDING</span>
                </div>
                <button data-pending-index="${i}" style="position:absolute; top:2px; right:2px; background:rgba(200,0,0,0.85); border:none; color:white; width:18px; height:18px; border-radius:4px; cursor:pointer; font-size:9px; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-xmark" style="pointer-events:none;"></i>
                </button>
            </div>
        `).join('');

        // Handle hapus pending per item
        container.querySelectorAll('button[data-pending-index]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.pendingIndex);
                const removed = card._pendingFiles.splice(idx, 1)[0];
                if (removed?.objUrl) URL.revokeObjectURL(removed.objUrl);
                this._renderPendingPreviews(card);
            };
        });
    },

    async deletePhoto(card, urlToDelete) {
        if (!await showPopup(t('confirm_delete_photo'), "confirm")) return;
        const id = card.dataset.id;
        const ann = this.state.announcements.find(a => String(a.id) === String(id));

        try {
            // Hapus dari storage Supabase
            if (urlToDelete && urlToDelete.includes('/subject-photos/')) {
                // Ekstrak path setelah bucket
                const path = urlToDelete.split('/subject-photos/')[1];
                if (path) {
                    await supabase.storage.from('subject-photos').remove([decodeURIComponent(path)]);
                }
            }

            // Parse dulu, filter, lalu serialize kembali ke string
            const currentUrls = this._parsePhotoUrls(ann?.photo_url);
            const newUrls = currentUrls.filter(u => u !== urlToDelete);
            const newVal = this._serializePhotoUrls(newUrls);

            // Update database
            await supabase.from("subject_announcements").update({ photo_url: newVal }).eq("id", id);

            // Update state
            if (ann) ann.photo_url = newUrls.length === 0 ? null : newUrls;

            // Update fallback di dataset card biar pas save gak error
            card.dataset.photoUrl = newVal || "";

            // Re-render grid dari awal biar urutan & overlay selalu bener
            const oldGrid = card.querySelector('.photo-grid');
            if (oldGrid) oldGrid.remove();

            if (newUrls.length > 0) {
                const newGridHTML = this._buildPhotoGridHTML(newUrls, this.state.editMode);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newGridHTML;
                const newGrid = tempDiv.firstElementChild;
                const anchor = card.querySelector('.pending-photo-preview') || card.querySelector('h3');
                card.insertBefore(newGrid, anchor);
                card.classList.add('clickable-card');
                card.style.cursor = '';
            } else {
                card.classList.remove('clickable-card');
                card.style.cursor = 'default';
            }

            showToast(t('photo_deleted_cloud'), "success");
        } catch (err) {
            console.error(err);
            showPopup(t('failed_delete_photo_cloud'), "error");
        }
    },

    async saveAnnouncement(card) {
        const id = card.dataset.id;
        const getData = (field) => {
            const el = card.querySelector(`[data-field="${field}"]`);
            if (!el) return "";
            // Jika field deskripsi (content), ambil innerHTML-nya
            return field === 'content' ? el.innerHTML : el.innerText.trim();
        };
        try {
            await supabase.from("subject_announcements").update({
                big_title: getData("big_title"),
                title: getData("title"),
                content: getData("content"),
                small: getData("small")
            }).eq("id", id);
        } catch (err) { console.error(err); }
    },

    _syncDomToState() {
        if (!this.state.editMode) return;
        const cards = document.querySelectorAll(".course-card");
        cards.forEach(card => {
            const id = card.dataset.id;
            const ann = this.state.announcements.find(a => String(a.id) === String(id));
            if (!ann) return;
            ann.big_title = card.querySelector('[data-field="big_title"]')?.innerText.trim() || "";
            ann.title = card.querySelector('[data-field="title"]')?.innerText.trim() || "";
            ann.content = card.querySelector('[data-field="content"]')?.innerHTML || "";
            ann.small = card.querySelector('[data-field="small"]')?.innerText.trim() || "";
        });
    },

    async deleteAnnouncement(card) {
        if (!await showPopup(t('confirm_delete_material'), "confirm")) return;
        const id = card.dataset.id;

        // Ambil data untuk hapus foto di storage
        const ann = this.state.announcements.find(a => String(a.id) === String(id));
        const photoPaths = [];
        if (ann && ann.photo_url) {
            const photos = this._parsePhotoUrls(ann.photo_url);
            photos.forEach(url => {
                // Ekstrak path dari URL public Supabase
                const parts = url.split('/subject-photos/');
                if (parts.length > 1) photoPaths.push(parts[1]);
            });
        }

        try {
            // Hapus di Storage
            if (photoPaths.length > 0) {
                await supabase.storage.from('subject-photos').remove(photoPaths);
            }

            // Hapus di Database
            const { error } = await supabase.from("subject_announcements").delete().eq("id", id);
            if (error) throw error;

            // Update state lokal
            this.state.announcements = this.state.announcements.filter(a => String(a.id) !== String(id));

            // Hapus kartu dari DOM langsung
            card.remove();

            // SINKRONISASI TUGAS
            if (typeof allTasks !== 'undefined') {
                allTasks = allTasks.filter(t => String(t.id) !== String(id));
                if (typeof doneIds !== 'undefined') {
                    doneIds = doneIds.filter(d => String(d) !== String(id));
                }
                if (typeof applyCurrentFilter === 'function') applyCurrentFilter();
                if (typeof updateProgressUI === 'function') updateProgressUI();
            }

            this._syncDomToState();
            this.renderAnnouncements();
            showToast(t('deleted_success'), "success");
        } catch (err) {
            console.error("Delete failed:", err);
            showPopup(t('failed_save_data'), "error");
        }
    },

    // ── DRAFT KEY (unik per subject) ─────────────────────────────
    _draftKey() {
        return `add_draft_${this.state.subjectId}`;
    },

    _saveDraft() {
        try {
            sessionStorage.setItem(this._draftKey(), JSON.stringify({
                big: document.getElementById('addJudul')?.value || '',
                tit: document.getElementById('addSubjudul')?.value || '',
                con: document.getElementById('addIsi')?.innerHTML || '',
                sml: document.getElementById('addSmall')?.value || '',
                color: this.state.selectedColor
            }));
        } catch (e) { }
    },

    _restoreDraft() {
        try {
            const raw = sessionStorage.getItem(this._draftKey());
            if (!raw) return false;
            const d = JSON.parse(raw);
            if (!d.big && !d.tit && !d.con) return false;
            if (d.big) document.getElementById('addJudul').value = d.big;
            if (d.tit) document.getElementById('addSubjudul').value = d.tit;
            if (d.con) document.getElementById('addIsi').innerHTML = d.con;
            if (d.sml) document.getElementById('addSmall').value = d.sml;
            if (d.color) {
                this.state.selectedColor = d.color;
                document.querySelectorAll('#addColors .color-opt').forEach(opt => {
                    opt.classList.toggle('active', opt.dataset.color === d.color);
                });
            }
            return true;
        } catch (e) { return false; }
    },

    _clearDraft() {
        try { sessionStorage.removeItem(this._draftKey()); } catch (e) { }
    },

    initAdd() {
        const modal = document.getElementById('addModal');
        const btnAdd = document.getElementById('addAnnouncementBtn');
        if (!modal || !btnAdd) return;

        const btnSave = document.getElementById('btnSaveAdd');
        const btnCancel = document.getElementById('btnCancelAdd');
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('addFiles');
        const destSelect = document.getElementById('addDestPage');
        const isLessonToggle = document.getElementById('addIsLesson');

        // List warna yang tersedia (sesuai data-color di HTML)
        const availableColors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'];

        if (!btnAdd) return;

        // Initial setup for destination select
        this.populateDestPages();

        btnAdd.onclick = async (e) => {
            e.preventDefault();
            modal.classList.remove('hidden');
            lockScroll();
            this.tempFiles = [];
            document.getElementById('previewContainer').innerHTML = '';

            // Update title modal kalo lagi Global
            const modalTitle = modal.querySelector('h2');
            const targetId = await this._getTargetClassId();
            const userClassId = getEffectiveClassId() || this.state.user.class_id;

            if (targetId != userClassId && modalTitle) {
                modalTitle.innerHTML = '<i class="fa-solid fa-globe"></i> Post Global Kisi-Kisi';
                modalTitle.style.color = 'var(--accent, #00eaff)';
            } else if (modalTitle) {
                modalTitle.innerHTML = 'Tambah Materi';
                modalTitle.style.color = '';
            }

            // Coba restore draft dulu
            const hasDraft = this._restoreDraft();

            if (!hasDraft) {
                // Default setup
                const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
                this.state.selectedColor = randomColor;
                const colorOpts = document.querySelectorAll('#addColors .color-opt');
                colorOpts.forEach(opt => {
                    opt.classList.toggle('active', opt.dataset.color === randomColor);
                });
                const el = document.getElementById('addSmall');
                if (el) el.value = getTodayIndo();

                // Sync UI with current page state
                if (destSelect) {
                    // Kalau di halaman tugas, jangan set value ke 'tugas' (gak ada di option)
                    if (this.state.subjectId !== 'tugas') {
                        destSelect.value = this.state.subjectId;
                    }
                }
                if (isLessonToggle) isLessonToggle.checked = this.state.isLessonMode;

                // FIX: Sembunyikan toggle tugas kalau di halaman announcements pas buka modal
                if (destSelect && isLessonToggle) {
                    const toggleWrap = isLessonToggle.closest('div');
                    if (destSelect.value === 'announcements') {
                        if (toggleWrap) toggleWrap.style.display = 'none';
                        isLessonToggle.checked = false;
                    } else {
                        if (toggleWrap) toggleWrap.style.display = 'flex';
                    }
                }

                this.updateAddTitleHint();
            }

            // Catat history untuk tombol back mobile
            history.pushState({ type: 'overlay', target: 'addModal' }, '');
        };

        if (btnCancel) btnCancel.onclick = () => { modal.classList.add('hidden'); unlockScroll(); };

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleNewFiles(e.target.files);
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
        dropZone.ondragleave = () => dropZone.classList.remove('dragover');
        dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); this.handleNewFiles(e.dataTransfer.files); };

        const colorOpts = document.querySelectorAll('#addColors .color-opt');
        colorOpts.forEach(opt => {
            opt.onclick = () => {
                colorOpts.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.state.selectedColor = opt.dataset.color;
            };
        });

        if (destSelect) {
            destSelect.onchange = () => {
                const isAnnouncements = destSelect.value === 'announcements';
                const toggleWrap = isLessonToggle.closest('div');

                if (isAnnouncements) {
                    if (toggleWrap) toggleWrap.style.display = 'none';
                    isLessonToggle.checked = false;
                } else {
                    if (toggleWrap) toggleWrap.style.display = 'flex';
                    // Default true kalau di halaman mapel, tapi user bisa matiin
                    isLessonToggle.checked = true;
                }

                this.updateAddTitleHint();
                this._saveDraft();
            };
        }

        if (isLessonToggle) {
            isLessonToggle.onchange = () => {
                this.updateAddTitleHint();
                this._saveDraft();
            };
        }

        // ── Autosave draft saat user ngetik ──────────────────────
        ['addJudul', 'addSubjudul', 'addIsi', 'addSmall'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this._saveDraft());
        });

        if (btnSave) {
            btnSave.onclick = async () => {
                const data = {
                    dest: destSelect.value,
                    isLesson: isLessonToggle.checked,
                    isTask: document.getElementById('addIsTask')?.checked || false,
                    big: document.getElementById('addJudul').value,
                    tit: document.getElementById('addSubjudul').value,
                    con: document.getElementById('addIsi').innerHTML,
                    sml: document.getElementById('addSmall').value,
                    files: this.tempFiles,
                    cardColor: this.state.selectedColor
                };

                if (!data.big) { showPopup("Judul wajib!", "error"); return; }

                btnSave.innerHTML = 'Sending...'; btnSave.disabled = true;
                await this.uploadAndSave(data);
                btnSave.innerHTML = 'Posting'; btnSave.disabled = false;
                modal.classList.add('hidden');
                unlockScroll();
                this._clearDraft();
                this.clearForm();
            };
        }
    },

    async populateDestPages() {
        const select = document.getElementById('addDestPage');
        if (!select) return;

        try {
            const classId = getEffectiveClassId();
            const { data, error } = await supabase
                .from('subjects_config')
                .select('subject_id, subject_name, menu_group')
                .eq('class_id', classId)
                .eq('menu_group', 'lessons')
                .order('display_order', { ascending: true });

            if (error) throw error;

            let html = `
                <option value="announcements" data-is-lesson="false">Announcements</option>
                <option value="kisi-kisi" data-is-lesson="false">Kisi-kisi PSTS</option>
                <option value="susulan" data-is-lesson="false">Materi Susulan</option>
            `;
            data.forEach(item => {
                if (item.subject_id === 'announcements' || item.subject_id === 'kisi-kisi' || item.subject_id === 'susulan') return;
                html += `<option value="${item.subject_id}" data-is-lesson="true">${item.subject_name}</option>`;
            });
            select.innerHTML = html;

            // DEFAULT: Bahasa Indonesia kalau di halaman tugas
            if (this.state.subjectId === 'tugas') {
                const indoOpt = Array.from(select.options).find(opt =>
                    opt.value === 'bahasaindonesia' ||
                    opt.text.toLowerCase().includes('indonesia')
                );
                if (indoOpt) {
                    select.value = indoOpt.value;
                } else if (select.options.length > 1) {
                    select.selectedIndex = 1; // skip announcements
                }
            }
        } catch (e) { console.error('Populate error:', e); }
    },

    updateAddTitleHint() {
        const judulEl = document.getElementById('addJudul');
        const destSelect = document.getElementById('addDestPage');
        const isLessonToggle = document.getElementById('addIsLesson');

        if (!judulEl || !destSelect || !isLessonToggle) return;

        // Hanya auto-fill kalau kosong
        if (judulEl.value && !judulEl.value.startsWith('Tugas ')) return;

        if (isLessonToggle.checked) {
            const opt = destSelect.options[destSelect.selectedIndex];
            const nama = opt ? opt.text.trim() : '';
            if (nama) judulEl.value = `${t('task')} ${nama}`;
        } else {
            // Jika dimatikan toggle tugasnya, dan judulnya "Tugas X", hapus
            if (judulEl.value.startsWith('Tugas ')) judulEl.value = '';
        }
    },

    async uploadAndSave(d) {
        // Upload semua foto secara parallel
        const urls = (await Promise.all(
            d.files.map(async (f) => {
                const name = `${d.dest}/new/${Date.now()}_${f.name.replace(/\s/g, '_')}`;
                const { data } = await supabase.storage.from('subject-photos').upload(name, f);
                if (!data) return null;
                return supabase.storage.from('subject-photos').getPublicUrl(name).data.publicUrl;
            })
        )).filter(Boolean);

        const targetClassId = await SubjectApp._getTargetClassId();
        const academicYear = await getAcademicYear(targetClassId);

        const { data: inserted, error } = await supabase.from('subject_announcements').insert({
            subject_id: d.dest,
            class_id: targetClassId,
            academic_year: academicYear,
            big_title: d.big, title: d.tit, content: d.con, small: d.sml,
            photo_url: urls.length > 1 ? urls : (urls[0] || null),
            card_color: d.cardColor,
            is_done: false, // default
            is_lesson: d.isLesson,
            is_task: d.isTask || false,
            is_pinned: false,
            susulan_day: d.susulanDay || null,
            susulan_date: d.susulanDate || null,
            susulan_subject: d.susulanSubject || null,
            display_order: 0
        }).select();

        if (!error) {
            // Kalau post ke halaman yang sama, tampilkan langsung tanpa refresh.
            // Jika di halaman 'tugas', reload kalau yang dipost adalah task (isLesson)
            if (d.dest === this.state.subjectId || (this.state.subjectId === 'tugas' && d.isLesson)) {
                if (this.state.subjectId === 'tugas') {
                    // Halaman tugas punya renderer sendiri (filter + numbering) — reload biar konsisten
                    showToast(t('task_sent_success'), 'success');
                    setTimeout(() => window.location.reload(), 600);
                    return;
                }

                // 1. Kalau lagi edit mode, simpen dulu perubahan card yang belum di-save
                if (this.state.editMode) {
                    await this.saveAllChanges();
                    // saveAllChanges ngereset FAB ke ikon edit — balikin ke tampilan mode edit
                    const toggleBtn = document.getElementById("toggleEditMode");
                    const fabContainer = document.getElementById("adminFabContainer");
                    if (toggleBtn && fabContainer) {
                        fabContainer.classList.add("active");
                        toggleBtn.className = "fab-main state-done";
                        toggleBtn.innerHTML = `<i class="fa-solid fa-check fab-icon"></i><span class="fab-label">${t('save')}</span>`;
                    }
                }

                // 2. Pakai id asli dari DB biar pas di-save lagi nanti gak dobel
                const row = (inserted && inserted[0]) || null;
                const newAnnouncement = {
                    id: row ? row.id : Date.now(),
                    subject_id: d.dest,
                    class_id: targetClassId,
                    academic_year: academicYear,
                    big_title: d.big,
                    title: d.tit,
                    content: d.con,
                    small: d.sml,
                    photo_url: urls.length > 1 ? urls : (urls[0] || null),
                    card_color: d.cardColor,
                    is_done: false,
                    is_lesson: d.isLesson,
                    is_task: d.isTask || false,
                    is_pinned: false,
                    susulan_day: d.susulanDay || null,
                    susulan_date: d.susulanDate || null,
                    susulan_subject: d.susulanSubject || null,
                    display_order: 0
                };

                // 3. Masukin ke state paling atas + render ulang tanpa refresh
                this.state.announcements.unshift(newAnnouncement);
                this.renderAnnouncements();

                // 4. Kisi-kisi render ulang pake renderer sendiri (group per hari),
                //    jadi pastiin edit mode ke-apply ulang di semua card
                if (this.state.editMode) {
                    document.querySelectorAll(".course-card").forEach(card => {
                        card.classList.add("editable-mode");
                        card.querySelectorAll(".editable").forEach(f => {
                            f.contentEditable = "true";
                            f.style.pointerEvents = "auto";
                            f.style.cursor = "text";
                        });
                        const deleteBtn = card.querySelector(".delete-btn");
                        if (deleteBtn) deleteBtn.style.display = "inline-block";
                        const colorTools = card.querySelector(".card-color-tools");
                        if (colorTools) colorTools.style.display = "flex";
                        const formatTools = card.querySelector(".card-format-tools");
                        if (formatTools) formatTools.style.display = "flex";
                        const reorderHandle = card.querySelector(".reorder-handle");
                        if (reorderHandle) {
                            const isStaticPage = this.state.isLessonMode || this.state.subjectId === 'kisi-kisi';
                            reorderHandle.style.display = isStaticPage ? "none" : "flex";
                        }
                        const cameraBtn = card.querySelector(".camera-btn");
                        if (cameraBtn) cameraBtn.style.display = "flex";
                        card.querySelectorAll(".delete-photo-btn").forEach(b => b.style.display = "flex");
                    });
                }

                showToast(t('task_sent_success'), 'success');
            } else {
                showToast(t('task_sent_success'), 'success');
            }
        } else {
            showPopup('Gagal simpan: ' + error.message, 'error');
        }
    },

    setupShortcuts() {
        // Guard: pastikan listener hanya dipasang sekali
        if (this._shortcutsInitialized) return;
        this._shortcutsInitialized = true;

        document.addEventListener('keydown', (e) => {
            const addModal = document.getElementById('addModal');
            const isAddModalOpen = addModal && !addModal.classList.contains('hidden');

            // [BARU] Shortcut Navigasi Detail & Foto (Desktop)
            const detailOverlay = document.getElementById('detailOverlay');
            const isDetailActive = detailOverlay && detailOverlay.classList.contains('active');

            if (isDetailActive) {
                if (e.key === 'ArrowRight') { e.preventDefault(); nextSlide(); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeDetail();
                    return; // Biar gak bentrok sama Escape modal
                }
                // Kalau detail lagi kebuka, kita batasi shortcut lain biar gak ganggu
                if (e.key.startsWith('Arrow')) return;
            }

            // Shortcut Ukuran Teks (Rich Text) yang sebelumnya
            if (e.ctrlKey && (e.key === 'j' || e.key === 'k' || e.key === 'l')) {
                e.preventDefault();
                if (e.key === 'j') formatText('5'); // Besar
                if (e.key === 'k') formatText('3'); // Sedang
                if (e.key === 'l') formatText('2'); // Kecil
                return;
            }

            if (e.ctrlKey && e.code === 'Enter') {
                e.preventDefault();
                if (isAddModalOpen) {
                    document.getElementById('btnSaveAdd')?.click();
                } else {
                    document.getElementById("toggleEditMode")?.click();
                }
            }

            if (e.ctrlKey && e.key === '\\') {
                e.preventDefault();
                if (!isAddModalOpen) {
                    document.getElementById("addAnnouncementBtn")?.click();
                    setTimeout(() => document.getElementById('addJudul')?.focus(), 100);
                }
                if (isDetailActive) closeDetail();
                if (isAddModalOpen) {
                    document.getElementById('btnCancelAdd')?.click();
                }
            }

            // Escape Global (untuk modal)
            if (e.key === 'Escape' && isAddModalOpen) {
                document.getElementById('btnCancelAdd')?.click();
            }
        });
    },

    setupAutoList() {
        document.addEventListener('keydown', (e) => {
            const el = document.activeElement;
            if (!el) return;
            const isInEditor = (el.isContentEditable && el.classList.contains('editable')) || el.id === 'addIsi';
            if (!isInEditor) return;

            if (e.key === ' ' && !e.ctrlKey && !e.metaKey) {
                handleBulletAuto(e);
            } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                handleNumberedAuto(e);
            }
        });
    },

    async handleNewFiles(files) {
        const container = document.getElementById('previewContainer');
        if (!container) return;

        for (const file of Array.from(files)) {
            try {
                let uploadFile = file;
                if (this._isImageFile(file)) {
                    // Compress image biar irit storage
                    uploadFile = await this.compressImage(file);
                }
                this.tempFiles.push(uploadFile);

                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `
                    ${this._isImageFile(uploadFile)
                        ? `<img src="${URL.createObjectURL(uploadFile)}">`
                        : `<div class="preview-file ${this._getFileTypeClass(uploadFile.name)}"><i class="${this._getFileIcon(uploadFile.name)}"></i><span>${this._escapeHTML(this._getFileExt(uploadFile.name) || 'file')}</span></div>`}
                    <div class="preview-remove">
                        <i class="fa-solid fa-trash-can"></i>
                    </div>
                `;
                div.querySelector('.preview-remove').onclick = () => this.removeTempFile(uploadFile.name, div.querySelector('.preview-remove'));
                container.appendChild(div);
            } catch (e) {
                console.error("Gagal proses file:", e);
            }
        }
    },

    removeTempFile(name, el) {
        this.tempFiles = this.tempFiles.filter(f => f.name !== name);
        el.closest('.preview-item').remove();
    },

    clearForm() {
        ['addJudul', 'addSubjudul', 'addSmall'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const isi = document.getElementById('addIsi');
        if (isi) isi.innerHTML = '';

        const preview = document.getElementById('previewContainer');
        if (preview) preview.innerHTML = '';

        this.tempFiles = [];
        this.state.selectedColor = 'default';

        // Reset warna di UI
        document.querySelectorAll('#addColors .color-opt').forEach(opt => {
            opt.classList.remove('active');
        });
    },

    compressImage: async function (file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const max = 1024;
                    let w = img.width, h = img.height;
                    if (w > max) { h *= max / w; w = max; }
                    canvas.width = w; canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(b => resolve(new File([b], file.name, { type: 'image/jpeg', lastModified: Date.now() })), 'image/jpeg', 0.6);
                };
            };
            reader.onerror = reject;
        });
    }
};

function getTodayIndo() {
    const d = new Date();
    const tanggal = d.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const jam = String(d.getHours()).padStart(2, '0');
    const menit = String(d.getMinutes()).padStart(2, '0');
    return `${tanggal}, ${jam}.${menit}`;
}

let currentViewerPhotos = [], currentViewerIndex = 0;
function openDetail(data, photoIndex = 0) {
    const overlay = document.getElementById('detailOverlay');
    const info = document.getElementById('detailInfoSection');
    const btn = document.getElementById('toggleInfoBtn');
    const detailBox = overlay.querySelector('.glass-detail-box');

    document.getElementById('detailBigTxt').innerText = data.big_title || '';
    document.getElementById('detailTitleTxt').innerText = data.title || '';
    document.getElementById('detailContentTxt').innerHTML = processCodeBlocks(processCardLinks(data.content || ''));
    document.getElementById('detailSmallTxt').innerText = data.small || '';

    let photos = [];
    if (data.photo_url) {
        try { photos = Array.isArray(data.photo_url) ? data.photo_url : JSON.parse(data.photo_url); }
        catch { photos = [data.photo_url]; }
    }
    if (photos.length === 0) detailBox.classList.add('text-only-mode');
    else detailBox.classList.remove('text-only-mode');
    if (window.innerWidth <= 768) {
        info.classList.add('hidden-mobile');
        info.classList.remove('full-screen');
        if (btn) btn.style.display = 'flex';
    } else {
        info.classList.remove('hidden-mobile', 'full-screen');
        if (btn) btn.style.display = 'none';
    }

    currentViewerPhotos = photos;
    currentViewerIndex = photoIndex;
    updateSliderUI();
    overlay.classList.add('active');
    lockScroll();
    history.pushState({ type: 'overlay', target: 'detail' }, '');
}

function closeDetail() {
    document.getElementById('detailOverlay').classList.remove('active');
    unlockScroll();
}

function updateSliderUI() {
    const imgEl = document.getElementById('detailImg');
    const nav = document.getElementById('sliderNavBtns');
    const wrapper = imgEl?.closest('.slider-wrapper');

    if (!nav || !imgEl || !wrapper) return;

    let filePreview = wrapper.querySelector('.detail-file-preview');
    if (!filePreview) {
        filePreview = document.createElement('a');
        filePreview.className = 'detail-file-preview';
        wrapper.appendChild(filePreview);
    }

    if (currentViewerPhotos.length === 0) {
        imgEl.style.display = 'none';
        filePreview.style.display = 'none';
        nav.style.display = 'none';
        return;
    }

    const currentUrl = currentViewerPhotos[currentViewerIndex];
    const isImage = SubjectApp._isImageUrl(currentUrl);
    wrapper.classList.toggle('file-mode', !isImage);

    filePreview.style.display = isImage ? 'none' : 'flex';
    imgEl.style.display = isImage ? 'block' : 'none';

    if (!isImage) {
        const fileName = SubjectApp._getFileNameFromUrl(currentUrl);
        wrapper.classList.remove('loading');
        filePreview.href = currentUrl;
        filePreview.download = fileName;
        filePreview.className = `detail-file-preview ${SubjectApp._getFileTypeClass(fileName)}`;
        filePreview.innerHTML = `
            <i class="${SubjectApp._getFileIcon(fileName)}"></i>
            <span>${SubjectApp._escapeHTML(fileName)}</span>
            <small>${t('download_file')}</small>
        `;
    } else {
        wrapper.classList.add('loading');

        imgEl.src = currentUrl;

        imgEl.onload = () => {
            wrapper.classList.remove('loading');
        };

        imgEl.onerror = () => {
            wrapper.classList.remove('loading');
            imgEl.src = 'icons/error-img.png';
        };
    }

    const tag = document.getElementById('photoCounterTag');
    if (tag) tag.innerText = `${currentViewerIndex + 1} / ${currentViewerPhotos.length}`;

    const isMulti = currentViewerPhotos.length > 1;
    nav.style.display = isMulti ? 'flex' : 'none';

    if (isMulti) {
        const btnPrev = nav.querySelector('.prev-btn');
        const btnNext = nav.querySelector('.next-btn');
        if (btnPrev) btnPrev.style.visibility = (currentViewerIndex === 0) ? 'hidden' : 'visible';
        if (btnNext) btnNext.style.visibility = (currentViewerIndex === currentViewerPhotos.length - 1) ? 'hidden' : 'visible';
    }
}
function nextSlide(e) { if (e) e.stopPropagation(); if (currentViewerIndex < currentViewerPhotos.length - 1) { currentViewerIndex++; updateSliderUI(); } }
function prevSlide(e) { if (e) e.stopPropagation(); if (currentViewerIndex > 0) { currentViewerIndex--; updateSliderUI(); } }

// ── Swipe gesture untuk detail photo viewer ──────────────────
(function initSwipe() {
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;

    document.addEventListener('touchstart', function (e) {
        const overlay = document.getElementById('detailOverlay');
        if (!overlay || !overlay.classList.contains('active')) return;
        if (currentViewerPhotos.length <= 1) return;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwiping = true;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!isSwiping) return;
        isSwiping = false;

        const overlay = document.getElementById('detailOverlay');
        if (!overlay || !overlay.classList.contains('active')) return;
        if (currentViewerPhotos.length <= 1) return;

        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;

        // Minimal 50px horizontal, dan lebih horizontal dari vertikal
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;

        if (dx < 0) nextSlide();  // geser kiri → foto berikutnya
        else prevSlide();          // geser kanan → foto sebelumnya
    }, { passive: true });
})();
function showMobileInfo(e) {
    if (e) e.stopPropagation();
    const info = document.getElementById('detailInfoSection');
    const btn = document.getElementById('toggleInfoBtn');

    info.classList.remove('hidden-mobile');
    if (btn) btn.style.display = 'none';
}

function toggleSheetHeight(e) {
    if (e) e.stopPropagation();
    const info = document.getElementById('detailInfoSection');
    const btn = document.getElementById('sheetToggleBtn');
    if (!info || !btn) return;

    const icon = btn.querySelector('i');
    const isFull = info.classList.contains('full-screen');

    if (isFull) {
        info.classList.remove('full-screen');
        if (icon) icon.className = 'fa-solid fa-expand';
    } else {
        info.classList.remove('hidden-mobile');
        info.classList.add('full-screen');
        if (icon) icon.className = 'fa-solid fa-compress';
    }
}

function toggleMobileInfo(e) {
    if (e) e.stopPropagation();
    const info = document.getElementById('detailInfoSection');
    const btn = document.getElementById('toggleInfoBtn');
    const toggleIcon = document.querySelector('#sheetToggleBtn i');

    if (info) {
        info.classList.add('hidden-mobile');
        info.classList.remove('full-screen');
    }
    if (btn) btn.style.display = 'flex';
    if (toggleIcon) toggleIcon.className = 'fa-solid fa-expand';
}

function formatText(size) {
    const editor = document.getElementById('addIsi');
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    let node = sel.getRangeAt(0).startContainer;
    if (node === editor) return;

    while (node.parentNode && node.parentNode !== editor) {
        node = node.parentNode;
    }
    if (!node.parentNode) return;

    if (node.nodeType === 3) {
        const div = document.createElement('div');
        node.parentNode.insertBefore(div, node);
        div.appendChild(node);
        node = div;
    }

    node.classList.remove('format-large', 'format-medium', 'format-small');
    const map = { '5': 'format-large', '3': 'format-medium', '2': 'format-small' };
    if (map[size]) node.classList.add(map[size]);

    editor.focus();
}

function formatBold() {
    const editor = document.getElementById('addIsi');
    if (editor) { editor.focus(); setTimeout(() => document.execCommand('bold', false, null), 10); }
}

function formatItalic() {
    const editor = document.getElementById('addIsi');
    if (editor) { editor.focus(); setTimeout(() => document.execCommand('italic', false, null), 10); }
}

function formatUnderline() {
    const editor = document.getElementById('addIsi');
    if (editor) { editor.focus(); setTimeout(() => document.execCommand('underline', false, null), 10); }
}

function getActiveEditor() {
    const el = document.activeElement;
    if (el && el.isContentEditable && el.classList.contains('editable')) return el;
    if (el && el.id === 'addIsi') return el;
    if (window._lastEditor && window._lastEditor.isConnected) return window._lastEditor;
    return null;
}

document.addEventListener('focusin', () => {
    const el = document.activeElement;
    if (el && el.isContentEditable && (el.id === 'addIsi' || el.classList.contains('editable'))) {
        window._lastEditor = el;
    }
});

function cardFormatText(e, size) {
    if (e) e.stopPropagation();
    const editor = getActiveEditor();
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    let node = sel.getRangeAt(0).startContainer;
    if (node === editor) return;

    while (node.parentNode && node.parentNode !== editor) {
        node = node.parentNode;
    }
    if (!node.parentNode || node.nodeType !== 1) return;

    if (node.nodeType === 3) {
        const div = document.createElement('div');
        node.parentNode.insertBefore(div, node);
        div.appendChild(node);
        node = div;
    }

    node.classList.remove('format-large', 'format-medium', 'format-small');
    const map = { '5': 'format-large', '3': 'format-medium', '2': 'format-small' };
    if (map[size]) node.classList.add(map[size]);

    editor.focus();
}

function cardFormatBold(e) {
    if (e) e.stopPropagation();
    const editor = getActiveEditor();
    if (editor) { editor.focus(); setTimeout(() => document.execCommand('bold', false, null), 10); }
}

function cardFormatItalic(e) {
    if (e) e.stopPropagation();
    const editor = getActiveEditor();
    if (editor) { editor.focus(); setTimeout(() => document.execCommand('italic', false, null), 10); }
}

function cardFormatUnderline(e) {
    if (e) e.stopPropagation();
    const editor = getActiveEditor();
    if (editor) { editor.focus(); setTimeout(() => document.execCommand('underline', false, null), 10); }
}

function cardFormatLink(e) {
    if (e) e.stopPropagation();
    const editor = getActiveEditor();
    if (!editor) return;
    editor.focus();
    document.execCommand('insertHTML', false, '<span class="tujuan-marker">tujuan=</span> , ');
}

function processCardLinks(html) {
    if (!html) return html;
    html = html.replace(/<span class="tujuan-marker">tujuan=<\/span>/g, 'tujuan=');
    return html.replace(/tujuan=([^,]+?)\s*,\s*(.+?)(?=<|$)/g, (m, url, label) => {
        const cleanUrl = url.trim();
        const cleanLabel = label.trim();
        if (!cleanUrl || !cleanLabel) return m;
        return `<a href="${cleanUrl.replace(/"/g, '&quot;')}" class="inline-link">${cleanLabel}</a>`;
    });
}

function revertCardLinks(html) {
    if (!html) return html;
    return html.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (m, url, label) => {
        return `<span class="tujuan-marker">tujuan=</span>${url}, ${label}`;
    });
}

// ── CODE BLOCK: deteksi & bungkus kode biar ada tombol copy ──
// Dipakai di render view (DOM doang). Pas edit mode, revertCodeBlocks
// balikin ke HTML asli biar yang ke-save tetap data mentah.

function _looksLikeCodeLine(el) {
    if (el.tagName !== 'DIV') return false;
    const spans = el.querySelectorAll('span');
    if (spans.length === 0) return false;
    let colored = 0;
    spans.forEach(s => {
        const st = s.getAttribute('style') || '';
        if (st.includes('color') || st.includes('font-family')) colored++;
    });
    return colored >= 1;
}

function _makeCodeCopyBtn() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy-btn';
    btn.title = t('copy_code');
    btn.innerHTML = `<i class="fa-regular fa-copy"></i> ${t('copy_code')}`;
    return btn;
}

function _makeCodeWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrap';
    wrapper.dataset.cb = '1';
    const body = document.createElement('div');
    body.className = 'code-block-body';
    wrapper.appendChild(body);
    wrapper.appendChild(_makeCodeCopyBtn());
    return wrapper;
}

function _wrapCodeBlock(el) {
    if (el.classList.contains('code-block-wrap')) return;
    const wrapper = _makeCodeWrapper();
    el.parentNode.insertBefore(wrapper, el);
    wrapper.querySelector('.code-block-body').appendChild(el);
}

// Rangkaian <div> ber-span warna (paste dari VSCode/IDE)
function _wrapColoredRuns(tmp) {
    const children = Array.from(tmp.children);
    let run = [];
    const flushRun = () => {
        if (run.length >= 3 && run.every(el => _looksLikeCodeLine(el))) {
            const wrapper = _makeCodeWrapper();
            run[0].parentNode.insertBefore(wrapper, run[0]);
            run.forEach(el => wrapper.querySelector('.code-block-body').appendChild(el));
        }
        run = [];
    };
    children.forEach(el => {
        if (el.tagName === 'DIV') run.push(el);
        else flushRun();
    });
    flushRun();
}

// Elemen yang isinya markup: teks literal '<' (&lt;) atau elemen dokumen
// HTML (header/nav/section/table/dll) yang ke-render pas paste halaman web
function _isPlainCodeEl(el) {
    if (el.classList.contains('code-block-wrap')) return false;
    const inner = el.innerHTML || '';
    if (inner.includes('&lt;')) return true;
    const tag = el.tagName;
    if (['SECTION', 'NAV', 'HEADER', 'FOOTER', 'MAIN', 'TABLE', 'ARTICLE', 'ASIDE', 'FORM'].includes(tag)) return true;
    // Tag dokumen di dalamnya (dokumen HTML yang ke-parse jadi elemen asli)
    const docTags = ['<section', '<nav', '<header', '<main', '<footer', '<table', '<article', '<aside', '<form', '<html', '<body'];
    return docTags.some(t => inner.toLowerCase().includes(t));
}

// Markup polos (plain text HTML): ubah text node ber-'<' jadi div, lalu
// grup elemen markup berurutan jadi satu blok kode
function _wrapPlainCodeRuns(tmp) {
    Array.from(tmp.childNodes).forEach(n => {
        if (n.nodeType === 3 && n.textContent.includes('<')) {
            const d = document.createElement('div');
            d.textContent = n.textContent;
            n.replaceWith(d);
        }
    });

    const children = Array.from(tmp.children);
    let run = [];
    const flushRun = () => {
        if (run.length > 0) {
            const wrapper = _makeCodeWrapper();
            run[0].parentNode.insertBefore(wrapper, run[0]);
            run.forEach(el => wrapper.querySelector('.code-block-body').appendChild(el));
        }
        run = [];
    };
    children.forEach(el => {
        if (_isPlainCodeEl(el)) run.push(el);
        else flushRun();
    });
    flushRun();
}

function processCodeBlocks(html) {
    if (!html || typeof html !== 'string') return html;
    const signals = ['<pre', '<div', '&lt;', '<table', '<section', '<nav', '<header', '<main', '<footer'];
    if (!signals.some(s => html.includes(s))) return html;

    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    // 1. Blok <pre>
    tmp.querySelectorAll('pre').forEach(pre => _wrapCodeBlock(pre));

    // 2. Rangkaian <div> ber-span warna (paste VSCode/IDE)
    _wrapColoredRuns(tmp);

    // 3. Markup polos / dokumen HTML (plain text paste)
    _wrapPlainCodeRuns(tmp);

    return tmp.innerHTML;
}

function revertCodeBlocks(html) {
    if (!html || !html.includes('code-block-wrap')) return html;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('.code-block-wrap').forEach(w => {
        const body = w.querySelector('.code-block-body');
        if (body) {
            while (body.firstChild) w.parentNode.insertBefore(body.firstChild, w);
        }
        w.remove();
    });
    return tmp.innerHTML;
}

function _copyTextFallback(text, onDone) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed; top:0; left:0; opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        onDone();
    } catch (e) {
        if (typeof showToast === 'function') showToast(t('failed_save_data'), 'error');
    }
}

function handleBulletAuto(e) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== 3) return;

    const textBefore = node.textContent.slice(0, range.startOffset);
    if (textBefore.trim() !== '-') return;

    e.preventDefault();

    const beforeDash = textBefore.slice(0, -1);
    const after = node.textContent.slice(range.startOffset);
    node.textContent = beforeDash + '• ' + after;

    const newOffset = beforeDash.length + 2;
    const newRange = document.createRange();
    newRange.setStart(node, newOffset);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
}

function handleNumberedAuto(e) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    let node = sel.getRangeAt(0).startContainer;
    const editor = getActiveEditor();
    if (!editor || node === editor) return;

    while (node.parentNode && node.parentNode !== editor) {
        node = node.parentNode;
    }
    if (node.nodeType !== 1 || !node.parentNode) return;

    const text = node.textContent || '';

    // Bullet continuation
    const bulletMatch = text.match(/^•\s*/);
    if (bulletMatch) {
        const afterBullet = text.slice(bulletMatch[0].length);
        if (!afterBullet.trim()) return;
        e.preventDefault();
        const newDiv = document.createElement('div');
        newDiv.textContent = '• ';
        node.parentNode.insertBefore(newDiv, node.nextSibling);
        const textNode = newDiv.firstChild;
        const newRange = document.createRange();
        newRange.setStart(textNode, 2);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        return;
    }

    // Numbered list continuation
    const match = text.match(/^(\d+)\.\s+/);
    if (!match) return;

    const num = parseInt(match[1]);
    const afterPrefix = text.slice(match[0].length);

    if (!afterPrefix.trim()) return;

    e.preventDefault();

    const newDiv = document.createElement('div');
    newDiv.textContent = `${num + 1}. `;
    node.parentNode.insertBefore(newDiv, node.nextSibling);

    const textNode = newDiv.firstChild;
    const newRange = document.createRange();
    newRange.setStart(textNode, textNode.textContent.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
}
