// ============================================================
// jepun.js — Nihongo Quiz (tebak hiragana & katakana)
// Data + logic dipindah dari inline script biar konsisten
// sama halaman /a/* lain (sidebar, auth, activity, dll).
// ============================================================

const basicH = [
  ["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"],
  ["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"],
  ["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"],
  ["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"],
  ["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"],
  ["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"],
  ["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"],
  ["や", "ya"], ["ゆ", "yu"], ["よ", "yo"],
  ["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"],
  ["わ", "wa"], ["を", "wo"], ["ん", "n"],
];
const voicedH = [
  ["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"],
  ["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"],
  ["だ", "da"], ["ぢ", "di"], ["づ", "du"], ["で", "de"], ["ど", "do"],
  ["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"],
  ["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"],
];
const comboH = [
  ["きゃ", "kya"], ["きゅ", "kyu"], ["きょ", "kyo"],
  ["しゃ", "sha"], ["しゅ", "shu"], ["しょ", "sho"],
  ["ちゃ", "cha"], ["ちゅ", "chu"], ["ちょ", "cho"],
  ["にゃ", "nya"], ["にゅ", "nyu"], ["にょ", "nyo"],
  ["ひゃ", "hya"], ["ひゅ", "hyu"], ["ひょ", "hyo"],
  ["みゃ", "mya"], ["みゅ", "myu"], ["みょ", "myo"],
  ["りゃ", "rya"], ["りゅ", "ryu"], ["りょ", "ryo"],
  ["ぎゃ", "gya"], ["ぎゅ", "gyu"], ["ぎょ", "gyo"],
  ["じゃ", "ja"], ["じゅ", "ju"], ["じょ", "jo"],
  ["びゃ", "bya"], ["びゅ", "byu"], ["びょ", "byo"],
];
const basicK = [
  ["ア", "a"], ["イ", "i"], ["ウ", "u"], ["エ", "e"], ["オ", "o"],
  ["カ", "ka"], ["キ", "ki"], ["ク", "ku"], ["ケ", "ke"], ["コ", "ko"],
  ["サ", "sa"], ["シ", "shi"], ["ス", "su"], ["セ", "se"], ["ソ", "so"],
  ["タ", "ta"], ["チ", "chi"], ["ツ", "tsu"], ["テ", "te"], ["ト", "to"],
  ["ナ", "na"], ["ニ", "ni"], ["ヌ", "nu"], ["ネ", "ne"], ["ノ", "no"],
  ["ハ", "ha"], ["ヒ", "hi"], ["フ", "fu"], ["ヘ", "he"], ["ホ", "ho"],
  ["マ", "ma"], ["ミ", "mi"], ["ム", "mu"], ["メ", "me"], ["モ", "mo"],
  ["ヤ", "ya"], ["ユ", "yu"], ["ヨ", "yo"],
  ["ラ", "ra"], ["リ", "ri"], ["ル", "ru"], ["レ", "re"], ["ロ", "ro"],
  ["ワ", "wa"], ["ヲ", "wo"], ["ン", "n"],
];
const voicedK = [
  ["ガ", "ga"], ["ギ", "gi"], ["グ", "gu"], ["ゲ", "ge"], ["ゴ", "go"],
  ["ザ", "za"], ["ジ", "ji"], ["ズ", "zu"], ["ゼ", "ze"], ["ゾ", "zo"],
  ["ダ", "da"], ["ヂ", "di"], ["ヅ", "du"], ["デ", "de"], ["ド", "do"],
  ["バ", "ba"], ["ビ", "bi"], ["ブ", "bu"], ["ベ", "be"], ["ボ", "bo"],
  ["パ", "pa"], ["ピ", "pi"], ["プ", "pu"], ["ペ", "pe"], ["ポ", "po"],
];
const comboK = [
  ["キャ", "kya"], ["キュ", "kyu"], ["キョ", "kyo"],
  ["シャ", "sha"], ["シュ", "shu"], ["ショ", "sho"],
  ["チャ", "cha"], ["チュ", "chu"], ["チョ", "cho"],
  ["ニャ", "nya"], ["ニュ", "nyu"], ["ニョ", "nyo"],
  ["ヒャ", "hya"], ["ヒュ", "hyu"], ["ヒョ", "hyo"],
  ["ミャ", "mya"], ["ミュ", "myu"], ["ミョ", "myo"],
  ["リャ", "rya"], ["リュ", "ryu"], ["リョ", "ryo"],
  ["ギャ", "gya"], ["ギュ", "gyu"], ["ギョ", "gyo"],
  ["ジャ", "ja"], ["ジュ", "ju"], ["ジョ", "jo"],
  ["ビャ", "bya"], ["ビュ", "byu"], ["ビョ", "byo"],
];

const JepunModes = [
  { id: "hb", name: "Hiragana dasar", desc: "46 huruf dasar", data: basicH, label: "Hiragana dasar • 46 huruf" },
  { id: "hv", name: "Hiragana bercoret", desc: "Dakuten + handakuten", data: voicedH, label: "Hiragana dakuten / handakuten • 25 huruf" },
  { id: "hc", name: "Hiragana kombinasi", desc: "ゃ・ゅ・ょ kecil", data: comboH, label: "Hiragana kombinasi • 30 huruf" },
  { id: "ha", name: "Semua Hiragana", desc: "Dasar + bercoret + kombinasi", data: [...basicH, ...voicedH, ...comboH], label: "Semua Hiragana • 101 huruf" },
  { id: "kb", name: "Katakana dasar", desc: "46 huruf dasar", data: basicK, label: "Katakana dasar • 46 huruf" },
  { id: "kv", name: "Katakana bercoret", desc: "Dakuten + handakuten", data: voicedK, label: "Katakana dakuten / handakuten • 25 huruf" },
  { id: "kc", name: "Katakana kombinasi", desc: "ャ・ュ・ョ kecil", data: comboK, label: "Katakana kombinasi • 30 huruf" },
  { id: "ka", name: "Semua Katakana", desc: "Dasar + bercoret + kombinasi", data: [...basicK, ...voicedK, ...comboK], label: "Semua Katakana • 101 huruf" },
  { id: "all", name: "Semua huruf", desc: "Hiragana + Katakana", data: [...basicH, ...voicedH, ...comboH, ...basicK, ...voicedK, ...comboK], label: "Semua huruf Jepang • 202 huruf" },
];

const JepunApp = {
  current: JepunModes[0],
  q: null,
  score: 0,
  streak: 0,
  answered: 0,
  correct: 0,
  locked: false,
  deck: [],
  lastKana: null,

  $ (id) { return document.getElementById(id); },

  init() {
    if (!this.$("modes")) return;
    this.renderModes();
    this.nextQuestion();
    this.$("submit").onclick = () => this.check(this.$("answerInput").value);
    this.$("answerInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.check(e.target.value);
    });
    this.$("next").onclick = () => this.nextQuestion();
    if (typeof logActivity === "function") logActivity("Buka Nihongo Quiz", "Jepun", 1, "jepun_visit");
  },

  renderModes() {
    const modesEl = this.$("modes");
    modesEl.innerHTML = JepunModes.map((m) =>
      `<button class="jp-mode ${m.id === this.current.id ? "active" : ""}" data-id="${m.id}"><strong>${m.name}</strong><small>${m.desc}</small></button>`
    ).join("");
    modesEl.querySelectorAll(".jp-mode").forEach((b) => (b.onclick = () => {
      this.current = JepunModes.find((m) => m.id === b.dataset.id);
      this.deck = [];
      this.lastKana = null;
      this.resetStats();
      this.nextQuestion();
      this.renderModes();
    }));
  },

  resetStats() {
    this.score = 0; this.streak = 0; this.answered = 0; this.correct = 0;
    this.updateStats();
  },

  updateStats() {
    this.$("score").textContent = this.score;
    this.$("streak").textContent = this.streak;
    this.$("accuracy").textContent = (this.answered ? Math.round((this.correct / this.answered) * 100) : 0) + "%";
  },

  shuffle(a) {
    const arr = [...a];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // Isi ulang deck pas abis / ganti mode. Fisher-Yates shuffle,
  // plus cegah huruf terakhir deck lama nyambung sama awal deck baru.
  refillDeck() {
    this.deck = this.shuffle(this.current.data);
    if (this.lastKana && this.deck.length > 1 && this.deck[0][0] === this.lastKana) {
      const swapIdx = 1 + Math.floor(Math.random() * (this.deck.length - 1));
      [this.deck[0], this.deck[swapIdx]] = [this.deck[swapIdx], this.deck[0]];
    }
  },

  nextQuestion() {
    this.locked = false;
    this.$("answerInput").value = "";
    const fb = this.$("feedback");
    fb.className = "jp-feedback";
    // Ambil dari deck (shuffle bag): tiap huruf keluar tepat 1x
    // per putaran, deck dikocok ulang pas udah abis semua.
    if (!this.deck.length) this.refillDeck();
    this.q = this.deck.shift();
    this.lastKana = this.q[0];
    fb.textContent = "Pilih salah satu jawaban atau ketik romaji.";
    const left = this.deck.length;
    this.$("modeLabel").textContent = `${this.current.label} • sisa ${left}`;
    if (!left) fb.textContent = "Putaran terakhir nih, abis ini dikocok ulang dari awal.";
    this.$("kana").textContent = this.q[0];
    const opts = this.shuffle([this.q, ...this.shuffle(this.current.data.filter((x) => x[0] !== this.q[0])).slice(0, 3)]);
    this.$("answers").innerHTML = opts.map((x) => `<button class="jp-answer" data-romaji="${x[1]}">${x[1]}</button>`).join("");
    this.$("answers").querySelectorAll(".jp-answer").forEach((b) => (b.onclick = () => this.check(b.dataset.romaji, b)));
  },

  check(value, button) {
    if (this.locked) return;
    if (!value || !String(value).trim()) return;
    this.locked = true;
    this.answered++;
    const ok = String(value).trim().toLowerCase() === this.q[1];
    const fb = this.$("feedback");
    if (ok) {
      this.correct++;
      this.streak++;
      const pts = 10 + Math.min(this.streak - 1, 5);
      this.score += pts;
      if (button) button.classList.add("correct");
      fb.className = "jp-feedback good";
      fb.textContent = `✓ Benar! ${this.q[0]} = ${this.q[1]}. +${pts} poin`;
      if (typeof logActivity === "function") logActivity(`Nihongo benar: ${this.q[0]}`, "Jepun", 2, `jepun_${Date.now()}`);
      if (typeof showToast === "function") showToast(`Benar! +${pts}`, "success");
    } else {
      this.streak = 0;
      if (button) button.classList.add("wrong");
      fb.className = "jp-feedback bad";
      fb.textContent = `✕ Belum tepat. ${this.q[0]} dibaca "${this.q[1]}".`;
      this.$("answers").querySelectorAll(".jp-answer").forEach((b) => {
        if (b.dataset.romaji === this.q[1]) b.classList.add("correct");
      });
    }
    this.updateStats();
    setTimeout(() => this.nextQuestion(), 900);
  },
};

document.addEventListener("DOMContentLoaded", () => JepunApp.init());
