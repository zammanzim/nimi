/**
 * E-LEARNIZ i18n SYSTEM
 * Handling multi-language without blinking.
 */

const i18n = {
    current: localStorage.getItem('app_lang') || 'id',

    // Kamus Utama
    data: {
        id: {
            "app_name": "E-Learning Nizam",
            "save": "Simpan",
            "cancel": "Batal",
            "delete": "Hapus",
            "close": "Tutup",
            "loading": "Memuat...",
            "welcome": "Haii, {name}!",
            "theme_title": "Personalisasi Tema",
            "lang_select": "Pilih Bahasa",
            "lang_id": "Bahasa Indonesia",
            "lang_en": "English",
            "lang_su": "Basa Sunda",
            "bg_title": "Background",
            "accent_title": "Warna Aksen",
            "text_size": "Ukuran Teks",
            "save_apply": "SIMPAN & TERAPKAN",
            "reset_default": "Reset ke tampilan default",
            "upload_photo": "Upload Foto",
            "own_photo": "Foto sendiri",
            "success_save": "Tema berhasil disimpan!",
            "error_upload": "Gagal upload foto",
            "login_first": "Login dulu miz!",
            "confirm_delete_item": "Hapus <b>{name}</b> secara permanen?",
            "materi_title": "Materi & Pengumuman",
            "tasks_list": "Daftar Tugas",
            "kisi_format": "Kisi - Kisi {subject}",
            "other": "Lainnya",
            "refresh": "Segarkan",
            "all": "Semua",

            // Sidebar Groups
            "sidebar_system": "Menu Sistem",
            "sidebar_admin": "Panel Admin",
            "sidebar_main": "Menu Utama",
            "sidebar_lessons": "Mata Pelajaran",
            "sidebar_custom": "Menu Lainnya",
            "sidebar_Web Siswa": "Web Siswa",

            // Sidebar Items (by subject_id)
            "announcements": "Pengumuman",
            "tugas": "Daftar Tugas",
            "kisi-kisi": "Kisi-Kisi",
            "search": "Cari Akun",
            "theme": "Tema",
            "settingacc": "Pengaturan Akun",
            "user": "Profil",
            "send": "Kirim File",
            "forum": "Forum Diskusi",
            "test-scores?id=psasi": "Nilai PSASI",
            "test-scores?id=psts": "Nilai PSTS",
            "updates": "Update Patch",
            "class-profile-v2.html": "Profil Kelas v2",
            "bahasaindonesia": "B. Indonesia",
            "bahasainggris": "B. Inggris",
            "bahasasunda": "B. Sunda",
            "bahasajepang": "B. Jepang",
            "matematika": "Matematika",
            "proipas": "Proipas",
            "pabp": "PABP",
            "pp": "PP",
            "senibudaya": "Seni Budaya",
            "sejarah": "Sejarah",
            "pjok": "PJOK",
            "bk": "BK",
            "informatika": "Informatika",
            "dpr1": "DASPROGRPL 1",
            "dpr2": "DASPROGRPL 2",
            "dpr3": "DASPROGRPL 3",
            "dasprogrpl1": "DASPROGRPL 1",
            "dasprogrpl2": "DASPROGRPL 2",
            "dasprogrpl3": "DASPROGRPL 3",

            // Days (Indonesia Keys for logic)
            "minggu": "Minggu",
            "senin": "Senin",
            "selasa": "Selasa",
            "rabu": "Rabu",
            "kamis": "Kamis",
            "jumat": "Jumat",
            "sabtu": "Sabtu",

            // Months
            "january": "Januari",
            "february": "Februari",
            "march": "Maret",
            "april": "April",
            "may": "Mei",
            "june": "Juni",
            "july": "Juli",
            "august": "Agustus",
            "september": "September",
            "october": "Oktober",
            "november": "November",
            "december": "Desember",

            // Announcements
            "announcements3": "Pengumuman dan Jadwal",
            "home": "Beranda",

            // Kisi-kisi
            "exam_topics": "Kisi-Kisi",
            "choose_lesson": "Pilih Pelajaran",
            "all_lessons": "Semua Pelajaran",
            "no_kisi": "Belum ada kisi-kisi untuk hari ini",

            // Materi Susulan
            "susulan": "Materi Susulan",
            "no_susulan": "Belum ada materi susulan",
            "choose_day": "Pilih Hari",
            "choose_date": "Pilih Tanggal",
            "susulan_subject": "Mata Pelajaran",
            "susulan_page": "Halaman Materi Susulan — materi pelajaran yang terlewat, dibagi per tanggal",
            "susulan_manage_dates": "Kelola Tanggal",
            "susulan_date_hint": "Tambahin tanggal buat kelompok materi. Contoh: 2026-08-01 = Senin, 1 Agustus. Bisa nambah minggu depan juga.",
            "susulan_no_dates": "Belum ada tanggal. Tambahin dulu di atas.",
            "susulan_no_date": "Tanpa Tanggal",
            "susulan_add_date_first": "Tambahin tanggal dulu di panel kiri sebelum posting materi.",
            "susulan_confirm_delete_date": "Hapus tanggal {date}? Materi di tanggal ini bakal jadi \"Tanpa Tanggal\".",
            "susulan_date_deleted": "Tanggal dihapus",
            "susulan_date_added": "Tanggal ditambahkan",
            "susulan_date_exists": "Tanggal sudah ada",
            "susulan_invalid_date": "Pilih tanggal yang valid",

            // Code Block
            "copy_code": "Salin Kode",
            "copied": "Tersalin!",

            // daily-card.js
            "edit_schedule": "Edit jadwal",
            "activate_mode": "Mode jadwal",
            "main_sch": "Jadwal Utama",
            "exam_sch": "Mode Ulangan",
            "custom_sch": "Custom Event",
            "auto_upd": "Auto Update di Jam 15:00",
            "sch_kisi": "Hari di Kisi-kisi",
            "edit_day": "Edit Hari",
            "special_event": "Event Spesial",
            "tomorrow": "Besok",
            "today": "Hari Ini",
            "exam": "Ujian",
            "task": "Tugas",
            "tasks_pending": "Yang Belum Selesai",
            "tasks_all": "Semua Tugas",
            "view_day": "Melihat jadwal hari {day}",
            "data_saved": "Data Tersimpan",
            "failed_save": "Gagal Menyimpan",
            "uniform": "Seragam",
            "activity": "Kegiatan",
            "notes": "Catatan",
            "lesson_sch": "Jadwal Pelajaran",
            "cleaning_duty": "Petugas Piket",
            "add_row": "Tambah Baris",
            "add_people": "Tambah Orang",

            // headerpp
            "hi": "Haii",
            "class": "Kelas",
            "announcements2": "Pengumuman",
            "edit_prof": "Edit Profil",
            "theme2": "Personalisasi",
            "visitor": "Pengunjung",
            "resetvist": "Reset Pengunjung",

            // modal
            "new_material": "Materi Baru",
            "send2page": "Kirim ke Halaman",
            "markasassign": "Tandai sebagai Tugas",
            "title": "Judul",
            "subtitle": "Sub-judul",
            "large": "Besar",
            "medium": "Sedang",
            "small": "Kecil",
            "footer": "Kaki (Footer)",
            "card_color": "Warna Kartu",
            "uploadphotos": "<b>Klik untuk upload</b> atau tarik file ke sini",
            "download_file": "Download file",
            "attachments": "Lampiran",

            // detailOverlay
            "see_desc": "Lihat Deskripsi",

            // forum
            "post_discussion": "Mulai Diskusi",
            "what_discussion": "Apa yang mau kamu bahas?",

            //tugas
            "task_list": "Daftar Tugas",
            "complete_status": "Status Penyelesaian",
            "small_text": "Pencet tombol 'Selesai?' agar tugas tertanda selesai dan tersortir rapi",
            youvedone: "Kamu sudah ngerjain {done} dari {total} tugas",
            "not_finish": "Yang Belum Selesai",
            "all_tasks": "Semua Tugas",
            "markasdone": "Tandai Selesai",
            "done": "Selesai",
            "archived":"Diarsipkan",

            // login.html
            "select_class": "Pilih Kelas",
            "select_name": "Pilih Nama Kamu",
            "secure_mode": "Secure Mode",
            "direct_mode": "Direct Mode",
            "guest_expiry": "Data tamu otomatis hilang",
            "search_name_placeholder": "Cari nama kamu...",
            "select_class_first": "Pilih Kelas Terlebih Dahulu",
            "central_access": "Akses Kendali Pusat",
            "loading_class_list": "Memuat daftar kelas...",
            "failed_load_class": "Gagal Memuat Kelas!",
            "loading_data": "Memuat data...",
            "no_teacher_registered": "Belum ada guru terdaftar.",
            "student_not_found": "Data siswa tidak ditemukan di kelas ini.",
            "failed_load_data": "Gagal Memuat Data!",
            "select_teacher": "Pilih Guru",

            // index.html
            "no_info": "Belum ada informasi.",
            "add_info": "Tambah Informasi",

            // a/kirim-tugas.html
            "page_title_tugas": "Kirim Tugas • E-Learning Nizam",
            "task_collection": "Pengumpulan Tugas",
            "mandatory_task": "Tugas Wajib Dikumpul",
            "send_task": "Kirim Tugas",
            "select_task_optional": "— Pilih Tugas (opsional) —",
            "select_teacher_option": "— Pilih Guru —",
            "upload_file": "Upload File",
            "task_link": "Link Tugas",
            "btn_send": "Kirim",
            "no_mandatory_task": "Belum ada tugas wajib kumpul",
            "no_task_option": "— Belum ada tugas —",
            "not_logged_in": "Belum login!",
            "select_teacher_first": "Pilih guru pengajar dulu!",
            "upload_or_link_required": "Upload file atau isi link tugas!",
            "task_sent_success": "Tugas berhasil dikirim!",
            "send_again": "Kirim Lagi",
            "no_submissions": "Belum ada yang ngumpulin tugas",
            "failed_load_task": "Gagal memuat tugas",

            // a/subject.html
            "not_set": "Belum diatur",
            "total_material": "Total Materi",
            "material_not_found": "Materi tidak ditemukan.",
            "teacher_data_saved": "Data guru berhasil disimpan",

            // a/user.html
            "task_progress": "Progress Tugas",
            "loading_task_progress": "Memuat progress tugas...",
            "today_schedule": "Jadwal Hari Ini",
            "view_full_schedule": "Lihat Full Jadwal",
            "post_photo": "Posting Foto",
            "select_photo_video": "Pilih foto atau video",
            "delete_post": "Hapus Post",

            // a/scores.html
            "exam_scores": "Nilai Ujian",
            "view_all_subjects": "Lihat Semua Mapel",
            "select_subject_hide": "Pilih mapel yang ingin DISEMBUNYIKAN",
            "upload_original_file": "Upload file asli (PDF/gambar)",
            "select": "Pilih",
            "class_scores": "Nilai Kelas",
            "select_file_first": "Pilih file dulu",
            "no_file_upload": "Belum ada file. Upload file asli...",
            "confirm_delete_file": "Hapus file ini?",

            // a/theme.html
            "select_preset": "Pilih Preset",
            "accent_desc": "Warna tombol, link, dan highlight",
            "default": "Default",
            "custom": "Custom",
            "uploading": "Uploading...",
            "photo_uploaded": "Foto berhasil diupload!",

            // a/send.html
            "send_file": "Kirim File",
            "all_formats_max": "Semua format file didukung. Maks 40 MB",
            "send_n_file": "Kirim {n} File",
            "pending": "Menunggu",
            "sent_success": "✓ Terkirim",
            "send_failed": "✗ Gagal",
            "uploading_text": "Mengupload...",

            // a/keaktifan.html
            "all_time": "All Time",
            "select_student_activity": "Pilih siswa untuk melihat jejak aktivitasnya.",
            "edit_excluded": "Edit Excluded",
            "no_activity_log": "Belum ada jejak aktivitas tercatat.",

            // a/quiz.html
            "exam_simulation": "Simulasi Ujian",
            "simulation_questions_title": "Soal Simulasi Ujian",
            "not_attempted": "Belum Dicoba",
            "already_completed": "Sudah Selesai",
            "loading_questions": "Loading pertanyaan...",
            "simulation_complete": "Simulasi Selesai!",

            // a/forum.html
            "add_comment_placeholder": "Tambah komentar...",

            // a/updates.html
            "update_desc": "Catatan perubahan & fitur baru",
            "total_update": "Total Update",
            "add_update": "Tambah Update",
            "new_update": "Update Baru",
            "update_title_placeholder": "Judul update (cth: Update 31 Maret)",
            "no_update_recorded": "Belum ada update yang dicatat.",
            "update_posted": "Update berhasil dipost!",
            "confirm_delete_update": "Hapus update ini?",
            "update_deleted": "Update dihapus",

            // a/settingacc.html
            "profile_updated": "Profil Berhasil Diupdate!",
            "account_data": "Data Akun",
            "profile_photo": "Foto Profil",
            "change_photo": "Ganti Foto",
            "role_status": "Role / Status",
            "user_not_found": "Pengguna tidak ditemukan.",
            "full_name": "Nama Lengkap",
            "nickname_display": "Nama Panggilan (Tampilan)",
            "bio": "Bio",
            "privacy": "Privasi",
            "private_account": "Akun Privat",
            "privacy_desc": "Postinganmu tidak akan muncul di Feed orang lain",
            "username_label": "Username",
            "password_label": "Password",
            "username_placeholder": "Buat username unik",
            "password_placeholder": "Buat password",
            "change_photo_note": "*kamu bisa ganti foto langsung lewat sini tanpa harus chat admin lewat wa",
            "admin_edit_note": "Hanya admin yang bisa mengedit data diatas! Merasa ada yang salah? Hubungi admin",
            "account_login": "Akun Login",
            "warning_set_credentials": "Buat username dan password buat akunmu! Biar ga bisa di login in orang lain.",
            "save_changes": "SIMPAN PERUBAHAN",
            "saving": "MENYIMPAN...",
            "warning_credentials_required": "⚠️ Username dan Password harus diisi!",
            "nickname_placeholder": "Mau dipanggil apa?",
            "bio_placeholder": "Bio nya donk",

            // admiii/tugas-masuk.html
            "incoming_tasks": "Tugas Masuk",
            "all_teachers": "Semua Guru",
            "all_time_filter": "Semua Waktu",
            "no_submissions_data": "Belum ada tugas masuk",
            "today_filter": "Hari Ini",
            "this_week": "Minggu Ini",
            "this_month": "Bulan Ini",
            "view_file": "Lihat File",
            "open_link": "Buka Link",
            "task_no_title": "Tugas tanpa judul",
            "failed_open_file": "Gagal buka file",

            // admiii/progress-tugas.html
            "total_tasks": "Total Tugas",
            "class_progress": "Progress Kelas",
            "per_task": "Per Tugas",
            "archive_all_tasks": "Arsipkan SEMUA Tugas",
            "search_title_subject": "Cari judul / mapel...",
            "search_student_name": "Cari nama siswa...",
            "search_placeholder": "🔍 Cari...",
            "complete_all": "Selesaikan Semua",
            "reset": "Reset",
            "no_tasks": "Belum ada tugas.",
            "all_tasks_archived": "Semua tugas sudah diarsipkan.",
            "all_active_completed": "Semua tugas aktif diselesaikan!",
            "reset_student_progress": "Reset: hapus semua progress siswa ini",
            "all_students_complete_reset": "Semua siswa selesai — progress dihapus",
            "archive_all": "Arsipkan Semua",
            "task_archived": "Tugas diarsipkan!",
            "task_unarchived": "Tugas di-unarsip.",
            "confirm_archive_all": "Arsipkan SEMUA ... tugas aktif?",
            "progress_tasks": "Progress Tugas",
            "student": "Siswa",
            "students": "Siswa",
            "average": "Rata-rata",
            "completed_100": "100% Selesai",
            "per_student": "Per Orang",
            "newest_first": "Terbaru dulu",
            "most_completed": "Paling banyak selesai ↓",
            "least_completed": "Paling sedikit selesai ↑",
            "a_z_title": "A–Z Judul",
            "a_z_name": "A–Z Nama",
            "progress_desc": "Progress ↓",
            "progress_asc": "Progress ↑",
            "archived_label": "DIARSIPKAN",
            "unarchive": "Un-arsip",
            "archiving": "Mengarsipkan...",
            "task_archived_progress": "Tugas diarsipkan! Progress dihapus dari DB 🎉",
            "task_unarchived_detail": "Tugas di-unarsip. Siswa perlu centang ulang.",
            "tasks_archived_count": "{n} tugas berhasil diarsipkan! 🎉",
            "progress_reset": "Progress direset.",
            "no_task_found": "Tidak ada tugas ditemukan.",
            "no_student_found": "Tidak ada siswa ditemukan.",
            "no_name": "Tanpa Nama",
            "done_slash_total": "{done}/{total} selesai",
            "all_students_complete": "Semua siswa selesai — progress dihapus dari DB",
            "failed_update": "Gagal update",

            // admiii/send_notice.html
            "select_color_type": "Pilih Warna / Tipe",
            "notice_text_color": "Warna Text Notice",
            "target_class": "Target Kelas",
            "all_classes_global": "Semua Kelas (Global)",
            "send_notice": "Kirim Notice",
            "cancel_edit": "Batal Edit",
            "no_notice_history": "Belum ada riwayat notice.",
            "global_label": "Global",
            "edit_notice": "Edit Notice",
            "save_changes_notice": "Simpan Perubahan",
            "confirm_delete_notice": "Hapus notice ini dari riwayat?",

            // admiii/menu.html
            "menu_manager": "Menu Manager",
            "add_menu": "Tambah Menu",
            "edit_menu": "Edit Menu",
            "menu_group": "Grup Menu",
            "menu_name": "Nama Menu",
            "select_from_file": "Pilih dari file yang ada",
            "select_icon": "Pilih ikon",
            "update_badge": "Update",
            "add_edit_group": "Tambah / Edit Grup",
            "main_menu_type": "Main Menu",
            "additional_menu": "Menu Tambahan",
            "admin_panel_type": "Admin Panel",
            "save_group": "Simpan Grup",
            "menu_structure": "Struktur Menu",
            "select_icon_modal": "Pilih Ikon",
            "search_icon_placeholder": "Cari ikon... (misal: book, math, code)",
            "select_file_page_modal": "Pilih File / Halaman",
            "search_page_placeholder": "Cari halaman...",
            "lesson_category": "Pelajaran:",
            "admin_system_category": "Admin & Sistem",
            "edit_cancelled": "Edit dibatalkan",
            "confirm_delete_group": "Hapus grup {name}?",
            "select_class_error": "Pilih kelas!",
            "menu_name_class_required": "Kelas dan nama menu wajib diisi!",
            "select_group_first": "Pilih atau buat grup menu terlebih dahulu!",
            "updated_success": "Berhasil diupdate!",
            "menu_added": "Menu ditambahkan!",
            "menu_deleted": "Menu dihapus!",
            "data_incomplete": "Data belum lengkap!",
            "this_material": "materi ini",
            "system_menu_global": "SYSTEM MENU (GLOBAL)",

            // admiii/bottom-nav.html
            "add_item": "Tambah Item",
            "custom_manual": "Custom / manual",
            "add": "Tambah",
            "remove_from_bottom_nav": "Hapus dari Bottom Nav",

            // admiii/files.html
            "all_files": "Semua File",
            "no_files": "Belum ada file masuk.",
            "download_all": "Download Semua",
            "delete_all": "Hapus semua",
            "confirm_download_group": "Download {n} file dari {name}?",
            "confirm_delete_file_group": "Hapus semua {n} file dari {name}?",
            "confirm_delete_file_single": "Hapus file ini tanpa download?",
            "confirm_download_file": "Download {name}?",

            // admiii/inputsoal.html
            "add_new_question": "Tambah Soal Baru",
            "subject_lesson": "Mata Pelajaran",
            "answer_choices": "Pilihan Jawaban (Centang yang benar)",
            "choice_a": "Pilihan A",
            "choice_b": "Pilihan B",
            "choice_c": "Pilihan C",
            "choice_d": "Pilihan D",
            "save_question": "Simpan Soal",
            "all_subjects": "Semua Mapel",
            "no_questions": "Belum ada soal.",
            "confirm_delete_question": "Hapus soal ini?",
            "edit_question": "Edit Soal",
            "failed_delete_question": "Gagal menghapus soal.",
            "failed_save_question": "Gagal menyimpan soal.",
            "master_class": "Master Class",
            "question_deleted": "Soal dihapus!",
            "question_min_required": "Pertanyaan dan minimal 2 pilihan wajib diisi!",
            "question_saved": "Soal berhasil disimpan!",
            "questions_found": "{n} Soal ditemukan",
            "n_choices": "{n} Pilihan",

            // admiii/control.html
            "search_user_placeholder": "Cari nama, nickname, atau role...",
            "last_activity": "Last Activity",
            "confirm_delete_user": "Hapus user ini secara permanen?",

            // admiii/visitor.html
            "search_user": "Cari User",
            "active": "Active",
            "browsing": "Muter-muter",
            "guest": "Guest",
            "leaving": "Leaving...",
            "logs_found": "{n} Ditemukan",
            "no_logs_match_filter": "Tidak ada data log yang sesuai filter.",
            "no_one_online": "Tidak ada yang online.",
            "online_count": "{n} Online",
            "visitors_today": "{n} Hari Ini",

            // admiii/monitor_nilai.html
            "class_average": "Rata-rata Kelas",
            "student_name": "Nama Siswa",
            "status_label": "Status",

            // admiii/nilai-psts.html
            "select_student_fill_score": "Pilih nickname siswa, isi nilai, lalu simpan.",
            "select_student": "Pilih Siswa",
            "select_student_nickname": "Pilih Siswa (Nickname)",
            "input_subject_score": "Input Nilai Mata Pelajaran",
            "select_student_first_alert": "Pilih nama siswa dulu!",
            "failed_save_label": "Gagal simpan: ",
            "saved_success_for": "Berhasil disimpan untuk {name}!",

            // admiii/monitor_simulasi.html
            "simulation_hub": "Hub Simulasi Ujian",
            "hours_ago": "{n}j lalu",
            "just_now": "Baru saja",
            "minutes_ago": "{n}m lalu",
            "status_completed": "SELESAI",
            "status_ongoing": "ONGOING",
            "status_stopped": "STOPPED",
            "unknown": "Unknown",

            // admiii/cleanup-storage.html
            "delete_selected_files": "Hapus File yang Terpilih",
            "deleted_success": "Berhasil dihapus!",

            // admiii/csv-sql.html
            "upload_csv": "Upload File CSV",
            "upload_csv_first": "Upload file CSV dulu!",

            // js/ui-components.js
            "view_schedule": "Lihat Jadwal",
            "save_schedule": "Simpan Jadwal",
            "edit_material": "Edit",
            "change_color": "Ganti Warna",
            "add_new": "Tambah Baru",

            // js/subject-manager.js
            "collect_task": "Kumpulin Tugas",
            "add_link": "Tambah tautan",
            "all_changes_saved": "Semua perubahan tersimpan!",
            "failed_save_data": "Gagal simpan data!",
            "confirm_delete_photo": "Hapus foto ini?",
            "photo_deleted_cloud": "Foto dihapus dari cloud!",
            "failed_delete_photo_cloud": "Gagal hapus foto dari cloud",
            "confirm_delete_material": "Hapus materi ini?",
            "confirm_archive_task": "Tugas ini diarsipkan — semua siswa sudah selesai!",
            "empty_materials": "Belum ada materi atau pengumuman untuk mata pelajaran ini.",
            "empty_tasks": "Semua tugas sudah selesai atau belum ada tugas baru.",

            // js/feed.js
            "edit_caption": "Edit caption",
            "no_comments": "Belum ada komentar.",
            "confirm_delete_post": "Hapus postingan ini?",

            // js/forum.js
            "no_discussion": "Belum ada diskusi.<br>Jadi yang pertama posting!",
            "no_comment_forum": "Belum ada komentar.<br>Mulai dulu!",
            "confirm_delete_discussion": "Hapus diskusi ini?",
            "discussion_deleted": "Diskusi dihapus",
            "confirm_delete_comment": "Hapus komentar ini?",
            "discussion_posted": "Diskusi diposting!",

            // js/dashboard.js
            "success_generic": "Berhasil!",
            "failed_generic": "Gagal",
            "no_posts": "Belum ada postingan.",

            // js/search.js
            "your_class_badge": "(Kelas Kamu)",
            "no_students_in_class": "Belum ada siswa di kelas ini.",
            "account_not_found": "Akun tidak ditemukan.",
            "all_classes": "Semua Kelas",

            // js/quiz.js
            "no_simulation_questions": "Belum ada soal simulasi.",
            "back_to_topics": "Balik ke Kisi-Kisi",
            "back_to_home": "Balik ke Beranda",

            // js/visitor.js
            "no_visitors": "Belum ada yang mampir.",

            // js/bottom-nav.js
            "feed": "Feed",
            "nav_tugas": "Tugas",
            "nav_forum": "Forum",
            "nav_search": "Cari",
            "nav_profile": "Profil",

            // Additional keys for hardcoded strings
            "custom_schedule": "Jadwal Khusus",
            "custom_active": "Mode Custom Aktif",
            "click_edit": "Klik Edit untuk mengisi detail event",
            "data_empty": "Data Kosong",
            "import_success": "Jadwal PDF berhasil di-impor! Geser-geser urutannya kalo perlu, lalu klik Simpan.",
            "reading_pdf": "Sedang membaca PDF...",
            "refreshing_cache": "Membersihkan cache...",
            "item_deleted": "Terhapus!",
            "simulation": "Simulasi",
            "not_yet_available": "(belum ada)",
            "all_tasks_done": "Hore! Semua tugas sudah selesai kamu kerjakan.",
            "main_navigation": "Navigasi utama",
            // a/flashcards.html
            "flashcards": "Flashcard",
            "flashcard_list": "Daftar Flashcard",
            "no_flashcards": "Belum ada flashcard untuk mapel ini",
            "add_flashcard": "Tambah Flashcard",
            "edit_flashcard": "Edit Flashcard",
            "delete_flashcard_confirm": "Hapus flashcard ini?",
            "front_side": "Sisi Depan (Konsep/Pertanyaan)",
            "back_side": "Sisi Belakang (Definisi/Jawaban)",
            "flip_hint": "Klik kartu untuk membalikkan",
            "no_flashcard_questions": "Admin belum masukin flashcard buat mapel ini. Tungguin aja ya! wkwk",
        },
        en: {
            "app_name": "E-Learning Nizam",
            "save": "Save",
            "cancel": "Cancel",
            "delete": "Delete",
            "close": "Close",
            "loading": "Loading...",
            "welcome": "Hello, {name}!",
            "theme_title": "Theme Personalization",
            "lang_select": "Select Language",
            "lang_id": "Indonesian",
            "lang_en": "English",
            "lang_su": "Sundanese",
            "bg_title": "Background",
            "accent_title": "Accent Color",
            "text_size": "Text Size",
            "save_apply": "SAVE & APPLY",
            "reset_default": "Reset to default appearance",
            "upload_photo": "Upload Photo",
            "own_photo": "Own photo",
            "success_save": "Theme saved successfully!",
            "error_upload": "Failed to upload photo",
            "login_first": "Login first miz!",
            "confirm_delete_item": "Permanently delete <b>{name}</b>?",
            "materi_title": "Material & Announcements",
            "tasks_list": "Tasks List",
            "kisi_format": "Exam Topics - {subject}",
            "other": "Other",
            "refresh": "Refresh",
            "all": "All",

            // Sidebar Groups
            "sidebar_system": "System Menu",
            "sidebar_admin": "Admin Panel",
            "sidebar_main": "Main Menu",
            "sidebar_lessons": "Lessons",
            "sidebar_custom": "Other Menu",
            "sidebar_Web Siswa": "Students web",

            // Sidebar Items (by subject_id)
            "announcements": "Announcements",
            "tugas": "Task List",
            "kisi-kisi": "Exam Topics",
            "search": "Search Account",
            "theme": "Theme",
            "settingacc": "Account Settings",
            "user": "Profile",
            "send": "Send Files",
            "forum": "Discussion Forum",
            "test-scores?id=psasi": "Test Score PSASI",
            "test-scores?id=psts": "Test Score PSTS",
            "updates": "Patch Updates",
            "class-profile-v2.html": "Class Profile v2",
            "bahasaindonesia": "Indonesian",
            "bahasainggris": "English",
            "bahasasunda": "Sundanese",
            "bahasajepang": "Japanese",
            "matematika": "Math",
            "proipas": "Science & Social",
            "pabp": "Islamic Education",
            "pp": "Pancasila Education",
            "senibudaya": "Culture",
            "sejarah": "History",
            "pjok": "Physical Education",
            "bk": "Counseling",
            "informatika": "Computer Science",
            "dpr1": "Software Engineering 1",
            "dpr2": "Software Engineering 2",
            "dpr3": "Software Engineering 3",
            "dasprogrpl1": "Software Engineering 1",
            "dasprogrpl2": "Software Engineering 2",
            "dasprogrpl3": "Software Engineering 3",

            // Days
            "minggu": "Sunday",
            "senin": "Monday",
            "selasa": "Tuesday",
            "rabu": "Wednesday",
            "kamis": "Thursday",
            "jumat": "Friday",
            "sabtu": "Saturday",

            // Months
            "january": "January",
            "february": "February",
            "march": "March",
            "april": "April",
            "may": "May",
            "june": "June",
            "july": "July",
            "august": "August",
            "september": "September",
            "october": "October",
            "november": "November",
            "december": "December",

            // Announcements
            "announcements3": "Announcements and Schedule",
            "home": "Home",

            // Kisi-kisi
            "exam_topics": "Exam Topics",
            "choose_lesson": "Choose a Lesson",
            "all_lessons": "All Lessons",
            "no_kisi": "There are no exam topics for this day",

            // Materi Susulan
            "susulan": "Makeup Materials",
            "no_susulan": "No makeup materials yet",
            "choose_day": "Choose Day",
            "choose_date": "Choose Date",
            "susulan_subject": "Subject",
            "susulan_page": "Makeup materials page — missed lessons, divided by date",
            "susulan_manage_dates": "Manage Dates",
            "susulan_date_hint": "Add dates for material groups. e.g. 2026-08-01 = Monday, Aug 1. You can add next weeks too.",
            "susulan_no_dates": "No dates yet. Add one above.",
            "susulan_no_date": "No Date",
            "susulan_add_date_first": "Add a date in the left panel first before posting material.",
            "susulan_confirm_delete_date": "Delete date {date}? Materials on this date will become \"No Date\".",
            "susulan_date_deleted": "Date deleted",
            "susulan_date_added": "Date added",
            "susulan_date_exists": "Date already exists",
            "susulan_invalid_date": "Pick a valid date",

            // Code Block
            "copy_code": "Copy Code",
            "copied": "Copied!",

            //daily-card.js
            "edit_schedule": "Edit schedule",
            "activate_mode": "Schedule mode",
            "main_sch": "Main schedule",
            "exam_sch": "Exam schedule",
            "custom_sch": "Custom schedule",
            "auto_upd": "Automatically update at 3pm",
            "sch_kisi": "Schedule in kisi-kisi",
            "edit_day": "Edit day",
            "special_event": "Special Event",
            "tomorrow": "Tomorrow",
            "today": "Today",
            "exam": "Exam",
            "task": "task",
            "view_day": "Viewing {day} schedule",
            "data_saved": "Data saved",
            "failed_save": "Failed to save",
            "uniform": "Uniform",
            "activity": "Activity",
            "notes": "Notes",
            "lesson_sch": "Lessons Schedule",
            "cleaning_duty": "Cleaning Duty",
            "add_row": "Add row",
            "add_people": "Add people",

            // headerpp
            "hi": "Hii",
            "class": "Class",
            "announcements2": "Announcements",
            "edit_prof": "Edit Profile",
            "theme2": "Personalize",
            "visitor": "Visitor",
            "resetvist": "Reset Visitor",

            //modal
            "new_material": "New Material",
            "send2page": "Send To page",
            "markasassign": "Mark as assignment",
            "title": "Title",
            "subtitle": "Sub-title",
            "large": "Large",
            "medium": "Medium",
            "small": "Small",
            "footer": "Footer",
            "card_color": "Card color",
            "uploadphotos": "<b>Click to upload</b> or drag files here",
            "download_file": "Download file",

            //detailOverlay
            "see_desc": "See Description",

            //forum
            "post_discussion": "Post a Discussion",
            "what_discussion": "What do you want to discuss?",

            //tugas
            "task_list": "Task List",
            "complete_status": "Completion Status",
            "small_text": "Press the 'Mark As Done' button to mark the task as complete and sort it neatly.",
            "not_finish": "Not Finished Yet",
            "all_tasks": "All Tasks",
            "markasdone": "Mark As Done",
            "done": "Done",
            youvedone: "You have completed {done} out of {total} tasks",
            "archived":"Archived",

            // login.html
            "select_class": "Select Class",
            "select_name": "Select Your Name",
            "secure_mode": "Secure Mode",
            "direct_mode": "Direct Mode",
            "guest_expiry": "Guest data is automatically deleted",
            "search_name_placeholder": "Search your name...",
            "select_class_first": "Select Class First",
            "central_access": "Central Access Control",
            "loading_class_list": "Loading class list...",
            "failed_load_class": "Failed to Load Classes!",
            "loading_data": "Loading data...",
            "no_teacher_registered": "No registered teachers.",
            "student_not_found": "Student data not found in this class.",
            "failed_load_data": "Failed to Load Data!",
            "select_teacher": "Select Teacher",

            // index.html
            "no_info": "No information available.",
            "add_info": "Add Information",

            // a/kirim-tugas.html
            "page_title_tugas": "Submit Assignment • E-Learning Nizam",
            "task_collection": "Assignment Collection",
            "mandatory_task": "Mandatory Assignment",
            "send_task": "Submit Assignment",
            "select_task_optional": "— Select Task (optional) —",
            "select_teacher_option": "— Select Teacher —",
            "upload_file": "Upload File",
            "task_link": "Task Link",
            "btn_send": "Submit",
            "no_mandatory_task": "No mandatory tasks",
            "no_task_option": "— No tasks —",
            "not_logged_in": "Not logged in!",
            "select_teacher_first": "Select a teacher first!",
            "upload_or_link_required": "Upload file or fill in task link!",
            "task_sent_success": "Task submitted successfully!",
            "send_again": "Submit Again",
            "no_submissions": "No submissions yet",
            "failed_load_task": "Failed to load tasks",

            // a/subject.html
            "not_set": "Not set",
            "total_material": "Total Materials",
            "material_not_found": "Material not found.",
            "teacher_data_saved": "Teacher data saved successfully",

            // a/user.html
            "task_progress": "Task Progress",
            "loading_task_progress": "Loading task progress...",
            "today_schedule": "Today's Schedule",
            "view_full_schedule": "View Full Schedule",
            "post_photo": "Post Photo",
            "select_photo_video": "Select photo or video",
            "delete_post": "Delete Post",

            // a/scores.html
            "exam_scores": "Exam Scores",
            "view_all_subjects": "View All Subjects",
            "select_subject_hide": "Select subjects to HIDE",
            "upload_original_file": "Upload original file (PDF/image)",
            "select": "Select",
            "class_scores": "Class Scores",
            "select_file_first": "Select file first",
            "no_file_upload": "No files yet. Upload original file...",
            "confirm_delete_file": "Delete this file?",

            // a/theme.html
            "select_preset": "Select Preset",
            "accent_desc": "Color for buttons, links, and highlights",
            "default": "Default",
            "custom": "Custom",
            "uploading": "Uploading...",
            "photo_uploaded": "Photo uploaded successfully!",

            // a/send.html
            "send_file": "Send File",
            "all_formats_max": "All file formats supported. Max 40 MB",
            "send_n_file": "Send {n} File",
            "pending": "Pending",
            "sent_success": "✓ Sent",
            "send_failed": "✗ Failed",
            "uploading_text": "Uploading...",

            // a/keaktifan.html
            "all_time": "All Time",
            "select_student_activity": "Select a student to view their activity.",
            "edit_excluded": "Edit Excluded",
            "no_activity_log": "No activity recorded.",

            // a/quiz.html
            "exam_simulation": "Exam Simulation",
            "simulation_questions_title": "Exam Simulation Questions",
            "not_attempted": "Not Attempted",
            "already_completed": "Completed",
            "loading_questions": "Loading questions...",
            "simulation_complete": "Simulation Complete!",

            // a/forum.html
            "add_comment_placeholder": "Add a comment...",

            // a/updates.html
            "update_desc": "Changelog & new features",
            "total_update": "Total Updates",
            "add_update": "Add Update",
            "new_update": "New Update",
            "update_title_placeholder": "Update title (e.g. Update March 31)",
            "no_update_recorded": "No updates recorded.",
            "update_posted": "Update posted successfully!",
            "confirm_delete_update": "Delete this update?",
            "update_deleted": "Update deleted",

            // a/settingacc.html
            "profile_updated": "Profile Updated Successfully!",
            "account_data": "Account Data",
            "profile_photo": "Profile Photo",
            "change_photo": "Change Photo",
            "role_status": "Role / Status",
            "user_not_found": "User not found.",
            "full_name": "Full Name",
            "nickname_display": "Nickname (Display)",
            "bio": "Bio",
            "privacy": "Privacy",
            "private_account": "Private Account",
            "privacy_desc": "Your posts won't appear in others' Feed",
            "username_label": "Username",
            "password_label": "Password",
            "username_placeholder": "Create a unique username",
            "password_placeholder": "Create a password",
            "change_photo_note": "*you can change photo directly here without contacting admin via WA",
            "admin_edit_note": "Only admin can edit the data above! Something wrong? Contact admin",
            "account_login": "Login Account",
            "warning_set_credentials": "Set a username and password for your account! So others can't log in.",
            "save_changes": "SAVE CHANGES",
            "saving": "SAVING...",
            "warning_credentials_required": "⚠️ Username and Password are required!",
            "nickname_placeholder": "What nickname?",
            "bio_placeholder": "Write your bio",

            // admiii/tugas-masuk.html
            "incoming_tasks": "Incoming Tasks",
            "all_teachers": "All Teachers",
            "all_time_filter": "All Time",
            "no_submissions_data": "No incoming tasks",
            "today_filter": "Today",
            "this_week": "This Week",
            "this_month": "This Month",
            "view_file": "View File",
            "open_link": "Open Link",
            "task_no_title": "Task without title",
            "failed_open_file": "Failed to open file",

            // admiii/progress-tugas.html
            "total_tasks": "Total Tasks",
            "class_progress": "Class Progress",
            "per_task": "Per Task",
            "archive_all_tasks": "Archive ALL Tasks",
            "search_title_subject": "Search title / subject...",
            "search_student_name": "Search student name...",
            "search_placeholder": "🔍 Search...",
            "complete_all": "Complete All",
            "reset": "Reset",
            "no_tasks": "No tasks.",
            "all_tasks_archived": "All tasks have been archived.",
            "all_active_completed": "All active tasks completed!",
            "reset_student_progress": "Reset: clear all progress for this student",
            "all_students_complete_reset": "All students completed — progress cleared",
            "archive_all": "Archive All",
            "task_archived": "Task archived!",
            "task_unarchived": "Task unarchived.",
            "confirm_archive_all": "Archive ALL ... active tasks?",
            "progress_tasks": "Task Progress",
            "student": "Student",
            "students": "Students",
            "average": "Average",
            "completed_100": "100% Completed",
            "per_student": "Per Student",
            "newest_first": "Newest first",
            "most_completed": "Most completed ↓",
            "least_completed": "Least completed ↑",
            "a_z_title": "A–Z Title",
            "a_z_name": "A–Z Name",
            "progress_desc": "Progress ↓",
            "progress_asc": "Progress ↑",
            "archived_label": "ARCHIVED",
            "unarchive": "Unarchive",
            "archiving": "Archiving...",
            "task_archived_progress": "Task archived! Progress cleared from DB 🎉",
            "task_unarchived_detail": "Task unarchived. Students need to re-check.",
            "tasks_archived_count": "{n} tasks successfully archived! 🎉",
            "progress_reset": "Progress reset.",
            "no_task_found": "No tasks found.",
            "no_student_found": "No students found.",
            "no_name": "No Name",
            "done_slash_total": "{done}/{total} completed",
            "all_students_complete": "All students completed — progress cleared from DB",
            "failed_update": "Update failed",

            // admiii/send_notice.html
            "select_color_type": "Select Color / Type",
            "notice_text_color": "Notice Text Color",
            "target_class": "Target Class",
            "all_classes_global": "All Classes (Global)",
            "send_notice": "Send Notice",
            "cancel_edit": "Cancel Edit",
            "no_notice_history": "No notice history.",
            "global_label": "Global",
            "edit_notice": "Edit Notice",
            "save_changes_notice": "Save Changes",
            "confirm_delete_notice": "Delete this notice from history?",

            // admiii/menu.html
            "menu_manager": "Menu Manager",
            "add_menu": "Add Menu",
            "edit_menu": "Edit Menu",
            "menu_group": "Menu Group",
            "menu_name": "Menu Name",
            "select_from_file": "Select from existing file",
            "select_icon": "Select icon",
            "update_badge": "Update",
            "add_edit_group": "Add / Edit Group",
            "main_menu_type": "Main Menu",
            "additional_menu": "Additional Menu",
            "admin_panel_type": "Admin Panel",
            "save_group": "Save Group",
            "menu_structure": "Menu Structure",
            "select_icon_modal": "Select Icon",
            "search_icon_placeholder": "Search icon... (e.g. book, math, code)",
            "select_file_page_modal": "Select File / Page",
            "search_page_placeholder": "Search page...",
            "lesson_category": "Lessons:",
            "admin_system_category": "Admin & System",
            "edit_cancelled": "Edit cancelled",
            "confirm_delete_group": "Delete group {name}?",
            "select_class_error": "Select class!",
            "menu_name_class_required": "Class and menu name are required!",
            "select_group_first": "Select or create a menu group first!",
            "updated_success": "Updated successfully!",
            "menu_added": "Menu added!",
            "menu_deleted": "Menu deleted!",
            "data_incomplete": "Incomplete data!",
            "this_material": "this material",
            "system_menu_global": "SYSTEM MENU (GLOBAL)",

            // admiii/bottom-nav.html
            "add_item": "Add Item",
            "custom_manual": "Custom / manual",
            "add": "Add",
            "remove_from_bottom_nav": "Remove from Bottom Nav",

            // admiii/files.html
            "all_files": "All Files",
            "no_files": "No incoming files.",
            "download_all": "Download All",
            "delete_all": "Delete All",
            "confirm_download_group": "Download {n} files from {name}?",
            "confirm_delete_file_group": "Delete all {n} files from {name}?",
            "confirm_delete_file_single": "Delete this file without downloading?",
            "confirm_download_file": "Download {name}?",

            // admiii/inputsoal.html
            "add_new_question": "Add New Question",
            "subject_lesson": "Subject",
            "answer_choices": "Answer Choices (Check the correct one)",
            "choice_a": "Choice A",
            "choice_b": "Choice B",
            "choice_c": "Choice C",
            "choice_d": "Choice D",
            "save_question": "Save Question",
            "all_subjects": "All Subjects",
            "no_questions": "No questions.",
            "confirm_delete_question": "Delete this question?",
            "edit_question": "Edit Question",
            "failed_delete_question": "Failed to delete question.",
            "failed_save_question": "Failed to save question.",
            "master_class": "Master Class",
            "question_deleted": "Question deleted!",
            "question_min_required": "Question and at least 2 choices are required!",
            "question_saved": "Question saved successfully!",
            "questions_found": "{n} questions found",
            "n_choices": "{n} Choices",

            // admiii/control.html
            "search_user_placeholder": "Search name, nickname, or role...",
            "last_activity": "Last Activity",
            "confirm_delete_user": "Permanently delete this user?",

            // admiii/visitor.html
            "search_user": "Search User",
            "active": "Active",
            "browsing": "Browsing",
            "guest": "Guest",
            "leaving": "Leaving...",
            "logs_found": "{n} Found",
            "no_logs_match_filter": "No log data matches the filter.",
            "no_one_online": "No one is online.",
            "online_count": "{n} Online",
            "visitors_today": "{n} Today",

            // admiii/monitor_nilai.html
            "class_average": "Class Average",
            "student_name": "Student Name",
            "status_label": "Status",

            // admiii/nilai-psts.html
            "select_student_fill_score": "Select student nickname, fill scores, then save.",
            "select_student": "Select Student",
            "select_student_nickname": "Select Student (Nickname)",
            "input_subject_score": "Input Subject Scores",
            "select_student_first_alert": "Select student name first!",
            "failed_save_label": "Failed to save: ",
            "saved_success_for": "Saved successfully for {name}!",

            // admiii/monitor_simulasi.html
            "simulation_hub": "Simulation Hub",
            "hours_ago": "{n}h ago",
            "just_now": "Just now",
            "minutes_ago": "{n}m ago",
            "status_completed": "COMPLETED",
            "status_ongoing": "ONGOING",
            "status_stopped": "STOPPED",
            "unknown": "Unknown",

            // admiii/cleanup-storage.html
            "delete_selected_files": "Delete Selected Files",
            "deleted_success": "Deleted successfully!",

            // admiii/csv-sql.html
            "upload_csv": "Upload CSV File",
            "upload_csv_first": "Upload CSV file first!",

            // js/ui-components.js
            "view_schedule": "View Schedule",
            "save_schedule": "Save Schedule",
            "edit_material": "Edit",
            "change_color": "Change Color",
            "add_new": "Add New",

            // js/subject-manager.js
            "collect_task": "Submit Task",
            "add_link": "Add link",
            "all_changes_saved": "All changes saved!",
            "failed_save_data": "Failed to save data!",
            "confirm_delete_photo": "Delete this photo?",
            "photo_deleted_cloud": "Photo deleted from cloud!",
            "failed_delete_photo_cloud": "Failed to delete photo from cloud",
            "confirm_delete_material": "Delete this material?",
            "confirm_archive_task": "This task is archived — all students have completed it!",
            "empty_materials": "No materials or announcements for this subject.",
            "empty_tasks": "All tasks are completed or there are no new tasks.",

            // js/feed.js
            "edit_caption": "Edit caption",
            "no_comments": "No comments.",
            "confirm_delete_post": "Delete this post?",

            // js/forum.js
            "no_discussion": "No discussions yet.<br>Be the first to post!",
            "no_comment_forum": "No comments yet.<br>Start one!",
            "confirm_delete_discussion": "Delete this discussion?",
            "discussion_deleted": "Discussion deleted",
            "confirm_delete_comment": "Delete this comment?",
            "discussion_posted": "Discussion posted!",

            // js/dashboard.js
            "success_generic": "Success!",
            "failed_generic": "Failed",
            "no_posts": "No posts yet.",

            // js/search.js
            "your_class_badge": "(Your Class)",
            "no_students_in_class": "No students in this class.",
            "account_not_found": "Account not found.",
            "all_classes": "All Classes",

            // js/quiz.js
            "no_simulation_questions": "No simulation questions.",
            "back_to_topics": "Back to Topics",
            "back_to_home": "Back to Home",

            // js/visitor.js
            "no_visitors": "No visitors yet.",

            // js/bottom-nav.js
            "feed": "Feed",
            "nav_tugas": "Tasks",
            "nav_forum": "Forum",
            "nav_search": "Search",
            "nav_profile": "Profile",

            // Additional keys for hardcoded strings
            "custom_schedule": "Special Schedule",
            "custom_active": "Custom Mode Active",
            "click_edit": "Click Edit to fill event details",
            "data_empty": "No Data",
            "import_success": "PDF schedule imported successfully! Adjust order if needed, then click Save.",
            "reading_pdf": "Reading PDF...",
            "refreshing_cache": "Clearing cache...",
            "item_deleted": "Deleted!",
            "simulation": "Simulation",
            "not_yet_available": "(not available)",
            "all_tasks_done": "Hooray! You've completed all your tasks.",
            "main_navigation": "Main navigation",
            // a/flashcards.html
            "flashcards": "Flashcards",
            "flashcard_list": "Flashcards List",
            "no_flashcards": "No flashcards for this subject",
            "add_flashcard": "Add Flashcard",
            "edit_flashcard": "Edit Flashcard",
            "delete_flashcard_confirm": "Delete this flashcard?",
            "front_side": "Front Side (Concept/Question)",
            "back_side": "Back Side (Definition/Answer)",
            "flip_hint": "Click card to flip",
            "no_flashcard_questions": "Admin hasn't uploaded any flashcards for this subject yet. Please wait! wkwk",
        },
        su: {
            "app_name": "E-Learning Nizam",
            "save": "Simpen",
            "cancel": "Bolay",
            "delete": "Hapus",
            "close": "Tutup",
            "loading": "Ngamuat...",
            "welcome": "Halo, {name}!",
            "theme_title": "Personalisasi Téma",
            "lang_select": "Pilih Basa",
            "lang_id": "Basa Indonesia",
            "lang_en": "English",
            "lang_su": "Basa Sunda",
            "bg_title": "Latar",
            "accent_title": "Warna Aksen",
            "text_size": "Ukuran Teks",
            "save_apply": "SIMPEN & TERAPKEUN",
            "reset_default": "Balikkeun ka tampilan awal",
            "upload_photo": "Upload Poto",
            "own_photo": "Poto sorangan",
            "success_save": "Téma geus disimpen!",
            "error_upload": "Gagal upload poto",
            "login_first": "Asup heula atuh!",
            "confirm_delete_item": "Hapus <b>{name}</b> sacara permanén?",
            "materi_title": "Materi & Pengumuman",
            "tasks_list": "Daptar Tugas",
            "kisi_format": "Kisi - Kisi {subject}",
            "other": "Séjénna",
            "refresh": "Segeurkeun",
            "all": "Kabéh",

            "sidebar_system": "Menu Sistem",
            "sidebar_admin": "Panel Admin",
            "sidebar_main": "Menu Utama",
            "sidebar_lessons": "Mata Pangajaran",
            "sidebar_custom": "Menu Séjén",
            "sidebar_Web Siswa": "Web Siswa",

            "announcements": "Pengumuman",
            "tugas": "Daptar Tugas",
            "kisi-kisi": "Kisi-Kisi",
            "search": "Pilarian Akun",
            "theme": "Téma",
            "settingacc": "Setélan Akun",
            "user": "Profil",
            "send": "Kirim Berkas",
            "forum": "Forum Diskusi",
            "test-scores?id=psasi": "Nilai PSASI",
            "test-scores?id=psts": "Nilai PSTS",
            "updates": "Update Patch",
            "class-profile-v2.html": "Profil Kelas v2",
            "bahasaindonesia": "B. Indonesia",
            "bahasainggris": "B. Inggris",
            "bahasasunda": "B. Sunda",
            "bahasajepang": "B. Jepang",
            "matematika": "Matematika",
            "proipas": "Proipas",
            "pabp": "PABP",
            "pp": "PP",
            "senibudaya": "Seni Budaya",
            "sejarah": "Sajarah",
            "pjok": "PJOK",
            "bk": "BK",
            "informatika": "Informatika",
            "dpr1": "DASPROGRPL 1",
            "dpr2": "DASPROGRPL 2",
            "dpr3": "DASPROGRPL 3",
            "dasprogrpl1": "DASPROGRPL 1",
            "dasprogrpl2": "DASPROGRPL 2",
            "dasprogrpl3": "DASPROGRPL 3",

            "minggu": "Minggu",
            "senin": "Senén",
            "selasa": "Salasa",
            "rabu": "Rebo",
            "kamis": "Kemis",
            "jumat": "Jumaah",
            "sabtu": "Saptu",

            "january": "Januari",
            "february": "Pébruari",
            "march": "Maret",
            "april": "April",
            "may": "Méi",
            "june": "Juni",
            "july": "Juli",
            "august": "Agustus",
            "september": "Séptémber",
            "october": "Oktober",
            "november": "Nopémber",
            "december": "Désémber",

            "home": "Imah",
            "failed_load_data": "Gagal ngamuat data",
            "no_data": "Can aya data",
            "no_tasks": "Can aya tugas",
            "no_announcements": "Can aya pengumuman",
            "no_schedule": "Can aya jadwal",
            "view_all": "Tingali Kabéh",
            "view_detail": "Tingali Detil",
            "confirm_delete": "Nya, Hapus!",
            "confirm_cancel": "Bolay",
            "yes": "Nya",
            "no": "Henteu",
            "notif": "Béja",
            "search_placeholder": "Pilarian...",
            "upload": "Upload",
            "download": "Undeur",
            "share": "Bagikeun",
            "edit": "Édit",
            "submit": "Kirim",
            "reset": "Reset",
            "success": "Hasil!",
            "error": "Gagal",
            "warning": "Awas",
            "info": "Info",
            "confirm": "Kunpirmasi",
            "message": "Pesen",

            "teacher": "Guru",
            "student": "Murid",
            "admin": "Admin",
            "class": "Kelas",
            "subject": "Pangajaran",

            "online": "Online",
            "offline": "Offline",
            "last_seen": "Katémbong {time}",
            "today": "Dinten Ieu",
            "yesterday": "Kamari",
            "tomorrow": "Isukan",
            "days_ago": "{n} poe katukang",

            "no_visitors": "Can aya nu ngalongok",
            "visitor": "Nu Ngalongok",
            "resetvist": "Reset Nu Ngalongok",

            // Materi Susulan
            "susulan": "Materi Susulan",
            "no_susulan": "Can acan aya materi susulan",
            "choose_day": "Pilih Poe",
            "choose_date": "Pilih Tanggal",
            "susulan_subject": "Mata Pangajaran",
            "susulan_page": "Kaca Materi Susulan — materi anu kaliwat, dibagi per tanggal",
            "susulan_manage_dates": "Kelola Tanggal",
            "susulan_date_hint": "Tambahkeun tanggal buat kelompok materi.",
            "susulan_no_dates": "Can aya tanggal. Tambahkeun heula.",
            "susulan_no_date": "Tanpa Tanggal",
            "susulan_add_date_first": "Tambahkeun tanggal heula di panel kenca.",
            "susulan_confirm_delete_date": "Hapus tanggal {date}?",
            "susulan_date_deleted": "Tanggal dihapus",
            "susulan_date_added": "Tanggal ditambah",
            "susulan_date_exists": "Tanggal geus aya",
            "susulan_invalid_date": "Pilih tanggal nu valid",

            // Code Block
            "copy_code": "Salin Kode",
            "copied": "Kasalim!",

            "material_not_found": "Materi teu kapendak.",
            "student_not_found": "Data murid teu kapendak di kelas ieu.",
            "user_not_found": "Pamaké teu kapendak.",
            "account_not_found": "Akun teu kapendak.",

            "loading_data": "Ngamuat data...",
            "load_more": "Muat deui",
            "show_less": "Témbongkeun saeutik",

            "select_class": "Pilih Kelas",
            "all_classes": "Kabéh Kelas",
            "all_subjects": "Kabéh Pangajaran",
            "all_time": "Sakalian Waktu",
            "this_week": "Minggu Ieu",
            "this_month": "Bulan Ieu",

            "settings": "Setélan",
            "profile": "Profil",
            "logout": "Kaluar",
            "login": "Asup",

            "custom_schedule": "Jadwal Husus",
            "custom_active": "Mode Husus Aktip",
            "click_edit": "Klik Édit keur ngeusian detil acara",
            "data_empty": "Data Kosong",
            "import_success": "Jadwal PDF hasil diimpor! Séér-séér urutanna mun perlu, tuluy klik Simpen.",
            "reading_pdf": "Macana PDF...",
            "refreshing_cache": "Ngabersihan cache...",
            "item_deleted": "Dihapus!",
            "simulation": "Simulasi",
            "not_yet_available": "(can aya)",
            "all_tasks_done": "Alhamdulillah! Kabéh tugas geus réngsé.",
            "main_navigation": "Navigasi utama",
            // a/flashcards.html
            "flashcards": "Flashcard",
            "flashcard_list": "Daftar Flashcard",
            "no_flashcards": "Teu aya flashcard kanggo mapel ieu",
            "add_flashcard": "Tambah Flashcard",
            "edit_flashcard": "Édit Flashcard",
            "delete_flashcard_confirm": "Hapus flashcard ieu?",
            "front_side": "Sisi Payun (Konsép/Patarosan)",
            "back_side": "Sisi Pengker (Hartosna/Waleran)",
            "flip_hint": "Klik kartu pikeun malikkeun",
            "no_flashcard_questions": "Admin teu acan ngalebetkeun flashcard kanggo mapel ieu. Antosan nya! wkwk",
        }
    },

    t(key, params = {}) {
        let text = this.data[this.current]?.[key] || this.data['id']?.[key] || key;
        Object.keys(params).forEach(p => {
            text = text.replace(`{${p}}`, params[p]);
        });
        return text;
    },

    setLanguage(lang) {
        if (this.current === lang) return;
        this.current = lang;
        localStorage.setItem('app_lang', lang);
        document.body.style.opacity = '0'; // Soft fade out
        setTimeout(() => window.location.reload(), 150);
    },

    init() {
        // 1. Scanner awal untuk elemen yang sudah ada
        const translateEl = (el) => {
            if (el.dataset.i18n) {
                const key = el.dataset.i18n;
                el.innerHTML = this.t(key);
            }
            if (el.placeholder && el.dataset.i18nPlaceholder) {
                el.placeholder = this.t(el.dataset.i18nPlaceholder);
            }
        };

        // 2. MutationObserver untuk handle elemen baru (Anti-Blink)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.dataset.i18n || node.dataset.i18nPlaceholder) translateEl(node);
                        node.querySelectorAll('[data-i18n], [data-i18n-placeholder]').forEach(translateEl);
                    }
                });
            });
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });

        // 3. Fallback & Lang Ready Class
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('[data-i18n], [data-i18n-placeholder]').forEach(translateEl);
            document.body.classList.add('lang-ready');
        });
    }
};

// Global Helpers
window.t = (key, params) => i18n.t(key, params);
window.setLanguage = (lang) => i18n.setLanguage(lang);

// Start ASAP
i18n.init();
;

function t(key, vars = {}) {

    let text =
        translations[currentLang]?.[key]
        || key;

    Object.keys(vars).forEach(k => {
        text = text.replace(`{${k}}`, vars[k]);
    });

    return text;
}
