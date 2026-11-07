// js/admin-menu-logic.js
let allMenuData = [];
document.addEventListener('DOMContentLoaded', () => {
    setupClassDropdown();
    loadClassMenus();
});

async function autoCalculateOrder() {
    const editId = document.getElementById('editId').value;
    const classId = document.getElementById('mClassId').value;
    const group = document.getElementById('mGroup').value;

    // Hanya jalan otomatis jika sedang "Tambah Baru" (bukan edit)
    if (editId || !classId || !group) return;

    const { data, error } = await supabase
        .from('subjects_config')
        .select('display_order')
        .eq('class_id', classId)
        .eq('menu_group', group)
        .order('display_order', { ascending: false })
        .limit(1);

    if (!error) {
        const nextOrder = (data && data.length > 0) ? (data[0].display_order + 1) : 1;
        document.getElementById('mOrder').value = nextOrder;
    }
}

async function setupClassDropdown() {
    const filterSelect = document.getElementById('targetClassId');
    const formSelect = document.getElementById('mClassId');

    const { data } = await supabase.from('classes').select('id, name').eq('is_active', true).order('id');
    if (data) {
        data.forEach(cls => {
            // Dropdown Filter
            const optF = document.createElement('option');
            optF.value = cls.id;
            optF.innerText = `🌍 ${cls.name}`;
            filterSelect.appendChild(optF);

            // Dropdown Form
            const optS = document.createElement('option');
            optS.value = cls.id;
            optS.innerText = cls.name;
            formSelect.appendChild(optS);
        });
    }
}

// js/admin-menu-logic.js

async function loadClassMenus() {
    const classId = document.getElementById('targetClassId').value;
    const container = document.getElementById('menuListContainer');
    container.innerHTML = `<p style='text-align:center; padding: 20px;'>${t('loading_data')}</p>`;

    let query = supabase.from('subjects_config').select('*').order('class_id').order('display_order');
    if (classId !== 'all') query = query.eq('class_id', classId);

    const { data, error } = await query;
    if (error) return alert(t('failed_load_data'));

    container.innerHTML = "";
    if (data.length === 0) {
        container.innerHTML = `<p style='text-align:center; color: #888; padding: 40px;'>${t('data_empty')}</p>`;
        return;
    }

    if (classId === 'all') {
        const grouped = data.reduce((acc, item) => {
            if (!acc[item.class_id]) acc[item.class_id] = [];
            acc[item.class_id].push(item);
            return acc;
        }, {});

        for (const [id, menus] of Object.entries(grouped)) {
            const groupHeader = document.createElement('div');
            groupHeader.innerHTML = `<h2 style="color: #ffd700; font-size: 15px; margin: 25px 0 10px 0; border-bottom: 1px solid rgba(255,215,0,0.2); padding-bottom: 5px;">
                <i class="fa-solid fa-users"></i> ${t('class')} ID: ${id}</h2>`;
            container.appendChild(groupHeader);
            menus.forEach(item => container.appendChild(createMenuItemElement(item)));
        }
    } else {
        const main = data.filter(i => i.menu_group === 'main');
        const lesson = data.filter(i => i.menu_group === 'lessons');
        const adminItems = data.filter(i => i.menu_group === 'admin');
        const systemItems = data.filter(i => i.menu_group === 'system');

        // Fungsi pembantu agar tidak pakai innerHTML +=
        const renderHeader = (text, color) => {
            const h3 = document.createElement('h3');
            h3.style.cssText = `color: ${color}; margin: 20px 0 10px 0; font-size: 13px; opacity:0.8;`;
            h3.innerText = text;
            container.appendChild(h3);
        };

        if (systemItems.length > 0) {
            renderHeader(t('system_menu_global'), "#00eaff");
            systemItems.forEach(i => container.appendChild(createMenuItemElement(i)));
        }

        if (adminItems.length > 0) {
            renderHeader(t('sidebar_admin'), "#ff4757");
            adminItems.forEach(i => container.appendChild(createMenuItemElement(i)));
        }
        if (main.length > 0) {
            renderHeader(t('sidebar_main'), "#ffd700");
            main.forEach(i => container.appendChild(createMenuItemElement(i)));
        }
        if (lesson.length > 0) {
            renderHeader(t('sidebar_lessons'), "#00eaff");
            lesson.forEach(i => container.appendChild(createMenuItemElement(i)));
        }
    }
}

function createMenuItemElement(item) {
    const div = document.createElement('div');
    div.className = "subject-item animate-slide-right";

    // Logika menampilkan badge jika ada
    const badgeHtml = item.badge
        ? `<span class="${item.badge_type}" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px; border: 1px solid rgba(255,255,255,0.2);">${item.badge}</span>`
        : '';

    div.innerHTML = `
        <div class="subject-info">
            <i class="fa-solid ${item.icon || 'fa-question'}" style="color: #00eaff; width: 25px; text-align: center;"></i>
            <div>
                <h4 style="margin: 0; font-size: 14px;">${item.subject_name} ${badgeHtml}</h4>
                <small style="color: #888;">/${item.subject_id} • Order: ${item.display_order}</small>
            </div>
        </div>
        <div style="display: flex; gap: 5px;">
            <button class="btn-action" id="btnEdit-${item.id}"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="btn-action btn-delete" onclick="deleteMenu(${item.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    div.querySelector(`#btnEdit-${item.id}`).onclick = () => editMenu(item);
    return div;
}

// FORM LOGIC
function autoSlug(val) {
    if (!document.getElementById('editId').value) {
        document.getElementById('mSubjectId').value = val.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    }
}

function previewIcon(val) {
    document.getElementById('iconPreview').innerHTML = `<i class="fa-solid ${val}"></i>`;
}

function editMenu(item) {
    document.getElementById('formTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> ${t('edit_material')}`;
    document.getElementById('editId').value = item.id;
    document.getElementById('mClassId').value = item.class_id;
    document.getElementById('mSubjectName').value = item.subject_name;
    document.getElementById('mSubjectId').value = item.subject_id;
    document.getElementById('mIcon').value = item.icon;
    document.getElementById('mOrder').value = item.display_order;
    document.getElementById('mGroup').value = item.menu_group;
    document.getElementById('btnReset').style.display = "block";
    document.getElementById('mBadge').value = item.badge || "";
    document.getElementById('mBadgeType').value = item.badge_type || "";

    previewIcon(item.icon);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 1. Fungsi Simpan yang Pintar
async function saveMenu() {
    const id = document.getElementById('editId').value;
    const currentFilter = document.getElementById('targetClassId').value; // Catat filter saat ini

    const payload = {
        class_id: document.getElementById('mClassId').value,
        subject_name: document.getElementById('mSubjectName').value,
        subject_id: document.getElementById('mSubjectId').value,
        icon: document.getElementById('mIcon').value,
        display_order: parseInt(document.getElementById('mOrder').value),
        menu_group: document.getElementById('mGroup').value,
        badge: document.getElementById('mBadge').value,        // Tambahkan ini
        badge_type: document.getElementById('mBadgeType').value // Tambahkan ini
    };

    if (!payload.class_id || !payload.subject_name) {
        if (window.showPopup) showPopup(t('data_incomplete'), "error");
        return;
    }

    const { error } = id
        ? await supabase.from('subjects_config').update(payload).eq('id', id)
        : await supabase.from('subjects_config').insert([payload]);

    if (error) {
        if (window.showPopup) showPopup(t('failed_generic') + ': ' + error.message, "error");
    } else {
        if (window.showToast) showToast(id ? t('updated_success') : t('menu_added'), "success");

        // RESET FORM TANPA RESET FILTER
        resetForm();

        // REFRESH LIST (Otomatis pakai filter yang masih nempel di dropdown)
        loadClassMenus();
    }
}

// 2. Fungsi Reset yang Tidak "Lupa Ingatan"
function resetForm() {
    document.getElementById('formTitle').innerHTML = `<i class="fa-solid fa-plus"></i> ${t('add_new')}`;
    document.getElementById('editId').value = "";
    document.getElementById('mSubjectName').value = "";
    document.getElementById('mSubjectId').value = "";
    document.getElementById('mIcon').value = "fa-book";
    document.getElementById('mOrder').value = "1";
    document.getElementById('mBadge').value = "";       // Reset badge (dari update sebelumnya)
    document.getElementById('mBadgeType').value = "";
    document.getElementById('btnReset').style.display = "none";

    // PENTING: Set dropdown form sesuai dengan filter yang aktif
    const filterValue = document.getElementById('targetClassId').value;
    document.getElementById('mClassId').value = (filterValue !== 'all') ? filterValue : "";

    previewIcon("fa-book");
}

async function deleteMenu(id) {
    // 1. Cari data materi buat ditampilin namanya di popup
    const item = allMenuData.find(m => String(m.id) === String(id));
    const itemName = item ? item.subject_name : t('this_material');

    // 2. Panggil popup universal dengan mode 'confirm'
    const yakin = await showPopup(t('confirm_delete_item', { name: itemName }), "confirm");

    // 3. Jika user klik 'Ya' (yakin === true)
    if (yakin) {
        const { error } = await supabase
            .from('subjects_config')
            .delete()
            .eq('id', id);

        if (error) {
            if (window.showPopup) showPopup(t('failed_generic') + ': ' + error.message, "error");
        } else {
            if (window.showToast) showToast(t('deleted_success'), "success");

            // 4. Refresh daftar menu setelah berhasil hapus
            loadClassMenus();
        }
    }
}

// 1. Koleksi Ikon yang lebih lengkap
const ICON_LIBRARY = [
    'fa-book', 'fa-book-open', 'fa-calculator', 'fa-language', 'fa-flask', 'fa-palette',
    'fa-microscope', 'fa-earth-americas', 'fa-dna', 'fa-laptop-code', 'fa-music', 'fa-medal',
    'fa-bullhorn', 'fa-clipboard-list', 'fa-calendar-days', 'fa-message', 'fa-comments',
    'fa-gears', 'fa-user-shield', 'fa-users-gear', 'fa-user-group', 'fa-shield-halved',
    'fa-house', 'fa-folder-open', 'fa-link', 'fa-circle-question', 'fa-star', 'fa-fire',
    'fa-graduation-cap', 'fa-vial', 'fa-brain', 'fa-atom', 'fa-shapes', 'fa-pen-nib', 'fa-list-check', 'fa-user-gear', 'fa-search', "fa-file-lines", 
    'fa-gear'
];

// 2. Fungsi buka Modal
// 2. Fungsi buka Modal (Lebih Galak)
function openIconPicker() {
    const modal = document.getElementById('iconPickerModal');
    if (!modal) return console.error("Modal tidak ditemukan!");

    // Tambah class 'show' biar sinkron sama CSS template
    modal.classList.add('show'); 
    
    // Paksa muncul pakai inline style buat overwrite CSS yang bandel
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';

    document.getElementById('searchIconInput').value = ''; // Reset search
    renderIconGrid(ICON_LIBRARY);
    
}

function closeIconPicker() {
    const modal = document.getElementById('iconPickerModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
}

// 3. Fungsi Render Grid Ikon (Bisa buat filter juga)
function renderIconGrid(list) {
    const grid = document.getElementById('iconGrid');
    grid.innerHTML = '';

    list.forEach(icon => {
        const btn = document.createElement('button');
        btn.className = 'btn-glass-icon-select';
        btn.style.cssText = "background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:15px; border-radius:8px; color:white; cursor:pointer; font-size:20px; transition:0.3s;";
        btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;

        btn.onclick = () => {
            document.getElementById('mIcon').value = icon; // Masuk ke input hidden
            document.getElementById('iconPreview').innerHTML = `<i class="fa-solid ${icon}"></i>`; // Update preview
            closeIconPicker();
        };

        btn.onmouseover = () => btn.style.background = 'rgba(0, 234, 255, 0.2)';
        btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.05)';
        grid.appendChild(btn);
    });
}

// 4. Fungsi Search Ikon (Biar gak pusing nyari)
function filterIcons(query) {
    const filtered = ICON_LIBRARY.filter(icon =>
        icon.toLowerCase().includes(query.toLowerCase())
    );
    renderIconGrid(filtered);
}