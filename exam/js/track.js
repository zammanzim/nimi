// ============================================================
// TRACK — telemetri ringan tanpa login (contek pola osistar).
// Identitas = device_key per HP/browser + nama profil (someone).
// - presence: 1 baris per device, di-upsert tiap aksi + heartbeat 30 dtk.
// - events: riwayat (buka halaman, mulai/selesai quiz + nilai).
// Semua fire-and-forget, ga pernah ganggu UX.
// ============================================================

const Track = {
    _did: null,
    _hb: null,

    device() {
        if (Track._did) return Track._did;
        try {
            let id = localStorage.getItem("exam_did");
            if (!id) {
                id = "d_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
                localStorage.setItem("exam_did", id);
            }
            Track._did = id;
        } catch (e) { Track._did = "d_unknown"; }
        return Track._did;
    },

    name() {
        try {
            const p = (typeof ExamDB !== "undefined" && ExamDB.profile())
                || JSON.parse(localStorage.getItem("exam_profile") || "null");
            const nm = p && (p.name || "").trim ? String(p.name || "").trim() : "";
            return nm || "someone";
        } catch (e) { return "someone"; }
    },

    slug() {
        try {
            const p = (typeof ExamDB !== "undefined" && ExamDB.profile())
                || JSON.parse(localStorage.getItem("exam_profile") || "null");
            return (p && p.slug) || new URLSearchParams(location.search).get("id") || "";
        } catch (e) { return ""; }
    },

    // Upsert presence. patch = kolom tambahan (quiz_* / last_score).
    async presence(page, patch) {
        try {
            await supa.from("exam_presence").upsert({
                device_key: Track.device(),
                name: Track.name(),
                class_slug: Track.slug(),
                page: page || "",
                last_seen: new Date().toISOString(),
                ...(patch || {})
            }, { onConflict: "device_key" });
        } catch (e) { /* abaikan */ }
    },

    async event(kind, detail) {
        try {
            await supa.from("exam_events").insert({
                device_key: Track.device(),
                name: Track.name(),
                class_slug: Track.slug(),
                kind, detail: detail || ""
            });
        } catch (e) { /* abaikan */ }
    },

    // Dipanggil tiap halaman dibuka. Heartbeat jalan selama tab keliatan.
    page(pageName) {
        Track.presence(pageName, { quiz_subject: "", quiz_idx: 0, quiz_total: 0 });
        Track.event("page", pageName);
        if (Track._hb) clearInterval(Track._hb);
        Track._hb = setInterval(() => {
            if (document.visibilityState === "visible") Track.presence(pageName);
        }, 30000);
    },

    quizStart(subject, total) {
        Track.presence("quiz", { quiz_subject: subject, quiz_idx: 0, quiz_total: total });
        Track.event("quiz_start", subject + " (" + total + " soal)");
    },

    quizProgress(subject, idx, total) {
        Track.presence("quiz", { quiz_subject: subject, quiz_idx: idx, quiz_total: total });
    },

    quizFinish(subject, score, benar, total) {
        Track.presence("quiz", {
            quiz_subject: subject, quiz_idx: total, quiz_total: total, last_score: score
        });
        Track.event("quiz_finish", subject + " nilai " + score + " (" + benar + "/" + total + ")");
    }
};

if (typeof window !== "undefined") window.Track = Track;
