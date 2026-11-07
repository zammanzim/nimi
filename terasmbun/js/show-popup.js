// ============================================================
// show-popup.js — popup universal pengganti alert/confirm
// (varian slim dari osistarpanone, tanpa history-back koordinasi).
//   await showPopup("Pesanan masuk!", "success")
//   await showPopup("Pesanan masuk!", "success", { aksi: [...] })
//     → success bisa nambah tombol aksi (mis. bagikan WA):
//       aksi: [{ id, label, ikon, cls, onClick }] — klik → onClick() + resolve(id)
//   await showPopup("Yakin?", "confirm") → true / false
//   const v = await showPopup("Isi nama", "form", { fields: [...] }) → objek / null
// fields: [{ name, label, type, placeholder, value, rows }]
// Tutup: ESC / klik area kosong / tombol.
// ============================================================

// tombol buat tipe success: ada options.aksi → tombol aksi + "Nanti aja";
// tanpa aksi → tombol OK biasa (kayak dulu)
function tombolSucc(options) {
  const aksi = options.aksi || [];
  if (!aksi.length) return `<button class="uni-btn" id="uniBtnOk">OK</button>`;
  return `<div class="uni-actions">
    ${aksi.map((a) => `<button class="uni-btn ${a.cls || ""}" id="uniAksi_${a.id}"><i class="${a.ikon || "fa-solid fa-share"}"></i> ${a.label}</button>`).join("")}
    <button class="uni-btn-cancel" id="uniBtnNo">${options.labelTutup || "Nanti aja"}</button>
  </div>`;
}

window.showPopup = function (msg, type = "info", options = {}) {
  return new Promise((resolve) => {
    // buang popup lama
    const lama = document.getElementById("uniOverlay");
    if (lama) lama.remove();

    const overlay = document.createElement("div");
    overlay.id = "uniOverlay";
    overlay.className = "uni-overlay";

    let iconHtml = "", btnsHtml = "", iconClass = "uni-icon";
    let contentHtml = `<p class="uni-msg">${msg}</p>`;

    if (type === "success") {
      iconClass += " success"; iconHtml = '<i class="fa-solid fa-check"></i>';
      btnsHtml = tombolSucc(options);
    } else if (type === "error") {
      iconClass += " error"; iconHtml = '<i class="fa-solid fa-xmark"></i>';
      btnsHtml = `<button class="uni-btn" id="uniBtnOk">OK</button>`;
    } else if (type === "confirm") {
      iconClass += " warning"; iconHtml = '<i class="fa-solid fa-exclamation"></i>';
      btnsHtml = `<div class="uni-actions">
          <button class="uni-btn-cancel" id="uniBtnNo">Tidak</button>
          <button class="uni-btn-confirm" id="uniBtnYes">Iya</button>
        </div>`;
    } else if (type === "form") {
      iconClass += " info"; iconHtml = options.icon || '<i class="fa-solid fa-pen-to-square"></i>';
      const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const fields = options.fields || [{ name: "value", label: msg, type: "text" }];
      const fieldsHtml = fields.map((f) => {
        if (f.type === "textarea") {
          return `<div class="uni-form-group">${f.label ? `<label>${f.label}</label>` : ""}
            <textarea id="uniInput_${f.name}" class="uni-input" rows="${f.rows || 3}"
              placeholder="${f.placeholder || ""}">${esc(f.value || "")}</textarea></div>`;
        }
        return `<div class="uni-form-group">${f.label ? `<label>${f.label}</label>` : ""}
          <input type="${f.type || "text"}" id="uniInput_${f.name}"
            placeholder="${f.placeholder || ""}" value="${esc(f.value || "")}" class="uni-input" autocomplete="off"></div>`;
      }).join("");
      contentHtml = `<div class="uni-form-container">
          ${options.title ? `<h3 class="uni-title">${options.title}</h3>` : `<p class="uni-msg">${msg}</p>`}
          ${fieldsHtml}</div>`;
      btnsHtml = `<div class="uni-actions">
          <button class="uni-btn-cancel" id="uniBtnNo">Batal</button>
          <button class="uni-btn-confirm" id="uniBtnYes">Simpan</button>
        </div>`;
    } else {
      iconClass += " info"; iconHtml = '<i class="fa-solid fa-info"></i>';
      btnsHtml = `<button class="uni-btn" id="uniBtnOk">OK</button>`;
    }

    overlay.innerHTML = `
      <div class="uni-box">
        <div class="${iconClass}">${iconHtml}</div>
        ${contentHtml}
        ${btnsHtml}
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("active"), 10);

    const aksiSucc = type === "success" ? (options.aksi || []) : [];
    const nilaiBatal = (type === "confirm" || type === "form" || aksiSucc.length) ? false : true;

    const close = (result) => {
      overlay.classList.remove("active");
      document.removeEventListener("keydown", handleKey, true);
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 250);
      if (type === "form" && result === true) {
        const data = {};
        (options.fields || [{ name: "value" }]).forEach((f) => {
          const el = document.getElementById(`uniInput_${f.name}`);
          if (el) data[f.name] = el.value;
        });
        resolve(data);
      } else if (type === "form" && result === false) {
        resolve(null);
      } else {
        resolve(result);
      }
    };

    const handleKey = (e) => {
      if (e.key === "Enter") {
        if (e.target && e.target.tagName === "TEXTAREA") return; // textarea: enter = newline
        e.preventDefault();
        try { e.stopPropagation(); } catch (err) {}
        close(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        try { e.stopPropagation(); } catch (err) {}
        close(nilaiBatal);
      }
    };
    document.addEventListener("keydown", handleKey, true);

    if (type === "confirm" || type === "form") {
      document.getElementById("uniBtnYes").onclick = () => close(true);
      document.getElementById("uniBtnNo").onclick = () => close(false);
      overlay.onclick = (e) => { if (e.target === overlay) close(false); };
    } else if (aksiSucc.length) {
      // success + aksi: klik aksi → jalanin onClick lalu tutup; "Nanti aja" → resolve false
      aksiSucc.forEach((a) => {
        document.getElementById("uniAksi_" + a.id).onclick = () => {
          if (a.onClick) { try { a.onClick(); } catch (err) {} }
          close(a.id);
        };
      });
      document.getElementById("uniBtnNo").onclick = () => close(false);
      overlay.onclick = (e) => { if (e.target === overlay) close(false); };
    } else {
      document.getElementById("uniBtnOk").onclick = () => close(true);
      overlay.onclick = (e) => { if (e.target === overlay) close(true); };
    }
  });
};

window.closePopup = function () {
  const overlay = document.getElementById("uniOverlay");
  if (overlay) overlay.remove();
};
