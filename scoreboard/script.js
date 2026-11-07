/* =========================================================
   SCOREBOARD — Vanilla JS, localStorage, no backend
   ========================================================= */

const STORAGE_KEY = "scoreboard_data_v1";
const DEFAULT_POINT = 1;
const DEFAULT_COUNT = 5;
const MAX_COUNT = 20;

const medal = ["🥇", "🥈", "🥉"];

/* ---------- State ---------- */
let state = loadState();
let activePoint = state.activePoint || DEFAULT_POINT;
let teamCount = state.teamCount || DEFAULT_COUNT;
let lastAction = null; // for undo

function makeTeam(n) {
  return { id: n, name: "TIM " + n, score: 0, order: n - 1 };
}

function defaultTeams() {
  return Array.from({ length: DEFAULT_COUNT }, (_, i) => makeTeam(i + 1));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.teams) && parsed.teams.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Gagal baca localStorage", e);
  }
  return { teams: defaultTeams(), activePoint: DEFAULT_POINT, teamCount: DEFAULT_COUNT };
}

function ensureTeams() {
  while (state.teams.length < teamCount) {
    const n = state.teams.length + 1;
    state.teams.push(makeTeam(n));
  }
}

function saveState() {
  state.activePoint = activePoint;
  state.teamCount = teamCount;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Ranking ---------- */
function rankedTeams() {
  // hanya tim yang ditampilkan, diurutkan skor desc, tie-break urutan awal asc
  const shown = state.teams.slice(0, teamCount);
  return [...shown].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.order - b.order;
  });
}

/* ---------- DOM refs ---------- */
const boardEl = document.getElementById("board");
const pointDisplayEl = document.getElementById("pointDisplay");
const pointInputEl = document.getElementById("pointInput");
const undoBtn = document.getElementById("undoBtn");

/* ---------- Layout: columns follow team count, responsive ---------- */
function applyLayout() {
  const w = window.innerWidth;
  let cols = teamCount;
  if (w <= 620) cols = 1;
  else if (w <= 1100) cols = Math.min(teamCount, 2);
  boardEl.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
}

/* ---------- Render board with FLIP animation ---------- */
function renderBoard(animate = true) {
  applyLayout();
  const ranked = rankedTeams();

  // record old positions for FLIP
  const oldRects = {};
  if (animate) {
    boardEl.querySelectorAll(".card").forEach((card) => {
      oldRects[card.dataset.id] = card.getBoundingClientRect();
    });
  }

  boardEl.innerHTML = "";

  ranked.forEach((team, idx) => {
    const rank = idx + 1;
    const card = document.createElement("div");
    card.className = "card" + (rank <= 3 ? " rank-" + rank : "");
    card.dataset.id = team.id;

    const badge = document.createElement("div");
    badge.className = "rank-badge";
    badge.innerHTML = rank <= 3 ? medal[rank - 1] : "";

    const nameInput = document.createElement("input");
    nameInput.className = "team-name";
    nameInput.value = team.name;
    nameInput.setAttribute("aria-label", "Nama tim");
    nameInput.addEventListener("change", () => {
      team.name = nameInput.value.trim() || team.name;
      nameInput.value = team.name;
      saveState();
    });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") nameInput.blur();
    });

    const scoreEl = document.createElement("div");
    scoreEl.className = "score";
    scoreEl.textContent = team.score;

    const controls = document.createElement("div");
    controls.className = "controls";

    const minus = document.createElement("button");
    minus.className = "big-btn minus";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "Kurangi skor");
    minus.addEventListener("click", () => adjustScore(team.id, -activePoint, scoreEl));

    const plus = document.createElement("button");
    plus.className = "big-btn plus";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Tambah skor");
    plus.addEventListener("click", () => adjustScore(team.id, activePoint, scoreEl));

    controls.appendChild(minus);
    controls.appendChild(plus);

    const resetOne = document.createElement("button");
    resetOne.className = "reset-one";
    resetOne.textContent = "Reset tim";
    resetOne.addEventListener("click", () => resetTeam(team.id));

    card.appendChild(badge);
    card.appendChild(nameInput);
    card.appendChild(scoreEl);
    card.appendChild(controls);
    card.appendChild(resetOne);
    boardEl.appendChild(card);
  });

  if (animate) {
    boardEl.querySelectorAll(".card").forEach((card) => {
      const oldR = oldRects[card.dataset.id];
      if (!oldR) return;
      const newR = card.getBoundingClientRect();
      const dx = oldR.left - newR.left;
      const dy = oldR.top - newR.top;
      if (dx || dy) {
        card.style.transform = `translate(${dx}px, ${dy}px)`;
        card.style.transition = "transform 0s";
        requestAnimationFrame(() => {
          card.style.transition = "";
          card.style.transform = "";
        });
      }
    });
  }
}

/* ---------- Score adjustment ---------- */
function adjustScore(teamId, delta, scoreEl) {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return;

  const prevScore = team.score;
  team.score = team.score + delta; // skor boleh negatif

  // record for undo
  lastAction = { teamId, prevScore, newScore: team.score };
  undoBtn.disabled = false;

  saveState();

  // update just the number + bump animation (keep card position for a frame)
  if (scoreEl) {
    scoreEl.textContent = team.score;
    scoreEl.classList.remove("bump");
    void scoreEl.offsetWidth; // reflow to restart animation
    scoreEl.classList.add("bump");
  }

  // tunda perubahan urutan 3 detik (threshold), reset tiap ada perubahan baru
  scheduleReorder();
}

let reorderTimer = null;
function scheduleReorder() {
  if (reorderTimer) clearTimeout(reorderTimer);
  reorderTimer = setTimeout(() => {
    reorderTimer = null;
    renderBoard(true);
  }, 3000);
}

function resetTeam(teamId) {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return;
  lastAction = { teamId, prevScore: team.score, newScore: 0 };
  team.score = 0;
  undoBtn.disabled = false;
  saveState();
  renderBoard(true);
}

/* ---------- Undo ---------- */
undoBtn.addEventListener("click", () => {
  if (!lastAction) return;
  const team = state.teams.find((t) => t.id === lastAction.teamId);
  if (team) {
    team.score = lastAction.prevScore;
    saveState();
    renderBoard(true);
  }
  lastAction = null;
  undoBtn.disabled = true;
});

/* ---------- Point value controls ---------- */
function setActivePoint(val) {
  val = Math.floor(Number(val));
  if (!Number.isFinite(val) || val === 0) return; // 0 tidak berguna, abaikan
  activePoint = val;
  pointDisplayEl.textContent = val;
  pointInputEl.value = "";
  document.querySelectorAll(".point-btn[data-point]").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.point) === val);
  });
  saveState();
}

document.querySelectorAll(".point-btn[data-point]").forEach((btn) => {
  btn.addEventListener("click", () => setActivePoint(btn.dataset.point));
});

document.getElementById("pointApply").addEventListener("click", () => {
  if (pointInputEl.value) setActivePoint(pointInputEl.value);
});
pointInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && pointInputEl.value) setActivePoint(pointInputEl.value);
});

/* ---------- Team count controls ---------- */
const countInputEl = document.getElementById("countInput");

function setTeamCount(val) {
  val = Math.floor(Number(val));
  if (!Number.isFinite(val) || val < 1 || val > MAX_COUNT) return;
  teamCount = val;
  ensureTeams();
  document.querySelectorAll(".count-btn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.count) === teamCount);
  });
  saveState();
  renderBoard(false);
}

document.querySelectorAll(".count-btn[data-count]").forEach((btn) => {
  btn.addEventListener("click", () => setTeamCount(btn.dataset.count));
});
document.getElementById("countApply").addEventListener("click", () => {
  if (countInputEl.value) setTeamCount(countInputEl.value);
});
countInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && countInputEl.value) setTeamCount(countInputEl.value);
});

/* ---------- Reset all (with confirm modal) ---------- */
const resetModal = document.getElementById("resetModal");

document.getElementById("resetBtn").addEventListener("click", () => {
  resetModal.hidden = false;
});
document.getElementById("resetCancel").addEventListener("click", () => {
  resetModal.hidden = true;
});
document.getElementById("resetConfirm").addEventListener("click", () => {
  state.teams.forEach((t) => (t.score = 0));
  lastAction = null;
  undoBtn.disabled = true;
  saveState();
  renderBoard(true);
  resetModal.hidden = true;
});
resetModal.addEventListener("click", (e) => {
  if (e.target === resetModal) resetModal.hidden = true;
});

/* ---------- Keyboard shortcuts (optional, touch-first) ---------- */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !resetModal.hidden) resetModal.hidden = true;
});

/* ---------- Init ---------- */
ensureTeams();
setActivePoint(activePoint);
document.querySelectorAll(".count-btn").forEach((b) => {
  b.classList.toggle("active", Number(b.dataset.count) === teamCount);
});
undoBtn.disabled = !lastAction;
renderBoard(false);
window.addEventListener("resize", applyLayout);
