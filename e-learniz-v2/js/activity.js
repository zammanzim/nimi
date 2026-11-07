// ==========================================
// ACTIVITY LOG + ONLINE POINTS
// ==========================================

const _getActivityUser = () => {
    try { return JSON.parse(localStorage.getItem("user")); } catch (e) { return null; }
};

// ── ONLINE TIMER: +5 poin setiap 30 detik ──
window._activityStart = Date.now();
setInterval(async () => {
    const user = _getActivityUser();
    if (!user || typeof supabase === 'undefined') return;
    if (document.visibilityState !== 'visible') return;
    await logActivity('Online 30 Detik', 'Online', 5, `online_${Date.now()}`);
}, 30000);

// ==========================================
// LOG ACTIVITY — anti-spam, 1x per sesi
// ==========================================
async function logActivity(action, page, points = 1, uniqueId = "") {
    const user = _getActivityUser();
    if (!user || typeof supabase === 'undefined') return;

    const userId = user.id;
    const actionId = action.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    const activityKey = `act_${userId}_${actionId}_${uniqueId}`;
    
    const lastKey = sessionStorage.getItem('last_activity_key');
    if (activityKey === lastKey) return;

    if (page !== "Navigation") {
        if (sessionStorage.getItem(activityKey)) {
            console.log(`logActivity: Content "${action}" already logged in this session.`);
            return;
        }
    }

    const classId = (typeof getEffectiveClassId === 'function') 
        ? getEffectiveClassId() 
        : (user.class_id || "unknown");

    try {
        const { error } = await supabase.from("activity_logs").insert({
            user_id: userId,
            action_text: action,
            page_name: page,
            points: points,
            class_id: classId,
            reference_id: uniqueId
        });

        if (!error) {
            sessionStorage.setItem(activityKey, "true");
            sessionStorage.setItem('last_activity_key', activityKey);
            console.log(`%cActivity Logged: ${action} (+${points} pts)`, "color: #0be881; font-weight: bold;");
        }
    } catch (err) { console.error("Activity Log Execution Error:", err); }
}

window.logActivity = logActivity;
