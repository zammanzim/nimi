// ============================================================
// RICH — editor rich-text minimal contek SubjectApp lama:
// - Area contentEditable (ngedit langsung di card).
// - Toolbar: judul/subjudul/normal (formatBlock), bold/italic/
//   underline (execCommand), list, hapus format.
// - sanitize(): allowlist tag + buang on*/javascript: pas simpan.
// ============================================================

const Rich = {

    // Tag yang boleh lolos ke DB. Selain ini dibuang (isi teks kept).
    ALLOWED: ["p", "h3", "h4", "b", "strong", "i", "em", "u", "s",
        "ul", "ol", "li", "br", "a", "blockquote", "div", "span"],

    toolbarHTML() {
        const b = (cmd, icon, title, arg) =>
            `<button type="button" class="rt-btn" data-cmd="${cmd}" data-arg="${arg || ""}" title="${title}">` +
            `<i class="${icon}"></i></button>`;
        return `<div class="rich-toolbar">` +
            `<button type="button" class="rt-btn rt-text" data-cmd="block" data-arg="h3" title="Judul gede">H1</button>` +
            `<button type="button" class="rt-btn rt-text" data-cmd="block" data-arg="h4" title="Subjudul">H2</button>` +
            `<button type="button" class="rt-btn rt-text" data-cmd="block" data-arg="p" title="Teks biasa">T</button>` +
            `<span class="rt-sep"></span>` +
            b("bold", "fa-solid fa-bold", "Tebal") +
            b("italic", "fa-solid fa-italic", "Miring") +
            b("underline", "fa-solid fa-underline", "Garis bawah") +
            `<span class="rt-sep"></span>` +
            b("insertUnorderedList", "fa-solid fa-list-ul", "Bullet") +
            b("insertOrderedList", "fa-solid fa-list-ol", "Nomor") +
            b("removeFormat", "fa-solid fa-text-slash", "Hapus format") +
            `</div>`;
    },

    // Pasang toolbar di container + bikin editor fokus-safe.
    // mousedown (bukan click) biar seleksi teks ga ilang pas pencet tombol.
    // Plus shortcut: Ctrl/Cmd+B/I/U + Ctrl+1/2/0 (judul/sub/normal).
    attach(toolbarEl, editorEl) {
        if (!toolbarEl || !editorEl) return;
        toolbarEl.querySelectorAll(".rt-btn").forEach(btn => {
            btn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                Rich.run(editorEl, btn.dataset.cmd, btn.dataset.arg);
            });
        });
        if (!editorEl.dataset.richKeys) {
            editorEl.dataset.richKeys = "1";
            editorEl.addEventListener("keydown", (e) => {
                if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
                const k = (e.key || "").toLowerCase();
                const inline = { b: "bold", i: "italic", u: "underline" };
                if (inline[k]) {
                    e.preventDefault();
                    try { document.execCommand(inline[k], false, null); } catch (err) { /* abaikan */ }
                    return;
                }
                if (e.key === "1") { e.preventDefault(); Rich.run(editorEl, "block", "h3"); }
                else if (e.key === "2") { e.preventDefault(); Rich.run(editorEl, "block", "h4"); }
                else if (e.key === "0") { e.preventDefault(); Rich.run(editorEl, "block", "p"); }
            });
        }
    },

    run(editor, cmd, arg) {
        editor.focus();
        try {
            if (cmd === "block") {
                document.execCommand("formatBlock", false, arg);
            } else {
                document.execCommand(cmd, false, arg || null);
            }
        } catch (e) { /* browser nolak — abaikan */ }
        editor.focus();
    },

    get(editor) {
        return Rich.sanitize(editor ? editor.innerHTML : "");
    },

    set(editor, html) {
        if (editor) editor.innerHTML = html || "";
    },

    sanitize(html) {
        try {
            const tpl = document.createElement("template");
            tpl.innerHTML = String(html || "");
            // Buang elemen berbahaya sekalian isinya.
            tpl.content.querySelectorAll(
                "script, iframe, object, embed, style, form, input, button, link, meta"
            ).forEach(n => n.remove());
            tpl.content.querySelectorAll("*").forEach(n => {
                const tag = (n.tagName || "").toLowerCase();
                if (!Rich.ALLOWED.includes(tag)) {
                    // Tag ga dikenal: lepas bungkusnya, teks tetap.
                    const parent = n.parentNode;
                    while (n.firstChild) parent.insertBefore(n.firstChild, n);
                    parent.removeChild(n);
                    return;
                }
                [...n.attributes].forEach(a => {
                    const an = a.name.toLowerCase();
                    if (/^on/i.test(an)) { n.removeAttribute(a.name); return; }
                    if (tag === "a") {
                        if (an === "href") {
                            const v = String(a.value || "").trim();
                            if (/^(javascript|data|vbscript):/i.test(v)) n.removeAttribute("href");
                            else {
                                n.setAttribute("target", "_blank");
                                n.setAttribute("rel", "noopener");
                            }
                        } else if (an !== "target" && an !== "rel") {
                            n.removeAttribute(a.name);
                        }
                        return;
                    }
                    // Selain <a>: buang semua atribut kecuali class.
                    if (an !== "class") n.removeAttribute(a.name);
                });
                // Class cuma boleh format-* (pola lama) — sisanya buang.
                if (n.hasAttribute("class")) {
                    const keep = String(n.getAttribute("class")).split(/\s+/)
                        .filter(c => /^(format-(large|medium|small)|tujuan-marker)$/.test(c));
                    if (keep.length) n.setAttribute("class", keep.join(" "));
                    else n.removeAttribute("class");
                }
            });
            return tpl.innerHTML;
        } catch (e) { return String(html || ""); }
    }
};

if (typeof window !== "undefined") window.Rich = Rich;
