// Skapar de påhittade exempelfilerna publik/exempel/Exempel_bedomning.json och Exempel_bedomning_sv.json. Inga riktiga företag eller personer.
import fs from "node:fs";
import en from "../publik/innehall/en.js";
import { allMarkers, FORMAT } from "../publik/modell.js";

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const bas = { ti: { cv: 3, mc: 3, sp: 2, bm: 2, cl: 3 }, bd: { cv: 2, mc: 3, sp: 3, bm: 2, cl: 3 }, ee: { cv: 2, mc: 2, sp: 2, bm: 1, cl: 2 } };
const noter = {
  CvT3: "Site logistics app and digital checklists are used in all regions since 2025.",
  CvT4: "Dashboards exist, but most decisions in the business units are still based on experience.",
  MB4: "Central innovation fund with a yearly call; two to three projects funded each year.",
  SB1: "Innovation board meets monthly and decides which pilots continue.",
  BB2: "No new business units so far. A service offer for facility data was discussed in 2025.",
  ME4: "Data sharing with subcontractors depends on the project manager.",
  ClB5: "The CEO talks about digitalisation, but the responsibility sits with the digital department.",
};
const answers = {};
for (const m of allMarkers(en.markers)) {
  if (m.id === "BE6" || m.id === "ClE4") { answers[m.id] = { level: null, unsure: true, note: "" }; continue; }
  const r = rnd();
  const level = Math.max(1, Math.min(4, bas[m.dim][m.dom] + (r < 0.2 ? -1 : r > 0.82 ? 1 : 0)));
  answers[m.id] = { level, unsure: false, note: noter[m.id] || "" };
}
const noterSv = {
  CvT3: "Platslogistikappen och digitala checklistor används i alla regioner sedan 2025.",
  CvT4: "Det finns instrumentpaneler, men de flesta beslut i affärsenheterna bygger fortfarande på erfarenhet.",
  MB4: "Central innovationsfond med en årlig utlysning; två till tre projekt får pengar varje år.",
  SB1: "Innovationsrådet träffas varje månad och beslutar vilka piloter som går vidare.",
  BB2: "Inga nya affärsenheter hittills. Ett tjänsteerbjudande för förvaltningsdata diskuterades 2025.",
  ME4: "Datadelning med underentreprenörer beror på projektchefen.",
  ClB5: "Vd talar om digitalisering, men ansvaret ligger på digitaliseringsavdelningen.",
};
function skriv(namn, lang, meta, noteMap) {
  const ans = {};
  for (const [id, a] of Object.entries(answers)) ans[id] = { ...a, note: noteMap[id] || "" };
  const fil = { format: FORMAT, formatVersion: 1, toolVersion: en.version, lang, saved: "2026-10-15T09:00:00.000Z", meta, answers: ans };
  fs.writeFileSync(new URL(`../publik/exempel/${namn}`, import.meta.url), JSON.stringify(fil, null, 1) + "\n");
}
skriv("Exempel_bedomning.json", "en", { company: "Example Construction Ltd (fictional)", mode: "group", name: "Management team", date: "2026-10-15" }, noter);
skriv("Exempel_bedomning_sv.json", "sv", { company: "Exempelbygg AB (påhittat)", mode: "group", name: "Ledningsgruppen", date: "2026-10-15" }, noterSv);
console.log("ok");
