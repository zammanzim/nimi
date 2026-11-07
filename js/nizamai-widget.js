/**
 * NizamAI Chat Assistant Widget
 * Implements the real persona configured by Nizam in his bot:
 * "Santai, to the point, kaya temen kelas yang pendiem tapi pinter. Langsung ke inti jawaban tanpa basa-basi."
 */

(function () {
  const widgetBtn = document.getElementById("nizamaiWidgetBtn");
  const chatWindow = document.getElementById("nizamaiChatWindow");
  const closeBtn = document.getElementById("chatCloseBtn");
  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const quickChips = document.querySelectorAll(".quick-chip");

  if (!widgetBtn || !chatWindow) return;

  // Toggle Chat
  widgetBtn.addEventListener("click", () => {
    chatWindow.classList.toggle("open");
    if (chatWindow.classList.contains("open")) {
      chatInput.focus();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      chatWindow.classList.remove("open");
    });
  }

  // Quick Chips
  quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const q = chip.getAttribute("data-query");
      if (q) {
        handleUserMessage(q);
      }
    });
  });

  function addMessage(text, sender = "ai") {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble bubble-${sender}`;
    bubble.innerHTML = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTypingIndicator() {
    const typing = document.createElement("div");
    typing.className = "chat-bubble bubble-ai typing-indicator";
    typing.id = "typingIndicator";
    typing.innerHTML = `<span style="opacity:0.6;font-style:italic;">lagi ngetik...</span>`;
    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById("typingIndicator");
    if (el) el.remove();
  }

  function getAiResponse(input) {
    const lower = input.toLowerCase();

    if (lower.includes("siapa") || lower.includes("orangnya kayak gimana") || lower.includes("sifat") || lower.includes("kepribadian")) {
      return "Gw Nizam Fhamer Arafli, anak XI RPL SMK Taruna Harapan 1 Cipatat. Kalau dibilang orang kayak gimana: santai, gak suka ribet, tapi kalau udah megang projek atau penasaran sama sesuatu, gw kulik sampe akar-akarnya—mau itu Cloudflare Workers, bongkar laptop, sampe ngapalin tuts piano.";
    }

    if (lower.includes("projek") || lower.includes("project") || lower.includes("karya") || lower.includes("portfolio")) {
      return "Yang paling aktif sekarang <strong>E-Learniz v3</strong> (LMS sekolah pake Cloudflare D1/Worker), <strong>OSIS TARPAN ONE</strong> (web resmi OSIS), sama <strong>Teras Mbun</strong> (web pesen makan + monitor dapur). Gw juga bikinin web portofolio buat 30+ temen sekelas di <code>studentsweb</code>.";
    }

    if (lower.includes("bisa bantuin") || lower.includes("jasa") || lower.includes("bikin web") || lower.includes("collab") || lower.includes("kerja sama")) {
      return "Bisa banget. Mau bikin web landing page, sistem informasi, bot otomatis, atau oprek sesuatu? Langsung japri aja ke WhatsApp gw di <a href='https://wa.me/6283851088843' target='_blank' style='color:var(--emerald);text-decoration:underline;'>+62 838-5108-8843</a>.";
    }

    if (lower.includes("piano") || lower.includes("musik") || lower.includes("alat musik") || lower.includes("lagu")) {
      return "Haha, itu hobi pelarian gw kalau lagi jenuh di depan baris kode. Awalnya modal nekat beli keyboard murah 1 jutaan, latihan otodidak tiap hari sampe tangan kiri sama kanan bisa sinkron. Musik sama coding itu mirip: dua-duanya soal nyusun nada/logika biar harmonis.";
    }

    if (lower.includes("hardware") || lower.includes("solder") || lower.includes("bongkar") || lower.includes("elektronik") || lower.includes("hp")) {
      return "Koding di layar doang kurang afdol kalau ga ngerti mesin fisiknya. Gw suka bongkar HP, flashing ROM/EDL mode, benerin jalur kabel kipas/speaker, sampe bikin otomasi ruangan pake ESP32. Kadang rusak sih, tapi dari rusaknya itu kita belajar cara kerjanya.";
    }

    if (lower.includes("kontak") || lower.includes("wa") || lower.includes("nomor") || lower.includes("email") || lower.includes("instagram")) {
      return "Catet ya:<br>• WA: <a href='https://wa.me/6283851088843' style='color:var(--emerald);text-decoration:underline;'>+62 838-5108-8843</a><br>• Email: nizzcuy@gmail.com<br>• IG: @zammanzim<br>• GitHub: github.com/zammanzim";
    }

    if (lower.includes("asli") || lower.includes("commit") || lower.includes("lucu") || lower.includes("131313")) {
      return "Valid wkwk. Itu commit asli gw pas lagi ngejar deadline bug. Kalau pas nemu solusi suka langsung commit 'asliasliasliasli' biar cepet.";
    }

    if (lower.includes("halo") || lower.includes("hai") || lower.includes("p") || lower.includes("hey")) {
      return "Halo! Ada yang mau ditanyain soal web, project, atau hardware?";
    }

    if (lower.includes("makasih") || lower.includes("terima kasih") || lower.includes("thanks")) {
      return "Sip, santai aja. Semoga ngebantu!";
    }

    // Default response matching persona
    return "Makes sense. Kalau mau tanya lebih detail soal tech stack, web yang pernah gw bikin, atau mau ngobrol langsung, gas kontak WA atau cek bagian terminal di atas ya.";
  }

  function handleUserMessage(msgText) {
    if (!msgText.trim()) return;

    addMessage(escapeHtml(msgText), "user");
    chatInput.value = "";

    showTypingIndicator();

    setTimeout(() => {
      removeTypingIndicator();
      const reply = getAiResponse(msgText);
      addMessage(reply, "ai");
    }, 600 + Math.random() * 400);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  chatSendBtn.addEventListener("click", () => {
    handleUserMessage(chatInput.value);
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleUserMessage(chatInput.value);
    }
  });
})();
