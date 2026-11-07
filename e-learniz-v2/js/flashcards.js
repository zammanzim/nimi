// File: js/flashcards.js
document.addEventListener('DOMContentLoaded', initFlashcards);

const FlashcardsApp = {
    state: {
        user: null,
        classId: null,
        subjects: [],
        currentSubjectId: null,
        cards: [],
        currentIndex: 0,
        isAdmin: false
    },

    async init() {
        try {
            this.state.user = JSON.parse(localStorage.getItem('user'));
        } catch (e) {
            this.state.user = null;
        }

        if (!this.state.user) {
            window.location.href = '../login';
            return;
        }

        this.state.classId = getEffectiveClassId() || String(this.state.user.class_id);
        this.state.isAdmin = (this.state.user.role === 'class_admin' || this.state.user.role === 'super_admin');

        // Setup event listeners for card flipping and buttons
        this.setupEventListeners();
        this.setupKeyboardShortcuts();

        // Load subjects configuration first
        await this.loadSubjects();

        // Check query param for subject ID
        const urlParams = new URLSearchParams(window.location.search);
        const urlSubject = urlParams.get('id');
        if (urlSubject) {
            this.selectSubject(urlSubject);
        } else {
            this.showHub();
        }
    },

    async loadSubjects() {
        try {
            // Fetch subjects config
            const { data, error } = await supabase
                .from('subjects_config')
                .select('subject_id, subject_name, icon')
                .or(`class_id.eq.${this.state.classId},class_id.eq.2`)
                .order('display_order', { ascending: true });

            if (error) throw error;
            this.state.subjects = data || [];

            // Get flashcards count per subject to display in chips
            const { data: countsData, error: countsError } = await supabase
                .from('flashcards')
                .select('subject_id')
                .or(`class_id.eq.${this.state.classId},class_id.eq.0`);

            const counts = {};
            if (!countsError && countsData) {
                countsData.forEach(c => {
                    counts[c.subject_id] = (counts[c.subject_id] || 0) + 1;
                });
            }

            this.renderSubjectChips(counts);
        } catch (err) {
            console.error('Gagal mengambil daftar mapel:', err);
        }
    },

    renderSubjectChips(counts) {
        const chipsContainer = document.getElementById('subjectListChips');
        if (!chipsContainer) return;

        if (this.state.subjects.length === 0) {
            chipsContainer.innerHTML = `<div style="color: #888; font-size: 13px; text-align: center; padding: 10px;">Belum ada mapel terdaftar</div>`;
            return;
        }

        const html = this.state.subjects.map(s => {
            const count = counts[s.subject_id] || 0;
            const name = t(s.subject_id) !== s.subject_id ? t(s.subject_id) : s.subject_name;
            const icon = s.icon || 'fa-book';
            const isActive = s.subject_id === this.state.currentSubjectId ? 'active' : '';

            return `
                <div class="mapel-chip-tugas ${isActive}" data-subject="${s.subject_id}" onclick="FlashcardsApp.selectSubject('${s.subject_id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid ${icon}" style="font-size: 12px; width: 14px;"></i>
                        <span style="font-size: 14px; font-weight: 600;">${name}</span>
                    </div>
                    <span class="sidebar-badge badge-ongoing" style="font-size: 10px; margin: 0; padding: 2px 6px;">${count}</span>
                </div>
            `;
        }).join('');

        chipsContainer.innerHTML = html;
    },

    showHub() {
        this.state.currentSubjectId = null;
        document.getElementById('subjectInfoCard').style.display = 'none';
        document.getElementById('flashcardView').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('hubPlaceholder').style.display = 'block';

        // Update active class on chips
        document.querySelectorAll('#subjectListChips .mapel-chip-tugas').forEach(c => c.classList.remove('active'));
    },

    async selectSubject(subjectId) {
        this.state.currentSubjectId = subjectId;
        const subject = this.state.subjects.find(s => s.subject_id === subjectId);
        const subjectName = subject ? (t(subjectId) !== subjectId ? t(subjectId) : subject.subject_name) : subjectId;
        const subjectIcon = subject ? subject.icon : 'fa-book';

        // Update active class on chips
        document.querySelectorAll('#subjectListChips .mapel-chip-tugas').forEach(c => {
            if (c.dataset.subject === subjectId) c.classList.add('active');
            else c.classList.remove('active');
        });

        // Setup Header Card
        document.getElementById('subjectTitleName').innerText = subjectName;
        document.getElementById('subjectIcon').className = `fa-solid ${subjectIcon}`;
        document.getElementById('subjectInfoCard').style.display = 'block';
        document.getElementById('backBtn').style.display = 'flex';
        document.getElementById('hubPlaceholder').style.display = 'none';

        // Fetch cards from db
        await this.loadCards();
    },

    async loadCards() {
        try {
            // Render Skeleton first
            document.getElementById('frontText').innerHTML = `<div class="skeleton" style="width: 80%; height: 24px; margin: auto;"></div>`;
            document.getElementById('backText').innerHTML = `<div class="skeleton" style="width: 80%; height: 24px; margin: auto;"></div>`;
            document.getElementById('flashcardView').style.display = 'block';

            const { data, error } = await supabase
                .from('flashcards')
                .select('*')
                .eq('subject_id', this.state.currentSubjectId)
                .or(`class_id.eq.${this.state.classId},class_id.eq.0`)
                .order('created_at', { ascending: true });

            if (error) throw error;
            this.state.cards = data || [];
            this.state.currentIndex = 0;

            document.getElementById('subjectCardsCount').innerText = `${this.state.cards.length} Cards`;

            if (this.state.cards.length === 0) {
                this.showEmptyState();
            } else {
                this.renderCard();
            }

            // Render Admin panel if user is admin
            if (this.state.isAdmin) {
                this.renderAdminPanel();
            }
        } catch (err) {
            console.error('Gagal mengambil flashcards:', err);
            showToast('Gagal memuat flashcard', 'error');
        }
    },

    showEmptyState() {
        const wrapper = document.getElementById('flashcardWrapper');
        wrapper.classList.remove('flipped');
        
        document.getElementById('frontText').innerHTML = `
            <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: #ff8c00; margin-bottom: 15px;"></i>
            <h4 style="margin: 0; font-size: 16px;">Materi Kosong</h4>
            <p style="opacity: 0.6; font-size: 13px; margin-top: 5px;">Mapel ini belum punya flashcards wkwk</p>
        `;
        document.getElementById('backText').innerHTML = 'Empty';
        document.getElementById('cardCounter').innerText = '0 / 0';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
    },

    renderCard() {
        const wrapper = document.getElementById('flashcardWrapper');
        // Reset flip state to front before changing contents
        wrapper.classList.remove('flipped');

        const card = this.state.cards[this.state.currentIndex];
        if (!card) return;

        setTimeout(() => {
            document.getElementById('frontText').innerText = card.front;
            document.getElementById('backText').innerText = card.back;
            document.getElementById('cardCounter').innerText = `${this.state.currentIndex + 1} / ${this.state.cards.length}`;
            
            document.getElementById('prevBtn').disabled = (this.state.currentIndex === 0);
            document.getElementById('nextBtn').disabled = (this.state.currentIndex === this.state.cards.length - 1);
        }, 150); // slight timeout to allow flipping back animation before content swap
    },

    flipCard() {
        const wrapper = document.getElementById('flashcardWrapper');
        if (this.state.cards.length === 0) return;
        wrapper.classList.toggle('flipped');
    },

    prevCard() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this.renderCard();
        }
    },

    nextCard() {
        if (this.state.currentIndex < this.state.cards.length - 1) {
            this.state.currentIndex++;
            this.renderCard();
        }
    },

    renderAdminPanel() {
        const adminPanel = document.getElementById('adminPanel');
        const grid = document.getElementById('adminCardsGrid');
        if (!adminPanel || !grid) return;

        adminPanel.style.display = 'block';

        if (this.state.cards.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 20px; font-size: 13px;">Belum ada flashcard untuk dikelola</div>`;
            return;
        }

        const html = this.state.cards.map((c, index) => `
            <div class="flashcard-admin-card" style="border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(15, 20, 30, 0.5);">
                <div style="font-weight: 700; font-size: 12px; color: #00eaff;">#${index + 1}</div>
                <div style="font-size: 13px; color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <b>Depan:</b> ${escapeSidebarHtml(c.front)}
                </div>
                <div style="font-size: 13px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <b>Belakang:</b> ${escapeSidebarHtml(c.back)}
                </div>
                <div style="display: flex; gap: 8px; margin-top: auto; justify-content: flex-end;">
                    <button class="fmt-btn" onclick="FlashcardsApp.editCard(${c.id})" style="background: rgba(0, 234, 255, 0.1); color: #00eaff; font-size: 11px;">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="fmt-btn" onclick="FlashcardsApp.deleteCard(${c.id})" style="background: rgba(255, 71, 87, 0.1); color: #ff4757; font-size: 11px;">
                        <i class="fa-solid fa-trash"></i> Hapus
                    </button>
                </div>
            </div>
        `).join('');

        grid.innerHTML = html;
    },

    async addCard() {
        if (!this.state.currentSubjectId) return;

        // Custom inputs via popup form
        const front = await showPopup('Masukkan Sisi Depan (Konsep/Pertanyaan)', 'form', { placeholder: 'Contoh: Apa kepanjangan dari HTML?' });
        if (front === null || front.trim() === '') return;

        const back = await showPopup('Masukkan Sisi Belakang (Definisi/Jawaban)', 'form', { placeholder: 'Contoh: Progressive Web App' });
        if (back === null || back.trim() === '') return;

        try {
            const { error } = await supabase
                .from('flashcards')
                .insert([{
                    subject_id: this.state.currentSubjectId,
                    class_id: this.state.classId,
                    front: front.trim(),
                    back: back.trim()
                }]);

            if (error) throw error;
            showToast('Flashcard berhasil ditambahkan!', 'success');
            
            // Reload cards & subjects to update counts
            await this.loadCards();
            await this.loadSubjects();
        } catch (err) {
            console.error('Gagal menambah flashcard:', err);
            showPopup('Gagal menambah flashcard: ' + err.message, 'error');
        }
    },

    async editCard(id) {
        const card = this.state.cards.find(c => c.id === id);
        if (!card) return;

        const front = await showPopup('Edit Sisi Depan', 'form', { value: card.front });
        if (front === null || front.trim() === '') return;

        const back = await showPopup('Edit Sisi Belakang', 'form', { value: card.back });
        if (back === null || back.trim() === '') return;

        try {
            const { error } = await supabase
                .from('flashcards')
                .update({
                    front: front.trim(),
                    back: back.trim()
                })
                .eq('id', id);

            if (error) throw error;
            showToast('Flashcard berhasil diupdate!', 'success');

            await this.loadCards();
        } catch (err) {
            console.error('Gagal mengedit flashcard:', err);
            showPopup('Gagal mengedit flashcard: ' + err.message, 'error');
        }
    },

    async deleteCard(id) {
        const ok = await showPopup('Hapus flashcard ini?', 'confirm');
        if (!ok) return;

        try {
            const { error } = await supabase
                .from('flashcards')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast('Flashcard berhasil dihapus', 'success');

            await this.loadCards();
            await this.loadSubjects();
        } catch (err) {
            console.error('Gagal menghapus flashcard:', err);
            showPopup('Gagal menghapus flashcard: ' + err.message, 'error');
        }
    },

    setupEventListeners() {
        const wrapper = document.getElementById('flashcardWrapper');
        if (wrapper) wrapper.onclick = () => this.flipCard();

        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) prevBtn.onclick = () => this.prevCard();

        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.onclick = () => this.nextCard();

        const backBtn = document.getElementById('backBtn');
        if (backBtn) backBtn.onclick = () => this.showHub();

        const addCardBtn = document.getElementById('addCardBtn');
        if (addCardBtn) addCardBtn.onclick = () => this.addCard();
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Avoid triggering shortcuts when inputs/popups are active
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.contentEditable === 'true')) {
                return;
            }

            if (this.state.cards.length === 0) return;

            if (e.code === 'Space') {
                e.preventDefault(); // prevent scroll
                this.flipCard();
            } else if (e.code === 'ArrowLeft') {
                this.prevCard();
            } else if (e.code === 'ArrowRight') {
                this.nextCard();
            }
        });
    }
};

function initFlashcards() {
    FlashcardsApp.init();
}
