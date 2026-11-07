// Skrip sekali jalan: buang "index.html" dari semua link/rute di e-learniz v3.
// Hosting udah support URL bersih, jadi root dirangkap "/" dan hash SPA tetap.
const fs = require("fs");
const files = ["js/sidebar.js", "login.html", "subjects.html", "tugas.html", "subject.html"];

for (const f of files) {
  const before = fs.readFileSync(f, "utf8");
  let s = before;
  s = s.split("index.html#/").join("/#/");          // index.html#/tugas → /#/tugas
  s = s.split('href="index.html"').join('href="/"'); // brand / ke beranda → /
  s = s.split('= "index.html"').join('= "/"');        // location.href = "index.html" → "/"
  if (s !== before) { fs.writeFileSync(f, s, "utf8"); console.log("ok    " + f); }
  else console.log("skip  " + f);
}

const sisa = files.filter((f) => fs.readFileSync(f, "utf8").includes("index.html"));
console.log("sisa index.html: " + (sisa.length ? sisa.join(", ") : "NONE"));
