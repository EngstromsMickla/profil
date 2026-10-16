// Kontroller före publicering: inga externa resurser, ingen innerHTML, inga tankstreck, CSP finns, bara påhittade exempel.
import fs from "node:fs";
import path from "node:path";

const rot = new URL("../publik/", import.meta.url).pathname;
const fel = [];
const tillatnaAdresser = [/^http:\/\/www\.w3\.org\//, /^http:\/\/localhost/];

function gaIgenom(dir) {
  for (const namn of fs.readdirSync(dir)) {
    const fil = path.join(dir, namn);
    if (fs.statSync(fil).isDirectory()) { gaIgenom(fil); continue; }
    if (!/\.(html|js|css|json)$/.test(fil)) continue;
    const text = fs.readFileSync(fil, "utf8");
    const kort = path.relative(rot, fil);
    for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
      if (!tillatnaAdresser.some((r) => r.test(m[0]))) fel.push(`${kort}: extern adress ${m[0]}`);
    }
    if (/\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write/.test(text)) fel.push(`${kort}: HTML läggs in som kod`);
    if (/\beval\(|new Function\(/.test(text)) fel.push(`${kort}: eval eller new Function`);
    if (/localStorage/.test(text)) fel.push(`${kort}: localStorage används (bara sessionStorage är tillåtet)`);
    if (/[–—]/.test(text)) fel.push(`${kort}: tankstreck i texten`);
  }
}
gaIgenom(rot);
const html = fs.readFileSync(path.join(rot, "index.html"), "utf8");
if (!/Content-Security-Policy[^>]*default-src 'none'/.test(html)) fel.push("index.html: Content Security Policy saknas");
for (const f of ["img/mickla.png", "exempel/Exempel_bedomning.json", "CNAME", "innehall/en.js", "innehall/en-markorer.js"]) {
  if (!fs.existsSync(path.join(rot, f))) fel.push(`saknas: publik/${f}`);
}
for (const f of fs.readdirSync(path.join(rot, "exempel"))) if (!/^Exempel_/.test(f)) fel.push(`publik/exempel/${f}: bara påhittade exempelfiler får ligga i repot`);
for (const f of fs.readdirSync(rot)) if (/\.(xlsx|pdf|docx)$/i.test(f)) fel.push(`publik/${f}: dokument får inte ligga i publik/`);

if (fel.length) { console.error("Kontrollen hittade problem:\n" + fel.map((f) => " - " + f).join("\n")); process.exit(1); }
console.log("Kontrollen gick igenom.");
