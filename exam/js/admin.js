// ============================================================
// ADMIN — PIN simpel (sessionStorage) + 3 tab: Jadwal / Kisi / Soal.
// Upload media: R2 presign kalo R2_ENABLED, kalo belum ya bucket
// Supabase `exam-media` (bikin Public di dashboard dulu).
// ============================================================

const Adm = {
    classes: [],
    classId: null,
    days: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    sched: {},
    kisiList: [],
    kisiMedia: {},
    kisiEditId: null,
    soalEditId: null,

    toast(msg, err) {
        const el = document.getElementById("toast");
        el.textContent = msg;
        el.className = "toast show" + (err ? " err" : "");
        clearTimeout(Adm._t);
        Adm._t = setTimeout(() => el.classList.remove("show"), 2200);
    },

    // Pemilik (nizam id=1): langsung masuk tanpa PIN. Orang lain tetap pake PIN.
    isOwner() {
        try {
            const p = ExamDB.profile() || {};
            if (String(p.user_id || "") === "1") return true;
            const nm = (p.name || "").trim().toLowerCase();
            if (nm === "nizam" || nm.split(/\s+/)[0] === "nizam") return true;
        } catch (e) { /* abaikan */ }
        return false;
    },

    async boot() {
        ExamDB.watchVersion();
        document.getElementById("r2state").textContent = ExamMedia.r2Aktif()
            ? "Backend media: R2 (presign worker)."
            : "Backend media: R2 BELUM diset — upload mati sampai R2 live (lihat README).";
        if (sessionStorage.getItem("exam_admin") === "1" || Adm.isOwner()) {
            sessionStorage.setItem("exam_admin", "1");
            Adm.open();
        }
        document.getElementById("pinBtn").addEventListener("click", Adm.login);
        document.getElementById("pinInput").addEventListener("keydown", e => {
            if (e.key === "Enter") Adm.login();
        });
    },

    async login() {
        const pin = document.getElementById("pinInput").value.trim();
        try {
            const { data, error } = await supa.from("exam_settings")
                .select("value").eq("key", "admin_pin").maybeSingle();
            if (error) throw error;
            if (data && data.value === pin) {
                sessionStorage.setItem("exam_admin", "1");
                Adm.open();
            } else {
                document.getElementById("pinErr").style.display = "block";
            }
        } catch (e) {
            Adm.toast("Gagal cek PIN: " + (e.message || e), true);
        }
    },

    async open() {
        document.getElementById("pinGate").style.display = "none";
        document.getElementById("admPanel").style.display = "block";
        try {
            Adm.classes = await ExamDB.classes();
        } catch (e) {
            Adm.toast("Gagal ambil kelas: " + (e.message || e), true);
            return;
        }
        const sel = document.getElementById("admClass");
        sel.innerHTML = Adm.classes.map(c => `<option value="${c.id}">${ExamDB.esc(c.name)}</option>`).join("");
        Adm.classId = Number(sel.value);
        sel.addEventListener("change", async () => {
            Adm.classId = Number(sel.value);
            await Adm.reloadAll();
        });
        document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach(x => x.classList.remove("on"));
            t.classList.add("on");
            ["jadwal", "kisi", "soal", "guru", "aktivitas"].forEach(k => {
                document.getElementById("tab-" + k).style.display = t.dataset.tab === k ? "block" : "none";
            });
        }));
        await Adm.reloadAll();
    },

    async reloadAll() {
        await Promise.all([Adm.loadJadwal(), Adm.loadKisi(), Adm.loadSoal(), Adm.loadGuru(), Adm.loadActivity(true)]);
    },

    // ============ TAB JADWAL ============
    async loadJadwal() {
        const box = document.getElementById("tab-jadwal");
        try {
            const sch = await ExamDB.schedule(Adm.classId);
            Adm.sched = sch.map;
        } catch (e) {
            box.innerHTML = `<div class="pub-empty">Gagal ambil jadwal.<br>${ExamDB.esc(e.message || e)}</div>`;
            return;
        }
        const days = Adm.days.filter(d => Adm.sched[d]);
        const configDays = await ExamDB.examDays(Adm.classId);
        box.innerHTML =
            `<div class="adm-card"><div class="field"><label>Hari ujian (urutan tampil)</label>` +
            `<input id="cfgDays" value="${ExamDB.esc(configDays.join(", "))}" placeholder="Selasa, Rabu, Kamis, Jumat">` +
            `</div><button class="btn sm" id="cfgSave">Simpan hari</button></div>` +
            `<div class="adm-card"><div class="field"><label>Tambah / timpa hari</label>` +
            `<div class="row2"><select id="jadDay">${Adm.days.map(d => `<option>${d}</option>`).join("")}</select>` +
            `<button class="btn sm" id="jadAdd">+ Baris mapel</button></div></div>` +
            `<div id="jadRows"></div>` +
            `<button class="btn gold sm" id="jadSave" style="margin-top:10px;">Simpan jadwal hari ini</button></div>` +
            `<div class="adm-card"><label style="font-size:.75rem; font-weight:800; color:var(--muted);">JADWAL KESIMPEN</label>` +
            `<div id="jadSaved" style="margin-top:8px;">` +
            (days.length ? days.map(d =>
                `<div class="list-item"><b>${d}: ${(Adm.sched[d] || []).map(e =>
                    ExamDB.esc((e.jam ? e.jam + " — " : "") + e.mapel)).join(" • ")}</b>` +
                `<button class="x" data-delday="${d}" title="Hapus hari ini">🗑</button></div>`
            ).join("") : `<p style="color:var(--muted); font-size:.85rem;">Belum ada.</p>`) +
            `</div></div>`;

        document.getElementById("cfgSave").addEventListener("click", async () => {
            const arr = document.getElementById("cfgDays").value.split(",").map(s => s.trim()).filter(Boolean);
            if (!arr.length) { Adm.toast("Hari kosong.", true); return; }
            const { error } = await supa.from("exam_config")
                .upsert({ class_id: Adm.classId, exam_days: arr });
            if (error) Adm.toast("Gagal: " + error.message, true);
            else Adm.toast("Hari ujian kesimpen.");
        });

        const rowsBox = document.getElementById("jadRows");
        const addRow = (jam, mapel) => {
            const div = document.createElement("div");
            div.className = "jam-row";
            div.innerHTML = `<input placeholder="07.30 - 08.30" value="${ExamDB.esc(jam || "")}">` +
                `<input placeholder="Nama mapel" value="${ExamDB.esc(mapel || "")}">` +
                `<button class="icon-btn" title="Hapus baris">✕</button>`;
            div.querySelector("button").addEventListener("click", () => div.remove());
            rowsBox.appendChild(div);
        };
        document.getElementById("jadAdd").addEventListener("click", () => addRow("", ""));
        addRow("", "");

        document.getElementById("jadSave").addEventListener("click", async () => {
            const day = document.getElementById("jadDay").value;
            const items = [...rowsBox.querySelectorAll(".jam-row")].map(r => ({
                jam: r.querySelectorAll("input")[0].value.trim(),
                mapel: r.querySelectorAll("input")[1].value.trim()
            })).filter(e => e.mapel);
            if (!items.length) { Adm.toast("Isi minimal 1 mapel.", true); return; }
            const { error } = await supa.from("exam_schedules")
                .upsert({ class_id: Adm.classId, day_name: day, items }, { onConflict: "class_id,day_name" });
            if (error) Adm.toast("Gagal: " + error.message, true);
            else { Adm.toast("Jadwal " + day + " kesimpen."); Adm.loadJadwal(); }
        });

        box.querySelectorAll("[data-delday]").forEach(b => b.addEventListener("click", async () => {
            if (!confirm("Hapus jadwal " + b.dataset.delday + "?")) return;
            const { error } = await supa.from("exam_schedules")
                .delete().eq("class_id", Adm.classId).eq("day_name", b.dataset.delday);
            if (error) Adm.toast("Gagal: " + error.message, true);
            else { Adm.toast("Dihapus."); Adm.loadJadwal(); }
        }));
    },

    // ============ TAB KISI ============
    async loadKisi() {
        const box = document.getElementById("tab-kisi");
        Adm.kisiEditId = null;
        try {
            Adm.kisiList = await ExamDB.kisi(Adm.classId);
            Adm.kisiMedia = await ExamDB.media(Adm.kisiList.map(k => k.id));
            if (!Adm.sched || !Object.keys(Adm.sched).length) {
                Adm.sched = (await ExamDB.schedule(Adm.classId)).map;
            }
        } catch (e) {
            box.innerHTML = `<div class="pub-empty">Gagal ambil kisi.<br>${ExamDB.esc(e.message || e)}</div>`;
            return;
        }
        // Default hari = hari ujian pertama yang ada jadwalnya.
        const choiceDays = Adm.days.filter(d => (Adm.sched[d] || []).length);
        const defDay = choiceDays[0] || Adm.days[0];
        box.innerHTML =
            `<div class="adm-card"><h3 id="kisiFormTitle">+ Kisi baru</h3>` +
            `<div class="row2"><div class="field"><label>Hari (wajib)</label>` +
            `<select id="kisiDay">` +
            Adm.days.map(d => `<option${d === defDay ? " selected" : ""}>${d}</option>`).join("") +
            `</select></div>` +
            `<div class="field"><label>Mapel (dari jadwal)</label><select id="kisiSubject"></select></div></div>` +
            `<div class="field" id="kisiClassWrap"><label>Kelas tujuan (bisa banyak)</label>` +
            `<div class="check-grid" id="kisiClasses">` +
            Adm.classes.map(c =>
                `<label class="check-pill"><input type="checkbox" value="${c.id}"${Number(c.id) === Number(Adm.classId) ? " checked" : ""}> ${ExamDB.esc(c.name)}</label>`
            ).join("") + `</div></div>` +
            `<div class="field"><label>Lampiran (opsional — keupload otomatis pas Simpan)</label>` +
            Adm.dzHTML("dzNew") + `</div>` +
            `<div class="field"><label>Isi — edit langsung di kartu, blok teksnya terus pencet format</label>` +
            `<div id="kisiToolbar">${Rich.toolbarHTML()}</div>` +
            `<div id="kisiContent" class="rich-editor kisi-card" contenteditable="true" data-ph="Tulis materi di sini…"></div></div>` +
            `<div style="display:flex; gap:8px; flex-wrap:wrap;">` +
            `<button class="btn gold sm" id="kisiSave">Simpan</button>` +
            `<button class="btn ghost sm" id="kisiCancel" style="display:none;">Batal</button></div></div>` +
            `<div id="kisiSaved">` + ExamDB.orderKisi(Adm.kisiList, Adm.sched, Adm.days).map(k =>
                `<div class="list-item"><b>${ExamDB.esc((k.day_name || "Umum") + " • " + k.subject)}</b>` +
                `<span style="font-size:.75rem; color:var(--muted);">${(Adm.kisiMedia[k.id] || []).length} file</span>` +
                `<button class="btn sm" data-editkisi="${k.id}">Edit + file</button>` +
                `<button class="x" data-delkisi="${k.id}" title="Hapus">🗑</button></div>`
            ).join("") + `</div>` +
            `<div class="adm-card" id="kisiFiles" style="display:none;">` +
            `<h3>Lampiran: <span id="kisiFilesName"></span></h3>` +
            `<div id="kisiFilesList" style="margin:10px 0;"></div>` +
            `<p style="color:var(--muted); font-size:.8rem;">Nambah file baru lewat dropzone di form atas, terus pencet Simpan.</p></div>`;

        document.getElementById("kisiSave").addEventListener("click", Adm.saveKisi);
        document.getElementById("kisiCancel").addEventListener("click", Adm.loadKisi);
        Rich.attach(document.getElementById("kisiToolbar"), document.getElementById("kisiContent"));
        Adm.bindDz("dzNew");
        Adm.fillMapel();
        document.getElementById("kisiDay").addEventListener("change", () => Adm.fillMapel());

        box.querySelectorAll("[data-editkisi]").forEach(b => b.addEventListener("click", () => {
            const k = Adm.kisiList.find(x => String(x.id) === b.dataset.editkisi);
            if (!k) return;
            Adm.kisiEditId = k.id;
            document.getElementById("kisiFormTitle").textContent = "Edit kisi";
            document.getElementById("kisiClassWrap").style.display = "none";
            document.getElementById("kisiDay").value = k.day_name || document.getElementById("kisiDay").value;
            Adm.fillMapel(k.subject);
            Rich.set(document.getElementById("kisiContent"), k.content || "");
            document.getElementById("kisiCancel").style.display = "inline-flex";
            document.getElementById("kisiFiles").style.display = "block";
            document.getElementById("kisiFilesName").textContent = k.subject;
            Adm.renderKisiFiles();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }));

        box.querySelectorAll("[data-delkisi]").forEach(b => b.addEventListener("click", async () => {
            if (!confirm("Hapus kisi ini + semua lampirannya?")) return;
            const { error } = await supa.from("exam_kisi").delete().eq("id", b.dataset.delkisi);
            if (error) Adm.toast("Gagal: " + error.message, true);
            else { Adm.toast("Dihapus."); Adm.loadKisi(); }
        }));

        // Upload file baru cukup lewat dropzone form + tombol Simpan.
    },

    // Isi dropdown mapel dari jadwal hari yang dipilih (biar ga typo).
    // Istirahat & sejenisnya dibuang — bukan mapel.
    fillMapel(selected) {
        const day = document.getElementById("kisiDay").value;
        const sel = document.getElementById("kisiSubject");
        const noise = ["istirahat", "upacara", "sholat", "shalat", "makan", "ishoma", "pulang", "apel", "senam"];
        const isNoise = m => {
            const n = String(m || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            return !n || noise.some(b => n.includes(b));
        };
        const list = (Adm.sched[day] || []).map(e => e.mapel).filter(m => m && !isNoise(m));
        if (!list.length) {
            sel.innerHTML = `<option value="">— Isi jadwal ${ExamDB.esc(day)} dulu di tab Jadwal —</option>`;
            return;
        }
        sel.innerHTML = list.map(m => `<option${m === selected ? " selected" : ""}>${ExamDB.esc(m)}</option>`).join("");
        if (selected && !list.includes(selected)) {
            const opt = document.createElement("option");
            opt.value = selected; opt.textContent = selected + " (pindahan jadwal lama)";
            opt.selected = true;
            sel.appendChild(opt);
        }
    },
    // Dropzone drag-drop + preview. File disimpen di Adm._dz[key].
    _dz: {},

    dzHTML(key) {
        Adm._dz[key] = [];
        return `<div class="dropzone" id="${key}">` +
            `<input type="file" multiple hidden>` +
            `<div class="dz-hint"><i class="fa-solid fa-cloud-arrow-up"></i>` +
            `<b>Seret file ke sini</b><span>atau klik buat pilih — gambar, PDF, Word, Excel, dll</span></div>` +
            `<div class="dz-chips"></div></div>`;
    },

    bindDz(key) {
        const root = document.getElementById(key);
        if (!root) return;
        const input = root.querySelector("input");
        Adm._dz[key] = [];
        Adm.dzRender(key);
        root.querySelector(".dz-hint").addEventListener("click", () => input.click());
        input.addEventListener("change", () => {
            Adm._dz[key].push(...input.files);
            input.value = "";
            Adm.dzRender(key);
        });
        ["dragenter", "dragover"].forEach(ev => root.addEventListener(ev, e => {
            e.preventDefault(); root.classList.add("drag");
        }));
        ["dragleave", "drop"].forEach(ev => root.addEventListener(ev, e => {
            e.preventDefault(); root.classList.remove("drag");
        }));
        root.addEventListener("drop", e => {
            if (e.dataTransfer && e.dataTransfer.files.length) {
                Adm._dz[key].push(...e.dataTransfer.files);
                Adm.dzRender(key);
            }
        });
        root.querySelector(".dz-chips").addEventListener("click", e => {
            const x = e.target.closest("[data-dzrm]");
            if (!x) return;
            Adm._dz[key].splice(parseInt(x.dataset.dzrm, 10), 1);
            Adm.dzRender(key);
        });
    },

    dzSize(n) {
        if (n > 1048576) return (n / 1048576).toFixed(1) + " MB";
        return Math.max(1, Math.round(n / 1024)) + " KB";
    },

    dzRender(key) {
        const root = document.getElementById(key);
        if (!root) return;
        const chips = root.querySelector(".dz-chips");
        chips.innerHTML = Adm._dz[key].map((f, i) => {
            const kind = ExamMedia.kindOf(f.name);
            return `<span class="dz-chip"><i class="${ExamMedia.iconFor(kind)}"></i>` +
                `<b>${ExamDB.esc(f.name.length > 26 ? f.name.slice(0, 24) + "…" : f.name)}</b>` +
                `<small>${Adm.dzSize(f.size || 0)}</small>` +
                `<button type="button" data-dzrm="${i}" title="Hapus">✕</button></span>`;
        }).join("");
    },

    renderKisiFiles() {
        const list = Adm.kisiMedia[Adm.kisiEditId] || [];
        document.getElementById("kisiFilesList").innerHTML = list.length ? list.map(m =>
            `<div class="list-item"><b>${ExamDB.esc(m.label || ExamMedia.fileName(m.path))}</b>` +
            `<span style="font-size:.72rem; color:var(--muted);">${ExamDB.esc((m.path || "").slice(0, 40))}</span>` +
            `<button class="x" data-delfile="${m.id}" title="Hapus">🗑</button></div>`
        ).join("") : `<p style="color:var(--muted); font-size:.85rem;">Belum ada lampiran.</p>`;
        document.querySelectorAll("[data-delfile]").forEach(b => b.addEventListener("click", async () => {
            if (!confirm("Hapus file ini dari daftar? (file di storage tidak ikut kehapus)")) return;
            const { error } = await supa.from("exam_media").delete().eq("id", b.dataset.delfile);
            if (error) Adm.toast("Gagal: " + error.message, true);
            else {
                Adm.kisiMedia = await ExamDB.media(Adm.kisiList.map(k => k.id));
                Adm.renderKisiFiles();
            }
        }));
    },

    async loadKisiList_only() {
        // Refresh ringan tanpa reset form edit (dipake abis upload).
        Adm.kisiList = await ExamDB.kisi(Adm.classId);
    },

    async saveKisi() {
        const subject = document.getElementById("kisiSubject").value.trim();
        const day = document.getElementById("kisiDay").value;
        if (!subject) { Adm.toast("Pilih mapel dulu (kalo kosong, isi jadwal harinya dulu).", true); return; }
        const payload = {
            class_id: Adm.classId,
            day_name: day,
            subject,
            content: Rich.get(document.getElementById("kisiContent")),
            updated_at: new Date().toISOString()
        };
        if (Adm.kisiEditId) {
            const { error } = await supa.from("exam_kisi").update(payload).eq("id", Adm.kisiEditId);
            if (error) { Adm.toast("Gagal: " + error.message, true); return; }
            await Adm.uploadDzFiles(Adm.kisiEditId);
            Adm.loadKisi();
            return;
        }
        // Baru: simpan -> upload lampiran (kalo ada) -> masuk mode edit.
        const targets = [...document.querySelectorAll("#kisiClasses input:checked")].map(x => Number(x.value));
        if (!targets.length) { Adm.toast("Pilih minimal 1 kelas tujuan.", true); return; }
        const ids = [];
        for (const cid of targets) {
            const { data, error } = await supa.from("exam_kisi")
                .insert({ ...payload, class_id: cid }).select("id").single();
            if (error) { Adm.toast("Gagal di kelas " + cid + ": " + error.message, true); return; }
            ids.push(data.id);
        }
        await Adm.uploadDzFiles(ids);
        await Adm.loadKisi();
        const btn = document.querySelector(`[data-editkisi="${ids[0]}"]`);
        if (btn) btn.click();
    },

    // Upload isi dropzone: file diupload sekali ke R2, ditempelin ke
    // SEMUA kisi hasil multi-kelas. Error ditampilin jelas per file.
    async uploadDzFiles(kisiIds) {
        const ids = Array.isArray(kisiIds) ? kisiIds : [kisiIds];
        const files = Adm._dz["dzNew"] || [];
        if (!files.length) { Adm.toast("Kisi kesimpen."); return; }
        Adm.toast("Kisi kesimpen — uploading " + files.length + " file…");
        const gagal = [];
        for (const f of files) {
            try {
                const path = await ExamMedia.upload(ids[0], f);
                for (const kid of ids) {
                    const { error } = await supa.from("exam_media").insert({ kisi_id: kid, path });
                    if (error) throw error;
                }
            } catch (e) { gagal.push(f.name + ": " + (e.message || e)); }
        }
        if (gagal.length) Adm.toast("Kisi kesimpen, " + gagal.length + " file gagal: " + gagal[0], true);
        else Adm.toast("Kisi + " + files.length + " lampiran kesimpen di " + ids.length + " kelas.");
    },

    // ============ TAB SOAL ============
    async loadSoal() {
        const box = document.getElementById("tab-soal");
        Adm.soalEditId = null;
        let subjects = [];
        try { subjects = await ExamDB.subjects(); } catch (e) { /* abaikan */ }
        box.innerHTML =
            `<div class="adm-card"><h3 id="soalFormTitle">+ Soal baru</h3>` +
            `<div class="row2"><div class="field"><label>Mapel (slug)</label>` +
            `<input id="soalSubject" list="soalSubjects" placeholder="cth: mtk">` +
            `<datalist id="soalSubjects">${subjects.map(s => `<option value="${ExamDB.esc(s.slug)}">${ExamDB.esc(s.name)}</option>`).join("")}</datalist></div>` +
            `<div class="field"><label>Nama mapel (kalo slug baru)</label><input id="soalSubjectName" placeholder="cth: Matematika"></div></div>` +
            `<div class="field" id="soalClassWrap"><label>Kelas tujuan (semua nyala = global, keliatan semua kelas)</label>` +
            `<div class="check-grid" id="soalClasses">` +
            Adm.classes.map(c =>
                `<label class="check-pill"><input type="checkbox" value="${c.id}" checked> ${ExamDB.esc(c.name)}</label>`
            ).join("") + `</div></div>` +
            `<div class="field"><label>Pertanyaan</label><textarea id="soalQ" style="min-height:70px;"></textarea></div>` +
            `<div class="field"><label>Pilihan (centang yang benar)</label><div id="soalOpts">` +
            [0, 1, 2, 3].map(i =>
                `<div class="opt-row"><input type="radio" name="soalAns" value="${i}"${i === 0 ? " checked" : ""}>` +
                `<input type="text" placeholder="Pilihan ${"ABCD"[i]}"></div>`
            ).join("") + `</div>` +
            `<button class="btn ghost sm" id="soalAddOpt">+ Pilihan E</button></div>` +
            `<div class="field"><label>Pembahasan (opsional)</label><textarea id="soalExp" style="min-height:60px;"></textarea></div>` +
            `<div style="display:flex; gap:8px;">` +
            `<button class="btn gold sm" id="soalSave">Simpan</button>` +
            `<button class="btn ghost sm" id="soalCancel" style="display:none;">Batal</button></div></div>` +
            `<div class="adm-card"><div class="field"><label>Filter mapel</label>` +
            `<select id="soalFilter"><option value="">Semua</option>` +
            subjects.map(s => `<option value="${ExamDB.esc(s.slug)}">${ExamDB.esc(s.name)}</option>`).join("") +
            `</select></div><div id="soalList"></div></div>`;

        document.getElementById("soalAddOpt").addEventListener("click", () => {
            const n = document.querySelectorAll("#soalOpts .opt-row").length;
            if (n >= 5) return;
            const div = document.createElement("div");
            div.className = "opt-row";
            div.innerHTML = `<input type="radio" name="soalAns" value="${n}">` +
                `<input type="text" placeholder="Pilihan ${"ABCDE"[n]}">`;
            document.getElementById("soalOpts").appendChild(div);
        });
        document.getElementById("soalSave").addEventListener("click", Adm.saveSoal);
        document.getElementById("soalCancel").addEventListener("click", Adm.loadSoal);
        document.getElementById("soalFilter").addEventListener("change", Adm.renderSoalList);
        Adm.renderSoalList();
    },

    async renderSoalList() {
        const slug = (document.getElementById("soalFilter") || {}).value || "";
        const box = document.getElementById("soalList");
        box.innerHTML = `<p style="color:var(--muted); font-size:.85rem;">Muat…</p>`;
        try {
            let q = supa.from("exam_questions").select("id, subject, question, class_id")
                .order("subject").order("display_order").order("id").limit(200);
            if (slug) q = q.eq("subject", slug);
            const { data, error } = await q;
            if (error) throw error;
            box.innerHTML = (data || []).map(r => {
                const cls = r.class_id == null ? "Global"
                    : ((Adm.classes.find(c => Number(c.id) === Number(r.class_id)) || {}).name || ("Kelas " + r.class_id));
                return `<div class="list-item"><b>[${ExamDB.esc(r.subject)}] ${ExamDB.esc((r.question || "").slice(0, 60))}</b>` +
                `<span style="font-size:.7rem; color:var(--muted); white-space:nowrap;">${ExamDB.esc(cls)}</span>` +
                `<button class="btn sm" data-editsoal="${r.id}">Edit</button>` +
                `<button class="x" data-delsoal="${r.id}">🗑</button></div>`;
            }).join("") || `<p style="color:var(--muted); font-size:.85rem;">Kosong.</p>`;
            box.querySelectorAll("[data-delsoal]").forEach(b => b.addEventListener("click", async () => {
                if (!confirm("Hapus soal ini?")) return;
                const { error } = await supa.from("exam_questions").delete().eq("id", b.dataset.delsoal);
                if (error) Adm.toast("Gagal: " + error.message, true);
                else { Adm.toast("Dihapus."); Adm.renderSoalList(); }
            }));
            box.querySelectorAll("[data-editsoal]").forEach(b => b.addEventListener("click", async () => {
                const { data, error } = await supa.from("exam_questions").select("*").eq("id", b.dataset.editsoal).single();
                if (error || !data) { Adm.toast("Gagal ambil soal.", true); return; }
                Adm.soalEditId = data.id;
                document.getElementById("soalFormTitle").textContent = "Edit soal";
                document.getElementById("soalClassWrap").style.display = "none";
                document.getElementById("soalSubject").value = data.subject || "";
                document.getElementById("soalQ").value = data.question || "";
                document.getElementById("soalExp").value = data.explanation || "";
                const wrap = document.getElementById("soalOpts");
                wrap.innerHTML = "";
                (data.options && data.options.length ? data.options : ["", ""]).forEach((opt, i) => {
                    const div = document.createElement("div");
                    div.className = "opt-row";
                    div.innerHTML = `<input type="radio" name="soalAns" value="${i}"${i === data.answer ? " checked" : ""}>` +
                        `<input type="text" value="${ExamDB.esc(opt)}">`;
                    wrap.appendChild(div);
                });
                document.getElementById("soalCancel").style.display = "inline-flex";
                window.scrollTo({ top: 0, behavior: "smooth" });
            }));
        } catch (e) {
            box.innerHTML = `<p style="color:var(--red); font-size:.85rem;">${ExamDB.esc(e.message || e)}</p>`;
        }
    },

    async saveSoal() {
        const subject = document.getElementById("soalSubject").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const question = document.getElementById("soalQ").value.trim();
        const opts = [...document.querySelectorAll("#soalOpts input[type=text]")].map(i => i.value.trim()).filter(Boolean);
        const ans = document.querySelector("input[name=soalAns]:checked");
        if (!subject || !question || opts.length < 2 || !ans) {
            Adm.toast("Lengkapi: slug mapel + soal + minimal 2 pilihan + 1 jawaban.", true);
            return;
        }
        // Slug baru? Daftarin nama mapelnya sekalian.
        try {
            const { data: ada } = await supa.from("exam_subjects").select("slug").eq("slug", subject).maybeSingle();
            if (!ada) {
                const nm = document.getElementById("soalSubjectName").value.trim() || subject.toUpperCase();
                await supa.from("exam_subjects").insert({ slug: subject, name: nm, icon: "fa-book" });
            }
        } catch (e) { /* abaikan, lanjut simpen soal */ }
        const payload = {
            subject, question, options: opts,
            answer: parseInt(ans.value, 10),
            explanation: document.getElementById("soalExp").value
        };
        if (Adm.soalEditId) {
            const { error } = await supa.from("exam_questions").update(payload).eq("id", Adm.soalEditId);
            if (error) Adm.toast("Gagal: " + error.message, true);
            else { Adm.toast("Soal kesimpen."); Adm.loadSoal(); }
            return;
        }
        // Baru: semua kelas nyala = 1 baris global; sebagian = per kelas.
        const checked = [...document.querySelectorAll("#soalClasses input:checked")].map(x => Number(x.value));
        if (!checked.length) { Adm.toast("Pilih minimal 1 kelas tujuan.", true); return; }
        const allIds = Adm.classes.map(c => Number(c.id));
        const isGlobal = checked.length === allIds.length && allIds.every(id => checked.includes(id));
        const rows = isGlobal ? [{ ...payload, class_id: null }]
            : checked.map(cid => ({ ...payload, class_id: cid }));
        const { error } = await supa.from("exam_questions").insert(rows);
        if (error) Adm.toast("Gagal: " + error.message, true);
        else { Adm.toast(isGlobal ? "Soal global kesimpen." : `Soal kesimpen di ${rows.length} kelas.`); Adm.loadSoal(); }
    },

    // ============ TAB GURU (per kelas, ngikut dropdown kelas atas) ============
    async loadGuru() {
        const box = document.getElementById("tab-guru");
        let rows = [];
        try {
            const { data, error } = await supa.from("exam_teachers").select("*")
                .eq("class_id", Adm.classId).order("name");
            if (error) throw error;
            rows = data || [];
        } catch (e) {
            box.innerHTML = `<div class="pub-empty">Gagal ambil data guru.<br>${ExamDB.esc(e.message || e)}</div>`;
            return;
        }
        box.innerHTML =
            `<div class="adm-card"><p style="font-size:.85rem; color:var(--muted); margin-bottom:10px;">` +
            `Nama guru tampil di kanan atas kartu kisi (cocok otomatis ke mapelnya). Kosongin buat nyembunyiin. ` +
            `Berlaku per kelas — ganti dropdown kelas di atas buat edit kelas lain.</p>` +
            `<div class="row2"><div class="field"><label>Slug (cth: informatika)</label>` +
            `<input id="guruSlug" placeholder="slug unik"></div>` +
            `<div class="field"><label>Nama mapel tampil</label>` +
            `<input id="guruName" placeholder="cth: Informatika"></div></div>` +
            `<div class="field"><label>Guru</label>` +
            `<input id="guruTeacher" placeholder="cth: Pak Nizam"></div>` +
            `<button class="btn gold sm" id="guruAdd">+ Tambah guru</button></div>` +
            `<div class="adm-card"><div id="guruList">` + rows.map(t =>
                `<div class="list-item"><b>${ExamDB.esc(t.name)}</b>` +
                `<input data-guru="${ExamDB.esc(t.slug)}" value="${ExamDB.esc(t.teacher || "")}" ` +
                `placeholder="Nama guru…" style="flex:2; font-family:inherit; font-size:.85rem; padding:8px 10px; border:1.5px solid var(--line); border-radius:9px;">` +
                `<button class="btn sm" data-saveguru="${ExamDB.esc(t.slug)}">Simpan</button></div>`
            ).join("") + `</div></div>`;
        document.getElementById("guruAdd").addEventListener("click", async () => {
            const slug = document.getElementById("guruSlug").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
            const name = document.getElementById("guruName").value.trim();
            const teacher = document.getElementById("guruTeacher").value.trim();
            if (!slug || !name) { Adm.toast("Slug + nama mapel wajib diisi.", true); return; }
            const { error } = await supa.from("exam_teachers")
                .upsert({ class_id: Adm.classId, slug, name, teacher }, { onConflict: "class_id,slug" });
            if (error) Adm.toast("Gagal: " + error.message, true);
            else { Adm.toast("Guru ditambahin."); Adm.loadGuru(); }
        });
        box.querySelectorAll("[data-saveguru]").forEach(b => b.addEventListener("click", async () => {
            const input = box.querySelector(`[data-guru="${b.dataset.saveguru}"]`);
            const { error } = await supa.from("exam_teachers")
                .update({ teacher: input.value.trim() })
                .eq("class_id", Adm.classId).eq("slug", b.dataset.saveguru);
            if (error) Adm.toast("Gagal: " + error.message, true);
            else Adm.toast("Guru kesimpen.");
        }));
    },

    // ============ TAB AKTIVITAS (2 tabel ala monitor_simulasi) ============
    // 1. Aktivitas halaman: per orang — halaman apa, jam berapa, online ngga.
    // 2. Aktivitas quiz: stat + filter + progres per mapel + realtime.
    _actTimer: null,
    _actSub: null,
    _actPres: [],
    _actEvts: [],
    _actFClass: "all",
    _actFMapel: "all",

    relTime(iso) {
        const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
        if (s < 10) return "baru aja";
        if (s < 60) return s + " dtk lalu";
        const m = Math.floor(s / 60);
        if (m < 60) return m + " mnt lalu";
        const h = Math.floor(m / 60);
        if (h < 24) return h + " jam lalu";
        return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    },

    jamPendek(iso) {
        try {
            const d = new Date(iso);
            const today = new Date().toDateString() === d.toDateString();
            const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
            return today ? jam : jam + " • " + d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
        } catch (e) { return "-"; }
    },

    async loadActivity(first) {
        const box = document.getElementById("tab-aktivitas");
        if (first && !box.dataset.ready) {
            box.dataset.ready = "1";
            box.innerHTML =
                `<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;">` +
                `<h3 style="font-weight:900;">📡 Aktivitas</h3>` +
                `<button class="btn sm" id="actRefresh"><i class="fa-solid fa-sync"></i> Refresh</button></div>` +
                `<div class="adm-card"><h3>📄 Aktivitas Halaman</h3>` +
                `<div class="mon-table-wrap"><table class="mon-table"><thead><tr>` +
                `<th>Nama</th><th>Kelas</th><th>Halaman</th><th>Jam</th><th>Status</th>` +
                `</tr></thead><tbody id="actPageBody"></tbody></table></div></div>` +
                `<div class="stats-grid" id="actStats" style="margin:16px 0;"></div>` +
                `<div class="adm-card"><h3>🏁 Aktivitas Quiz</h3>` +
                `<div class="filter-bar">` +
                `<select id="actFClass" class="field-input"><option value="all">Semua Kelas</option></select>` +
                `<select id="actFMapel" class="field-input"><option value="all">Semua Mapel</option></select>` +
                `</div>` +
                `<div class="mon-table-wrap"><table class="mon-table"><thead><tr>` +
                `<th>Nama</th><th>Kelas</th><th>Mapel</th><th>Progres</th><th>Status</th><th>Terakhir Aktif</th>` +
                `</tr></thead><tbody id="actQuizBody"></tbody></table></div></div>` +
                `<div class="adm-card"><h3>Kejadian terbaru</h3><div id="actEvents"></div></div>`;

            try {
                const cls = await ExamDB.classes();
                document.getElementById("actFClass").innerHTML =
                    `<option value="all">Semua Kelas</option>` +
                    cls.map(c => `<option value="${ExamDB.esc(c.slug)}">${ExamDB.esc(c.name)}</option>`).join("");
                const subs = await ExamDB.subjects();
                document.getElementById("actFMapel").innerHTML =
                    `<option value="all">Semua Mapel</option>` +
                    subs.map(s => `<option value="${ExamDB.esc(s.slug)}">${ExamDB.esc(s.name)}</option>`).join("");
            } catch (e) { /* abaikan */ }

            document.getElementById("actFClass").addEventListener("change", e => {
                Adm._actFClass = e.target.value;
                Adm.renderActivity();
            });
            document.getElementById("actFMapel").addEventListener("change", e => {
                Adm._actFMapel = e.target.value;
                Adm.renderActivity();
            });
            document.getElementById("actRefresh").addEventListener("click", () => Adm.loadActivity(false));

            // Realtime ala monitor_simulasi + refresh status tiap menit.
            try {
                if (Adm._actSub) supa.removeChannel(Adm._actSub);
                Adm._actSub = supa.channel("realtime-exam-activity")
                    .on("postgres_changes", { event: "*", schema: "public", table: "exam_presence" }, () => Adm.loadActivity(false))
                    .on("postgres_changes", { event: "INSERT", schema: "public", table: "exam_events" }, () => Adm.loadActivity(false))
                    .subscribe();
            } catch (e) { /* abaikan */ }
            Adm._actTimer = setInterval(() => {
                if (document.getElementById("tab-aktivitas").style.display !== "none") Adm.renderActivity();
            }, 60000);
        }
        try {
            const [{ data: pres }, { data: evts }] = await Promise.all([
                supa.from("exam_presence").select("*").order("last_seen", { ascending: false }).limit(100),
                supa.from("exam_events").select("*").order("created_at", { ascending: false }).limit(50)
            ]);
            Adm._actPres = pres || [];
            Adm._actEvts = evts || [];
            Adm.renderActivity();
        } catch (e) {
            if (first) box.innerHTML = `<div class="pub-empty">Gagal ambil aktivitas.<br>${ExamDB.esc(e.message || e)}</div>`;
        }
    },

    renderActivity() {
        if (!document.getElementById("actPageBody")) return;
        const now = Date.now();
        const isOn = p => (now - new Date(p.last_seen).getTime()) < 120000;
        const isFresh = p => (now - new Date(p.last_seen).getTime()) < 300000;
        const pageLbl = p => p === "kisi" ? "Kisi-Kisi" : (p === "quiz" ? "Quiz" : (p || "-"));

        // ---- Tabel 1: aktivitas halaman per orang ----
        document.getElementById("actPageBody").innerHTML = Adm._actPres.length
            ? Adm._actPres.map(p =>
                `<tr><td style="font-weight:700;">${ExamDB.esc(p.name || "someone")}</td>` +
                `<td>${ExamDB.esc(p.class_slug || "-")}</td>` +
                `<td>${pageLbl(p.page)}</td>` +
                `<td style="font-variant-numeric:tabular-nums;">${Adm.jamPendek(p.last_seen)}</td>` +
                `<td><span class="status-badge ${isOn(p) ? "status-completed" : "status-stopped"}">` +
                `${isOn(p) ? "● Online" : "○ Offline"}</span></td></tr>`
            ).join("")
            : `<tr><td colspan="5" style="text-align:center; padding:30px; opacity:.5;">Belum ada aktivitas.</td></tr>`;

        // ---- Tabel 2: aktivitas quiz (filter kelas + mapel) ----
        let rows = Adm._actPres.filter(p => (p.quiz_total || 0) > 0);
        if (Adm._actFClass !== "all") rows = rows.filter(p => p.class_slug === Adm._actFClass);
        if (Adm._actFMapel !== "all") rows = rows.filter(p => p.quiz_subject === Adm._actFMapel);

        const done = rows.filter(p => p.quiz_idx >= p.quiz_total).length;
        const ongoing = rows.filter(p => p.quiz_idx < p.quiz_total && isFresh(p)).length;
        const stat = (num, lbl, color) =>
            `<div class="stat-card"><h3>${lbl}</h3><p style="color:${color};">${num}</p></div>`;
        document.getElementById("actStats").innerHTML =
            stat(rows.length, "Total Partisipan") +
            stat(done, "Selesai", "#198754") +
            stat(ongoing, "Lagi Ngerjain", "#b57e0a");

        const badge = p => {
            if (p.quiz_idx >= p.quiz_total) return `<span class="status-badge status-completed">Selesai</span>`;
            if (isFresh(p)) return `<span class="status-badge status-ongoing">Lagi ngerjain</span>`;
            return `<span class="status-badge status-stopped">Berhenti</span>`;
        };
        document.getElementById("actQuizBody").innerHTML = rows.length
            ? rows.map(p =>
                `<tr><td style="font-weight:700;">${ExamDB.esc(p.name || "someone")}</td>` +
                `<td>${ExamDB.esc(p.class_slug || "-")}</td>` +
                `<td>${ExamDB.esc(p.quiz_subject || "-")}</td>` +
                `<td><span class="progress-pill">${Math.min(p.quiz_idx, p.quiz_total)} / ${p.quiz_total}` +
                `${p.last_score != null ? " • nil " + p.last_score : ""}</span></td>` +
                `<td>${badge(p)}</td>` +
                `<td style="font-size:.8rem; opacity:.6;">${Adm.relTime(p.last_seen)}</td></tr>`
            ).join("")
            : `<tr><td colspan="6" style="text-align:center; padding:30px; opacity:.5;">Belum ada yang ngerjain.</td></tr>`;

        // ---- Kejadian terbaru ----
        const kindLbl = k => ({ page: "📄 buka", quiz_start: "▶ mulai", quiz_finish: "🏁 selesai" }[k] || k);
        document.getElementById("actEvents").innerHTML = Adm._actEvts.length
            ? Adm._actEvts.map(e =>
                `<div class="list-item"><b>${kindLbl(e.kind)} ${ExamDB.esc(e.detail || "")}</b>` +
                `<span style="font-size:.72rem; color:var(--muted);">${ExamDB.esc(e.name || "")} • ${ExamDB.esc(e.class_slug || "")} • ${Adm.relTime(e.created_at)}</span></div>`
            ).join("")
            : `<p style="color:var(--muted); font-size:.85rem;">Kosong.</p>`;
    }
};

document.addEventListener("DOMContentLoaded", () => Adm.boot());
