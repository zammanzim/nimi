document.addEventListener("DOMContentLoaded", async () => {
    const isInAdmin = window.location.pathname.includes("/admiii/");
    const isInA     = window.location.pathname.includes("/a/");
    const pathPrefix = isInAdmin ? "../" : isInA ? "../" : "";

    const isPublicPage = window.location.pathname.includes("login") || window.location.pathname.includes("404");
    const isIndex = !window.location.pathname || window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');
    if (isPublicPage || isIndex) return;

    const user = getUser();
    if (user) {
        await autoFetchUser();
        // Path Guard: Cek apakah user boleh akses halaman ini
        // [TEMP DISABLED] banyak bug — nonaktifin dulu biar semua halaman bisa diakses sementara
        // await checkPathAccess(user);
    } else {
        // Biar kalau gak login pas di folder admin, gak mental ke admin/index
        window.location.href = pathPrefix + "login";
    }
});

/**
 * Path Guard System
 * Mencegah user akses halaman yang tidak ada di sidebar mereka.
 * Kecuali super_admin (miz).
 */
async function checkPathAccess(user) {
    return; // [TEMP DISABLED] fitur halaman dilarang dimatiin sementara — hapus baris ini buat aktifin lagi
    if (!user || user.role === 'super_admin' || user.role === 'teacher') return;

    // class_admin boleh akses semua halaman di /admiii/
    if (user.role === 'class_admin' && window.location.pathname.includes('/admiii/')) return;

    const currentId = getPathIdentifier();
    const whitelist = ['login', '404', 'index', 'theme', 'settingacc', 'user', 'kirim-tugas', 'class-profil'];
    
    // 1. Cek Whitelist Dasar
    if (whitelist.includes(currentId) || !currentId) return;

    // Langsung query DB aja — ga pake cache biar selalu fresh
    const classId = user.class_id;

    try {
        if (typeof supabase === 'undefined') return;

        const { data } = await supabase
            .from('subjects_config')
            .select('subject_id')
            .or(`class_id.eq.${classId},class_id.eq.2`)
            .eq('subject_id', currentId);

        if (!data || data.length === 0) {
            renderAccessDenied();
        }
    } catch (e) {
        console.warn("[PathGuard] Error:", e);
    }
}

function getPathIdentifier() {
    const path = window.location.pathname;
    const search = window.location.search;
    const parts = path.split('/');
    let filename = parts.pop() || parts.pop() || '';
    filename = filename.replace('.html', '').toLowerCase();

    const params = new URLSearchParams(search);
    const idParam = params.get('id')?.toLowerCase();

    // Lesson page sekarang pake /a/index.html?id=xxx (dulu subject.html)
    // Jadi kalau ada ?id= dan filenya index / a / subject / kosong, balikin id-nya aja
    // biar cocok sama subjects_config.subject_id (mis: 'matematika', 'bing', dll)
    if (idParam && (filename === 'subject' || filename === 'index' || filename === 'a' || filename === '')) {
        return idParam;
    }

    // Untuk halaman lain, identitasnya adalah filename + query string (misal: scores?id=psat)
    // Ini biar cocok ama subject_id yang diinput manual di database
    const query = search ? search.toLowerCase() : '';
    return filename + query;
}

function renderAccessDenied() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) {
        // Fallback jika tidak ada .main-content
        document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; background:#0a0a0c; color:white;"><h2>Akses Dibatasi</h2></div>';
        return;
    }

    const isA = window.location.pathname.includes('/a/');
    const homeUrl = isA ? '../' : '../';

    mainContent.innerHTML = `
        <div class="course-card animate-pop-up" style="text-align:center; max-width:500px; margin:40px auto; padding:40px; background:rgba(20,20,25,0.7); border:1px solid rgba(255,71,87,0.2);">
            <i class="fa-solid fa-circle-exclamation uni-icon error" style="font-size:72px; margin-bottom:15px; color:#ff4757; text-shadow: 0 0 20px rgba(255,71,87,0.3);"></i>
            <h2 style="margin-bottom:8px; color:#fff;">Akses Dibatasi</h2>
            <p style="opacity:.8; line-height:1.6; color:#ccc; font-size:14px;">
                Maaf, kamu tidak memiliki izin untuk mengakses halaman ini.<br>
                Halaman ini bersifat private atau tidak ada di menu kamu.
            </p>
            <div style="margin-top:25px; display:flex; justify-content:center; gap:12px;">
                <a href="${homeUrl}" class="uni-btn" style="text-decoration: none; background:#ff4757; color:#fff; padding:10px 24px; border-radius:12px; font-weight:700; display:inline-flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-house"></i> ${t('home')}
                </a>
            </div>
        </div>
    `;
    
    // Beri tanda agar script lain tidak mencoba merender ulang konten
    mainContent.classList.add('access-denied-view');
}

function getUser() {
    try {
        const data = localStorage.getItem("user");
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
}

function getShortName(user) {
    if (!user) return "";
    return user.short_name || user.nickname || user.full_name?.split(" ")[0] || "User";
}

async function autoFetchUser() {
    const oldUser = getUser();
    if (!oldUser) return;

    // --- LOGIC JEDA WAKTU (1 JAM) ---
    const lastSync = localStorage.getItem("last_user_sync");
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 jam dalam milidetik

    // Kalau baru aja sinkron kurang dari 1 jam yang lalu, gausah narik data lagi
    if (lastSync && (now - parseInt(lastSync) < oneHour)) {
        return oldUser;
    }

    try {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", oldUser.id)
            .single();

        if (error || !data) return;

        // Update data user dan catat waktu sinkronisasi terbaru
        localStorage.setItem("user", JSON.stringify(data));
        localStorage.setItem("last_user_sync", now.toString());

        console.log("🔄 Data user berhasil diperbarui dari database.");
        return data;
    } catch (err) {
        console.error("Gagal auto-fetch:", err);
    }
}

async function logout() {
    const user = getUser();

    const yakin = await showPopup("Yakin mau logout?", "confirm");
    if (!yakin) return;

    try {
        const isInAdmin = window.location.pathname.includes('/admiii/');
        const isInA_logout = window.location.pathname.includes('/a/');
        const prefix = (isInAdmin || isInA_logout) ? '../' : '';

        // Catat ke DB siapa yang logout
        if (user && typeof supabase !== 'undefined') {
            try {
                await supabase.from("activity_logs").insert({
                    user_id: user.id,
                    action_text: "Melakukan Logout",
                    page_name: "Auth System",
                    points: 0,
                    class_id: (user.class_id || "unknown")
                });
            } catch (err) { console.warn("Gagal catat logout ke DB:", err); }
        }

        localStorage.removeItem("user");

        const classId = user?.class_id;
        const targetId = (classId && classId !== "undefined" && !isNaN(classId)) ? classId : "";
        const finalUrl = targetId ? `login?id=${targetId}` : "login";
        window.location.href = prefix + finalUrl;
    } catch (e) {
        console.error("Logout Error:", e);
        const isInAdmin = window.location.pathname.includes('/admiii/');
        const isInA_fb  = window.location.pathname.includes('/a/');
        window.location.href = (isInAdmin || isInA_fb ? "../" : "") + "login";
    }
}