// ============================================================
// quiz.js — Simulasi Ujian Logic
// Handles fetching questions, checking answers, and navigation.
// ============================================================

let QUIZ_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
let quizScheduleMap = {};

const QuizApp = {
    state: {
        subjectId: null,
        questions: [],
        currentIndex: 0,
        answeredCorrectly: false,
        user: null,
        history: {}, // Map: questionIndex -> Array of selected option indices
        subjectsInfo: {} // Map: subjectId -> { name, icon, qCount, progress }
    },

    resetState() {
        this.state.subjectId = null;
        this.state.questions = [];
        this.state.currentIndex = 0;
        this.state.answeredCorrectly = false;
        this.state.history = {};

        // Reset UI Elements
        const elements = ['backBtn', 'selectionView', 'infoView', 'quizView', 'resultView'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    },

    async init() {
        this.resetState();
        
        const urlParams = new URLSearchParams(window.location.search);
        this.state.subjectId = urlParams.get('id');
        this.state.user = JSON.parse(localStorage.getItem('user'));

        if (!this.state.user) {
            window.location.href = '../login';
            return;
        }

        if (!this.state.subjectId) {
            // Show Skeleton
            if (typeof SkeletonUI !== 'undefined') {
                SkeletonUI.render('selectionView', 'quizHub');
                document.getElementById('selectionView').style.display = 'block';
            }
            await this.loadSchedule();
            await this.loadQuizMenu();
        } else {
            document.getElementById('selectionView').style.display = 'none';
            this.updateSubjectSubtitle();
            await this.loadQuestions();
        }
        
        this.setupEventListeners();
    },

    async loadSchedule() {
        try {
            const MASTER_CLASS_ID = 2;
            const USER_CLASS_ID = getEffectiveClassId() || this.state.user.class_id;
            
            // Cek Global Exam
            const { data: masterConfig } = await supabase.from('daily_config').select('mode, kisi_days').eq('class_id', MASTER_CLASS_ID).single();
            const isGlobalExam = (masterConfig && masterConfig.mode === 'exam');
            const TARGET_CLASS_ID = isGlobalExam ? MASTER_CLASS_ID : USER_CLASS_ID;

            if (isGlobalExam && masterConfig.kisi_days) QUIZ_DAYS = masterConfig.kisi_days;
            else {
                const { data: localConfig } = await supabase.from('daily_config').select('kisi_days').eq('class_id', USER_CLASS_ID).single();
                if (localConfig && localConfig.kisi_days) QUIZ_DAYS = localConfig.kisi_days;
            }

            const { data: schedules } = await supabase
                .from('daily_schedules')
                .select('day_name, lessons')
                .eq('class_id', TARGET_CLASS_ID)
                .eq('type', 'exam')
                .in('day_name', QUIZ_DAYS);

            quizScheduleMap = {};
            (schedules || []).forEach(s => {
                quizScheduleMap[s.day_name] = (s.lessons || '').split(';').map(raw => {
                    const name = raw.includes('-') ? raw.substring(raw.lastIndexOf('-') + 1).trim() : raw.trim();
                    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
                }).filter(n => n.length > 1);
            });
        } catch (err) {
            console.error('Gagal ambil jadwal quiz:', err);
        }
    },

    async loadQuizMenu() {
        try {
            const hTitle = document.getElementById('headerTitle');
            if (hTitle) hTitle.innerHTML = `<i class="fa-solid fa-graduation-cap"></i> ${t('exam_simulation')}`;
            
            const classId = getEffectiveClassId() || this.state.user.class_id;
            
            // 1. Ambil semua soal
            const { data: allQ, error: qErr } = await supabase.from('simulation_questions').select('subject_id').or(`class_id.eq.${classId},class_id.eq.0`);
            if (qErr) throw qErr;

            const counts = allQ.reduce((acc, item) => {
                acc[item.subject_id] = (acc[item.subject_id] || 0) + 1;
                return acc;
            }, {});

            const uniqueSubjects = Object.keys(counts);
            if (uniqueSubjects.length === 0) {
                this.showEmptyState();
                return;
            }

            // 2. Ambil progres & config
            const [progRes, confRes] = await Promise.all([
                supabase.from('simulation_progress').select('*').eq('user_id', this.state.user.id),
                supabase.from('subjects_config').select('subject_id, subject_name, icon').in('subject_id', uniqueSubjects)
            ]);

            // Map info biar gampang diakses
            this.state.subjectsInfo = {};
            uniqueSubjects.forEach(id => {
                const conf = (confRes.data || []).find(c => c.subject_id === id);
                const prog = (progRes.data || []).find(p => p.subject_id === id);
                this.state.subjectsInfo[id] = {
                    id,
                    name: conf ? conf.subject_name : (typeof t === 'function' ? t(id) : id),
                    icon: conf ? conf.icon : 'fa-book',
                    qCount: counts[id] || 0,
                    progress: prog
                };
            });

            this.renderDayGroups();

        } catch (err) {
            console.error('Gagal muat menu simulasi:', err);
        }
    },

    renderDayGroups() {
        const selectionView = document.getElementById('selectionView');
        if (!selectionView) return;

        // Jangan hapus header card (kartu pertama)
        const headerCard = selectionView.querySelector('.question-card');
        const headerHTML = headerCard ? headerCard.outerHTML : '';
        
        selectionView.innerHTML = headerHTML;
        selectionView.style.display = 'block';
        
        const dayOrder = this.getDayOrder();
        const subjectsWithProgress = Object.values(this.state.subjectsInfo);
        const assignedIds = new Set();

        dayOrder.forEach(day => {
            const scheduledNorms = quizScheduleMap[day] || [];
            const daySubjects = subjectsWithProgress.filter(s => {
                const isMatch = scheduledNorms.some(norm => s.id.includes(norm) || norm.includes(s.id));
                if (isMatch) assignedIds.add(s.id);
                return isMatch;
            });

            if (daySubjects.length > 0) {
                this.createDaySection(day, daySubjects);
            }
        });

        // Others
        const unassigned = subjectsWithProgress.filter(s => !assignedIds.has(s.id));
        if (unassigned.length > 0) {
            this.createDaySection(t('other'), unassigned, true);
        }
    },

    createDaySection(dayLabel, subjects, isOther = false) {
        const section = document.createElement('div');
        section.className = 'quiz-day-section';
        section.style.marginBottom = '35px';

        const isToday = dayLabel === this.getDayOrder()[0];
        const titleColor = isOther ? '#ffd700' : (isToday ? 'var(--accent)' : 'rgba(255,255,255,0.5)');
        
        section.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:15px;">
                <span style="font-size:14px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase; color:${titleColor};">
                    ${isOther ? dayLabel : (typeof t === 'function' ? t(dayLabel.toLowerCase()) : dayLabel)}
                </span>
                <div style="flex:1; height:1px; background:linear-gradient(to right, ${titleColor}44, transparent);"></div>
            </div>
            <div class="quiz-menu-grid">
                ${subjects.map(s => this.createCardHTML(s)).join('')}
            </div>
        `;
        document.getElementById('selectionView').appendChild(section);
    },

    createCardHTML(s) {
        let badgeClass = 'badge-new';
        let badgeText = 'COBA!';
        
        if (s.progress) {
            if (s.progress.is_completed) {
                badgeClass = 'badge-done';
                badgeText = 'SELESAI';
            } else {
                badgeClass = 'badge-ongoing';
                badgeText = `${s.progress.last_index + 1}/${s.qCount}`;
            }
        }

        return `
            <div class="quiz-menu-card" onclick="window.location.href='quiz?id=${s.id}'">
                <span class="quiz-card-badge ${badgeClass}">${badgeText}</span>
                <i class="fa-solid ${s.icon}"></i>
                <h4>${s.name}</h4>
                <span style="font-size: 14px">${s.qCount} Soal</span>
            </div>
        `;
    },

    getDayOrder() {
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const now = new Date();
        let todayName = dayNames[now.getDay()];
        if (now.getHours() >= 15) {
            const tom = new Date(now);
            tom.setDate(now.getDate() + 1);
            todayName = dayNames[tom.getDay()];
        }
        const idx = QUIZ_DAYS.indexOf(todayName);
        if (idx === -1) return [...QUIZ_DAYS];
        return [...QUIZ_DAYS.slice(idx), ...QUIZ_DAYS.slice(0, idx)];
    },

    handleBack() {
        window.location.href = 'quiz';
    },

    async loadQuestions() {
        try {
            const classId = getEffectiveClassId() || this.state.user.class_id;
            const { data: questions, error: qErr } = await supabase.from('simulation_questions').select('*').eq('subject_id', this.state.subjectId).or(`class_id.eq.${classId},class_id.eq.0`).order('id', { ascending: true });
            if (qErr) throw qErr;
            if (!questions || questions.length === 0) {
                this.showEmptyState();
                return;
            }
            this.state.questions = questions;
            const { data: progress } = await supabase.from('simulation_progress').select('last_index, is_completed').eq('user_id', this.state.user.id).eq('subject_id', this.state.subjectId).maybeSingle();
            if (progress && !progress.is_completed) {
                this.state.currentIndex = Math.min(progress.last_index, questions.length - 1);
                for(let i=0; i < this.state.currentIndex; i++) {
                    this.state.history[i] = [questions[i].answer];
                }
            }
            this.showInfoView();
        } catch (err) {
            console.error('Gagal ambil soal:', err);
        }
    },

    updateSubjectSubtitle() {
        const subtitle = document.getElementById('subjectSubtitle');
        if (!subtitle) return;
        const name = (typeof t === 'function') ? t(this.state.subjectId) : this.state.subjectId;
        subtitle.innerText = `${t('subject_lesson')}: ${name}`;
    },

    showInfoView() {
        const infoV = document.getElementById('infoView');
        const backB = document.getElementById('backBtn');
        if (infoV) infoV.style.display = 'block';
        if (backB) backB.style.display = 'flex';
        const name = (typeof t === 'function') ? t(this.state.subjectId) : this.state.subjectId;
        const infoSub = document.getElementById('infoSubject');
        const infoCount = document.getElementById('infoCount');
        if (infoSub) infoSub.innerText = name;
        if (infoCount) infoCount.innerText = this.state.questions.length;
    },

    startQuiz() {
        document.getElementById('infoView').style.display = 'none';
        document.getElementById('quizView').style.display = 'block';
        this.renderQuestion();
    },

    showEmptyState() {
        const container = this.state.subjectId ? document.getElementById('quizView') : document.getElementById('selectionView');
        if (container) {
            container.style.display = 'block';
            container.innerHTML = `
                <div class="question-card" style="text-align:center; padding:50px;">
                    <i class="fa-solid fa-face-surprise" style="font-size:3rem; color:var(--accent); margin-bottom:15px;"></i>
                    <h3>${t('no_simulation_questions')}</h3>
                    <p style="opacity:0.7;">Admin belum masukin soal buat ${this.state.subjectId ? 'mapel ini' : 'kelas lo'}. Tungguin aja ya! wkwk</p>
                    <button onclick="window.location.href='kisi-kisi'" class="btn-back" style="margin:20px auto;">${t('back_to_topics')}</button>
                </div>
            `;
        }
    },

    renderQuestion() {
        const q = this.state.questions[this.state.currentIndex];
        if (!q) return;
        const chosenIndices = this.state.history[this.state.currentIndex] || [];
        this.state.answeredCorrectly = chosenIndices.includes(q.answer);
        const progressC = document.getElementById('cardProgress');
        const qText = document.getElementById('questionText');
        const pBar = document.getElementById('progressBar');
        if (progressC) progressC.innerText = `SOAL ${this.state.currentIndex + 1}/${this.state.questions.length}`;
        if (qText) qText.innerText = q.question;
        if (pBar) pBar.style.width = `${((this.state.currentIndex) / this.state.questions.length) * 100}%`;
        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) {
            prevBtn.style.opacity = this.state.currentIndex > 0 ? '1' : '0.3';
            prevBtn.style.pointerEvents = this.state.currentIndex > 0 ? 'auto' : 'none';
        }
        const optionsGrid = document.getElementById('optionsGrid');
        if (optionsGrid) {
            optionsGrid.innerHTML = '';
            const prefixes = ['A', 'B', 'C', 'D', 'E'];
            q.options.forEach((opt, index) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                if (chosenIndices.includes(index)) {
                    if (index === q.answer) btn.classList.add('correct');
                    else btn.classList.add('wrong');
                }
                if (this.state.answeredCorrectly && index !== q.answer) {
                    btn.classList.add('disabled');
                }
                btn.innerHTML = `<span class="option-prefix">${prefixes[index]}</span><span class="option-content">${opt}</span>`;
                btn.onclick = () => this.checkAnswer(index, btn);
                optionsGrid.appendChild(btn);
            });
        }
        const expBox = document.getElementById('explanationBox');
        if (expBox) {
            if (this.state.answeredCorrectly && q.explanation) {
                expBox.innerHTML = `<strong>Penjelasan:</strong><br>${q.explanation}`;
                expBox.style.display = 'block';
            } else {
                expBox.style.display = 'none';
            }
        }
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            if (this.state.answeredCorrectly) nextBtn.classList.add('active');
            else nextBtn.classList.remove('active');
        }
        this.renderNavigator();
    },

    renderNavigator() {
        const container = document.getElementById('questionNavigator');
        if (!container) return;
        container.innerHTML = '';
        let maxUnlocked = 0;
        this.state.questions.forEach((q, idx) => {
            const h = this.state.history[idx] || [];
            if (h.includes(q.answer)) maxUnlocked = idx + 1;
        });
        const currentUnlockedLimit = Math.max(maxUnlocked, this.state.currentIndex);
        this.state.questions.forEach((_, index) => {
            const div = document.createElement('div');
            div.className = 'nav-item';
            div.innerText = index + 1;
            const isAnswered = (this.state.history[index] || []).includes(this.state.questions[index].answer);
            if (index === this.state.currentIndex) div.classList.add('active');
            else if (isAnswered) div.classList.add('completed');
            else if (index > currentUnlockedLimit) div.classList.add('locked');
            if (!div.classList.contains('locked')) {
                div.onclick = () => {
                    this.state.currentIndex = index;
                    this.renderQuestion();
                };
            }
            container.appendChild(div);
        });
    },

    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this.renderQuestion();
        }
    },

    checkAnswer(choiceIndex, btn) {
        if (this.state.answeredCorrectly) return;
        const q = this.state.questions[this.state.currentIndex];
        if (!this.state.history[this.state.currentIndex]) this.state.history[this.state.currentIndex] = [];
        if (!this.state.history[this.state.currentIndex].includes(choiceIndex)) this.state.history[this.state.currentIndex].push(choiceIndex);
        const isCorrect = choiceIndex === q.answer;
        if (isCorrect) {
            this.state.answeredCorrectly = true;
            btn.classList.add('correct');
            document.querySelectorAll('.option-btn').forEach(b => { if (b !== btn) b.classList.add('disabled'); });
            const expBox = document.getElementById('explanationBox');
            if (q.explanation && expBox) {
                expBox.innerHTML = `<strong>Penjelasan:</strong><br>${q.explanation}`;
                expBox.style.display = 'block';
            }
            const nextBtn = document.getElementById('nextBtn');
            if (nextBtn) nextBtn.classList.add('active');
        } else {
            btn.classList.add('wrong');
            btn.style.pointerEvents = 'none';
        }
    },

    async syncProgress(completed = false) {
        if (!this.state.user || !this.state.subjectId) return;
        try {
            await supabase.from('simulation_progress').upsert({
                user_id: this.state.user.id,
                subject_id: this.state.subjectId,
                last_index: this.state.currentIndex,
                total_questions: this.state.questions.length,
                is_completed: completed,
                updated_at: new Date().toISOString()
            });
        } catch (err) {
            console.warn('Tracking progress failed:', err);
        }
    },

    nextQuestion() {
        if (!this.state.answeredCorrectly) return;
        this.syncProgress();
        this.state.currentIndex++;
        if (this.state.currentIndex < this.state.questions.length) this.renderQuestion();
        else this.showResult();
    },

    showResult() {
        const pBar = document.getElementById('progressBar');
        const qView = document.getElementById('quizView');
        const rView = document.getElementById('resultView');
        if (pBar) pBar.style.width = '100%';
        if (qView) qView.style.display = 'none';
        if (rView) rView.style.display = 'block';
        this.syncProgress(true);
        if (typeof logActivity === 'function') logActivity(`Menyelesaikan Simulasi: ${this.state.subjectId}`, "Simulasi", 15, this.state.subjectId);
    },

    setupEventListeners() {
        const nextBtn = document.getElementById('nextBtn');
        const backBtn = document.getElementById('backBtn');
        const startBtn = document.getElementById('startBtn');
        const prevBtn = document.getElementById('prevBtn');
        if (nextBtn) nextBtn.onclick = () => this.nextQuestion();
        if (backBtn) backBtn.onclick = () => this.handleBack();
        if (startBtn) startBtn.onclick = () => this.startQuiz();
        if (prevBtn) prevBtn.onclick = () => this.prevQuestion();
    }
};

document.addEventListener('DOMContentLoaded', () => QuizApp.init());