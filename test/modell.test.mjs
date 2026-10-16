import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import en from "../publik/innehall/en.js";
import * as M from "../publik/modell.js";

const LANGS = { en };

test("modellen har 72 markörer med fyra nivåer och unika id", () => {
  for (const L of Object.values(LANGS)) {
    const all = M.allMarkers(L.markers);
    assert.equal(all.length, 72);
    assert.equal(new Set(all.map((m) => m.id)).size, 72);
    for (const m of all) {
      assert.equal(m.levels.length, 4, m.id);
      assert.ok(m.name && m.definition && m.levels.every(Boolean), m.id);
    }
    const per = (dim) => M.DOMAINS.reduce((s, d) => s + L.markers[dim][d].length, 0);
    assert.deepEqual([per("ti"), per("bd"), per("ee")], [24, 21, 27]);
  }
});

test("alla språk har samma id i samma ordning", () => {
  const ids = (L) => M.allMarkers(L.markers).map((m) => m.id).join();
  for (const L of Object.values(LANGS)) assert.equal(ids(L), ids(en));
});

test("normaliseringen återger avhandlingens referensvärden (Fig. 8, US1 teknik = 80/96)", () => {
  const answers = {};
  const levels = { cv: [4, 4, 4, 3, 4, 4], mc: [4, 2, 2, 2, 4], sp: [2, 3, 4], bm: [4, 4, 4, 3], cl: [3, 4, 4, 1, 3, 4] };
  for (const d of M.DOMAINS) en.markers.ti[d].forEach((m, i) => { answers[m.id] = { level: levels[d][i], unsure: false, note: "" }; });
  const s = M.dimStats(en.markers, answers, "ti");
  assert.equal(s.sum, 80);
  assert.equal(Math.round((s.avg / 4) * 100) / 100, en.reference.cases.US1.total[0]);
});

test("Inte säker räknas inte och närmaste profil väljs", () => {
  const all = M.allMarkers(en.markers);
  const ans = (lv) => Object.fromEntries(all.map((m) => [m.id, { level: lv, unsure: false, note: "" }]));
  assert.equal(M.nearestProfile(en.reference, [1, 1, 1]).id, "op");
  assert.equal(M.nearestProfile(en.reference, [4, 4, 4]).id, "adv");
  assert.equal(M.nearestProfile(en.reference, [2.5, 2.7, 2.4]).id, "io");
  assert.equal(M.nearestProfile(en.reference, [2, null, 2]), null);
  const a = ans(2); a[all[0].id] = { level: null, unsure: true, note: "" };
  const t = M.totalStats(en.markers, a);
  assert.equal(t.answered, 71); assert.equal(t.unsure, 1); assert.equal(t.done, 72); assert.equal(t.avg, 2);
});

test("formen", () => {
  assert.equal(M.shape([3, 2, 2]), "tech");
  assert.equal(M.shape([2.5, 2.5, 2]), "eco");
  assert.equal(M.shape([2, 2.6, 2.2]), "business");
  assert.equal(M.shape([2, 2.1, 2]), "even");
});

test("sparfilen läses försiktigt", () => {
  const ex = fs.readFileSync(new URL("../publik/exempel/Exempel_bedomning.json", import.meta.url), "utf8");
  const d = M.readSaveFile(ex, en.markers);
  assert.equal(Object.keys(d.answers).length, 72);
  assert.match(d.meta.company, /fictional/);
  const bad = JSON.stringify({ format: M.FORMAT, meta: { company: "<b>x</b>", mode: "x", date: "igår" },
    answers: { CvT1: { level: 9 }, NOPE: { level: 2 }, CvT2: { level: 3, note: "a".repeat(5000) }, CvT3: { level: 2, unsure: true } } });
  const b = M.readSaveFile(bad, en.markers);
  assert.equal(b.meta.mode, "group"); assert.equal(b.meta.date, "");
  assert.equal(b.answers.CvT1, undefined); assert.equal(b.answers.NOPE, undefined);
  assert.equal(b.answers.CvT2.note.length, M.MAX_NOTE);
  assert.deepEqual(b.answers.CvT3, { level: null, unsure: true, note: "" });
  assert.throws(() => M.readSaveFile("{}", en.markers));
  assert.throws(() => M.readSaveFile("inte json", en.markers));
});

test("jämförelsen hittar spridning", () => {
  const all = M.allMarkers(en.markers);
  const a = { answers: { [all[0].id]: { level: 1 } } }, b = { answers: { [all[0].id]: { level: 4 } } };
  const c = M.compareAnswers(en.markers, [a, b]);
  assert.equal(c[0].spread, 3);
  assert.equal(M.pooledCell(en.markers, [a, b], "cv", "ti"), 2.5);
});
