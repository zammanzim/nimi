/* ==========================================================================
   js/auth.js — E-Learniz v3 Authentication & Active Class Session

   Aturan baru (lebih aman):
   - Siswa : login "pilih nama" dari v3.users, TANPA password. Sesi disimpan
             di localStorage. Ini memang model kelas, bukan akun rahasia.
   - Staff : WAJIB Supabase Auth (email/alias + password). Tidak ada lagi
             fallback "ketik admin/guru lalu jadi super_admin".
   - UI admin mengikuti sesi Supabase Auth yang valid + role staff di
             v3.users. RLS tetap menjadi pengaman utama di server.
   ========================================================================== */
(function () {
  const USER_STORAGE_KEY = typeof V3_USER_KEY !== 'undefined' ? V3_USER_KEY : 'elearniz_v3_user';
  const CLASS_SLUG_KEY = 'elearniz_v3_active_class_slug';
  const STAFF_ROLES = ['admin', 'superadmin', 'super_admin', 'class_admin', 'teacher', 'guru', 'staff'];

  function getActiveClassSlug() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('class');
    if (fromQuery) return fromQuery;
    return localStorage.getItem(CLASS_SLUG_KEY) || (typeof V3_DEFAULT_CLASS_SLUG !== 'undefined' ? V3_DEFAULT_CLASS_SLUG : 'xirpl2');
  }

  function setActiveClassSlug(slug) {
    if (!slug) return;
    localStorage.setItem(CLASS_SLUG_KEY, slug);
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function setCurrentUser(userObj) {
    if (!userObj) {
      localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    }
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userObj));
    return userObj;
  }

  function roleOf(userObj) {
    return String((userObj && userObj.role) || '').toLowerCase();
  }

  function isAdmin(userObj) {
    const u = userObj || getCurrentUser();
    if (!u || !u.role) return false;
    return STAFF_ROLES.includes(roleOf(u));
  }

  function isSuperAdmin(userObj) {
    const u = userObj || getCurrentUser();
    if (!u || !u.role) return false;
    return ['super_admin', 'superadmin'].includes(roleOf(u));
  }

  function getClient() {
    return window.ELearnizDB && window.ELearnizDB.getClient
      ? window.ELearnizDB.getClient()
      : null;
  }

  function getDb() {
    return window.ELearnizDB && window.ELearnizDB.api
      ? window.ELearnizDB.api()
      : null;
  }

  function resolveStaffEmail(input) {
    const clean = String(input || '').trim();
    if (!clean) return null;
    if (clean.includes('@')) return clean;

    const aliases = typeof V3_STAFF_EMAIL_ALIASES !== 'undefined' ? V3_STAFF_EMAIL_ALIASES : {};
    return aliases[clean.toLowerCase()] || null;
  }

  function buildStaffSession(authUser, row) {
    return {
      id: row.id,
      class_id: row.class_id,
      username: row.nickname || authUser.email || 'staff',
      nickname: row.nickname || authUser.email || 'Staff',
      display_name: row.full_name || row.nickname || authUser.email || 'Staff',
      full_name: row.full_name || row.nickname || authUser.email || 'Staff',
      role: row.role,
      auth_user_id: authUser.id,
      avatar_url: row.avatar_url || ''
    };
  }

  /**
   * Login staf murni lewat Supabase Auth.
   * Tidak ada fallback lokal. Kalau auth gagal / role bukan staff -> throw.
   */
  async function login(classSlug, usernameOrEmail, password) {
    if (classSlug) setActiveClassSlug(classSlug);

    const cleanInput = String(usernameOrEmail || '').trim();
    const cleanPassword = String(password || '').trim();
    if (!cleanInput) throw new Error('Masukkan email staf atau nama akun staf.');
    if (!cleanPassword) throw new Error('Masukkan password akun staf.');

    const email = resolveStaffEmail(cleanInput);
    if (!email) {
      throw new Error('Gunakan email staf yang terdaftar (contoh: nama@e-learniz.my.id).');
    }

    const client = getClient();
    const db = getDb();
    if (!client || !db) {
      throw new Error('Koneksi Supabase tidak tersedia. Cek koneksi internet lalu coba lagi.');
    }

    let authUser = null;
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: cleanPassword
      });
      if (error || !data || !data.user) {
        throw new Error('Email/username atau password salah.');
      }
      authUser = data.user;
    } catch (err) {
      // Jangan bocorkan detail auth internal ke UI.
      throw new Error(err && err.message ? err.message : 'Email/username atau password salah.');
    }

    let row = null;
    try {
      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      if (error) throw error;
      row = data;
    } catch (err) {
      try { await client.auth.signOut(); } catch (_) {}
      throw new Error('Gagal memverifikasi akun staf. Coba lagi.');
    }

    if (!row) {
      try { await client.auth.signOut(); } catch (_) {}
      throw new Error('Akun ini belum terhubung ke data staf kelas.');
    }

    if (!STAFF_ROLES.includes(String(row.role || '').toLowerCase())) {
      try { await client.auth.signOut(); } catch (_) {}
      throw new Error('Akun ini bukan staf/guru, jadi tidak bisa masuk mode admin.');
    }

    return setCurrentUser(buildStaffSession(authUser, row));
  }

  /**
   * Verifikasi sesi staf setiap kali app dibuka / ganti kelas.
   * - Siswa (tanpa auth_user_id) dikembalikan apa adanya.
   * - Staf harus punya sesi Supabase Auth yang masih aktif + role staff di DB.
   * - localStorage yang dioprek jadi super_admin tanpa sesi akan dibersihkan.
   */
  async function verifyStaffSession() {
    const user = getCurrentUser();
    if (!user) return null;

    // Sesi siswa pick-name tidak perlu verifikasi server.
    if (!user.auth_user_id && !isAdmin(user)) return user;

    const client = getClient();
    const db = getDb();
    if (!client || !db) {
      setCurrentUser(null);
      return null;
    }

    let session = null;
    try {
      const { data } = await client.auth.getSession();
      session = data && data.session;
    } catch (_) {
      session = null;
    }

    if (!session || !session.user) {
      setCurrentUser(null);
      return null;
    }

    let row = null;
    try {
      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      row = data;
    } catch (_) {
      // Tidak bisa verifikasi role karena gangguan jaringan. Turunkan ke
      // siswa supaya UI admin tidak aktif; sesi auth asli tetap tersimpan.
      return setCurrentUser({
        ...user,
        role: 'student',
        auth_user_id: session.user.id
      });
    }

    if (!row || !STAFF_ROLES.includes(String(row.role || '').toLowerCase())) {
      try { await client.auth.signOut(); } catch (_) {}
      setCurrentUser(null);
      return null;
    }

    return setCurrentUser(buildStaffSession(session.user, row));
  }

  function enterAsGuest(classSlug) {
    if (classSlug) setActiveClassSlug(classSlug);
    localStorage.removeItem(USER_STORAGE_KEY);
    try {
      const client = getClient();
      if (client) client.auth.signOut();
    } catch (_) {}
  }

  function loginStudent(studentObj, classSlug) {
    if (!studentObj || studentObj.id === undefined || studentObj.id === null) {
      throw new Error('Data siswa tidak valid.');
    }

    // Akun staf tidak boleh masuk lewat jalur pick-name.
    if (studentObj.auth_user_id || STAFF_ROLES.includes(String(studentObj.role || '').toLowerCase())) {
      throw new Error('Akun staf harus masuk lewat form staf dengan password.');
    }

    if (classSlug) setActiveClassSlug(classSlug);
    const userSession = {
      id: Number(studentObj.id),
      class_id: Number(studentObj.class_id),
      username: studentObj.nickname
        ? String(studentObj.nickname).toLowerCase()
        : (studentObj.full_name ? String(studentObj.full_name).toLowerCase() : 'siswa'),
      nickname: studentObj.nickname || (studentObj.full_name ? String(studentObj.full_name).split(' ')[0] : 'Siswa'),
      display_name: studentObj.full_name || studentObj.nickname || 'Siswa',
      full_name: studentObj.full_name || studentObj.nickname || 'Siswa',
      role: 'student',
      avatar_url: studentObj.avatar_url || ''
    };
    return setCurrentUser(userSession);
  }

  function logout() {
    localStorage.removeItem(USER_STORAGE_KEY);
    try {
      const client = getClient();
      if (client) client.auth.signOut();
    } catch (_) {}
  }

  window.ELearnizAuth = {
    getActiveClassSlug,
    setActiveClassSlug,
    getCurrentUser,
    setCurrentUser,
    isAdmin,
    isSuperAdmin,
    login,
    loginStudent,
    verifyStaffSession,
    enterAsGuest,
    logout
  };
})();
