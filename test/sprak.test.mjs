import test from "node:test";
import assert from "node:assert/strict";
import en from "../publik/innehall/en.js";
import sv from "../publik/innehall/sv.js";
import ordlista from "../publik/innehall/ordlista.js";
import { allMarkers } from "../publik/modell.js";

const nycklar = (o, p = "") => Object.entries(o).flatMap(([k, v]) =>
  k === "markers" || k === "cases" ? [p + k] : v && typeof v === "object" ? nycklar(v, p + k + ".") : [p + k]);

test("engelska och svenska har samma nycklar", () => {
  const a = nycklar(en), b = nycklar(sv);
  assert.deepEqual(a.filter((k) => !b.includes(k)), [], "saknas på svenska");
  assert.deepEqual(b.filter((k) => !a.includes(k)), [], "saknas på engelska");
});

test("inga tomma texter på något språk", () => {
  const tomma = (o, p = "") => Object.entries(o).flatMap(([k, v]) =>
    typeof v === "string" ? (v.trim() ? [] : [p + k]) : v && typeof v === "object" ? tomma(v, p + k + ".") : []);
  assert.deepEqual(tomma(en), []);
  assert.deepEqual(tomma(sv), []);
});

test("markörernas namn följer ordlistan på båda språken", () => {
  const e = allMarkers(en.markers), s = allMarkers(sv.markers);
  assert.equal(Object.keys(ordlista.markers).length, 72);
  e.forEach((m, i) => {
    assert.equal(s[i].id, m.id);
    assert.equal(m.name, ordlista.markers[m.id].en, m.id);
    assert.equal(s[i].name, ordlista.markers[m.id].sv, m.id);
  });
});

test("modellens termer följer ordlistan", () => {
  const term = Object.fromEntries(ordlista.model.map((x) => [x.id, x]));
  const kolla = (ids, en1, sv1) => ids.forEach((id, i) => {
    assert.equal(en1[i], term[id].en.replace(/ \((profile|short)\)$/, ""), `${id} engelska`);
    assert.equal(sv1[i], term[id].sv, `${id} svenska`);
  });
  kolla(["M07", "M08", "M09"], en.dimensions.map((d) => d.name), sv.dimensions.map((d) => d.name));
  kolla(["M10", "M11", "M12"], en.dimensions.map((d) => d.short), sv.dimensions.map((d) => d.short));
  kolla(["M13", "M14", "M15", "M16", "M17"], en.domains.map((d) => d.name), sv.domains.map((d) => d.name));
  kolla(["M18", "M19", "M20", "M21"], en.levels.map((l) => `Level ${l.n}: ${l.label}`), sv.levels.map((l) => `Nivå ${l.n}: ${l.label}`));
  kolla(["M22"], [en.unsure], [sv.unsure]);
  kolla(["M23", "M24", "M25"], en.reference.profiles.map((x) => x.name), sv.reference.profiles.map((x) => x.name));
});

test("varje ordlistepost finns på båda språken", () => {
  for (const x of [...ordlista.model, ...ordlista.concepts]) {
    assert.ok(x.en && x.sv, x.id);
    assert.equal(!!x.enText, !!x.svText, `${x.id}: förklaring saknas på ett språk`);
  }
});

test("sajtens skript har giltig syntax", async () => {
  const { execFileSync } = await import("node:child_process");
  for (const f of ["app.js", "modell.js", "innehall/en.js", "innehall/sv.js", "innehall/ordlista.js", "innehall/en-markorer.js", "innehall/sv-markorer.js"]) {
    execFileSync(process.execPath, ["--check", new URL(`../publik/${f}`, import.meta.url).pathname]);
  }
});
