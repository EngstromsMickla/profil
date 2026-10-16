// Calculations for the Beyond Pilots self-assessment. Pure functions without DOM, tested in test/modell.test.mjs.

export const DIMS = ["ti", "bd", "ee"];
export const DOMAINS = ["cv", "mc", "sp", "bm", "cl"];
export const FORMAT = "mickla-beyond-pilots";
export const MAX_NOTE = 2000;
export const MAX_META = 200;

// All markers in reading order: domain by domain, and within a domain technology, business, ecosystem.
export function allMarkers(markers) {
  const out = [];
  for (const dom of DOMAINS) for (const dim of DIMS) for (const m of markers[dim][dom]) out.push({ ...m, dim, dom });
  return out;
}

// The 15 cells in reading order.
export function cells() {
  const out = [];
  for (const dom of DOMAINS) for (const dim of DIMS) out.push({ dom, dim, key: `${dom}-${dim}` });
  return out;
}

export function levelOf(answers, id) {
  const a = answers[id];
  return a && !a.unsure && Number.isInteger(a.level) && a.level >= 1 && a.level <= 4 ? a.level : null;
}
export function isDone(answers, id) {
  const a = answers[id];
  return !!a && (a.unsure === true || levelOf(answers, id) !== null);
}

function stats(list, answers) {
  let sum = 0, answered = 0, unsure = 0, done = 0;
  for (const m of list) {
    const l = levelOf(answers, m.id);
    if (l !== null) { sum += l; answered++; }
    if (answers[m.id] && answers[m.id].unsure) unsure++;
    if (isDone(answers, m.id)) done++;
  }
  return { n: list.length, answered, unsure, done, sum, avg: answered ? sum / answered : null };
}

export function cellStats(markers, answers, dom, dim) { return stats(markers[dim][dom], answers); }
export function dimStats(markers, answers, dim) { return stats(DOMAINS.flatMap((d) => markers[dim][d]), answers); }
export function domStats(markers, answers, dom) { return stats(DIMS.flatMap((d) => markers[d][dom]), answers); }
export function totalStats(markers, answers) { return stats(allMarkers(markers), answers); }

// Reference profile centroids as average levels (normalised value × 4).
export function profileCentroids(reference) {
  return reference.profiles.map((p) => {
    const v = [0, 1, 2].map((i) => (p.cases.reduce((s, c) => s + reference.cases[c].total[i], 0) / p.cases.length) * 4);
    return { ...p, values: v };
  });
}

// The closest profile by distance in the three dimensions. Needs an average for all three.
export function nearestProfile(reference, dimAvgs) {
  if (dimAvgs.some((v) => v === null || v === undefined)) return null;
  let best = null;
  for (const p of profileCentroids(reference)) {
    const d = Math.sqrt(p.values.reduce((s, v, i) => s + (v - dimAvgs[i]) ** 2, 0));
    if (!best || d < best.distance) best = { ...p, distance: d };
  }
  return best;
}

// The shape: which pattern stands out between the dimensions (average levels 1 to 4).
export function shape(dimAvgs) {
  if (dimAvgs.some((v) => v === null)) return null;
  const [ti, bd, ee] = dimAvgs;
  if (ti - (bd + ee) / 2 >= 0.4) return "tech";
  if (ee <= Math.min(ti, bd) - 0.3) return "eco";
  if (bd >= Math.max(ti, ee) + 0.3) return "business";
  return "even";
}

// Strongest and weakest cells among those with at least half of the markers answered.
export function rankCells(markers, answers, count = 3) {
  const list = cells()
    .map((c) => ({ ...c, ...cellStats(markers, answers, c.dom, c.dim) }))
    .filter((c) => c.answered > 0 && c.answered * 2 >= c.n);
  const asc = [...list].sort((a, b) => a.avg - b.avg || a.key.localeCompare(b.key));
  const desc = [...list].sort((a, b) => b.avg - a.avg || a.key.localeCompare(b.key));
  const weak = asc.slice(0, count);
  const strong = desc.filter((c) => !weak.includes(c)).slice(0, count);
  return { strong, weak };
}

// ---------- Comparing several assessments ----------

export function compareAnswers(markers, assessments) {
  return allMarkers(markers).map((m) => {
    const levels = assessments.map((a) => levelOf(a.answers, m.id)).filter((l) => l !== null);
    const min = levels.length ? Math.min(...levels) : null;
    const max = levels.length ? Math.max(...levels) : null;
    return { ...m, levels, min, max, spread: levels.length >= 2 ? max - min : null };
  });
}

// Average answers over several assessments, as an answers object with fractional levels left out:
// each assessment counts once per marker, so cell averages are averages of everyone's answers.
export function pooledCell(markers, assessments, dom, dim) {
  let sum = 0, k = 0;
  for (const a of assessments) for (const m of markers[dim][dom]) {
    const l = levelOf(a.answers, m.id);
    if (l !== null) { sum += l; k++; }
  }
  return k ? sum / k : null;
}
export function pooledDim(markers, assessments, dim) {
  let sum = 0, k = 0;
  for (const dom of DOMAINS) for (const a of assessments) for (const m of markers[dim][dom]) {
    const l = levelOf(a.answers, m.id);
    if (l !== null) { sum += l; k++; }
  }
  return k ? sum / k : null;
}

// ---------- Save file ----------

const clip = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");

export function makeSaveFile(state, version, lang) {
  return {
    format: FORMAT,
    formatVersion: 1,
    toolVersion: version,
    lang,
    saved: new Date().toISOString(),
    meta: { ...state.meta },
    answers: state.answers,
  };
}

// Reads a save file defensively: only known fields, only known marker ids, all text as plain text.
export function readSaveFile(text, markers) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("json"); }
  if (!data || data.format !== FORMAT || typeof data.answers !== "object" || data.answers === null) throw new Error("format");
  const ids = new Set(allMarkers(markers).map((m) => m.id));
  const answers = {};
  for (const [id, a] of Object.entries(data.answers)) {
    if (!ids.has(id) || !a || typeof a !== "object") continue;
    const level = Number.isInteger(a.level) && a.level >= 1 && a.level <= 4 ? a.level : null;
    const unsure = a.unsure === true;
    const note = clip(a.note, MAX_NOTE);
    if (level !== null || unsure || note) answers[id] = { level: unsure ? null : level, unsure, note };
  }
  const m = data.meta && typeof data.meta === "object" ? data.meta : {};
  const meta = {
    company: clip(m.company, MAX_META),
    mode: m.mode === "individual" ? "individual" : "group",
    name: clip(m.name, MAX_META),
    date: /^\d{4}-\d{2}-\d{2}$/.test(m.date || "") ? m.date : "",
  };
  return { meta, answers, saved: clip(data.saved, 40) };
}

// Formats an average level with one decimal, using the language's decimal sign.
export function fmt(v, decimal = ".") {
  return v === null || v === undefined ? "" : v.toFixed(1).replace(".", decimal);
}

// Interpolates {key} placeholders.
export function t(s, vars = {}) {
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

// Heat class for an average level.
export function heat(v) {
  if (v === null || v === undefined) return "h0";
  if (v < 1.75) return "h1";
  if (v < 2.5) return "h2";
  if (v < 3.25) return "h3";
  return "h4";
}
