// js/ui-components.js
const UIComponents = {
    inject() {
        // Cek agar tidak inject dua kali
        if (document.getElementById('addModal')) return;

        const body = document.body;
        if (!body) return;

        const cachedCount = localStorage.getItem('cached_visitor_count') || '0';

        // Baca user data synchronously buat populate header tanpa blink
        let _uData = null;
        try { _uData = JSON.parse(localStorage.getItem('user')); } catch(e) {}
        const _isSubDir = /\/(a|admiii)\//.test(window.location.pathname);
        const _defaultPP = _isSubDir ? '../icons/profpicture.png' : 'icons/profpicture.png';
        const _avatarSrc = (_uData && _uData.avatar_url) ? _uData.avatar_url : _defaultPP;
        const _displayName = _uData ? (_uData.short_name || _uData.nickname || 'User') : '...';

        // Logika Class Switcher & POV Student
        let classSwitcherHTML = '';
        let povToggleHTML = '';

        // POV Toggle — super_admin only
        if (_uData && (_uData.role === 'super_admin' || _uData.original_role === 'super_admin')) {
            const isPOV = _uData.role === 'student';
            povToggleHTML = `
            <div id="povToggleWrapper" style="display:flex; align-items:center; gap:8px; margin-right:12px; background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:20px; border:1px solid rgba(255,255,255,0.1);">
                <span style="font-size:10px; color:#aaa; font-weight:600; letter-spacing:0.5px;">POV STUDENT</span>
                <label class="switch">
                    <input type="checkbox" id="povStudentToggle" ${isPOV ? 'checked' : ''} onchange="UIComponents.toggleStudentPOV(this.checked)">
                    <span class="slider round" style="before: {width:14px; height:14px; left:2px; bottom:2px;}"></span>
                </label>
            </div>`;
        }

        // Class Switcher — super_admin & teacher
        if (_uData && (_uData.role === 'super_admin' || _uData.original_role === 'super_admin' || _uData.role === 'teacher')) {
            let currentClassName = `${t('class')}`;
            try {
                const overrideName = sessionStorage.getItem('class_override_name');
                if (overrideName) {
                    currentClassName = overrideName;
                } else if (_uData.class_name) {
                    currentClassName = _uData.class_name;
                } else {
                    currentClassName = `${t('class')} ${_uData.class_id}`;
                }
            } catch(e) {}

            classSwitcherHTML = `
            <div id="classSwitcherWrapper" style="display:flex; position:relative; margin-right:8px;">
                <div id="classSwitcherTrigger" onclick="toggleClassSwitcher()" style="
                    display:flex; align-items:center; gap:6px;
                    background:rgba(0, 234, 255, 0.08); border:1px solid rgba(0, 234, 255, 0.25);
                    border-radius:20px; padding:5px 12px; cursor:pointer;
                    font-size:12px; color:var(--accent, #00eaff); transition:all 0.2s;
                ">
                    <i class="fa-solid fa-layer-group" style="font-size:11px;"></i>
                    <span id="classSwitcherLabel">${currentClassName}</span>
                    <i class="fa-solid fa-caret-down" style="font-size:10px;"></i>
                </div>
                <div id="classSwitcher" style="
                    display:none; position:absolute; top:calc(100% + 8px); left:0;
                    background:#111; border:1px solid rgba(0, 234, 255, 0.2);
                    border-radius:10px; min-width:140px; overflow:hidden; z-index:9999;
                "></div>
            </div>`;
        }

        // 1. HEADER & VISITOR
        const _pathPrefix = _isSubDir ? '../' : '';
        const profileHTML = _uData ? `
            <div class="profile-box" id="profileTrigger">
                <span id="headerName">${t('hi')}, ${_displayName}</span>
                <img id="headerPP" class="header-pp" src="${_avatarSrc}">
                <i class="fa-solid fa-caret-down"></i>
            </div>
            <div class="profile-dropdown" id="profileDropdown">
                <ul>
                    <li onclick="goAnnouncements()"><i class="fa-solid fa-table-columns"></i>${t('announcements2')}</li>
                    <li onclick="goProfile()"><i class="fa-solid fa-user"></i>${t('edit_prof')}</li>
                    <li onclick="window.location.href='${_pathPrefix}theme'"><i class="fa-solid fa-palette"></i>${t('theme2')}</li>
                    ${_uData.role === 'super_admin' || _uData.role === 'class_admin' ? `<li onclick="window.location.href='${_pathPrefix}admiii/visitor'"><i class="fa-solid fa-tower-broadcast"></i> Monitor Visitor</li>` : ''}
                    <li onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</li>
                </ul>
            </div>
        ` : `
            <a href="${_pathPrefix}login" class="guest-login-btn">
                <i class="fa-solid fa-right-to-bracket"></i> Login
            </a>`;

        const headerHTML = `
        <header>
            <div class="header-left">
                <div class="hamburger" id="hamburger" onclick="toggleMenu()">
                    <span></span><span></span><span></span>
                </div>
                <div id="visitorTrigger" class="visitor-trigger">
                    <i class="fa-solid fa-eye"></i>
                    <span id="headerVisitorCount">${cachedCount}</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; flex:1; justify-content:flex-end;">
                ${povToggleHTML}
                ${classSwitcherHTML}
            </div>
            ${profileHTML}
        </header>
        <div id="visitorOverlay" class="visitor-overlay">
            <div class="visitor-popup">
                <div class="popup-header">
                    <h3>${t('visitor')} <i class="fa-solid fa-eye" style="font-size:15px; margin-left: 10px;"></i> <span id="popupVisitorCount" style="font-size:16px; font-weight:bold; color:var(--accent, #00eaff);">${cachedCount}</span></h3>
                    <span id="closeVisitorPopup" class="close-popup">&times;</span>
                </div>

                <!-- Tab kelas -->
                <div id="visitorTabs" class="visitor-tabs"></div>

                <!-- NEW: Wrapped List Section -->
                <div class="list-section">
                    <div id="visitorList" class="visitor-list-container"></div>
                </div>

                <div class="admin-actions" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#aaa;cursor:pointer;">
                        <label class="switch" style="margin:0;">
                            <input type="checkbox" id="autoResetVisitor">
                            <span class="slider"></span>
                        </label>
                        Auto Reset 15:00
                    </label>
                    <button id="resetVisitorBtn" class="btn-reset-text">
                        <i class="fa-solid fa-rotate-right"></i> ${t('resetvist')}
                     </button>
                </div>
            </div>
        </div>`;

        // 2. MODALS (Add & Detail)
        const modalsHTML = `
        <div id="addModal" class="modal-overlay hidden">
            <div class="glass-modal-box">
                <h3><i class="fa-solid fa-layer-group"></i> ${t('new_material')}</h3>
                
                <!-- NEW: Step 1 - Configuration -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; margin-bottom: 15px;">
                    <div class="form-group" style="margin-bottom: 10px;">
                        <label style="font-size: 11px; color: #888; margin-bottom: 5px; display: block;">${t('send2page')}:</label>
                        <select id="addDestPage" class="glass-input" style="padding: 8px 12px; font-size: 13px;">
                            <option value="announcements">Announcements</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <label style="font-size: 13px; color: #fff; cursor: pointer;" for="addIsLesson">${t('markasassign')}</label>
                        <label class="switch">
                            <input type="checkbox" id="addIsLesson">
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top:8px;">
                        <label style="font-size: 13px; color: #ffd32a; cursor: pointer;" for="addIsTask">📋 Wajib Kumpul</label>
                        <label class="switch">
                            <input type="checkbox" id="addIsTask">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>

                <!-- Materi Susulan: pilih tanggal (cuma muncul di halaman susulan) -->
                <div id="susulanDayWrap" style="display:none; background: rgba(0,234,255,0.05); border: 1px solid rgba(0,234,255,0.25); border-radius: 12px; padding: 12px; margin-bottom: 15px;">
                    <label style="font-size: 11px; color: #888; margin-bottom: 5px; display: block;">${t('choose_date')}:</label>
                    <select id="susulanDateSelect" class="glass-input" style="padding: 8px 12px; font-size: 13px; width:100%;">
                        <option value="">${t('susulan_no_date')}</option>
                    </select>
                    <!-- backward compat: hidden old day select biar script lama ga error -->
                    <select id="susulanDaySelect" style="display:none;"><option value="Senin">Senin</option></select>
                </div>

                <!-- Materi Susulan: pilih pelajaran (sesuai jadwal daily card) -->
                <div id="susulanSubjectWrap" style="display:none; background: rgba(0,234,255,0.05); border: 1px solid rgba(0,234,255,0.25); border-radius: 12px; padding: 12px; margin-bottom: 15px;">
                    <label style="font-size: 11px; color: #888; margin-bottom: 5px; display: block;">${t('susulan_subject')}:</label>
                    <select id="susulanSubjectSelect" class="glass-input" style="padding: 8px 12px; font-size: 13px; width:100%;">
                        <option value="">-</option>
                    </select>
                </div>

                <input type="text" id="addJudul" class="glass-input" placeholder="${t('title')}" spellcheck="false">
                <input type="text" id="addSubjudul" class="glass-input" placeholder="${t('subtitle')}" spellcheck="false">
                <div class="editor-toolbar" style="display:flex; gap:6px; margin-bottom: 8px; align-items:center;">
                    <button type="button" onclick="formatBold()" class="btn-tool" title="Tebal (Ctrl+B)" style="font-weight:700;">B</button>
                    <button type="button" onclick="formatItalic()" class="btn-tool" title="Miring (Ctrl+I)" style="font-style:italic;">I</button>
                    <button type="button" onclick="formatUnderline()" class="btn-tool" title="Garis bawah (Ctrl+U)" style="text-decoration:underline;">U</button>
                    <span style="width:1px;height:18px;background:rgba(255,255,255,0.15);margin:0 4px;"></span>
                    <button type="button" onclick="formatText('5')" class="btn-tool">${t('large')}</button>
                    <button type="button" onclick="formatText('3')" class="btn-tool">${t('medium')}</button>
                    <button type="button" onclick="formatText('2')" class="btn-tool">${t('small')}</button>
                </div>
                <div id="addIsi" contenteditable="true" class="glass-input" style="min-height: 150px; overflow-y: auto; plac"></div>
                <input type="text" id="addSmall" class="glass-input" placeholder="${t('footer')}" style="font-size: 12px; opacity:0.8;">
<div class="color-picker-container" style="margin-top: 15px;">
    <label style="font-size: 12px; color: #aaa; margin-bottom: 8px; display: block;">${t('card_color')}:</label>
    <div id="addColors" class="color-options" style="display: flex; gap: 8px; flex-wrap: wrap;">
    <div class="color-opt active" data-color="default" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; cursor: pointer; background: rgba(0,0,0,0.3);"></div>
    <div class="color-opt" data-color="red" style="width: 22px; height: 22px; border-radius: 50%; background: #ff4757; cursor: pointer;"></div>
    <div class="color-opt" data-color="orange" style="width: 22px; height: 22px; border-radius: 50%; background: #ff9f43; cursor: pointer;"></div>
    <div class="color-opt" data-color="yellow" style="width: 22px; height: 22px; border-radius: 50%; background: #ffd32a; cursor: pointer;"></div>
    <div class="color-opt" data-color="green" style="width: 22px; height: 22px; border-radius: 50%; background: #2ed573; cursor: pointer;"></div>
    <div class="color-opt" data-color="blue" style="width: 22px; height: 22px; border-radius: 50%; background: #00c8ff; cursor: pointer;"></div>
    <div class="color-opt" data-color="purple" style="width: 22px; height: 22px; border-radius: 50%; background: #a55eea; cursor: pointer;"></div>
    <div class="color-opt" data-color="pink" style="width: 22px; height: 22px; border-radius: 50%; background: #ff9ff3; cursor: pointer;"></div>
    <div class="color-opt" data-color="brown" style="width: 22px; height: 22px; border-radius: 50%; background: #8b4513; cursor: pointer;"></div>
</div>
</div>
                <div id="dropZone" class="drop-area">
                    <i class="fa-solid fa-cloud-arrow-up drop-icon"></i>
                    <div class="drop-text">${t('uploadphotos')}</div>
                    <input type="file" id="addFiles" multiple style="display: none;">
                </div>
                <div id="previewContainer" class="preview-container"></div>
                <div class="action-buttons">
                    <button id="btnCancelAdd" class="btn-glass-cancel">${t('cancel')}</button>
                    <button id="btnSaveAdd" class="btn-glass-save"><i class="fa-solid fa-paper-plane"></i> Posting</button>
                </div>
            </div>
        </div>

        <div id="detailOverlay" class="detail-overlay">
            <div class="glass-detail-box">
                <span class="close-detail-btn" onclick="closeDetail()">&times;</span>
                <div class="detail-media-section">
                    <div class="slider-wrapper">
                        <img id="detailImg" src="">
                        <div id="sliderNavBtns" class="slider-nav-container">
                            <button class="glass-nav-btn prev-btn" onclick="prevSlide(event)"><i class="fa-solid fa-chevron-left"></i></button>
                            <button class="glass-nav-btn next-btn" onclick="nextSlide(event)"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                        <div id="toggleInfoBtn" class="mobile-toggle-btn" onclick="showMobileInfo(event)"><i class="fa-solid fa-circle-info"></i> ${t('see_desc')}</div>
                        <div id="photoCounterTag" class="photo-counter-tag">1 / 1</div>
                    </div>
                </div>
                <div id="detailInfoSection" class="detail-info-section hidden-mobile">
                    <div class="sheet-header-mobile">
                        <button id="sheetToggleBtn" class="sheet-btn-left" onclick="toggleSheetHeight(event)"><i class="fa-solid fa-expand"></i></button>
                        <div class="sheet-drag-indicator" style="width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 10px;"></div>
                        <button class="sheet-btn-right" onclick="toggleMobileInfo(event)"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="info-content-scroll">
                        <h2 id="detailBigTxt"></h2>
                        <h4 id="detailTitleTxt"></h4>
                        <div id="detailContentTxt" class="detail-body-text"></div>
                        <small id="detailSmallTxt" class="detail-footer-text" style="margin-bottom: 50px;"></small>
                    </div>
                </div>
            </div>
        </div>`;

        body.insertAdjacentHTML('afterbegin', headerHTML);
        body.insertAdjacentHTML('beforeend', modalsHTML);

        // ── Paste handler: sanitize HTML di addIsi ────────────────
        // code dari VSCode warnanya stay, tapi style layout dibuang biar width ga liar
        const _addIsi = document.getElementById('addIsi');
        if (_addIsi) {
            _addIsi.addEventListener('paste', (e) => {
                const html = (e.clipboardData || window.clipboardData).getData('text/html');
                if (html) {
                    e.preventDefault();
                    const cleaned = _sanitizePasteHTML(html);
                    document.execCommand('insertHTML', false, cleaned);
                }
                // kalo ga ada HTML (plain text), biarin default
            });
        }

        // 3. CONTEXT MENU
        this.contextMenu.init();
    },

    toggleStudentPOV(active) {
        let user;
        try { user = JSON.parse(localStorage.getItem('user')); } catch(e) { return; }
        if (!user) return;

        if (active) {
            // Aktifkan POV Student
            user.original_role = user.role;
            user.role = 'student';
        } else {
            // Balikkan ke Super Admin
            user.role = user.original_role || 'super_admin';
            delete user.original_role;
        }

        localStorage.setItem('user', JSON.stringify(user));
        
        // Kasih loading bentar biar transisinya enak
        const loader = document.createElement('div');
        loader.style = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:sans-serif;';
        loader.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="font-size:30px; margin-bottom:15px; color:#00eaff;"></i><span>Beralih Perspektif...</span>';
        document.body.appendChild(loader);

        setTimeout(() => window.location.reload(), 800);
    },

    contextMenu: {
        init() {
            if (typeof ContextMenu === 'undefined') return;
            ContextMenu.init();
            ContextMenu.registerProvider(
                'ui-components',
                (e) => this.provideContextMenu(e),
                0,
                (touch, target) => this.provideLongPress(touch, target)
            );
        },

        provideLongPress(touch, target) {
            const isSubjectPage = !!document.getElementById('announcements');
            const isTugasPage = !!document.getElementById('taskList');
            if (!isSubjectPage && !isTugasPage) return null;

            const card = target.closest('.course-card');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');

            this.renderMenu(card, isAdmin);
            return { html: document.getElementById('customContextMenu').innerHTML };
        },

        provideContextMenu(e) {
            if (e.target.closest('.admin-fab-container') ||
                e.target.closest('.daily-fab-container') ||
                e.target.closest('.updates-fab') ||
                e.target.closest('.drag-grip') ||
                e.target.closest('.dc-edit-btn-wrap')) {
                return { html: '', preventDefault: true };
            }

            const isSubjectPage = !!document.getElementById('announcements');
            const isTugasPage = !!document.getElementById('taskList');
            const isDailyCard = e.target.closest('#dailyInfoCard');
            if (!isSubjectPage && !isTugasPage && !isDailyCard) return null;

            const card = e.target.closest('.course-card');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');

            this.renderMenu(card || isDailyCard, isAdmin, !!isDailyCard);
            return { html: document.getElementById('customContextMenu').innerHTML };
        },

        initTouchEvents() {
            let touchTimer;
            const longPressDuration = 500; // ms

            document.addEventListener('touchstart', (e) => {
                // Jangan trigger kalau klik kanan asli (untuk device hybrid)
                if (e.touches.length > 1) return;

                // FIX: Abaikan element draggable (FAB & Grip) biar gak bentrok sama drag timer
                if (e.target.closest('.admin-fab-container') || 
                    e.target.closest('.daily-fab-container') || 
                    e.target.closest('.updates-fab') ||
                    e.target.closest('.drag-grip') ||
                    [...e.target.classList].some(c => c.includes('fab'))) return;

                const touch = e.touches[0];
                const card = e.target.closest('.course-card');
                
                touchTimer = setTimeout(() => {
                    this.handleLongPress(touch, card);
                }, longPressDuration);
            }, { passive: true });

            document.addEventListener('touchend', () => {
                clearTimeout(touchTimer);
            });

            document.addEventListener('touchmove', () => {
                clearTimeout(touchTimer);
            }, { passive: true });
        },

        handleLongPress(touch, card) {
            // Hanya aktif di Subject & Tugas page
            const isSubjectPage = !!document.getElementById('announcements');
            const isTugasPage = !!document.getElementById('taskList');
            if (!isSubjectPage && !isTugasPage) return;

            // Vibrate feedback if supported
            if (navigator.vibrate) navigator.vibrate(50);

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');

            this.renderMenu(card, isAdmin);
            this.show(touch.clientX, touch.clientY);
        },

        handleContextMenu(e) {
            // FIX: Kunci total buat FAB & Grip — jangan munculin menu (custom maupun browser)
            // biar gak ganggu logic drag-and-drop
            if (e.target.closest('.admin-fab-container') || 
                e.target.closest('.daily-fab-container') || 
                e.target.closest('.updates-fab') ||
                e.target.closest('.drag-grip') ||
                e.target.closest('.dc-edit-btn-wrap')) {
                e.preventDefault();
                return;
            }

            // Hanya aktif di Subject, Tugas, atau Announcements page
            const isSubjectPage = !!document.getElementById('announcements');
            const isTugasPage = !!document.getElementById('taskList');
            const isDailyCard = e.target.closest('#dailyInfoCard');
            
            // Jika bukan di halaman yang didukung, biarkan menu default browser
            if (!isSubjectPage && !isTugasPage && !isDailyCard) return;

            e.preventDefault();

            const card = e.target.closest('.course-card');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');

            this.renderMenu(card || isDailyCard, isAdmin, !!isDailyCard);
            this.show(e.clientX, e.clientY);
        },

        renderMenu(card, isAdmin, isDaily = false) {
            const menu = document.getElementById('customContextMenu');
            let html = '<ul>';

            if (isDaily) {
                // Daily Card Context
                html += `
                    <li class="has-submenu" onclick="UIComponents.contextMenu.toggleSubmenu(event, this)">
                        <i class="fa-solid fa-calendar-days"></i> ${t('view_schedule')}
                        <div class="context-submenu daily-days-grid">
                            ${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(day => 
                                `<div class="ctx-day-item" onclick="window.switchDailyDay('${day}')">${day.substring(0,3)}</div>`
                            ).join('')}
                        </div>
                    </li>
                `;
                if (isAdmin) {
                    if (window.isDailyEditing) {
                        html += `<li onclick="window.saveAllDrafts()"><i class="fa-solid fa-check"></i> ${t('save_schedule')}</li>`;
                    } else {
                        html += `<li onclick="window.toggleDailyEditMode()"><i class="fa-solid fa-pen-to-square"></i> ${t('edit_schedule')}</li>`;
                    }
                }
                html += `<div class="divider"></div>`;
            } else if (card) {
                // Card Context
                html += `<li onclick="UIComponents.contextMenu.copyCardText()"><i class="fa-solid fa-copy"></i> Salin Teks</li>`;
                
                if (isAdmin) {
                    html += `
                        <li onclick="UIComponents.contextMenu.triggerCardAction('edit')"><i class="fa-solid fa-pen-to-square"></i> ${t('edit_material')}</li>
                        <li class="has-submenu" onclick="UIComponents.contextMenu.toggleSubmenu(event, this)">
                            <i class="fa-solid fa-palette"></i> ${t('change_color')}
                            <div class="context-submenu">
                                ${['default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'].map(c => 
                                    `<div class="ctx-color-dot ctx-color-${c}" onclick="UIComponents.contextMenu.changeColor('${c}')" title="${c}"></div>`
                                ).join('')}
                            </div>
                        </li>
                        <div class="divider"></div>
                        <li class="danger" onclick="UIComponents.contextMenu.triggerCardAction('delete')"><i class="fa-solid fa-trash"></i> ${t('delete')}</li>
                    `;
                }
            }

            // Global Actions (selalu ada di bawah)
            if (!card && !isDaily && isAdmin) {
                html += `<li onclick="UIComponents.contextMenu.triggerGlobalAction('add')"><i class="fa-solid fa-plus"></i> ${t('add_new')}</li>`;
            }
            
            html += `
                <li onclick="location.reload()"><i class="fa-solid fa-rotate"></i> Refresh Halaman</li>
                <li onclick="window.scrollTo({top: 0, behavior: 'smooth'})"><i class="fa-solid fa-arrow-up"></i> Ke Atas</li>
            `;

            html += '</ul>';
            menu.innerHTML = html;
            this.activeCard = isDaily ? null : card;
        },

        toggleSubmenu(e, li) {
            if (typeof ContextMenu !== 'undefined') return ContextMenu.toggleSubmenu(e, li);
        },

        show(x, y) {
            if (typeof ContextMenu !== 'undefined') ContextMenu.show(x, y);
        },

        hide() {
            if (typeof ContextMenu !== 'undefined') ContextMenu.hide();
        },

        copyCardText() {
            if (!this.activeCard) return;
            // Hanya ambil isi/deskripsi saja sesuai permintaan user
            const content = this.activeCard.querySelector('[data-field="content"]')?.innerText || 
                            this.activeCard.querySelector('p')?.innerText || '';
            
            if (!content.trim()) {
                if (typeof showToast === 'function') showToast('Tidak ada teks untuk disalin', 'error');
                return;
            }

            navigator.clipboard.writeText(content.trim()).then(() => {
                if (typeof showToast === 'function') showToast('Isi materi berhasil disalin!', 'success');
            });
        },

        changeColor(color) {
            if (!this.activeCard) return;
            // Panggil fungsi global yang ada di SubjectApp
            if (typeof SubjectApp !== 'undefined' && SubjectApp.changeCardColor) {
                SubjectApp.changeCardColor(this.activeCard.dataset.id, color);
            }
        },

        triggerCardAction(action) {
            if (!this.activeCard) return;
            if (action === 'delete') {
                const deleteBtn = this.activeCard.querySelector('.delete-btn') || this.activeCard.querySelector('.task-btn-delete');
                if (deleteBtn) deleteBtn.click();
            } else if (action === 'edit') {
                const editBtn = document.getElementById('toggleEditMode');
                if (editBtn) {
                    // Jika belum mode edit, nyalakan dulu
                    if (!document.body.classList.contains('editable-mode') && !editBtn.classList.contains('state-done')) {
                        editBtn.click();
                    }
                    // Scroll ke card tersebut biar enak
                    this.activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    this.activeCard.style.outline = '2px solid #ff6200';
                    setTimeout(() => this.activeCard.style.outline = '', 2000);
                }
            }
        },

        triggerGlobalAction(action) {
            if (action === 'add') {
                const addBtn = document.getElementById('addAnnouncementBtn');
                if (addBtn) addBtn.click();
            }
        }
    }
};

const SkeletonUI = {

    // CSS yang dibutuhin semua skeleton — inject sekali ke <head>
    _cssInjected: false,
    injectCSS() {
        if (this._cssInjected) return;
        this._cssInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            /* ── Base skeleton shimmer ── */
            .sk {
                background: linear-gradient(90deg,
                    rgba(255,255,255,.05) 25%,
                    rgba(255,255,255,.10) 50%,
                    rgba(255,255,255,.05) 75%);
                background-size: 200% 100%;
                animation: skShimmer 1.4s infinite;
                border-radius: 6px;
            }
            @keyframes skShimmer {
                0%   { background-position: 200% 0 }
                100% { background-position: -200% 0 }
            }

            /* ── Shared sk-card ── */
            .sk-card {
                background: rgba(8,10,18,.6);
                border: 1px solid rgba(255,255,255,.07);
                border-radius: 14px;
                overflow: hidden;
                margin-bottom: 14px;
            }

            /* ── Feed skeleton parts ── */
            .sk-header   { display:flex; gap:10px; align-items:center; padding:10px 12px; }
            .sk-circle   { width:38px; height:38px; border-radius:50%; flex-shrink:0; }
            .sk-line     { height:11px; }
            .sk-img      { width:100%; aspect-ratio:1; border-radius:0; }
            .sk-sm       { width:42%; }
            .sk-md       { width:68%; margin-top:5px; }
            .sk-pad      { padding:10px 12px; }

            /* ── Tugas skeleton parts ── */
            .sk-media    { height:120px; width:100%; border-radius:0; }
            .sk-title    { height:16px; width:60%; margin:14px 14px 8px; border-radius:6px; }
            .sk-text     { height:11px; width:80%; margin:0 14px 8px; border-radius:6px; }
            .sk-text.short { width:45%; }

            /* ── User profile skeleton ── */
            .sk-cover    { height:90px; border-radius:0; }
            .sk-avatar   { width:84px; height:84px; border-radius:50%; margin:-42px 0 0 20px; }
            .sk-info-line{ height:13px; border-radius:7px; margin:11px 20px; }
        `;
        document.head.appendChild(style);
    },

    // Feed: 2 kartu post (avatar + gambar + caption)
    feed() {
        this.injectCSS();
        const card = () => `
            <div class="sk-card">
                <div class="sk-header">
                    <div class="sk sk-circle"></div>
                    <div style="flex:1">
                        <div class="sk sk-line sk-sm"></div>
                        <div class="sk sk-line sk-md"></div>
                    </div>
                </div>
                <div class="sk sk-img"></div>
                <div class="sk-pad"><div class="sk sk-line sk-sm"></div></div>
            </div>`;
        return card() + card();
    },

    // Tugas: N kartu tugas (gambar + title + text)
    tugas(count = 2) {
        this.injectCSS();
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
            <div class="sk-card">
                <div class="sk sk-media"></div>
                <div class="sk sk-title"></div>
                <div class="sk sk-text"></div>
                <div class="sk sk-text short"></div>
            </div>`;
        }
        return html;
    },

    // Subject/announcements: N kartu materi (title + lines)
    subject(count = 3) {
        this.injectCSS();
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
            <div class="sk-card" style="padding:18px">
                <div class="sk sk-line" style="width:45%;height:16px;margin-bottom:12px;"></div>
                <div class="sk sk-line" style="width:80%;margin-bottom:8px;"></div>
                <div class="sk sk-line" style="width:65%;"></div>
            </div>`;
        }
        return html;
    },

    // User profile header
    userProfile() {
        this.injectCSS();
        return `
            <div class="sk-card">
                <div class="sk sk-cover"></div>
                <div class="sk sk-avatar"></div>
                <div class="sk sk-info-line" style="width:38%;"></div>
                <div class="sk sk-info-line" style="width:22%;"></div>
                <div class="sk sk-info-line" style="width:55%;"></div>
            </div>`;
    },

    // Generic: render ke container by id
    render(containerId, type = 'subject', count = 3) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const map = {
            feed: () => this.feed(),
            tugas: () => this.tugas(count),
            subject: () => this.subject(count),
            userProfile: () => this.userProfile(),
            quizHub: () => this.quizHub(),
        };
        el.innerHTML = (map[type] || map.subject)();
    },

    // Quiz Hub skeleton
    quizHub() {
        this.injectCSS();
        const card = () => `
            <div class="sk-card" style="height:120px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:15px;">
                <div class="sk sk-circle" style="width:40px; height:40px;"></div>
                <div class="sk sk-line" style="width:60%; height:14px;"></div>
                <div class="sk sk-line" style="width:40%; height:10px;"></div>
            </div>`;
        
        const section = (titleWidth) => `
            <div style="margin-bottom:30px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:15px;">
                    <div class="sk sk-line" style="width:${titleWidth}px; height:14px;"></div>
                    <div class="sk sk-line" style="flex:1; height:1px;"></div>
                </div>
                <div class="quiz-menu-grid">
                    ${card()} ${card()} ${card()}
                </div>
            </div>`;

        return section(80) + section(60);
    }
};

// ── Sanitize pasted HTML: strip layout styles, keep color/font ──
function _sanitizePasteHTML(html) {
    const d = document.createElement('div');
    d.innerHTML = html;

    const layoutProps = new Set([
        'width', 'min-width', 'max-width',
        'height', 'min-height', 'max-height',
        'display', 'position', 'float', 'clear',
        'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'overflow', 'overflow-x', 'overflow-y',
        'white-space',
        'box-sizing',
        'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
        'align-items', 'align-content', 'align-self',
        'justify-content', 'justify-items', 'justify-self',
        'gap', 'row-gap', 'column-gap',
        'grid', 'grid-template', 'grid-column', 'grid-row',
        'transform', 'transition', 'animation',
        'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
        'border-radius', 'outline', 'visibility',
        'z-index', 'top', 'right', 'bottom', 'left',
        'table-layout', 'border-collapse', 'border-spacing',
    ]);

    const walker = document.createTreeWalker(d, NodeFilter.SHOW_ELEMENT, null, false);
    while (walker.nextNode()) {
        const el = walker.currentNode;

        el.removeAttribute('class');
        el.removeAttribute('id');

        const style = el.getAttribute('style');
        if (style) {
            const kept = style.split(';').filter(Boolean).map(s => s.trim()).filter(s => {
                const prop = s.split(':')[0].trim().toLowerCase();
                return !layoutProps.has(prop);
            });
            if (kept.length) {
                el.setAttribute('style', kept.join(';'));
            } else {
                el.removeAttribute('style');
            }
        }
    }

    return d.innerHTML;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UIComponents.inject());
} else {
    UIComponents.inject();
}
