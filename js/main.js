/**
 * Main Interactive Logic for Nizam's Portfolio (Optimized, High Performance)
 * Features: Typewriter, Fast Click-to-Open Project Cards, Modal, Web Audio Synth
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Typewriter Effect
  initTypewriter();

  // 2. Clickable Project Cards & Modal Architecture
  initProjectCardsAndModal();

  // 3. Web Audio Piano Synthesizer
  initPianoSynth();

  // 4. Contact Form & Copy Tools
  initContactTools();

  // 5. Mobile Navigation
  initMobileNav();
});

/* ===================================================================
   1. TYPEWRITER EFFECT
   =================================================================== */
function initTypewriter() {
  const roles = [
    "Fullstack Web & Cloud Developer",
    "Hardware Tinkerer & Electronics",
    "Self-Taught Pianist & Musician",
    "The Practical Problem Solver",
    "Creator of E-Learniz & OSIS Portal"
  ];

  const roleTextEl = document.getElementById("typedRoleText");
  if (!roleTextEl) return;

  let roleIdx = 0;
  let charIdx = 0;
  let isDeleting = false;

  function typeStep() {
    const currentRole = roles[roleIdx];

    if (!isDeleting) {
      charIdx++;
      roleTextEl.textContent = currentRole.slice(0, charIdx);
      if (charIdx === currentRole.length) {
        isDeleting = true;
        setTimeout(typeStep, 2200);
        return;
      }
    } else {
      charIdx--;
      roleTextEl.textContent = currentRole.slice(0, charIdx);
      if (charIdx === 0) {
        isDeleting = false;
        roleIdx = (roleIdx + 1) % roles.length;
      }
    }

    const speed = isDeleting ? 35 : 75;
    setTimeout(typeStep, speed);
  }

  typeStep();
}

/* ===================================================================
   2. CLICKABLE PROJECT CARDS & MODAL ARCHITECTURE
   =================================================================== */
const projectsDatabase = {
  elearniz: {
    title: "E-Learniz v3.0 — The Flagship LMS",
    badge: "Flagship Cloud Platform",
    tagline: "Sistem Belajar & Manajemen Kelas Modern Berbasis Cloudflare Workers & D1",
    overview: "E-Learniz lahir dari keresahan terhadap platform belajar yang berat, kaku, dan lambat. Melalui iterasi berulang (Draft -> v2 -> v3), Nizam merancang arsitektur modern yang super kencang menggunakan Cloudflare Workers dan D1 SQLite di edge network.",
    features: [
      "Multi-Role System (Siswa, Pengurus Kelas, Super Admin).",
      "Dynamic Class Switcher (fleksibel ganti kelas secara real-time).",
      "Kuis Interaktif, Kisi-Kisi Pelajaran, dan Rekap Nilai Otomatis.",
      "Desain responsif dengan tema gelap/terang dan tipografi modern (Plus Jakarta Sans + JetBrains Mono).",
      "Arsitektur Vanilla JavaScript tanpa dependency berlebih demi performa maksimal."
    ],
    tech: ["Cloudflare Workers", "SQLite / D1", "Vanilla JS (ES6+)", "CSS Variables", "REST API", "PWA"],
    status: "Active Production (e-learniz.my.id)",
    url: "../e-learniz-v3/index.html"
  },
  osistarpanone: {
    title: "OSIS TARPAN ONE — Portal Resmi Sekolah",
    badge: "Official School Portal & PWA",
    tagline: "Pusat Informasi, Prestasi, Seksi Bidang, dan Suara Aspirasi Siswa",
    overview: "Web portal resmi OSIS SMK Taruna Harapan 1 Cipatat yang dibuat untuk mendigitalkan seluruh agenda, prestasi, struktur organisasi, dan aspirasi siswa dalam satu genggaman.",
    features: [
      "Progressive Web App (PWA): Bisa di-install langsung di HP tanpa Play Store.",
      "Mobile-First Interaction: Dilengkapi Swipe Drawer, Bottom Sheet modal, dan Custom Context Menu.",
      "Sistem Aspirasi Siswa: Media aspirasi langsung bagi siswa SMK Taruna Harapan 1 Cipatat.",
      "Desain identitas Tarpan: Merah berani (#e11d2e) dipadukan dengan dark mode futuristik."
    ],
    tech: ["PWA", "Service Worker", "Mobile Gestures / Swipe API", "Vanilla JS", "HTML5", "CSS3"],
    status: "Live Production (osistarpanone.my.id)",
    url: "../osistarpanone/index.html"
  },
  terasmbun: {
    title: "Teras Mbun — Smart Ordering & POS",
    badge: "F&B Real World System",
    tagline: "Pesen Enak Tanpa Ribet — Web Kasir, Menu Interaktif & Layar Dapur Live",
    overview: "Solusi digital nyata untuk usaha kuliner 'Teras Mbun'. Sistem ini menghubungkan pelanggan yang memesan lewat meja dengan display antrean di bagian dapur secara langsung.",
    features: [
      "Customer Self-Order: Pelanggan memilih menu dan mengirim pesanan langsung dari browser smartphone.",
      "Kitchen Display Monitor (dapur.html): Layar monitor dapur yang meng-update pesanan masuk secara real-time.",
      "Admin & POS Management (admin.html): Manajemen menu, harga, status pembayaran, dan riwayat pesanan.",
      "PWA Ready dengan tipografi editorial Fraunces & Outfit bernuansa kuliner hangat."
    ],
    tech: ["JavaScript", "PWA Manifest", "Local/Cloud State", "Responsive UI", "Custom POS"],
    status: "Production Ready",
    url: "../terasmbun/index.html"
  },
  wabot: {
    title: "Class WA-Bot & Assistant @nizamai",
    badge: "Automation & AI",
    tagline: "Bot WhatsApp Multi-Device Cerdas Bertenaga Baileys & Custom AI Persona",
    overview: "Bot otomatisasi WhatsApp yang bertugas melayani satu kelas. Mengintegrasikan AI assistant '@nizamai' yang memiliki persona santai, tidak bertele-tele, seperti teman kelas yang pendiem namun serba tahu.",
    features: [
      "AI Persona '@nizamai': Menjawab pertanyaan tugas, jadwal, dan koding dengan bahasa natural dan to the point.",
      "Sistem Pengingat Jadwal & PR Otomatis terintegrasi database kelas.",
      "Brat Sticker Maker, Lempar Dadu, dan Quote Generator interaktif.",
      "Sinkronisasi data siswa & nilai melalui Supabase backend."
    ],
    tech: ["Node.js", "Baileys MD", "Supabase", "Custom AI Engine", "Logger System"],
    status: "Deployed & Active",
    url: "action:nizamai"
  },
  exam: {
    title: "Portal Ujian & Bank Soal E-Learniz",
    badge: "EdTech & Quiz Engine",
    tagline: "Platform Latihan Soal, Kisi-Kisi Ulangan & Input Nilai Cepat",
    overview: "Platform latihan ujian yang dirancang khusus untuk memfasilitasi Asesmen Sumatif Tengah Semester (ASTS) dan kuis harian di SMK Taruna Harapan 1 Cipatat.",
    features: [
      "Akses tanpa ribet: Siswa cukup memilih kelas dan nama tanpa perlu login berbelit-belit.",
      "Database terintegrasi Supabase Client-side SDK untuk sinkronisasi nilai seketika.",
      "Dashboard admin untuk input kunci jawaban dan monitoring hasil pengerjaan siswa."
    ],
    tech: ["Supabase JS", "Vanilla JS", "CSS Grid", "PDF Integration"],
    status: "Deployed",
    url: "../exam/index.html"
  },
  studentsweb: {
    title: "StudentsWeb — Portofolio Ekosistem Kelas",
    badge: "Community Platform",
    tagline: "Platform Hosting & Showcase Portofolio untuk 30+ Siswa RPL",
    overview: "Inisiatif luar biasa Nizam dalam membantu seluruh teman sekelasnya di jurusan RPL untuk memiliki halaman web portofolio personal mereka sendiri.",
    features: [
      "Mengakomodasi portofolio personal untuk 30+ siswa (Alena, Almira, Bintang, Revan, Zim, dsb).",
      "Integrasi komponen navigasi 'Magic Pill' untuk memudahkan berpindah antar web teman.",
      "Mendorong teman sekelas untuk mulai belajar koding dan unjuk karya di internet."
    ],
    tech: ["Multi-Tenant Static Architecture", "Magic Pill Router", "HTML/CSS/JS"],
    status: "30+ Live Profiles",
    url: "../studentsweb/zim/index.html"
  },
  waclone: {
    title: "WhatsApp Web High-Fidelity Clone",
    badge: "Frontend UI/UX",
    tagline: "Replika Tampilan & Interaksi WhatsApp Web Menggunakan Murni Vanilla JS",
    overview: "Eksperimen frontend rekayasa ulang antarmuka WhatsApp Web. Membuktikan pemahaman mendalam tentang state chat, rendering pesan, auto-scroll, dan layouting kompleks tanpa bantuan framework React.",
    features: [
      "Custom Chat Renderer & Message Bubbles dengan penanda waktu.",
      "Filter Kontak dan status online/offline.",
      "Tema gelap khas WhatsApp Web dengan animasi transisi presisi."
    ],
    tech: ["Vanilla JS", "DOM Engine", "CSS Modular", "Unit Tests"],
    status: "Completed Experiment",
    url: "../waclone/index.html"
  },
  scoreboard: {
    title: "Digital Tournament Scoreboard",
    badge: "Utility App",
    tagline: "Papan Skor Digital Interaktif untuk Pertandingan Sekolah & Class Meeting",
    overview: "Aplikasi papan skor real-time sederhana dan tangguh yang dipakai untuk mencatat skor pertandingan olahraga antar-kelas.",
    features: [
      "Kontrol tombol cepat untuk tambah/kurang skor dan set babak.",
      "Pilihan nama tim dan tampilan kontras tinggi yang jelas dilihat dari jarak jauh."
    ],
    tech: ["HTML5", "CSS3 Flexbox", "JavaScript"],
    status: "Completed",
    url: "../scoreboard/index.html"
  }
};

function initProjectCardsAndModal() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  const projectCards = document.querySelectorAll(".project-card");
  const modalBackdrop = document.getElementById("projectModalBackdrop");
  const modalClose = document.getElementById("modalCloseBtn");
  const detailBtns = document.querySelectorAll(".project-btn-detail");
  const modalOpenBtn = document.getElementById("modalOpenBtn");

  // 1. KLIK CARD -> BUKA PROJECT LANGSUNG!
  projectCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      // Jika user klik tombol detail arsitektur, jangan langsung buka project
      if (e.target.closest(".project-btn-detail")) return;

      const href = card.getAttribute("data-href");
      if (!href) return;

      if (href === "action:nizamai") {
        const chatWin = document.getElementById("nizamaiChatWindow");
        if (chatWin) {
          chatWin.classList.add("open");
          const input = document.getElementById("chatInput");
          if (input) input.focus();
        }
        return;
      }

      // Buka project di tab baru
      window.open(href, "_blank");
    });
  });

  // 2. FILTERING KATEGORI
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const filterVal = btn.getAttribute("data-filter");

      projectCards.forEach((card) => {
        const cat = card.getAttribute("data-category");
        if (filterVal === "all" || cat.includes(filterVal)) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  });

  // 3. POPUP DETAIL ARSITEKTUR
  detailBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // Cegah card click triggered
      const pKey = btn.getAttribute("data-project");
      const data = projectsDatabase[pKey];

      if (data && modalBackdrop) {
        document.getElementById("modalBadge").textContent = data.badge;
        document.getElementById("modalTitle").textContent = data.title;
        document.getElementById("modalTagline").textContent = data.tagline;
        document.getElementById("modalOverview").textContent = data.overview;
        document.getElementById("modalStatus").textContent = data.status;

        const featList = document.getElementById("modalFeatures");
        featList.innerHTML = data.features.map((f) => `<li>${f}</li>`).join("");

        const techList = document.getElementById("modalTech");
        techList.innerHTML = data.tech.map((t) => `<span class="tech-tag">${t}</span>`).join("");

        if (modalOpenBtn) {
          if (data.url === "action:nizamai") {
            modalOpenBtn.innerHTML = `Chat @nizamai <i class="fa-solid fa-comments"></i>`;
            modalOpenBtn.onclick = (ev) => {
              ev.preventDefault();
              modalBackdrop.classList.remove("open");
              const chatWin = document.getElementById("nizamaiChatWindow");
              if (chatWin) chatWin.classList.add("open");
            };
          } else {
            modalOpenBtn.innerHTML = `Buka Project <i class="fa-solid fa-arrow-up-right-from-square"></i>`;
            modalOpenBtn.href = data.url;
            modalOpenBtn.onclick = null;
          }
        }

        modalBackdrop.classList.add("open");
      }
    });
  });

  // 4. TUTUP MODAL
  if (modalClose && modalBackdrop) {
    modalClose.addEventListener("click", () => {
      modalBackdrop.classList.remove("open");
    });

    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.remove("open");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalBackdrop.classList.contains("open")) {
        modalBackdrop.classList.remove("open");
      }
    });
  }
}

/* ===================================================================
   3. WEB AUDIO PIANO SYNTHESIZER
   =================================================================== */
function initPianoSynth() {
  let audioCtx = null;

  const notes = {
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.00,
    A4: 440.00,
    B4: 493.88,
    C5: 523.25
  };

  function playTone(freq) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.0);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.05);
    } catch (err) {
      console.warn("Audio Context not supported or blocked:", err);
    }
  }

  const keys = document.querySelectorAll(".piano-key");
  keys.forEach((key) => {
    key.addEventListener("click", () => {
      const note = key.getAttribute("data-note");
      if (note && notes[note]) {
        playTone(notes[note]);
        key.classList.add("active-key");
        setTimeout(() => key.classList.remove("active-key"), 120);
      }
    });
  });
}

/* ===================================================================
   4. CONTACT TOOLS & NOTIFICATIONS
   =================================================================== */
function initContactTools() {
  const form = document.getElementById("quickContactForm");
  const toast = document.getElementById("toastNotice");

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("senderName").value.trim();
      const msg = document.getElementById("senderMsg").value.trim();

      if (!name || !msg) {
        showToast("Harap isi nama dan pesan ya!");
        return;
      }

      const waText = encodeURIComponent(`Halo Nizam, perkenalkan saya ${name}.\n\nPesan: ${msg}`);
      const waUrl = `https://wa.me/6283851088843?text=${waText}`;

      showToast("Membuka WhatsApp...");
      setTimeout(() => {
        window.open(waUrl, "_blank");
        form.reset();
      }, 400);
    });
  }
}

/* ===================================================================
   5. MOBILE NAVIGATION
   =================================================================== */
function initMobileNav() {
  const toggle = document.getElementById("mobileToggle");

  if (toggle) {
    toggle.addEventListener("click", () => {
      const links = document.querySelector(".nav-links");
      if (links) {
        const isShown = links.style.display === "flex";
        links.style.display = isShown ? "none" : "flex";
        links.style.flexDirection = "column";
        links.style.position = "absolute";
        links.style.top = "100%";
        links.style.left = "0";
        links.style.right = "0";
        links.style.background = "#0c0f18";
        links.style.padding = "1.25rem";
        links.style.borderRadius = "14px";
        links.style.marginTop = "0.5rem";
        links.style.border = "1px solid var(--border-color)";
      }
    });
  }
}
