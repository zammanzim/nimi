/* ==========================================================================
   js/visitor.js — Visitor Counter & Today's Visitor List

   Sumber data:
   - Pengguna login : tabel v3.visitors (1 baris per user, upsert by user_id)
   - Tamu          : localStorage (tidak punya user_id)
   - Jika DB/RLS sedang bermasalah, daftar lokal tetap ditampilkan.

   Semua waktu ditampilkan dalam WIB.
   ========================================================================== */
(function () {
  let cachedVisitors = [];
  let activeClassId = null;
  let activeUser = null;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function roleLabel(role) {
    const value = String(role || '').toLowerCase();
    if (value === 'super_admin' || value === 'superadmin') return 'Super Admin';
    if (value === 'class_admin' || value === 'admin') return 'Admin Kelas';
    if (value === 'teacher' || value === 'guru' || value === 'staff') return 'Guru / Staf';
    if (value === 'student') return 'Siswa';
    return 'Tamu';
  }

  function formatTime(value) {
    const T = window.ELearnizTime;
    if (!value) return 'Hari ini';
    if (T) {
      return T.formatDate(value, { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'Hari ini';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function renderVisitorBody(modalBody) {
    if (!modalBody) return;

    if (!cachedVisitors || cachedVisitors.length === 0) {
      modalBody.innerHTML = `
        <div class="empty-card-state">
          <i class="fa-solid fa-users"></i>
          <h4>Belum Ada Pengunjung</h4>
          <p>Daftar pengunjung kelas hari ini akan tampil di sini.</p>
        </div>
      `;
      return;
    }

    modalBody.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:0.55rem;">
        ${cachedVisitors.map((v) => {
          const name = String(v.display_name || 'Tamu');
          const initial = name.charAt(0).toUpperCase() || '?';
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.85rem;background:var(--bg-subtle);border-radius:12px;border:1px solid var(--border-color);gap:0.6rem;">
              <div style="display:flex;align-items:center;gap:0.65rem;min-width:0;">
                <div class="profile-avatar" style="width:32px;height:32px;font-size:0.78rem;flex-shrink:0;">${escapeHtml(initial)}</div>
                <div style="min-width:0;">
                  <div style="font-weight:700;font-size:0.85rem;color:var(--text-main);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(name)}</div>
                  <div style="font-size:0.7rem;color:var(--accent);font-weight:700;">${escapeHtml(roleLabel(v.role))}</div>
                </div>
              </div>
              <span style="font-size:0.72rem;color:var(--text-muted);font-weight:600;white-space:nowrap;">${escapeHtml(formatTime(v.visited_at))}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function refreshVisitors() {
    if (!activeClassId) {
      cachedVisitors = [];
      return;
    }
    try {
      cachedVisitors = await window.ELearnizDB.listTodayVisitors(activeClassId);
    } catch (err) {
      console.warn('refreshVisitors error:', err);
      cachedVisitors = [];
    }
  }

  async function initVisitorCounter(classId, currentUser) {
    activeClassId = classId || null;
    activeUser = currentUser || null;

    const countEl = document.getElementById('visitorCount');
    const triggerBtn = document.getElementById('visitorTrigger');
    const modal = document.getElementById('visitorModal');
    const modalBody = document.getElementById('visitorModalBody');

    if (activeClassId) {
      try {
        await window.ELearnizDB.logVisit(activeClassId, {
          userId: activeUser ? activeUser.id : null,
          displayName: activeUser
            ? (activeUser.display_name || activeUser.full_name || activeUser.username || 'Pengguna')
            : 'Tamu',
          role: activeUser ? (activeUser.role || 'student') : 'guest',
          lastPage: window.location.hash || '#/'
        });
      } catch (err) {
        // Data lokal sudah tersimpan di logVisit; DB bisa dicoba lagi nanti.
        console.warn('logVisit error:', err);
      }
    }

    await refreshVisitors();

    if (countEl) {
      countEl.textContent = String(cachedVisitors.length);
    }

    if (triggerBtn && modal && modalBody) {
      triggerBtn.onclick = async (e) => {
        if (e) e.preventDefault();

        if (typeof window.toggleProfileDropdown === 'function') {
          window.toggleProfileDropdown(false);
        } else {
          const dropdownMenu = document.getElementById('dropdownMenu');
          if (dropdownMenu) dropdownMenu.classList.remove('show');
          const caretIcon = document.getElementById('caretIcon');
          if (caretIcon) caretIcon.classList.remove('rotate');
        }

        // Buka modal langsung dengan skeleton, lalu isi dengan data terbaru.
        modalBody.innerHTML = `
          <div class="sk-fx" style="display:flex;flex-direction:column;gap:0.55rem;" role="status" aria-label="Memuat pengunjung...">
            ${[0, 1, 2].map(() => `
              <div style="display:flex;align-items:center;gap:0.65rem;padding:0.6rem 0.85rem;border-radius:12px;border:1px solid var(--border-color);">
                <span class="sk sk-circle" style="width:32px;height:32px;"></span>
                <span style="flex:1;display:flex;flex-direction:column;gap:6px;">
                  <span class="sk" style="width:55%;height:12px;"></span>
                  <span class="sk" style="width:30%;height:10px;"></span>
                </span>
              </div>`).join('')}
          </div>`;

        if (window.ELearnizUI && window.ELearnizUI.popup) {
          window.ELearnizUI.popup.open(modal);
        } else {
          modal.classList.add('open');
        }

        // Ambil data terbaru setiap modal dibuka.
        await refreshVisitors();
        if (countEl) countEl.textContent = String(cachedVisitors.length);
        renderVisitorBody(modalBody);
      };
    }
  }

  window.ELearnizVisitor = {
    initVisitorCounter,
    refresh: refreshVisitors
  };
})();
