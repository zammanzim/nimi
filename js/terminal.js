/**
 * Interactive Terminal Emulator for Nizam's Portfolio
 * Features command parsing, arrow history, and system easter eggs.
 */

(function () {
  const terminalBody = document.getElementById("terminalBody");
  const terminalInput = document.getElementById("terminalInput");

  if (!terminalBody || !terminalInput) return;

  const commandHistory = [];
  let historyIndex = -1;

  const commands = {
    help: () => `
<div style="color:var(--emerald);font-weight:700;margin-bottom:6px;">-- PERINTAH YANG TERSEDIA --</div>
  <span style="color:var(--cyan)">whoami</span>      : Profil & biodata lengkap Nizam
  <span style="color:var(--cyan)">projects</span>    : Daftar portofolio & sistem yang pernah dibangun
  <span style="color:var(--cyan)">skills</span>      : Tech stack, bahasa pemrograman & keahlian teknis
  <span style="color:var(--cyan)">hardware</span>    : Catatan oprek hardware, ESP32, solder, & bongkar gadget
  <span style="color:var(--cyan)">music</span>       : Kisah piano, chord, & instrumen musik
  <span style="color:var(--cyan)">contact</span>     : Akses WhatsApp, GitHub, Email & medsos
  <span style="color:var(--cyan)">easteregg</span>   : Rahasia commit git & cerita koding
  <span style="color:var(--cyan)">ai</span>          : Buka chat widget @nizamai
  <span style="color:var(--cyan)">clear</span>       : Bersihkan layar terminal
`,

    whoami: () => `
<pre style="color:#a5b4fc;font-family:var(--font-mono);font-size:0.84rem;">
{
  "name": "Nizam Fhamer Arafli",
  "alias": ["Zim", "Zam", "nizzcuy", "zammanzim"],
  "born": "Bandung Barat, 13 Juli 2010",
  "origin": "Kampung Sekip, Cipatat, Bandung Barat",
  "school": "SMK Taruna Harapan 1 Cipatat",
  "major": "Rekayasa Perangkat Lunak (XI RPL)",
  "roles": [
    "Web & Cloud Developer",
    "Hardware & Electronics Tinkerer",
    "Self-Taught Pianist & Musician"
  ],
  "philosophy": "Santai, to the point, gak suka basa-basi, dan suka membongkar sesuatu sampai paham cara kerjanya."
}
</pre>
`,

    projects: () => `
<div style="color:var(--emerald);font-weight:700;margin-bottom:6px;">[ REPOSITORI & PRODUK NYATA ]</div>
  🚀 <strong style="color:#fff;">E-Learniz v3.0</strong> (LMS Cloud Platform - Cloudflare D1/SQLite, Worker, Multi-role)
  🏫 <strong style="color:#fff;">OSIS TARPAN ONE</strong> (Web & PWA Resmi OSIS SMK Taruna Harapan 1 Cipatat)
  🍜 <strong style="color:#fff;">Teras Mbun Web POS</strong> (Food Ordering System + Monitor Dapur Live + Admin)
  🤖 <strong style="color:#fff;">Class WA-Bot & @nizamai</strong> (Bot WA multi-device Baileys + Custom AI Assistant)
  📝 <strong style="color:#fff;">Exam / Ujian Portal</strong> (Kisi-kisi, Quiz Online & Rekap Nilai Supabase)
  🌐 <strong style="color:#fff;">StudentsWeb Ecosystem</strong> (Hosting portofolio untuk 30+ teman sekelas RPL)
  💬 <strong style="color:#fff;">WhatsApp Web Clone</strong> (Replika UI pixel-perfect dengan vanilla JS)
  🏆 <strong style="color:#fff;">Live Tournament Scoreboard</strong> (Aplikasi papan skor interaktif)
`,

    skills: () => `
<div style="color:var(--cyan);font-weight:700;margin-bottom:6px;">[ TECHNICAL STACK MATRIX ]</div>
  • <span style="color:#fff;">Frontend:</span> HTML5 (95%), CSS3 (95%), Vanilla JS ESNext (90%), PWA, DOM Manipulation
  • <span style="color:#fff;">Backend & Cloud:</span> Cloudflare Workers, Supabase REST/Auth, SQLite/D1, Node.js, PHP, MySQL
  • <span style="color:#fff;">Hardware & IoT:</span> ESP32/Arduino C++, Soldering, Smartphone Flashing/EDL, Teardown PC/Laptop
  • <span style="color:#fff;">Audio & Music:</span> Piano Keyboard, Two-Hand Synchronization, Chords & Ear Training
`,

    hardware: () => `
<div style="color:var(--amber);font-weight:700;margin-bottom:6px;">[ HARDWARE LAB NOTES ]</div>
"Selain membuat program, saya juga suka ngulik gimana cara kerja hardware menjalankan program itu."
  1. <strong>Bongkar & Flashing HP</strong>: EDL mode, unlock bootloader, custom recovery.
  2. <strong>Laptop & PC Teardown</strong>: Maintenance thermal paste, repointing sirkuit, hardware diagnosis.
  3. <strong>IoT Smart Room (ESP32)</strong>: Otomasi ruangan dengan mikrokontroler C++.
  4. <strong>Elektronik Kasar</strong>: Nyolder & benerin speaker, kipas, modul power supply, panel LED.
`,

    music: () => `
<div style="color:var(--purple);font-weight:700;margin-bottom:6px;">[ PIANO & MUSICAL JOURNEY ]</div>
"Berawal dari nekat beli piano 1 jutaan, saya terus berlatih dan memainkannya setiap hari.
Sampai saya bisa tau semua chord, sinkron main 2 tangan, dan hafal banyak lagu.
Koding melatih logika, piano mengasah rasa. Keduanya adalah seni merangkai komponen."
<br><span style="color:var(--text-dim);">Coba mainkan tuts piano di section Skills untuk tes nada!</span>
`,

    contact: () => `
<div style="color:var(--emerald);font-weight:700;margin-bottom:6px;">[ DIRECT CHANNELS ]</div>
  📱 <span style="color:#fff;">WhatsApp:</span> +62 838-5108-8843
  📧 <span style="color:#fff;">Email:</span> nizzcuy@gmail.com
  🐙 <span style="color:#fff;">GitHub:</span> github.com/zammanzim
  📸 <span style="color:#fff;">Instagram:</span> @zammanzim
  📍 <span style="color:#fff;">Lokasi:</span> Kampung Sekip, Cipatat, Bandung Barat
`,

    easteregg: () => `
<div style="color:#f43f5e;font-weight:700;margin-bottom:6px;">[ GIT COMMIT CHRONICLES ]</div>
Catatan commit asli di repo Nizam:
  • <code style="color:var(--amber)">"asliasliasliasli"</code> (terasmbun - pas fix beneran jalan)
  • <code style="color:var(--amber)">"131313"</code> (terasmbun)
  • <code style="color:var(--amber)">"nilaifiz"</code> (exam - fitur nilai kelar)
  • <code style="color:var(--amber)">"ctxmenu"</code> (osistarpanone - nambahin menu klik kanan custom)
  • <code style="color:var(--amber)">"swipe"</code> (osistarpanone - gestur mobile)
<br>
Cerita: "Awalnya ga kenal coding, pas masuk SMK RPL saya cari tau dan belajar sendiri apa itu coding, eh malah kejauhan..."
`,

    sudo: () => `<span style="color:#ef4444;">Access Denied: Nizam holds full root authority in this system.</span>`,

    ai: () => {
      const chatWin = document.getElementById("nizamaiChatWindow");
      if (chatWin) {
        chatWin.classList.add("open");
        return `<span style="color:var(--emerald);">Memanggil @nizamai... Widget chat dibuka di kanan bawah!</span>`;
      }
      return "Widget chat sedang tidak tersedia.";
    },

    clear: () => {
      terminalBody.innerHTML = "";
      return "";
    },

    date: () => new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB",
  };

  // Aliases
  commands["cls"] = commands["clear"];
  commands["ls"] = commands["projects"];
  commands["bio"] = commands["whoami"];

  function printLine(html) {
    const div = document.createElement("div");
    div.className = "terminal-output-line";
    div.innerHTML = html;
    terminalBody.appendChild(div);
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  function handleCommand(cmdRaw) {
    const cmdClean = cmdRaw.trim();
    if (!cmdClean) return;

    // Add to history
    commandHistory.push(cmdClean);
    historyIndex = commandHistory.length;

    // Print command entered
    printLine(`<span class="t-prompt">nizam@tarpan:~$</span> ${escapeHtml(cmdClean)}`);

    const lower = cmdClean.toLowerCase();
    const [action, ...args] = lower.split(" ");

    if (commands[action]) {
      const res = commands[action](args);
      if (res) printLine(res);
    } else if (lower.startsWith("cat ")) {
      const file = lower.replace("cat ", "").trim();
      if (file.includes("about") || file.includes("nizam") || file.includes("whoami")) {
        printLine(commands.whoami());
      } else {
        printLine(`<span style="color:#ef4444;">cat: ${escapeHtml(file)}: No such file or directory</span>`);
      }
    } else {
      printLine(`Perintah tidak dikenal: <span style="color:#ef4444;">${escapeHtml(cmdClean)}</span>. Ketik <span style="color:var(--cyan);font-weight:700;">help</span> untuk daftar perintah.`);
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Keyboard navigation
  terminalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = terminalInput.value;
      terminalInput.value = "";
      handleCommand(val);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        terminalInput.value = commandHistory[historyIndex] || "";
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        terminalInput.value = commandHistory[historyIndex] || "";
      } else {
        historyIndex = commandHistory.length;
        terminalInput.value = "";
      }
    }
  });

  // Focus terminal input on container click
  terminalBody.parentElement.addEventListener("click", () => {
    terminalInput.focus();
  });
})();
