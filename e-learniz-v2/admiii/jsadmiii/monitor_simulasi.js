// ============================================================
// monitor_simulasi.js — Admin Monitoring Logic
// Displays real-time progress of students in simulations.
// ============================================================

const MonitorSim = {
    state: {
        progressData: [],
        subjects: [],
        subscription: null
    },

    async init() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || (user.role !== 'class_admin' && user.role !== 'super_admin')) {
            window.location.href = '../login';
            return;
        }

        // 1. Pasang listener duluan biar responsif
        this.setupEventListeners();

        // 2. Sinkronin sama Effective Class (kalo ada)
        if (typeof getEffectiveClassId === 'function') {
            const effClass = getEffectiveClassId();
            if (effClass) {
                document.getElementById('filterClass').value = effClass;
            }
        }

        await this.loadSubjects();
        await this.loadData();
        this.setupRealtime();

        // Auto refresh UI status tiap menit (buat deteksi STOPPED)
        setInterval(() => {
            this.renderTable();
        }, 60000);
    },

    setupRealtime() {
        if (this.state.subscription) {
            supabase.removeChannel(this.state.subscription);
        }

        const channel = supabase
            .channel('realtime-simulasi')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'simulation_progress' 
            }, () => {
                this.loadData();
            })
            .subscribe();
            
        this.state.subscription = channel;
    },

    async loadSubjects() {
        try {
            const { data, error } = await supabase
                .from('subjects_config')
                .select('subject_id, subject_name')
                .order('subject_name', { ascending: true });

            if (error) throw error;
            this.state.subjects = data || [];

            const filterSel = document.getElementById('filterSubject');
            let html = '<option value="all">' + t('all_subjects') + '</option>';
            data.forEach(s => {
                html += `<option value="${s.subject_id}">${s.subject_name}</option>`;
            });
            filterSel.innerHTML = html;
        } catch (err) {
            console.error('Load subjects failed:', err);
        }
    },

    async loadData() {
        const tbody = document.getElementById('monitorBody');
        // Tampilkan loading kalo data lagi kosong
        if (tbody && this.state.progressData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:50px; opacity:0.5;"><i class="fa-solid fa-spinner fa-spin"></i> ' + t('loading_data') + '</td></tr>';
        }

        try {
            const classFilter = document.getElementById('filterClass').value;
            const subjectFilter = document.getElementById('filterSubject').value;

            // Fetch progress joined with user details
            let query = supabase
                .from('simulation_progress')
                .select(`
                    *,
                    users (full_name, class_id)
                `)
                .order('updated_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            // Manual filtering
            let filtered = data || [];
            if (classFilter !== 'all') {
                filtered = filtered.filter(p => p.users && p.users.class_id == classFilter);
            }
            if (subjectFilter !== 'all') {
                filtered = filtered.filter(p => p.subject_id === subjectFilter);
            }

            this.state.progressData = filtered;
            this.updateStats();
            this.renderTable();
        } catch (err) {
            console.error('Load monitor data failed:', err);
            showPopup(t('failed_load_data'), 'error');
        }
    },

    updateStats() {
        const total = this.state.progressData.length;
        const now = new Date();
        
        const completed = this.state.progressData.filter(p => p.is_completed).length;
        
        // Ongoing = Yang belum beres DAN aktif (update < 5 menit)
        const ongoing = this.state.progressData.filter(p => {
            if (p.is_completed) return false;
            const diff = (now - new Date(p.updated_at)) / 1000 / 60;
            return diff < 5;
        }).length;

        document.getElementById('statTotalUsers').innerText = total;
        document.getElementById('statCompleted').innerText = completed;
        document.getElementById('statOngoing').innerText = ongoing;
    },

    renderTable() {
        const tbody = document.getElementById('monitorBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        const now = new Date();

        if (this.state.progressData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:50px; opacity:0.5;">' + t('no_activity_log') + '</td></tr>';
            return;
        }

        this.state.progressData.forEach(p => {
            const subject = this.state.subjects.find(s => s.subject_id === p.subject_id);
            const subjectName = subject ? subject.subject_name : p.subject_id;
            
            // Hitung Status
            let statusText = t('status_ongoing');
            let statusClass = 'status-ongoing';

            if (p.is_completed) {
                statusText = t('status_completed');
                statusClass = 'status-completed';
            } else {
                const diffMinutes = (now - new Date(p.updated_at)) / 1000 / 60;
                if (diffMinutes >= 5) {
                    statusText = t('status_stopped');
                    statusClass = 'status-stopped';
                }
            }

            const displayProgress = p.is_completed 
                ? `${p.total_questions} / ${p.total_questions}`
                : `${Math.min(p.last_index + 1, p.total_questions)} / ${p.total_questions}`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:700;">${p.users?.full_name || t('unknown')}</td>
                <td><span class="badge-subject" style="background:rgba(255,255,255,0.05); color:white; border-color:rgba(255,255,255,0.1);">${t('class')} ${p.users?.class_id || '?'}</span></td>
                <td>${subjectName}</td>
                <td>
                    <span class="progress-pill">${displayProgress}</span>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td style="font-size:0.8rem; opacity:0.6;">${this.formatRelativeTime(p.updated_at)}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    formatRelativeTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return t('just_now');
        if (diffInSeconds < 3600) return t('minutes_ago', { n: Math.floor(diffInSeconds / 60) });
        if (diffInSeconds < 86400) return t('hours_ago', { n: Math.floor(diffInSeconds / 3600) });
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    },

    setupEventListeners() {
        const filterClass = document.getElementById('filterClass');
        const filterSubject = document.getElementById('filterSubject');
        
        if (filterClass) filterClass.onchange = () => this.loadData();
        if (filterSubject) filterSubject.onchange = () => this.loadData();
    }
};

document.addEventListener('DOMContentLoaded', () => MonitorSim.init());