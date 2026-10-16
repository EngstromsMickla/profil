// Beyond Pilots: the views. All text is added with DOM methods and textContent, never as HTML.
// Answers are kept in memory and in this tab's sessionStorage (gone when the tab closes). Nothing is sent anywhere.

import en from "./innehall/en.js";
import {
  DIMS, DOMAINS, allMarkers, cells, levelOf, isDone, cellStats, dimStats, totalStats, profileCentroids,
  nearestProfile, shape, rankCells, compareAnswers, pooledCell, pooledDim, makeSaveFile, readSaveFile,
  fmt, t, heat,
} from "./modell.js";

const LANGS = { en };
const KEY = "beyond-pilots-v1";
const MAX_FILE = 1024 * 1024;

let L = en;
let MARKERS = allMarkers(L.markers);
const CELLS = cells();

const S = {
  meta: { company: "", mode: "group", name: "", date: today() },
  answers: {},
  example: false,
  unsaved: false,
  compare: [],
  toast: "",
};

function today() { return new Date().toISOString().slice(0, 10); }

// ---------- Small building blocks ----------

function h(tag, attr = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attr || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "style") {
      // Through the CSSOM, which the Content Security Policy allows (style attributes are blocked).
      for (const decl of String(v).split(";")) {
        const i = decl.indexOf(":");
        if (i > 0) el.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
      }
    }
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const b of kids.flat(Infinity)) {
    if (b === null || b === undefined || b === false) continue;
    el.append(b instanceof Node ? b : document.createTextNode(String(b)));
  }
  return el;
}
const p = (text, cls) => h("p", { class: cls, text });
const clean = (l) => l.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false);
function swap(el, ...kids) { el.replaceChildren(...clean(kids)); }

const dimName = (id) => L.dimensions.find((d) => d.id === id);
const domName = (id) => L.domains.find((d) => d.id === id);
const lvl = (n) => L.levels[n - 1];
const f1 = (v) => fmt(v, L.lang === "sv" ? "," : ".");

// ---------- Session storage ----------

function persist() {
  try { sessionStorage.setItem(KEY, JSON.stringify({ meta: S.meta, answers: S.answers, example: S.example, unsaved: S.unsaved })); } catch { /* storage unavailable: memory only */ }
}
function restore() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    const d = readSaveFile(JSON.stringify({ format: "mickla-beyond-pilots", meta: saved.meta, answers: saved.answers }), L.markers);
    S.meta = { ...S.meta, ...d.meta, date: d.meta.date || today() };
    S.answers = d.answers;
    S.example = saved.example === true;
    S.unsaved = saved.unsaved === true;
  } catch { /* ignore a broken entry */ }
}

window.addEventListener("beforeunload", (e) => {
  if (S.unsaved && !S.example && totalStats(L.markers, S.answers).done > 0) { e.preventDefault(); e.returnValue = ""; }
});

// ---------- Files ----------

function download(name, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function slug(s) {
  return (s || "assessment").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "assessment";
}

function saveFile() {
  const data = makeSaveFile(S, L.version, L.lang);
  download(`beyond-pilots-${slug(S.meta.company)}-${S.meta.date || today()}.json`, JSON.stringify(data, null, 1));
  S.unsaved = false;
  persist();
  flash(L.common.saved);
}

async function readFile(file) {
  if (!file || file.size > MAX_FILE) throw new Error("size");
  return readSaveFile(await file.text(), L.markers);
}

document.getElementById("fil-oppna").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const d = await readFile(file);
    S.meta = { ...d.meta, date: d.meta.date || today() };
    S.answers = d.answers;
    S.example = false;
    S.unsaved = false;
    persist();
    flash(L.common.loaded);
    go(totalStats(L.markers, S.answers).done ? "#profile" : "#map");
  } catch (err) {
    console.error(err);
    flash(L.common.loadError, true);
  }
});

document.getElementById("fil-jamfor").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  const errors = [];
  for (const file of files) {
    try {
      const d = await readFile(file);
      S.compare.push({ label: d.meta.name || d.meta.company || file.name.replace(/\.json$/i, ""), meta: d.meta, answers: d.answers });
    } catch (err) {
      console.error(err);
      errors.push(t(L.compare.loadError, { name: file.name }));
    }
  }
  if (errors.length) flash(errors.join(" "), true);
  render();
});

async function loadExample() {
  try {
    const res = await fetch("exempel/Exempel_bedomning.json");
    if (!res.ok) throw new Error(String(res.status));
    const d = readSaveFile(await res.text(), L.markers);
    S.meta = d.meta;
    S.answers = d.answers;
    S.example = true;
    S.unsaved = false;
    persist();
    go("#profile");
  } catch (err) {
    console.error(err);
    flash(L.common.exampleError, true);
  }
}

function resetAssessment() {
  S.meta = { company: "", mode: "group", name: "", date: today() };
  S.answers = {};
  S.example = false;
  S.unsaved = false;
  persist();
}

// ---------- Messages ----------

let toastTimer = null;
function flash(text, isError = false) {
  S.toast = { text, isError };
  renderToast();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = ""; renderToast(); }, 6000);
}
function renderToast() {
  let el = document.getElementById("toast");
  if (!el) { el = h("div", { id: "toast", class: "toast", role: "status" }); document.body.append(el); }
  el.hidden = !S.toast;
  el.className = "toast" + (S.toast && S.toast.isError ? " fel" : "");
  el.textContent = S.toast ? S.toast.text : "";
}

// ---------- Frame ----------

function updateFrame(view) {
  document.documentElement.lang = L.lang;
  document.title = L.toolName;
  document.getElementById("hoppa").textContent = L.skip;
  document.getElementById("brand").textContent = L.toolName;
  document.getElementById("upphov").textContent = L.copyright;
  document.getElementById("metod").textContent = L.methodCredit;
  document.getElementById("version").textContent = `${L.toolName} · ${L.version}`;
  const nav = document.getElementById("meny");
  const items = ["start", "map", "profile", "report", "compare", "guide"];
  swap(nav, items.map((k) => h("a", { href: "#" + k, "aria-current": view === k ? "page" : null, text: L.nav[k] })),
    Object.keys(LANGS).length > 1 ? langSwitch() : null);
  const st = totalStats(L.markers, S.answers);
  const status = document.getElementById("status");
  status.hidden = st.done === 0 || view === "start" || view === "guide" || view === "compare";
  if (!status.hidden) {
    document.getElementById("statustext").textContent = [S.meta.company, S.meta.name].filter(Boolean).join(" · ") || (S.meta.mode === "group" ? L.report.group : L.report.individual);
    document.getElementById("statusantal").textContent = t(L.map.progress, { n: st.done, m: st.n });
  }
}

function langSwitch() {
  const sel = h("select", { class: "liten sprak", "aria-label": "Language", onchange: (e) => { L = LANGS[e.target.value]; MARKERS = allMarkers(L.markers); render(); } },
    Object.values(LANGS).map((x) => h("option", { value: x.lang, selected: x.lang === L.lang, text: x.langName })));
  return sel;
}

function go(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

function render() {
  const hash = location.hash || "#start";
  const vy = document.getElementById("vy");
  let view = hash.slice(1);
  let content;
  if (view.startsWith("cell-")) { content = viewCell(view.slice(5)); view = "map"; }
  else if (view === "map") content = viewMap();
  else if (view === "profile") content = viewProfile();
  else if (view === "report") content = viewReport();
  else if (view === "compare") content = viewCompare();
  else if (view === "guide") content = viewGuide();
  else { view = "start"; content = viewStart(); }
  updateFrame(view);
  swap(vy, S.example && view !== "start" && view !== "guide" && view !== "compare" ? p(L.common.exampleBanner, "note strong") : null, content);
}

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); document.getElementById("innehall").focus({ preventScroll: true }); });

// ---------- Start ----------

function viewStart() {
  const T = L.start;
  const st = totalStats(L.markers, S.answers);
  const inProgress = st.done > 0 && !S.example;
  const m = S.meta;

  const field = (label, input, hint) => h("label", { class: "field" }, h("span", {}, label, hint ? h("span", { class: "muted vikt", text: " " + hint }) : null), input);
  const inp = (key, type = "text") => h("input", { type, value: m[key] || "", maxlength: 200, oninput: (e) => { S.meta[key] = e.target.value; S.unsaved = true; persist(); } });

  const nameLabel = h("span", { text: m.mode === "group" ? T.nameGroup : T.nameIndividual });
  const radios = h("div", { class: "radios", role: "radiogroup", "aria-label": T.modeLabel },
    ["group", "individual"].map((mode) => h("label", {},
      h("input", { type: "radio", name: "mode", value: mode, checked: m.mode === mode, onchange: () => { S.meta.mode = mode; nameLabel.textContent = mode === "group" ? T.nameGroup : T.nameIndividual; persist(); } }),
      mode === "group" ? T.modeGroup : T.modeIndividual)));

  const setup = h("section", { class: "card" },
    h("h2", { class: "kortrubrik", text: T.setupTitle }),
    field(T.company, inp("company"), T.optional),
    h("p", { class: "hjalp tight", text: T.companyHint }),
    h("fieldset", { class: "plain" }, h("legend", { class: "small-legend", text: T.modeLabel }), radios),
    h("label", { class: "field" }, h("span", {}, nameLabel, h("span", { class: "muted vikt", text: " " + T.optional })), inp("name")),
    h("label", { class: "field kort-falt" }, h("span", { text: T.date }), inp("date", "date")),
    h("div", { class: "actions" },
      inProgress
        ? [h("button", { type: "button", onclick: () => go(nextCellHash()), text: T.resume }),
           h("button", { type: "button", class: "ghost", onclick: () => { if (confirm(T.confirmNew)) { resetAssessment(); render(); } }, text: T.newAssessment })]
        : h("button", { type: "button", onclick: () => { if (S.example) resetAssessment(); go("#cell-cv-ti"); }, text: T.begin })),
    inProgress ? p(T.resumeNote, "hjalp") : null);

  return h("div", {},
    h("div", { class: "eyebrow", text: T.eyebrow }),
    h("h1", { text: T.title }),
    p(T.lead, "lead"),
    h("div", { class: "fritt", text: T.promise }),
    h("div", { class: "tvaspalt start" },
      h("div", {},
        h("section", { class: "card" },
          h("h2", { class: "kortrubrik", text: T.howTitle }),
          h("ol", { class: "lista-steg" }, T.how.map((x) => h("li", { text: x }))),
          p(T.time, "hjalp")),
        modelTable(),
      ),
      h("div", {},
        setup,
        h("section", { class: "card tight" },
          h("div", { class: "rad" },
            h("div", {}, h("h3", { text: T.openFile }), p(T.openFileNote, "hjalp tight")),
            h("button", { type: "button", class: "ghost", onclick: () => document.getElementById("fil-oppna").click(), text: T.openFile }))),
        h("section", { class: "card tight" },
          h("div", { class: "rad" },
            h("div", {}, h("h3", { text: T.example }), p(T.exampleNote, "hjalp tight")),
            h("button", { type: "button", class: "ghost", onclick: loadExample, text: T.example }))),
        h("section", { class: "card tight" },
          h("h3", { text: T.compareTitle }), p(T.compareText, "hjalp"),
          h("a", { class: "btn ghost", href: "#compare", text: T.compareGo })),
      )));
}

function modelTable() {
  const T = L.start;
  return h("section", { class: "card" },
    h("h2", { class: "kortrubrik", text: T.modelTitle }),
    p(T.modelText, "hjalp"),
    h("div", { class: "modell", role: "table", "aria-label": T.modelTitle },
      h("div", { class: "mrad mhuvud", role: "row" }, h("span", { role: "columnheader" }), L.dimensions.map((d) => h("span", { role: "columnheader", text: d.short }))),
      L.domains.map((dom) => h("div", { class: "mrad", role: "row" },
        h("span", { class: "mdom", role: "rowheader", text: dom.name }),
        DIMS.map((dim) => h("span", { class: "mtal", role: "cell", text: String(L.markers[dim][dom.id].length) }))))));
}

// ---------- The overview (assessment map) ----------

function nextCellHash() {
  const c = CELLS.find((c) => cellStats(L.markers, S.answers, c.dom, c.dim).done < L.markers[c.dim][c.dom].length);
  return c ? `#cell-${c.key}` : "#profile";
}

function matrix({ valueOf, labelOf, link }) {
  return h("div", { class: "matris", role: "table" },
    h("div", { class: "mx-huvud", role: "row" }, h("span", { role: "columnheader" }),
      L.dimensions.map((d) => h("span", { role: "columnheader", class: "mx-dim", text: d.name }))),
    L.domains.map((dom) => h("div", { class: "mx-rad", role: "row" },
      h("span", { class: "mx-dom", role: "rowheader" }, h("b", { text: dom.name }), h("small", { text: dom.question })),
      DIMS.map((dim) => {
        const v = valueOf(dom.id, dim);
        const inner = [h("span", { class: "mx-cdim", text: dimName(dim).short }), ...labelOf(dom.id, dim, v)];
        return link
          ? h("a", { class: `mx-cell ${heat(v)}`, role: "cell", href: `#cell-${dom.id}-${dim}`, "aria-label": `${dom.name}, ${dimName(dim).name}` }, inner)
          : h("span", { class: `mx-cell ${heat(v)}`, role: "cell" }, inner);
      }))));
}

function heatLegend() {
  return h("div", { class: "forklaring" }, h("span", { class: "grupp-namn", text: L.map.legendTitle }),
    [["h1", "1 to 1.7"], ["h2", "1.8 to 2.4"], ["h3", "2.5 to 3.2"], ["h4", "3.3 to 4"]].map(([c, txt]) =>
      h("span", {}, h("i", { class: c }), L.lang === "sv" ? txt.replace(/\./g, ",") : txt)));
}

function viewMap() {
  const T = L.map;
  const st = totalStats(L.markers, S.answers);
  const done = st.done === st.n;
  return h("div", {},
    h("div", { class: "eyebrow", text: T.eyebrow }),
    h("h1", { text: T.title }),
    p(T.lead, "lead"),
    h("div", { class: "framsteg" },
      h("div", { class: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": st.n, "aria-valuenow": st.done }, h("span", { style: `width:${(100 * st.done) / st.n}%` })),
      h("span", { text: t(T.progress, { n: st.done, m: st.n }) + (st.unsure ? " · " + t(T.unsureCount, { n: st.unsure }) : "") })),
    h("div", { class: "actions topp" },
      done ? [p(T.allDone, "tight"), h("a", { class: "btn", href: "#profile", text: T.toProfile })]
        : [h("a", { class: "btn", href: nextCellHash(), text: T.continueNext }), st.answered ? h("a", { class: "btn ghost", href: "#profile", text: T.toProfile }) : null]),
    matrix({
      link: true,
      valueOf: (dom, dim) => { const c = cellStats(L.markers, S.answers, dom, dim); return c.done === c.n ? c.avg : null; },
      labelOf: (dom, dim) => {
        const c = cellStats(L.markers, S.answers, dom, dim);
        return [h("span", { class: "mx-prog", text: c.done ? t(T.cellProgress, { n: c.done, m: c.n }) : T.notStarted }),
          c.done === c.n && c.avg !== null ? h("span", { class: "mx-v", text: t(T.cellAvg, { v: f1(c.avg) }) }) : null,
          h("span", { class: "mx-prick" }, Array.from({ length: c.n }, (_, i) => h("i", { class: isDone(S.answers, L.markers[dim][dom][i].id) ? "ja" : "" })))];
      },
    }),
    heatLegend());
}

// ---------- One cell ----------

function viewCell(key) {
  const idx = CELLS.findIndex((c) => c.key === key);
  if (idx < 0) return viewMap();
  const { dom, dim } = CELLS[idx];
  const T = L.cell;
  const list = L.markers[dim][dom];
  const counter = h("span", { class: "hjalp" });
  const updateCounter = () => { const c = cellStats(L.markers, S.answers, dom, dim); counter.textContent = t(T.answered, { n: c.done, m: c.n }); };
  updateCounter();

  const prev = CELLS[idx - 1], next = CELLS[idx + 1];
  const nav = () => h("div", { class: "navrow" },
    prev ? h("a", { class: "btn ghost", href: `#cell-${prev.key}`, text: "← " + T.prev }) : h("span"),
    h("a", { class: "lank", href: "#map", text: T.backToMap }),
    next ? h("a", { class: "btn", href: `#cell-${next.key}`, text: T.next + " →" }) : h("a", { class: "btn", href: "#profile", text: T.done + " →" }));

  return h("div", { class: "cellvy" },
    h("div", { class: "eyebrow", text: `${domName(dom).name} · ${dimName(dim).name}` }),
    h("h1", { class: "cellrubrik", text: domName(dom).question }),
    h("p", { class: "muted" }, h("b", { text: dimName(dim).name + ": " }), dimName(dim).text),
    h("div", { class: "cellrad" }, h("span", { class: "steg-tal", text: t(T.of, { n: idx + 1, m: CELLS.length }) }), counter),
    p(T.instruction, "note"),
    list.map((m, i) => markerCard(m, i, list.length, updateCounter)),
    nav());
}

function markerCard(m, i, n, onChange) {
  const T = L.cell;
  const a = () => S.answers[m.id] || { level: null, unsure: false, note: "" };
  const card = h("fieldset", { class: "markor" + (isDone(S.answers, m.id) ? " klar" : "") });
  const buttons = [];
  const set = (patch) => {
    const next = { ...a(), ...patch };
    if (next.level === null && !next.unsure && !next.note) delete S.answers[m.id]; else S.answers[m.id] = next;
    S.unsaved = true;
    if (S.example) S.example = false;
    persist();
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.v === (next.unsure ? "u" : String(next.level))));
    card.classList.toggle("klar", isDone(S.answers, m.id));
    onChange();
  };
  const cur = a();
  for (const lv of L.levels) {
    const b = h("button", { type: "button", class: "niva", "data-v": String(lv.n), "aria-pressed": String(!cur.unsure && cur.level === lv.n),
      onclick: () => set(a().level === lv.n && !a().unsure ? { level: null } : { level: lv.n, unsure: false }) },
    h("span", { class: "niva-huvud" }, h("span", { class: "niva-nr", text: String(lv.n) }), h("span", { class: "niva-namn", text: lv.label })),
    h("span", { class: "niva-text", text: m.levels[lv.n - 1] }));
    buttons.push(b);
  }
  const unsureBtn = h("button", { type: "button", class: "osaker", "data-v": "u", "aria-pressed": String(cur.unsure === true),
    onclick: () => set(a().unsure ? { unsure: false } : { unsure: true, level: null }), text: L.unsure });
  buttons.push(unsureBtn);
  const note = h("textarea", { rows: 2, maxlength: 2000, placeholder: T.notePlaceholder, oninput: (e) => set({ note: e.target.value.slice(0, 2000) }) });
  note.value = cur.note || "";
  const noteId = `note-${m.id}`;
  note.id = noteId;

  card.append(
    h("legend", {}, h("span", { class: "markor-nr", text: `${i + 1}/${n} · ${m.id}` }), h("span", { class: "markor-namn", text: m.name })),
    h("details", { class: "def" }, h("summary", { text: T.whatMeans }), p(m.definition, "small")),
    h("div", { class: "nivaer", role: "group", "aria-label": m.name }, buttons.slice(0, 4)),
    h("div", { class: "markor-fot" },
      unsureBtn,
      h("label", { class: "notlabel", for: noteId, text: T.note }),
      note));
  return card;
}

// ---------- Profile ----------

function dimAverages(answers = S.answers) { return DIMS.map((d) => dimStats(L.markers, answers, d).avg); }

function dimChart(series) {
  // series: [{ label, values:[ti,bd,ee], cls }]
  const refs = profileCentroids(L.reference);
  const pos = (v) => `${((v - 1) / 3) * 100}%`;
  return h("div", { class: "dimdiagram" },
    L.dimensions.map((d, i) => h("div", { class: "dimrad" },
      h("div", { class: "dimnamn" }, h("b", { text: d.name }),
        series.length === 1 && series[0].values[i] !== null ? h("span", { class: "dimtal", text: f1(series[0].values[i]) }) : null),
      h("div", { class: "spar" },
        [1, 2, 3, 4].map((n) => h("span", { class: "tick", style: `left:${pos(n)}` }, h("span", { text: String(n) }))),
        series.map((s, k) => s.values[i] === null ? null : h("span", {
          class: `stapel ${s.cls || ""}`, style: `width:${pos(s.values[i])};--rad:${k}; --antal:${series.length}`, title: `${s.label}: ${f1(s.values[i])}`,
        })),
        refs.map((r) => h("span", { class: `ref ref-${r.id}`, style: `left:${pos(r.values[i])}`, title: `${r.name}: ${f1(r.values[i])}`, text: r.mark }))))),
    h("div", { class: "forklaring" },
      series.length === 1 ? h("span", {}, h("i", { class: "du" }), series[0].label) : null,
      refs.map((r) => h("span", {}, h("b", { class: `refmark ref-${r.id}`, text: r.mark }), r.name))));
}

function profileBody(answers, opts = {}) {
  const T = L.profile;
  const st = totalStats(L.markers, answers);
  const avgs = dimAverages(answers);
  const near = nearestProfile(L.reference, avgs);
  const sh = shape(avgs);
  const ranks = rankCells(L.markers, answers);
  const markerList = (c) => L.markers[c.dim][c.dom].filter((m) => { const l = levelOf(answers, m.id); return l !== null && l <= 2; });
  const cellItem = (c, showLow) => h("li", {},
    h("b", { text: t(T.cellLine, { domain: domName(c.dom).name, dimension: dimName(c.dim).short, v: f1(c.avg) }) }),
    showLow && markerList(c).length ? h("span", { class: "small muted blokk" }, T.lowMarkers + " " + markerList(c).map((m) => `${m.name} (${levelOf(answers, m.id)})`).join("; ")) : null);

  return [
    p(t(T.coverage, { n: st.answered }) + (st.unsure ? " " + t(st.unsure === 1 ? T.unsureNoteOne : T.unsureNote, { n: st.unsure }) : ""), "muted"),
    st.answered * 2 < st.n ? p(T.coverageLow, "note strong") : null,
    h("section", { class: "card" },
      h("h2", { class: "kortrubrik", text: T.dimTitle }),
      p(T.dimLead, "hjalp"),
      dimChart([{ label: opts.youLabel || T.you, values: avgs, cls: "du" }])),
    near ? h("section", { class: "card profilkort" },
      h("div", { class: "eyebrow", text: T.nearestTitle }),
      h("h2", { class: "kortrubrik" }, h("span", { class: `refmark stor ref-${near.id}`, text: near.mark }), near.name),
      h("div", { class: "taggar" }, h("span", { class: "tag", text: `${T.approach}: ${near.approach}` }), h("span", { class: "tag", text: `${T.phase}: ${near.phase}` })),
      p(near.text), p(near.next),
      sh ? p({ tech: T.shapeTech, eco: T.shapeEco, business: T.shapeBusiness, even: T.shapeEven }[sh], "muted") : null,
      p(T.caveat, "hjalp")) : null,
    h("section", {},
      h("h2", { text: T.matrixTitle }),
      p(T.matrixLead, "hjalp"),
      matrix({
        link: !opts.static,
        valueOf: (dom, dim) => cellStats(L.markers, answers, dom, dim).avg,
        labelOf: (dom, dim, v) => {
          const c = cellStats(L.markers, answers, dom, dim);
          return [h("span", { class: "mx-stor", text: v === null ? "·" : f1(v) }), c.answered < c.n ? h("span", { class: "mx-prog", text: t(L.map.cellProgress, { n: c.answered, m: c.n }) }) : null];
        },
      }),
      heatLegend()),
    ranks.weak.length ? h("div", { class: "tvaspalt" },
      h("section", { class: "card" }, h("h3", { text: T.strongTitle }), h("ul", { class: "rangl" }, ranks.strong.map((c) => cellItem(c, false)))),
      h("section", { class: "card" }, h("h3", { text: T.weakTitle }), h("ul", { class: "rangl" }, ranks.weak.map((c) => cellItem(c, true))))) : null,
    h("section", { class: "card" },
      h("h3", { text: T.questionsTitle }), p(T.questionsLead, "hjalp"),
      h("ol", { class: "fragor" }, orderedDomains(answers).map((d) => h("li", {}, h("b", { text: d.name + ": " }), d.question)))),
    h("section", { class: "card tight" }, h("h3", { text: T.phasesTitle }), p(T.phasesText, "small")),
  ];
}

// Domains ordered weakest first.
function orderedDomains(answers) {
  return [...L.domains].map((d) => {
    let s = 0, k = 0;
    for (const dim of DIMS) for (const m of L.markers[dim][d.id]) { const l = levelOf(answers, m.id); if (l !== null) { s += l; k++; } }
    return { ...d, avg: k ? s / k : 99 };
  }).sort((a, b) => a.avg - b.avg);
}

function viewProfile() {
  const T = L.profile;
  const st = totalStats(L.markers, S.answers);
  const head = [h("div", { class: "eyebrow", text: T.eyebrow }), h("h1", { text: T.title })];
  if (!st.answered) return h("div", {}, head, p(T.empty, "lead"), h("div", { class: "actions" },
    h("a", { class: "btn", href: "#start", text: L.start.begin }), h("button", { type: "button", class: "ghost", onclick: loadExample, text: L.start.example })));
  return h("div", {}, head, profileBody(S.answers),
    h("div", { class: "navrow" }, h("a", { class: "btn ghost", href: "#map", text: "← " + T.toMap }), h("a", { class: "btn", href: "#report", text: T.toReport + " →" })));
}

// ---------- Report ----------

function viewReport() {
  const T = L.report;
  const st = totalStats(L.markers, S.answers);
  if (!st.answered) return viewProfile();
  const avgs = dimAverages();
  const near = nearestProfile(L.reference, avgs);
  const org = S.meta.company || T.titleFallback;
  const withNotes = MARKERS.filter((m) => S.answers[m.id] && S.answers[m.id].note);
  const unsure = MARKERS.filter((m) => S.answers[m.id] && S.answers[m.id].unsure);

  return h("div", { class: "rapport" },
    h("div", { class: "eyebrow", text: T.eyebrow }),
    h("h1", { text: org }),
    p([S.meta.date, S.meta.mode === "group" ? T.group : T.individual, S.meta.name].filter(Boolean).join(" · "), "muted"),
    h("div", { class: "actions skrivut-ej" },
      h("button", { type: "button", onclick: () => window.print(), text: T.print }),
      h("button", { type: "button", class: "ghost", onclick: saveFile, text: T.save })),
    p(T.saveNote, "hjalp skrivut-ej"),
    h("section", { class: "card" },
      h("h2", { class: "kortrubrik", text: T.summaryTitle }),
      p(t(T.summaryText, { org, n: st.answered, avg: f1(st.avg), ti: f1(avgs[0]), bd: f1(avgs[1]), ee: f1(avgs[2]) })),
      near ? p(t(T.nearestLine, { profile: near.name, approach: near.approach.toLowerCase() })) : null),
    profileBody(S.answers, { static: true }),
    h("section", { class: "card" },
      h("h3", { text: T.notesTitle }),
      withNotes.length ? h("dl", { class: "noter" }, withNotes.map((m) => [
        h("dt", {}, h("b", { text: m.name }), h("span", { class: "muted small", text: ` · ${domName(m.dom).name}, ${dimName(m.dim).short} · ${levelOf(S.answers, m.id) ? T.level + " " + levelOf(S.answers, m.id) : L.unsure}` })),
        h("dd", { text: S.answers[m.id].note })])) : p(T.notesEmpty, "muted")),
    unsure.length ? h("section", { class: "card" }, h("h3", { text: T.unsureTitle }), p(T.unsureLead, "hjalp"),
      h("ul", {}, unsure.map((m) => h("li", { text: `${m.name} (${domName(m.dom).name}, ${dimName(m.dim).short})` })))) : null,
    h("section", { class: "card sidbryt" },
      h("h3", { text: T.allTitle }),
      L.domains.map((d) => h("div", { class: "alla" },
        h("h4", { text: d.name }),
        h("table", {}, h("tbody", {}, DIMS.flatMap((dim) => L.markers[dim][d.id].map((m) => {
          const l = levelOf(S.answers, m.id);
          return h("tr", {}, h("td", { class: "muted", text: dimName(dim).short }), h("td", { text: m.name }),
            h("td", { class: "lv", text: l ? `${l} ${lvl(l).short}` : (S.answers[m.id] && S.answers[m.id].unsure ? L.unsure : "") }));
        }))))))),
    h("section", { class: "card tight" }, h("h3", { text: T.methodTitle }), p(T.methodText, "small")));
}

// ---------- Compare ----------

function viewCompare() {
  const T = L.compare;
  const list = S.compare;
  const hasCurrent = totalStats(L.markers, S.answers).answered > 0;
  const head = [
    h("div", { class: "eyebrow", text: T.eyebrow }), h("h1", { text: T.title }), p(T.lead, "lead"),
    h("div", { class: "actions topp" },
      h("button", { type: "button", onclick: () => document.getElementById("fil-jamfor").click(), text: T.add }),
      hasCurrent && !list.some((x) => x.current) ? h("button", { type: "button", class: "ghost", onclick: () => {
        S.compare.push({ current: true, label: S.meta.name || S.meta.company || t(T.unnamed, { n: list.length + 1 }), meta: { ...S.meta }, answers: JSON.parse(JSON.stringify(S.answers)) });
        render();
      }, text: T.addCurrent }) : null,
      list.length ? h("button", { type: "button", class: "ghost", onclick: () => { S.compare = []; render(); }, text: T.clear }) : null),
  ];
  if (!list.length) return h("div", {}, head, p(T.none, "muted"));

  const cmp = compareAnswers(L.markers, list);
  const spread = cmp.filter((c) => c.spread !== null && c.spread >= 2).sort((a, b) => b.spread - a.spread || a.id.localeCompare(b.id)).slice(0, 15);
  const agree = cmp.filter((c) => c.levels.length >= 2 && c.levels.length === list.length && c.spread === 0);

  return h("div", {}, head,
    h("section", { class: "card" },
      h("h3", { text: T.participants }),
      h("table", { class: "deltagare" },
        h("thead", {}, h("tr", {}, h("th", { text: "" }), L.dimensions.map((d) => h("th", { text: d.short })), h("th", { text: "" }))),
        h("tbody", {}, list.map((x, i) => h("tr", {},
          h("td", {}, h("b", { text: x.label || t(T.unnamed, { n: i + 1 }) }), h("span", { class: "muted small blokk", text: [x.meta.company, x.meta.date].filter(Boolean).join(" · ") })),
          DIMS.map((d) => h("td", { class: "tal", text: f1(dimStats(L.markers, x.answers, d).avg) })),
          h("td", {}, h("button", { type: "button", class: "lank", onclick: () => { S.compare.splice(i, 1); render(); }, text: T.remove }))))),
        list.length > 1 ? h("tfoot", {}, h("tr", {}, h("td", {}, h("b", { text: "Σ" })), DIMS.map((d) => h("td", { class: "tal" }, h("b", { text: f1(pooledDim(L.markers, list, d)) }))), h("td"))) : null)),
    h("section", {},
      h("h2", { text: T.matrixTitle }),
      matrix({ link: false, valueOf: (dom, dim) => pooledCell(L.markers, list, dom, dim), labelOf: (dom, dim, v) => [h("span", { class: "mx-stor", text: v === null ? "·" : f1(v) })] }),
      heatLegend()),
    list.length > 1 ? h("section", { class: "card" },
      h("h3", { text: T.spreadTitle }), p(T.spreadLead, "hjalp"),
      spread.length ? h("ul", { class: "spridning" }, spread.map((c) => h("li", {},
        h("div", { class: "sp-huvud" }, h("b", { text: c.name }), h("span", { class: "muted small", text: ` · ${domName(c.dom).name}, ${dimName(c.dim).short}` })),
        h("div", { class: "sp-skala", "aria-label": t(T.spreadLine, { min: c.min, max: c.max }) },
          [1, 2, 3, 4].map((n) => h("span", { class: "sp-steg" + (n >= c.min && n <= c.max ? " inom" : "") },
            h("span", { class: "sp-n", text: String(n) }),
            h("span", { class: "sp-antal", text: c.levels.filter((l) => l === n).length ? "●".repeat(c.levels.filter((l) => l === n).length) : "" }))))))) : p(T.noSpread, "muted")) : null,
    list.length > 1 && agree.length ? h("section", { class: "card" },
      h("h3", { text: T.agreeTitle }), p(T.agreeLead, "hjalp"),
      h("ul", { class: "small" }, agree.map((c) => h("li", { text: `${c.name} (${domName(c.dom).name}, ${dimName(c.dim).short}): ${c.levels[0]} ${lvl(c.levels[0]).short}` })))) : null);
}

// ---------- Guide ----------

function viewGuide() {
  const T = L.guide;
  return h("div", { class: "smal" },
    h("div", { class: "eyebrow", text: T.eyebrow }),
    h("h1", { text: T.title }),
    p(T.lead, "lead"),
    h("h2", { text: T.mapTitle }),
    h("figure", { class: "karta" },
      h("div", { class: "zon webblasare" },
        h("div", { class: "zon-namn", text: T.zoneBrowser }),
        h("ol", { class: "faser", style: `--antal:${T.phases.length}` }, T.phases.map((f) => h("li", { class: "fas" }, h("span", { class: "fas-namn", text: f.name }), h("span", { class: "fas-text", text: f.text }))))),
      h("figcaption", { text: T.groupNote })),
    h("h2", { text: T.stepsTitle }),
    h("ol", { class: "instr-steg" }, T.steps.map((s) => h("li", {}, h("h3", { text: s.title }), p(s.text), s.bullets ? h("ul", {}, s.bullets.map((b) => h("li", { text: b }))) : null))),
    h("h2", { text: T.levelsTitle }),
    h("ul", { class: "nivalista" }, T.levelsText.map((x) => h("li", { text: x }))),
    h("h2", { text: L.profile.phasesTitle }),
    p(L.profile.phasesText),
    h("h2", { text: T.storageTitle }),
    h("ul", {}, T.storage.map((x) => h("li", { text: x }))),
    h("h2", { text: T.glossaryTitle }),
    h("dl", { class: "ordlista" }, T.glossary.map(([k, v]) => [h("dt", { text: k }), h("dd", { text: v })])),
    h("h2", { text: T.methodTitle }),
    p(L.report.methodText));
}

// ---------- Start up ----------

restore();
render();
