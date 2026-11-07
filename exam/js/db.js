// ============================================================
// DB — satu-satunya akses Supabase (urutan: supabase-js -> config -> db)
// Pola contek osistarpanone: client tunggal `supa`, semua query
// lewat helper di file ini.
// ============================================================

const supa = (() => {
    try {
        return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.warn("Supabase CDN belum termuat.", e);
        const t = new Error("Offline — data tidak tersedia.");
        return new Proxy({}, { get() { throw t; } });
    }
})();

const ExamDB = {

    async classes() {
        const { data, error } = await supa.from("exam_classes")
            .select("*").eq("is_active", true).order("display_order");
        if (error) throw error;
        return data || [];
    },

    // Resolve ?id= (slug "xrpl1", angka "2", nama) jadi baris kelas.
    async resolveClass(param) {
        const list = await ExamDB.classes();
        if (!list.length) throw new Error("Belum ada data kelas.");
        const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const np = norm(param);
        let found = null;
        if (/^\d+$/.test(String(param || ""))) {
            found = list.find(c => String(c.id) === String(param));
        }
        if (!found && np) {
            found = list.find(c => norm(c.slug) === np || norm(c.name) === np);
            if (!found) {
                const d = (np.match(/(\d+)$/) || [])[1];
                if (d) found = list.find(c => ((norm(c.name).match(/(\d+)$/) || [])[1]) === d);
            }
        }
        return found || list.find(c => c.slug === "xrpl2") || list[0];
    },

    async examDays(classId) {
        try {
            const { data, error } = await supa.from("exam_config")
                .select("exam_days").eq("class_id", classId).maybeSingle();
            if (error) throw error;
            if (data && Array.isArray(data.exam_days) && data.exam_days.length) return data.exam_days;
        } catch (e) { console.warn("examDays:", e); }
        return ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
    },

    // Jadwal exam 1 kelas: { day: [{jam, mapel}] }.
    // Kosong -> fallback jadwal XRPL2 biar ga kopong (flag ikut).
    async schedule(classId) {
        const pull = async (cid) => {
            const { data, error } = await supa.from("exam_schedules")
                .select("day_name, items").eq("class_id", cid);
            if (error) throw error;
            return data || [];
        };
        let rows = await pull(classId);
        let shared = false;
        if (!rows.length) {
            const xrpl2 = (await ExamDB.classes()).find(c => c.slug === "xrpl2");
            if (xrpl2 && Number(xrpl2.id) !== Number(classId)) {
                rows = await pull(xrpl2.id);
                shared = rows.length > 0;
            }
        }
        const map = {};
        rows.forEach(r => {
            const items = Array.isArray(r.items) ? r.items : [];
            if (items.length) map[r.day_name] = items;
        });
        return { map, shared };
    },

    async kisi(classId) {
        const { data, error } = await supa.from("exam_kisi").select("*")
            .eq("class_id", classId).order("display_order").order("id");
        if (error) throw error;
        return data || [];
    },

    async media(kisiIds) {
        if (!kisiIds.length) return {};
        const { data, error } = await supa.from("exam_media").select("*")
            .in("kisi_id", kisiIds).order("display_order").order("id");
        if (error) throw error;
        const map = {};
        (data || []).forEach(m => { (map[m.kisi_id] = map[m.kisi_id] || []).push(m); });
        return map;
    },

    async subjects() {
        const { data, error } = await supa.from("exam_subjects").select("*").order("name");
        if (error) throw error;
        return data || [];
    },

    async teachers(classId) {
        try {
            let q = supa.from("exam_teachers").select("*");
            if (classId) q = q.eq("class_id", classId);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn("teachers:", e); return []; }
    },

    // Soal global (class_id NULL) selalu ikut di kelas mana pun.
    async questionCount(classId) {
        let q = supa.from("exam_questions").select("subject").eq("is_active", true);
        if (classId) q = q.or(`class_id.is.null,class_id.eq.${classId}`);
        const { data, error } = await q;
        if (error) throw error;
        const counts = {};
        (data || []).forEach(r => { counts[r.subject] = (counts[r.subject] || 0) + 1; });
        return counts;
    },

    async questions(subject, classId) {
        let q = supa.from("exam_questions").select("*")
            .eq("subject", subject).eq("is_active", true);
        if (classId) q = q.or(`class_id.is.null,class_id.eq.${classId}`);
        const { data, error } = await q.order("display_order").order("id");
        if (error) throw error;
        return data || [];
    },

    // Urutan hari: hari-ini-dulu (lewat 15:00 = besok).
    dayOrder(days) {
        const names = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const now = new Date();
        let today = names[now.getDay()];
        if (now.getHours() >= 15) {
            const tom = new Date(now);
            tom.setDate(now.getDate() + 1);
            today = names[tom.getDay()];
        }
        const i = days.indexOf(today);
        if (i === -1) return [...days];
        return [...days.slice(i), ...days.slice(0, i)];
    },

    // Urutin kisi ngikut jadwal: hari dulu, terus posisi mapel hari itu.
    // Kisi yang mapelnya ga ada di jadwal (Lainnya) taro paling belakang.
    orderKisi(items, schedMap, days) {
        const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const posIn = (nSubj, day) => {
            const list = (schedMap && schedMap[day]) || [];
            let i = list.findIndex(e => norm(e.mapel) === nSubj);
            if (i !== -1) return i;
            i = list.findIndex(e => {
                const nm = norm(e.mapel);
                return nm && (nm.includes(nSubj) || nSubj.includes(nm));
            });
            return i;
        };
        return [...items].sort((a, b) => {
            const da = (days || []).indexOf(a.day_name);
            const db = (days || []).indexOf(b.day_name);
            const ia = da === -1 ? 999 : da, ib = db === -1 ? 999 : db;
            if (ia !== ib) return ia - ib;
            const pa = posIn(norm(a.subject), a.day_name);
            const pb = posIn(norm(b.subject), b.day_name);
            const xa = pa === -1 ? 999 : pa, xb = pb === -1 ? 999 : pb;
            if (xa !== xb) return xa - xb;
            return String(a.subject || "").localeCompare(String(b.subject || ""));
        });
    },

    // Profil lokal (dari index): { slug, name, user_id?, claimed? }. Tanpa login.
    // Fallback: sesi app lama (key "user", domain sama → kebaca).
    // class_id lama 1-4 = XI-RPL 1-4 → slug xrpl1-4.
    profile() {
        try {
            const p = JSON.parse(localStorage.getItem("exam_profile") || "null");
            if (p && p.slug) return p;
            // Abis Keluar: jangan fallback ke sesi lama.
            if (localStorage.getItem("exam_logged_out") === "1") return null;
        } catch (e) { /* lanjut fallback */ }
        try {
            const u = JSON.parse(localStorage.getItem("user") || "null");
            if (u && (u.nickname || u.full_name)) {
                const cid = parseInt(u.class_id, 10);
                return {
                    slug: Number.isFinite(cid) ? ("xrpl" + cid) : "",
                    name: u.nickname || u.short_name || String(u.full_name || "").split(" ")[0] || "",
                    user_id: u.id != null ? String(u.id) : null,
                    legacy: true
                };
            }
        } catch (e) { /* abaikan */ }
        return null;
    },

    // Popup "Ini ... yaa?" — SEKALI selamanya (flag localStorage).
    // Tombol: "Iya bener, masuk" (tutup) / "Bukan, ganti" (ke index).
    confirmIdentity() {
        try {
            if (localStorage.getItem("exam_idok") === "1") return;
            const p = ExamDB.profile();
            if (!p || !p.name) return;
            const ov = document.createElement("div");
            ov.className = "idpop-ov";
            ov.innerHTML =
                `<div class="idpop-card">` +
                `<div class="idpop-ava">${ExamDB.esc(String(p.name).trim().charAt(0).toUpperCase() || "?")}</div>` +
                `<h2>Ini <span>${ExamDB.esc(p.name)}</span> yaa?</h2>` +
                `<p class="idpop-sub">Popup ini muncul buat mastiin akunnya, biar nanti bisa liat nilai pribadi.</p>` +
                `<div class="idpop-btns">` +
                `<button class="btn gold" id="idpopYes">Iya bener, masuk</button>` +
                `<button class="btn ghost" id="idpopNo">Bukan, ganti</button>` +
                `</div></div>`;
            document.body.appendChild(ov);
            requestAnimationFrame(() => ov.classList.add("open"));
            const done = () => {
                try { localStorage.setItem("exam_idok", "1"); } catch (e) { /* abaikan */ }
                ov.classList.remove("open");
                setTimeout(() => ov.remove(), 300);
            };
            document.getElementById("idpopYes").addEventListener("click", done);
            document.getElementById("idpopNo").addEventListener("click", () => { location.href = "index.html"; });
        } catch (e) { /* abaikan */ }
    },
    // Chip user di header kanan: avatar inisial + Haii + caret.
    // Pencet → dropdown (Kisi-Kisi, Latihan Soal, Keluar).
    // Keluar = hapus profil + kunci fallback sesi lama (exam_logged_out).
    topUser() {
        try {
            const box = document.getElementById("topUser");
            if (!box) return;
            const p = ExamDB.profile();
            if (!p || !p.name) { box.style.display = "none"; return; }
            box.style.display = "flex";
            document.getElementById("topAva").textContent =
                String(p.name).trim().charAt(0).toUpperCase() || "?";
            document.getElementById("topHai").textContent = "Haii, " + p.name;
            const slug = p.slug || "";
            const dk = document.getElementById("dropKisi");
            const dq = document.getElementById("dropQuiz");
            const dn = document.getElementById("dropNilai");
            if (dk) dk.href = "kisi" + (slug ? "?id=" + encodeURIComponent(slug) : "");
            if (dq) dq.href = "quiz" + (slug ? "?id=" + encodeURIComponent(slug) : "");
            if (dn) dn.href = "nilai";
            // Menu admin cuma buat pemilik (nizam id=1). Orang lain ga liat.
            const da = document.getElementById("dropAdmin");
            if (da) {
                let owner = false;
                try {
                    owner = String(p.user_id || "") === "1" ||
                        (p.name || "").trim().toLowerCase().split(/\s+/)[0] === "nizam";
                } catch (e) { /* abaikan */ }
                da.style.display = owner ? "" : "none";
            }
            if (!box.dataset.linked) {
                box.dataset.linked = "1";
                const drop = document.getElementById("topDrop");
                box.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const open = drop.classList.toggle("open");
                    box.classList.toggle("open", open);
                });
                document.addEventListener("click", (e) => {
                    if (!drop.contains(e.target) && e.target !== box && !box.contains(e.target)) {
                        drop.classList.remove("open");
                        box.classList.remove("open");
                    }
                });
                document.addEventListener("keydown", (e) => {
                    if (e.key === "Escape") {
                        drop.classList.remove("open");
                        box.classList.remove("open");
                    }
                });
            }
        } catch (e) { /* abaikan */ }
    },

    esc(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;")
            .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },

    // Auto-refresh kalo ada update halaman (version.json naik).
    // Ga langsung reload: munculin popup dulu + tombol.
    _verSeen: null,
    _verAsked: false,
    watchVersion() {
        const check = async () => {
            try {
                const r = await fetch("version.json?_=" + Date.now(), { cache: "no-store" });
                if (!r.ok) return;
                const j = await r.json();
                if (ExamDB._verSeen === null) { ExamDB._verSeen = j.v; return; }
                if (j.v !== ExamDB._verSeen && !ExamDB._verAsked) {
                    ExamDB._verAsked = true;
                    ExamDB.askRefresh();
                }
            } catch (e) { /* offline/404 — abaikan */ }
        };
        check();
        setInterval(check, 60000);
    },

    askRefresh() {
        try {
            if (document.getElementById("verPop")) return;
            const ov = document.createElement("div");
            ov.id = "verPop";
            ov.className = "idpop-ov";
            ov.innerHTML =
                `<div class="idpop-card">` +
                `<div style="font-size:2.4rem;">🔄</div>` +
                `<h2>Ada versi baru nih</h2>` +
                `<p class="idpop-sub">Halamannya di refresh dulu yaa biar ga ketinggalan update.</p>` +
                `<div class="idpop-btns">` +
                `<button class="btn gold" id="verYes">Iya, refresh</button>` +
                `</div></div>`;
            document.body.appendChild(ov);
            requestAnimationFrame(() => ov.classList.add("open"));
            document.getElementById("verYes").addEventListener("click", () => location.reload());
        } catch (e) { location.reload(); }
    },

    // Render LaTeX \(...\) / \[...\] via KaTeX (kalo lib-nya ke-load).
    // Aman buat teks biasa: ga ada delimiter = ga diapa-apain.
    // Lib CDN defer bisa telat → retry 5 detik.
    renderMath(root, tries) {
        try {
            const el = root || document.body;
            if (typeof renderMathInElement !== "function") {
                if ((tries || 0) < 10) {
                    setTimeout(() => ExamDB.renderMath(el, (tries || 0) + 1), 500);
                }
                return;
            }
            renderMathInElement(el, {
                delimiters: [
                    { left: "\\(", right: "\\)", display: false },
                    { left: "\\[", right: "\\]", display: true }
                ],
                throwOnError: false
            });
        } catch (e) { /* abaikan, tampil teks mentah */ }
    },

    cleanHTML(html) {
        try {
            const tpl = document.createElement("template");
            tpl.innerHTML = String(html || "");
            tpl.content.querySelectorAll("script, iframe, object, embed").forEach(n => n.remove());
            tpl.content.querySelectorAll("*").forEach(n => {
                [...n.attributes].forEach(a => { if (/^on/i.test(a.name)) n.removeAttribute(a.name); });
            });
            return tpl.innerHTML;
        } catch (e) { return String(html || ""); }
    }
};

if (typeof window !== "undefined") window.ExamDB = ExamDB;
