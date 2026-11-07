// ============================================================
// inputsoal.js — Admin Question Management
// Handles CRUD for simulation questions.
// ============================================================

const AdminSoal = {
    state: {
        questions: [],
        subjects: [],
        isEditing: false
    },

    async init() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || (user.role !== 'class_admin' && user.role !== 'super_admin')) {
            window.location.href = '../login';
            return;
        }

        await this.loadSubjects();
        await this.loadQuestions();
        this.setupEventListeners();
    },

    async loadSubjects() {
        try {
            const { data, error } = await supabase
                .from('subjects_config')
                .select('subject_id, subject_name')
                .eq('menu_group', 'lessons')
                .order('display_order', { ascending: true });

            if (error) throw error;
            this.state.subjects = data || [];

            const inputSel = document.getElementById('inputSubject');
            const filterSel = document.getElementById('filterSubject');

            let html = '';
            data.forEach(s => {
                html += `<option value="${s.subject_id}">${s.subject_name}</option>`;
            });

            inputSel.innerHTML = html;
            filterSel.innerHTML = '<option value="all">' + t('all_subjects') + '</option>' + html;
        } catch (err) {
            console.error('Load subjects failed:', err);
        }
    },

    async loadQuestions() {
        try {
            const filter = document.getElementById('filterSubject').value;
            let query = supabase.from('simulation_questions').select('*').order('created_at', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('subject_id', filter);
            }

            const { data, error } = await query;
            if (error) throw error;

            this.state.questions = data || [];
            this.renderQuestions();
        } catch (err) {
            console.error('Load questions failed:', err);
        }
    },

    renderQuestions() {
        const container = document.getElementById('questionsList');
        const countInfo = document.getElementById('countInfo');
        container.innerHTML = '';

        if (this.state.questions.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 20px; opacity: 0.5;">' + t('no_questions') + '</p>';
            countInfo.innerText = t('questions_found', { n: 0 });
            return;
        }

        countInfo.innerText = t('questions_found', { n: this.state.questions.length });

        this.state.questions.forEach(q => {
            const subject = this.state.subjects.find(s => s.subject_id === q.subject_id);
            const subjectName = subject ? subject.subject_name : q.subject_id;

            const div = document.createElement('div');
            div.className = 'q-item';
            div.innerHTML = `
                <div class="q-content">
                    <div class="q-text">${q.question}</div>
                    <div class="q-meta">
                        <span class="badge-subject">${subjectName}</span>
                        <span> • ${q.class_id === 0 ? t('all_classes_global') : (q.class_id === 2 ? t('master_class') : t('class') + ' 10')}</span>
                        <span> • ${t('n_choices', { n: q.options.length })}</span>
                    </div>
                </div>
                <div class="q-actions">
                    <button class="btn-action btn-edit" onclick="AdminSoal.editSoal(${q.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="AdminSoal.deleteSoal(${q.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    },

    async saveSoal() {
        const id = document.getElementById('editId').value;
        const subject_id = document.getElementById('inputSubject').value;
        const class_id = parseInt(document.getElementById('inputClass').value);
        const question = document.getElementById('inputQuestion').value;
        const explanation = document.getElementById('inputExplanation').value;
        const answer = parseInt(document.querySelector('input[name="correctAnswer"]:checked').value);
        
        const optionInputs = document.querySelectorAll('.option-input');
        const options = Array.from(optionInputs).map(input => input.value.trim()).filter(Boolean);

        if (!question || options.length < 2) {
            showPopup(t('question_min_required'), 'error');
            return;
        }

        const btn = document.getElementById('btnSave');
        btn.innerText = t('loading');
        btn.disabled = true;

        const payload = { subject_id, class_id, question, options, answer, explanation };

        try {
            let res;
            if (id) {
                res = await supabase.from('simulation_questions').update(payload).eq('id', id);
            } else {
                res = await supabase.from('simulation_questions').insert([payload]);
            }

            if (res.error) throw res.error;

            showToast(t('question_saved'), 'success');
            this.resetForm();
            await this.loadQuestions();
        } catch (err) {
            console.error('Save failed:', err);
            showPopup(t('failed_save_question'), 'error');
        } finally {
            btn.innerText = t('save_question');
            btn.disabled = false;
        }
    },

    editSoal(id) {
        const q = this.state.questions.find(item => item.id === id);
        if (!q) return;

        this.state.isEditing = true;
        document.getElementById('formTitle').innerText = t('edit_question');
        document.getElementById('editId').value = q.id;
        document.getElementById('inputSubject').value = q.subject_id;
        document.getElementById('inputClass').value = q.class_id;
        document.getElementById('inputQuestion').value = q.question;
        document.getElementById('inputExplanation').value = q.explanation || '';
        
        const optionInputs = document.querySelectorAll('.option-input');
        optionInputs.forEach((input, index) => {
            input.value = q.options[index] || '';
        });

        const radios = document.querySelectorAll('input[name="correctAnswer"]');
        radios[q.answer].checked = true;

        document.getElementById('btnCancel').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async deleteSoal(id) {
        if (!await showPopup(t('confirm_delete_question'), 'confirm')) return;

        try {
            const { error } = await supabase.from('simulation_questions').delete().eq('id', id);
            if (error) throw error;

            showToast(t('question_deleted'), 'success');
            await this.loadQuestions();
        } catch (err) {
            console.error('Delete failed:', err);
            showPopup(t('failed_delete_question'), 'error');
        }
    },

    resetForm() {
        this.state.isEditing = false;
        document.getElementById('formTitle').innerText = t('add_new_question');
        document.getElementById('editId').value = '';
        document.getElementById('inputQuestion').value = '';
        document.getElementById('inputExplanation').value = '';
        document.querySelectorAll('.option-input').forEach(input => input.value = '');
        document.querySelectorAll('input[name="correctAnswer"]')[0].checked = true;
        document.getElementById('btnCancel').style.display = 'none';
    },

    setupEventListeners() {
        document.getElementById('btnSave').onclick = () => this.saveSoal();
        document.getElementById('btnCancel').onclick = () => this.resetForm();
        document.getElementById('filterSubject').onchange = () => this.loadQuestions();
    }
};

document.addEventListener('DOMContentLoaded', () => AdminSoal.init());