// ============================================================
// NILAI — port halaman scores lama ke tema exam.
// Sumber: nilai_scores (+users lama), nilai_config, nilai_files.
// ?id=asts|psts|psasi|psat (default asts). Identitas: profil exam.
// Admin (PIN): sembunyiin mapel + upload file (R2 folder nilai/).
// ============================================================

const NilaiPage = {
    TESTS: {
        asts: "Nilai ASTS",
        psts: "Nilai PSTS",
        psasi: "Nilai PSAS",
        psat: "Nilai PSAT"
    },
    // Tahun lalu (nilai_scores): 16 mapel. 2026 (scores2026): 12 mapel.
    MAPEL_LAMA: {
        pabp: "PABP", pp: "PP", bindo: "B. Indonesia", bing: "B. Inggris",
        mtk: "Matematika", sejarah: "Sejarah", bjepang: "B. Jepang",
        bsunda: "B. Sunda", senibudaya: "Seni Budaya", informatika: "Informatika",
        pjok: "PJOK", proipas: "Proipas", dasprog1: "DASPRO 1",
        dasprog2: "DASPRO 2", dasprog3: "DASPRO 3", kik: "KIK"
    },
    MAPEL_2026: {
        pabp: "PABP", pp: "PP", bindo: "B. Indonesia", bing: "B. Inggris",
        mtk: "Matematika", sindo: "Sejarah Indonesia", bjepang: "B. Jepang",
        bsunda: "B. Sunda", pjok: "PJOK", kik: "KIK", kk1: "KK 1", kk2: "KK 2", kk3: "KK 3"
    },
    KKM: 75,
    TTL: 5 * 60 * 1000,

    testId: "asts",
    classId: null,
    classes: [],
    rows: [],       // nilai_scores + average
    myRow: null,
    myUserId: null,
    myRank: null,
    myHidden: [],
    hidden: [],
    nickMap: {},    // nama lower -> nickname tampil

    // ASTS 2026 pindah ke tabel sendiri; psts/psat/psasi (tahun lalu) tetap di nilai_scores.
    table() {
        return NilaiPage.testId === "asts" ? "scores2026" : "nilai_scores";
    },
    mapel() {
        return NilaiPage.testId === "asts" ? NilaiPage.MAPEL_2026 : NilaiPage.MAPEL_LAMA;
    },
    // Jurusan dari nama kelas ("XI - RPL 1" → "RPL"). Buat label KK.
    major() {
        const c = (NilaiPage.classes || []).find(x => String(x.id) === String(NilaiPage.classId));
        const m = c && c.name ? c.name.split("-")[1] : "";
        return ((m || "").trim().split(/\s+/)[0] || "").toUpperCase();
    },
    // Label tampil: kk1-3 ngikutin jurusan (RPL → "KK RPL 1", BR → "KK BR 1").
    mlabel(k) {
        if (k === "kk1" || k === "kk2" || k === "kk3") {
            const mj = NilaiPage.major();
            return "KK " + (mj ? mj + " " : "") + k.slice(2);
        }
        return NilaiPage.mapel()[k];
    },

    async boot() {
        const p = new URLSearchParams(location.search).get("id") || "asts";
        if (NilaiPage.TESTS[p]) NilaiPage.testId = p;
        document.title = `${NilaiPage.TESTS[NilaiPage.testId]} • Ujian`;
        const td = document.getElementById("testDesc");
        if (td) td.textContent = `Nilai murni ${NilaiPage.testId.toUpperCase()}. Ada nilai pribadi, leaderboard, dan daftar nilai kelas.`;
        ExamDB.topUser();
        try {
            const pslug = (ExamDB.profile() || {}).slug || "";
            const hk = document.getElementById("heroKisiLink");
            const hq = document.getElementById("heroQuizLink");
            if (hk) hk.href = "kisi" + (pslug ? "?id=" + encodeURIComponent(pslug) : "");
            if (hq) hq.href = "quiz" + (pslug ? "?id=" + encodeURIComponent(pslug) : "");
        } catch (e) { /* abaikan */ }

        try {
            const { data } = await supa.from("classes").select("id, name")
                .eq("is_active", true).order("id");
            NilaiPage.classes = data || [];
        } catch (e) { /* abaikan */ }

        // Default kelas: dari profil exam (xrplN -> id lama N).
        let defId = null;
        try {
            const prof = ExamDB.profile();
            const m = prof && prof.slug && prof.slug.match(/(\d+)$/);
            if (m && NilaiPage.classes.some(c => String(c.id) === m[1])) defId = m[1];
        } catch (e) { /* abaikan */ }
        if (!defId && NilaiPage.classes.length) defId = String(NilaiPage.classes[0].id);
        NilaiPage.classId = defId;

        // Dropdown kelas custom (contek top-drop header).
        const pickBtn = document.getElementById("kelasPickBtn");
        const pickName = document.getElementById("kelasPickName");
        const pickDrop = document.getElementById("kelasPickDrop");
        const shortName = n => String(n || "").replace(/\s*-\s*/, "-");
        const syncPick = () => {
            const c = NilaiPage.classes.find(x => String(x.id) === String(NilaiPage.classId));
            pickName.textContent = c ? shortName(c.name) : "…";
            pickDrop.querySelectorAll("button").forEach(b =>
                b.classList.toggle("on", String(b.dataset.id) === String(NilaiPage.classId)));
        };
        pickDrop.innerHTML = NilaiPage.classes.map(c =>
            `<button type="button" data-id="${c.id}"><i class="fa-solid fa-users"></i><span>${ExamDB.esc(shortName(c.name))}</span><i class="fa-solid fa-check tick"></i></button>`).join("");
        pickDrop.querySelectorAll("button").forEach(b =>
            b.addEventListener("click", () => {
                NilaiPage.classId = b.dataset.id;
                syncPick();
                pickBtn.classList.remove("open");
                pickDrop.classList.remove("open");
                NilaiPage.load(true);
            }));
        syncPick();
        pickBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const open = pickDrop.classList.toggle("open");
            pickBtn.classList.toggle("open", open);
        });
        document.addEventListener("click", (e) => {
            if (!pickDrop.contains(e.target) && !pickBtn.contains(e.target)) {
                pickDrop.classList.remove("open");
                pickBtn.classList.remove("open");
            }
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                pickDrop.classList.remove("open");
                pickBtn.classList.remove("open");
            }
        });

        document.getElementById("mapelSel").addEventListener("change", () => NilaiPage.renderTable());
        document.getElementById("sortSel").addEventListener("change", () => NilaiPage.renderTable());
        document.getElementById("stuClose").addEventListener("click", () => NilaiPage.closeStu());
        document.getElementById("stuModal").addEventListener("click", e => {
            if (e.target.id === "stuModal") NilaiPage.closeStu();
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") { NilaiPage.closeStu(); NilaiPage.closeAdm(); }
        });
        window.addEventListener("popstate", () => {
            const m = document.getElementById("stuModal");
            if (m && m.classList.contains("open")) m.classList.remove("open");
            const a = document.getElementById("admModal");
            if (a && a.classList.contains("open")) a.classList.remove("open");
        });

        if (typeof Track !== "undefined") Track.page("nilai");
        if (typeof ExamViewer !== "undefined") ExamViewer.bind();
        ExamDB.watchVersion();
        await NilaiPage.load(true);
        NilaiPage.setupAdmin();
    },

    color(v) {
        if (isNaN(v)) return "var(--ink)";
        if (v >= 85) return "#198754";
        if (v >= NilaiPage.KKM) return "#8a6d00";
        if (v >= 60) return "#b57e0a";
        return "#dc3545";
    },

    cacheKey() {
        return `nilai_cache_${NilaiPage.testId}_${NilaiPage.classId}`;
    },

    async load(fresh) {
        const ck = NilaiPage.cacheKey();
        try {
            const raw = localStorage.getItem(ck);
            if (raw) {
                const c = JSON.parse(raw);
                if (c.ts && Date.now() - c.ts < NilaiPage.TTL) {
                    NilaiPage.applyData(c);
                    NilaiPage.fetchFresh(ck).catch(() => {});
                    return;
                }
            }
        } catch (e) { /* abaikan */ }
        await NilaiPage.fetchFresh(ck, true);
    },

    async fetchFresh(ck, render) {
        try {
            const [nRes, uRes, cRes] = await Promise.all([
                supa.from(NilaiPage.table()).select("*").eq("class_id", NilaiPage.classId).eq("scores_type", NilaiPage.testId),
                supa.from("users").select("id, full_name, nickname").eq("class_id", NilaiPage.classId),
                supa.from("nilai_config").select("hidden_subjects")
                    .eq("test_id", NilaiPage.testId).eq("class_id", NilaiPage.classId).maybeSingle()
            ]);
            if (nRes.error) throw nRes.error;
            const hidden = (cRes.data && cRes.data.hidden_subjects) || [];
            const nick = {};
            (uRes.data || []).forEach(u => {
                if (u.full_name) nick[u.full_name.toLowerCase()] = u.nickname || u.full_name;
                if (u.nickname) nick[u.nickname.toLowerCase()] = u.nickname;
                if (u.id != null) nick["id:" + u.id] = u.nickname || u.full_name;
            });
            // Adil: pembagi tetap = jumlah mapel kelas (yang kosong dihitung 0).
            const avg = s => {
                let t = 0, c = 0;
                for (const k in NilaiPage.mapel()) {
                    if (hidden.includes(k)) continue;
                    c++;
                    const v = parseFloat(s[k]);
                    if (!isNaN(v)) t += v;
                }
                return c ? parseFloat((t / c).toFixed(2)) : 0;
            };
            const rows = (nRes.data || []).map(s => ({ ...s, average: avg(s) }))
                .sort((a, b) => b.average - a.average || String(a.nama_siswa || "").localeCompare(String(b.nama_siswa || "")));

            // Identitas: profil exam → users lama → user_id; fallback nama_siswa.
            // Kalo udah klaim akun (index step 3), user_id langsung dari profil.
            // Kalo liat kelas lain, Pribadimu tetap dari kelas sendiri.
            let myClassId = null;
            try {
                const prof0 = ExamDB.profile();
                const mm = prof0 && prof0.slug && prof0.slug.match(/(\d+)$/);
                if (mm) myClassId = mm[1];
            } catch (e) { /* abaikan */ }
            let myRows = rows, myHidden = hidden;
            if (myClassId && String(myClassId) !== String(NilaiPage.classId)) {
                try {
                    const [mRes, mcRes] = await Promise.all([
                        supa.from(NilaiPage.table()).select("*").eq("class_id", myClassId).eq("scores_type", NilaiPage.testId),
                        supa.from("nilai_config").select("hidden_subjects")
                            .eq("test_id", NilaiPage.testId).eq("class_id", myClassId).maybeSingle()
                    ]);
                    if (!mRes.error && mRes.data) {
                        myHidden = (mcRes.data && mcRes.data.hidden_subjects) || [];
                        const avgM = s => {
                            let t = 0, c = 0;
                            for (const k in NilaiPage.mapel()) {
                                if (myHidden.includes(k)) continue;
                                c++;
                                const v = parseFloat(s[k]);
                                if (!isNaN(v)) t += v;
                            }
                            return c ? parseFloat((t / c).toFixed(2)) : 0;
                        };
                        myRows = mRes.data.map(s => ({ ...s, average: avgM(s) }))
                            .sort((a, b) => b.average - a.average || String(a.nama_siswa || "").localeCompare(String(b.nama_siswa || "")));
                    }
                } catch (e) { myRows = rows; myHidden = hidden; }
            }
            let myUserId = null, myRow = null, myRank = null;
            try {
                const prof = ExamDB.profile();
                if (prof && prof.user_id != null) {
                    myUserId = String(prof.user_id);
                    myRow = myRows.find(r => String(r.user_id) === String(myUserId))
                        || rows.find(r => String(r.user_id) === String(myUserId)) || null;
                }
                if (!myRow) {
                    const nm = ((prof && prof.name) || "").toLowerCase();
                    if (nm) {
                        const u = (uRes.data || []).find(x =>
                            (x.nickname && x.nickname.toLowerCase() === nm) ||
                            (x.full_name && x.full_name.toLowerCase() === nm));
                        if (u) myUserId = u.id;
                        myRow = myRows.find(r => (myUserId != null && String(r.user_id) === String(myUserId)))
                            || myRows.find(r => (r.nama_siswa || "").toLowerCase() === nm)
                            || rows.find(r => (myUserId != null && String(r.user_id) === String(myUserId)))
                            || rows.find(r => (r.nama_siswa || "").toLowerCase() === nm)
                            || rows.find(r => myUserId != null && (nick["id:" + myUserId] || "").toLowerCase() === (r.nama_siswa || "").toLowerCase())
                            || null;
                    }
                }
                if (myRow) {
                    const src = myRows.includes(myRow) ? myRows : rows;
                    myRank = src.indexOf(myRow) + 1;
                }
            } catch (e) { /* abaikan */ }

            const data = { ts: Date.now(), rows, myRow, myUserId, myRank, myHidden, hidden, nick };
            try { localStorage.setItem(ck, JSON.stringify(data)); } catch (e) { /* abaikan */ }
            NilaiPage.applyData(data);
            NilaiPage.loadFiles();
        } catch (e) {
            if (render) {
                document.getElementById("myName").textContent = "Gagal ambil data";
                document.getElementById("myMsg").textContent = e.message || e;
            }
        }
    },

    applyData(c) {
        NilaiPage.rows = c.rows || [];
        NilaiPage.myRow = c.myRow || null;
        NilaiPage.myUserId = c.myUserId || null;
        NilaiPage.myRank = c.myRank || null;
        NilaiPage.myHidden = c.myHidden || c.hidden || [];
        NilaiPage.hidden = c.hidden || [];
        NilaiPage.nickMap = c.nick || {};
        NilaiPage.renderMapel();
        NilaiPage.renderMine();
        NilaiPage.renderHideGrid();
        NilaiPage.renderAvg();
        NilaiPage.renderPodium();
        NilaiPage.renderTable();
    },

    disp(nama) {
        if (!nama) return "-";
        return NilaiPage.nickMap[nama.toLowerCase()] || nama;
    },

    visibleKeys() {
        return Object.keys(NilaiPage.mapel());
    },

    // Hide mapel pribadi: cuma tampilan di layarmu (localStorage per ujian).
    myHideKey() { return `nilai_myhide_${NilaiPage.testId}`; },
    myHide() {
        try { return JSON.parse(localStorage.getItem(NilaiPage.myHideKey()) || "[]"); }
        catch (e) { return []; }
    },
    toggleMyHide(k) {
        let h = NilaiPage.myHide();
        h = h.includes(k) ? h.filter(x => x !== k) : [...h, k];
        try { localStorage.setItem(NilaiPage.myHideKey(), JSON.stringify(h)); } catch (e) { /* abaikan */ }
        NilaiPage.renderMine();
    },

    // Mapel yang di-hide admin: murid liat "-", admin liat asli.
    // hk = config hide kelas sendiri (buat kartu Pribadimu pas liat kelas lain).
    // Admin default ikut tampilan murid; nyalain adminViewAll buat ngintip semua.
    adminViewAll: false,
    masked(k, hk) {
        const h = hk || NilaiPage.hidden;
        if (!h.includes(k)) return false;
        if (NilaiPage.isAdmin() && NilaiPage.adminViewAll) return false;
        return true;
    },

    renderMapel() {
        const sel = document.getElementById("mapelSel");
        const prev = sel.value;
        sel.innerHTML = NilaiPage.visibleKeys()
            .map(k => `<option value="${k}">${NilaiPage.mlabel(k)}</option>`).join("");
        if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
    },

    renderMine() {
        const r = NilaiPage.myRow;
        if (!r) {
            document.getElementById("myName").textContent = "Belum ada data";
            document.getElementById("myAvg").textContent = "-";
            document.getElementById("myRank").textContent = "-";
            document.getElementById("myMsg").textContent = "Namamu ga ketemu di data kelas ini. Login pake akun aslimu biar nilaimu muncul.";
            const next = encodeURIComponent("nilai?id=" + NilaiPage.testId);
            document.getElementById("myTable").innerHTML =
                `<div style="margin-top:14px;"><a class="btn gold sm" href="index.html?next=${next}&akun=1">` +
                `<i class="fa-solid fa-right-to-bracket"></i> Login buat liat nilai</a></div>`;
            document.getElementById("privWrap").style.display = "none";
            return;
        }
        const prof = ExamDB.profile() || {};
        document.getElementById("myAva").textContent = NilaiPage.disp(r.nama_siswa).charAt(0).toUpperCase() || "🙂";
        document.getElementById("myName").textContent = prof.name || NilaiPage.disp(r.nama_siswa);
        document.getElementById("myAvg").textContent = r.average.toFixed(2);
        document.getElementById("myAvg").style.color = NilaiPage.color(r.average);
        const rank = NilaiPage.myRank || (NilaiPage.rows.indexOf(r) + 1);
        document.getElementById("myRank").textContent = "#" + rank;
        // Top 5 gabisa private: paksa mati + betulin di DB.
        if (rank >= 1 && rank <= 5 && r.is_private) {
            r.is_private = false;
            try { localStorage.removeItem(NilaiPage.cacheKey()); } catch (e) {}
            if (NilaiPage.myUserId != null) {
                supa.from(NilaiPage.table()).update({ is_private: false })
                    .eq("user_id", NilaiPage.myUserId).eq("scores_type", NilaiPage.testId);
            }
        }
        const msg = r.average >= 85 ? "dingin di puncak 🥶"
            : r.average >= 75 ? "pass KKM, aman"
            : r.average >= 60 ? "dikit lagi KKM" : "gapapa, gas lagi";
        document.getElementById("myMsg").textContent = msg;

        document.getElementById("myTable").innerHTML =
            `<div class="mon-table-wrap"><table class="mon-table"><thead><tr>` +
            `<th>Mapel</th><th style="text-align:center;">Nilai</th><th style="text-align:center;">KKM</th><th style="width:34px;"></th>` +
            `</tr></thead><tbody>` +
            (() => {
                const gh = NilaiPage.myHide();
                return NilaiPage.visibleKeys().map(k => {
                    const v = parseFloat(r[k]);
                    const ghost = gh.includes(k);
                    const ok = !isNaN(v) && !NilaiPage.masked(k, NilaiPage.myHidden) && !ghost;
                    const c = ok ? NilaiPage.color(v) : "var(--muted)";
                    return `<tr${ghost ? ` style="opacity:.5;"` : ""}><td style="font-weight:700;">${NilaiPage.mlabel(k)}</td>` +
                        `<td style="text-align:center;"><span class="progress-pill" style="color:${c};">${ok ? v.toFixed(1) : "-"}</span></td>` +
                        `<td style="text-align:center;">${ok ? (v >= NilaiPage.KKM ? "✅" : "❌") : "-"}</td>` +
                        `<td style="text-align:center;"><button type="button" class="hide-eye" data-myhide="${k}" title="Sembunyiin dari layarmu"><i class="fa-solid fa-${ghost ? "eye-slash" : "eye"}"></i></button></td></tr>`;
                }).join("");
            })() + `</tbody></table></div>` +
            `<p style="font-size:.72rem; color:var(--muted); margin-top:8px; text-align:center;">Pencet <i class="fa-solid fa-eye"></i> buat nyembunyiin nilai dari layarmu aja.</p>`;
        document.querySelectorAll("#myTable [data-myhide]").forEach(b =>
            b.addEventListener("click", () => NilaiPage.toggleMyHide(b.dataset.myhide)));

        const tw = document.getElementById("privWrap");
        if (NilaiPage.myUserId != null) {
            tw.style.display = "flex";
            const tgl = document.getElementById("privToggle");
            tgl.checked = !!r.is_private;
            tgl.onchange = async () => {
                // Top 5 wajib tampil: tolak + kasih tau.
                const rankNow = NilaiPage.myRank || (NilaiPage.rows.indexOf(r) + 1);
                if (tgl.checked && rankNow >= 1 && rankNow <= 5) {
                    tgl.checked = false;
                    document.getElementById("stuName").textContent = "Gabisa";
                    document.getElementById("stuAvg").textContent = "";
                    document.getElementById("stuTable").innerHTML =
                        `<div style="text-align:center; padding:18px 6px;">` +
                        `<div style="font-size:2.4rem; color:var(--red);"><i class="fa-solid fa-xmark"></i></div>` +
                        `<p style="font-size:.88rem; color:var(--muted); margin-top:8px;">Kamu gabisa nge-privasi nilai, nilai kamu pada bagus.</p></div>`;
                    NilaiPage.openStu();
                    return;
                }
                try {
                    const { error } = await supa.from(NilaiPage.table()).update({ is_private: tgl.checked })
                        .eq("user_id", NilaiPage.myUserId).eq("scores_type", NilaiPage.testId);
                    if (error) throw error;
                    try { localStorage.removeItem(NilaiPage.cacheKey()); } catch (e) {}
                    await NilaiPage.load(true);
                    if (tgl.checked) {
                        document.getElementById("stuName").textContent = "Berhasil";
                        document.getElementById("stuAvg").textContent = "";
                        document.getElementById("stuTable").innerHTML =
                            `<div style="text-align:center; padding:18px 6px;">` +
                            `<div style="font-size:2.4rem; color:var(--green);"><i class="fa-solid fa-circle-check"></i></div>` +
                            `<p style="font-size:.88rem; color:var(--muted); margin-top:8px;">Kamu menyembunyikan nilai kamu.<br>Nilai kamu sekarang gabisa dilihat orang lain.</p></div>`;
                        NilaiPage.openStu();
                    }
                } catch (e) { tgl.checked = !tgl.checked; }
            };
        } else tw.style.display = "none";
    },

    renderAvg() {
        const card = document.getElementById("avgCard");
        if (!NilaiPage.rows.length) { card.style.display = "none"; return; }
        card.style.display = "block";
        const keys = NilaiPage.visibleKeys();
        const calc = keys.filter(k => !NilaiPage.hidden.includes(k));
        let sum = 0, n = 0;
        const avgMap = {};
        calc.forEach(k => {
            let s = 0, c = 0;
            NilaiPage.rows.forEach(r => {
                const v = parseFloat(r[k]);
                if (!isNaN(v)) { s += v; c++; }
            });
            sum += s; n += c;
            avgMap[k] = c ? s / c : null;
        });
        const overall = n ? sum / n : 0;
        const lulus = NilaiPage.rows.filter(r => r.average >= NilaiPage.KKM).length;
        document.getElementById("avgOverall").textContent = overall.toFixed(1);
        document.getElementById("avgTop").textContent = Math.max(...NilaiPage.rows.map(r => r.average)).toFixed(1);
        document.getElementById("avgPass").textContent = `${lulus}/${NilaiPage.rows.length}`;
        document.getElementById("avgList").innerHTML = keys.map(k => {
            const mask = NilaiPage.masked(k);
            const a = avgMap[k];
            const txt = (mask || a == null) ? "-" : a.toFixed(1);
            const col = (mask || a == null) ? "var(--muted)" : NilaiPage.color(a);
            return `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid var(--line);">` +
            `<span style="color:var(--muted);">${NilaiPage.mlabel(k)}</span>` +
            `<b style="color:${col};">${txt}</b></div>`;
        }).join("");
    },

    // Nilai disembunyiin (is_private): orang lain liat "-" + popup privasi.
    // Admin pun ikut ketutup, kecuali nyalain mata di samping setting.
    // Ngebuka kunci top 5 cuma di HP orangnya (renderMine), bukan dari HP orang lain.
    locked(s) {
        if (!s || !s.is_private) return false;
        if (NilaiPage.isAdmin() && NilaiPage.adminViewAll) return false;
        return NilaiPage.myUserId == null || String(s.user_id) !== String(NilaiPage.myUserId);
    },

    renderPodium() {
        const t3 = document.getElementById("podiumTop3");
        const rs = document.getElementById("podiumRest");
        if (!NilaiPage.rows.length) {
            t3.innerHTML = "";
            rs.innerHTML = `<div class="pub-empty">Belum ada data leaderboard.</div>`;
            return;
        }
        const medal = ["🥇", "🥈", "🥉"];
        const top = NilaiPage.rows.slice(0, 3);
        t3.innerHTML = `<div class="podium-grid">` + [1, 0, 2].map(i => {
            const s = top[i];
            if (!s) return `<div></div>`;
            return `<button type="button" class="podium-box p${i + 1}" data-uid="${ExamDB.esc(String(s.user_id ?? ""))}" data-nama="${ExamDB.esc(s.nama_siswa || "")}">` +
                `<div class="pod-medal">${medal[i]}</div>` +
                `<div class="pod-name">${ExamDB.esc(NilaiPage.disp(s.nama_siswa))}${s.is_private ? " 🔒" : ""}</div>` +
                `<div class="pod-score">${s.average.toFixed(1)}</div></button>`;
        }).join("") + `</div>`;
        rs.innerHTML = NilaiPage.rows.slice(3, 15).map((s, j) =>
            `<button type="button" class="leader-item" data-uid="${ExamDB.esc(String(s.user_id ?? ""))}" data-nama="${ExamDB.esc(s.nama_siswa || "")}">` +
            `<span class="leader-rank">${j + 4}</span>` +
            `<span class="leader-name">${ExamDB.esc(NilaiPage.disp(s.nama_siswa))}${s.is_private ? " 🔒" : ""}</span>` +
            `<b style="color:${NilaiPage.color(s.average)};">${s.average.toFixed(1)}</b></button>`
        ).join("");
        document.querySelectorAll("[data-uid]").forEach(b =>
            b.addEventListener("click", () => NilaiPage.showStudent(b.dataset.uid, b.dataset.nama)));
    },

    // Modal: fade dua arah (CSS) + Esc + back HP (contek ExamViewer).
    openStu() {
        const m = document.getElementById("stuModal");
        if (m.classList.contains("open")) return;
        m.classList.add("open");
        try { history.pushState({ stu: true }, ""); } catch (e) { /* abaikan */ }
    },

    closeStu() {
        const m = document.getElementById("stuModal");
        if (!m.classList.contains("open")) return;
        // Ada cantolan history → makan 1 back biar sinkron (popstate yang nutup).
        try {
            if (history.state && history.state.stu) { history.back(); return; }
        } catch (e) { /* lanjut tutup manual */ }
        m.classList.remove("open");
    },

    showStudent(uid, nama) {
        const s = NilaiPage.rows.find(x => String(x.user_id ?? "") === String(uid || "§"))
            || NilaiPage.rows.find(x => (x.nama_siswa || "") === (nama || ""));
        if (!s) return;
        if (NilaiPage.locked(s)) {
            document.getElementById("stuName").textContent = NilaiPage.disp(s.nama_siswa);
            document.getElementById("stuAvg").textContent = "";
            document.getElementById("stuTable").innerHTML =
                `<div style="text-align:center; padding:18px 6px;">` +
                `<div style="font-size:2.4rem; opacity:.5;"><i class="fa-solid fa-lock"></i></div>` +
                `<p style="font-size:.88rem; color:var(--muted); margin-top:8px;">Orang ini memprivasi nilainya.</p></div>`;
            NilaiPage.openStu();
            return;
        }
        document.getElementById("stuName").textContent = NilaiPage.disp(s.nama_siswa);
        document.getElementById("stuAvg").textContent = "Rata-rata " + s.average.toFixed(2);
        document.getElementById("stuTable").innerHTML =
            `<div class="mon-table-wrap"><table class="mon-table"><thead><tr>` +
            `<th>Mapel</th><th style="text-align:center;">Nilai</th><th style="text-align:center;">KKM</th>` +
            `</tr></thead><tbody>` +
            NilaiPage.visibleKeys().map(k => {
                const v = parseFloat(s[k]);
                const show = !isNaN(v) && !NilaiPage.masked(k);
                const c = show ? NilaiPage.color(v) : "var(--muted)";
                return `<tr><td style="font-weight:700;">${NilaiPage.mlabel(k)}</td>` +
                    `<td style="text-align:center;"><span class="progress-pill" style="color:${c};">${show ? v.toFixed(1) : "-"}</span></td>` +
                    `<td style="text-align:center;">${show ? (v >= NilaiPage.KKM ? "✅" : "❌") : "-"}</td></tr>`;
            }).join("") + `</tbody></table></div>`;
        NilaiPage.openStu();
    },

    renderTable() {
        const k = document.getElementById("mapelSel").value;
        const sort = document.getElementById("sortSel").value;
        const tb = document.getElementById("classBody");
        if (!k || !NilaiPage.rows.length) {
            tb.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px; opacity:.5;">Belum ada data.</td></tr>`;
            return;
        }
        const sorted = [...NilaiPage.rows].sort((a, b) =>
            sort === "nama"
                ? String(a.nama_siswa || "").localeCompare(String(b.nama_siswa || ""))
                : (parseFloat(b[k]) || -1) - (parseFloat(a[k]) || -1));
        tb.innerHTML = sorted.map((s, i) => {
            const v = parseFloat(s[k]);
            const mine = NilaiPage.myUserId != null && String(s.user_id) === String(NilaiPage.myUserId);
            const lock = NilaiPage.locked(s);
            const hide = lock || NilaiPage.masked(k);
            const score = hide ? `<td style="text-align:right; opacity:.4;">-</td>` :
                `<td style="text-align:right;"><b style="color:${NilaiPage.color(v)};">${isNaN(v) ? "-" : v.toFixed(1)}</b></td>`;
            return `<tr${mine ? ' class="me"' : ""} data-uid="${ExamDB.esc(String(s.user_id ?? ""))}" data-nama="${ExamDB.esc(s.nama_siswa || "")}" style="cursor:pointer;">` +
                `<td style="opacity:.5; font-weight:800;">${i + 1}</td>` +
                `<td style="font-weight:700;">${ExamDB.esc(NilaiPage.disp(s.nama_siswa))}${s.is_private ? " 🔒" : ""}</td>` +
                score + `</tr>`;
        }).join("");
        tb.querySelectorAll("tr[data-uid]").forEach(tr =>
            tr.addEventListener("click", () => NilaiPage.showStudent(tr.dataset.uid, tr.dataset.nama)));
    },

    async loadFiles() {
        const box = document.getElementById("filesList");
        try {
            const { data, error } = await supa.from("nilai_files").select("*")
                .eq("test_id", NilaiPage.testId).eq("class_id", NilaiPage.classId)
                .order("display_order").order("id");
            if (error) throw error;
            box.innerHTML = (data || []).length ? (data || []).map(f => {
                const full = ExamMedia.url(f.file_url || "");
                const isPdf = /\.pdf($|\?)/i.test(full);
                const main = isPdf
                    ? `<button type="button" class="pub-file" data-pdf="${ExamDB.esc(full)}">` +
                      `<i class="fa-solid fa-file-pdf"></i><span>${ExamDB.esc(f.label || f.file_name || "File")}</span>` +
                      `<i class="fa-solid fa-expand pub-open"></i></button>`
                    : `<a class="pub-file" href="${ExamDB.esc(full)}" target="_blank" rel="noopener">` +
                      `<i class="fa-solid fa-file-arrow-down"></i><span>${ExamDB.esc(f.label || f.file_name || "File")}</span>` +
                      `<i class="fa-solid fa-arrow-up-right-from-square pub-open"></i></a>`;
                const del = NilaiPage.isAdmin()
                    ? `<button type="button" class="x" data-delfile="${f.id}" title="Hapus" style="flex-shrink:0;">🗑</button>` : "";
                return `<div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;"><div style="flex:1; min-width:0;">${main}</div>${del}</div>`;
            }).join("") : `<p style="color:var(--muted); font-size:.85rem;">Belum ada file.</p>`;
            box.querySelectorAll("[data-pdf]").forEach(b =>
                b.addEventListener("click", () => ExamViewer.open([b.dataset.pdf], 0)));
        } catch (e) {
            box.innerHTML = `<p style="color:var(--muted); font-size:.85rem;">Gagal ambil file.</p>`;
        }
    },

    // ---- Admin (PIN exam_admin ATAU akun nizam id=1) ----
    isAdmin() {
        try {
            if (sessionStorage.getItem("exam_admin") === "1") return true;
            if (NilaiPage.myUserId != null && String(NilaiPage.myUserId) === "1") return true;
            const p = ExamDB.profile() || {};
            if (String(p.user_id || "") === "1") return true;
            const nm = (p.name || "").trim().toLowerCase();
            if (nm === "nizam" || nm.split(/\s+/)[0] === "nizam") return true;
        } catch (e) { /* abaikan */ }
        return false;
    },

    // Checklist hide-mapel ngikutin kelas yang aktif (di-render ulang tiap load).
    renderHideGrid() {
        const grid = document.getElementById("hideGrid");
        if (!grid) return;
        grid.innerHTML = Object.keys(NilaiPage.mapel()).map(k =>
            `<label class="check-pill"><input type="checkbox" value="${k}"${NilaiPage.hidden.includes(k) ? " checked" : ""}> ${NilaiPage.mlabel(k)}</label>`
        ).join("");
    },

    // Modal admin: contek pola openStu (fade + Esc + back HP).
    openAdm() {
        const m = document.getElementById("admModal");
        if (!m || m.classList.contains("open")) return;
        m.classList.add("open");
        try { history.pushState({ adm: true }, ""); } catch (e) { /* abaikan */ }
    },

    closeAdm() {
        const m = document.getElementById("admModal");
        if (!m || !m.classList.contains("open")) return;
        try {
            if (history.state && history.state.adm) { history.back(); return; }
        } catch (e) { /* lanjut tutup manual */ }
        m.classList.remove("open");
    },

    setupAdmin() {
        if (!NilaiPage.isAdmin()) return;
        // Gear + mata pindah ke dropdown profil (cuma ada di halaman nilai).
        const st = document.getElementById("dropSetting");
        st.style.display = "";
        const shutDrop = () => {
            document.getElementById("topDrop").classList.remove("open");
            document.getElementById("topUser").classList.remove("open");
        };
        st.addEventListener("click", () => { shutDrop(); NilaiPage.openAdm(); });
        document.getElementById("admClose").addEventListener("click", () => NilaiPage.closeAdm());
        document.getElementById("admModal").addEventListener("click", e => {
            if (e.target.id === "admModal") NilaiPage.closeAdm();
        });
        // Toggle mata: admin ngintip semua nilai vs tampilan murid.
        const vw = document.getElementById("dropViewAll");
        vw.style.display = "";
        vw.addEventListener("click", () => {
            NilaiPage.adminViewAll = !NilaiPage.adminViewAll;
            shutDrop();
            vw.querySelector("i").className = `fa-solid fa-${NilaiPage.adminViewAll ? "eye-slash" : "eye"}`;
            NilaiPage.renderMine();
            NilaiPage.renderAvg();
            NilaiPage.renderTable();
        });
        NilaiPage.renderHideGrid();
        document.getElementById("hideSave").addEventListener("click", async () => {
            const hidden = [...document.querySelectorAll("#hideGrid input:checked")].map(x => x.value);
            const btn = document.getElementById("hideSave");
            const orig = btn.innerHTML;
            btn.disabled = true;
            try {
                const { error } = await supa.from("nilai_config").upsert(
                    { test_id: NilaiPage.testId, class_id: NilaiPage.classId, hidden_subjects: hidden },
                    { onConflict: "test_id,class_id" });
                if (error) throw error;
                try { localStorage.removeItem(NilaiPage.cacheKey()); } catch (e) {}
                await NilaiPage.load(true);
                btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan`;
                setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2500);
            } catch (e) {
                btn.innerHTML = `<i class="fa-solid fa-xmark"></i> Gagal, coba lagi`;
                setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2500);
            }
        });
        document.getElementById("fileBtn").addEventListener("click", async () => {
            const input = document.getElementById("fileUp");
            if (!input.files.length) return;
            const f = input.files[0];
            const label = document.getElementById("fileLabel").value.trim() || f.name;
            try {
                const key = "nilai/" + NilaiPage.testId + "-" + Date.now() + "-" +
                    f.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
                let up = f;
                if (f.type.startsWith("image/")) {
                    try { up = await ExamMedia.compressImage(f); } catch (e) { /* asli */ }
                }
                const pres = await ExamMedia.mintaPresign(key, up.type || "application/octet-stream");
                const r = await fetch(pres.url, { method: "PUT", headers: { "Content-Type": up.type }, body: up });
                if (!r.ok) throw new Error("Upload R2 gagal (" + r.status + ")");
                const { error } = await supa.from("nilai_files").insert({
                    test_id: NilaiPage.testId, class_id: NilaiPage.classId,
                    file_name: f.name, file_url: key,
                    label
                });
                if (error) throw error;
                input.value = "";
                document.getElementById("fileLabel").value = "";
                NilaiPage.loadFiles();
            } catch (e) { /* abaikan */ }
        });
        document.getElementById("filesList").addEventListener("click", async e => {
            const x = e.target.closest("[data-delfile]");
            if (!x || !confirm("Hapus file ini?")) return;
            try {
                const { data } = await supa.from("nilai_files").select("file_url").eq("id", x.dataset.delfile).single();
                const url = (data && data.file_url) || "";
                // Hapus fisik cuma buat file R2 (domain sendiri / path relatif).
                // URL Supabase lama → skip (biarin yatim).
                let key = null;
                const r2m = url.match(/media\.e-learniz\.my\.id\/(.+?)(\?.*)?$/);
                if (r2m) key = r2m[1];
                else if (url && !/^https?:/i.test(url)) key = url.replace(/^\/+/, "");
                if (key) {
                    try { await ExamMedia.r2Delete(key); } catch (err) { /* lanjut hapus baris */ }
                }
                await supa.from("nilai_files").delete().eq("id", x.dataset.delfile);
                NilaiPage.loadFiles();
            } catch (err) { /* abaikan */ }
        });
    }
};

document.addEventListener("DOMContentLoaded", () => NilaiPage.boot());
