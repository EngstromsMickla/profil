# Bygger publik/innehall/sv-markorer.js: svenska namn ur ordlistan, texter ur verktyg/sv_text_*.py.
# Användning: python3 verktyg/skapa_sv_markorer.py
import json, re, sys
from pathlib import Path
rot = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(rot / "verktyg"))
from sv_text_ti import TEXT as TI
from sv_text_bd import TEXT as BD
from sv_text_ee import TEXT as EE
TEXT = {**TI, **BD, **EE}
def las_js(p):
    s = (rot / p).read_text(encoding="utf-8")
    return json.loads(s[s.index("{"):s.rindex("}") + 1])
en = las_js("publik/innehall/en-markorer.js")
ordl = las_js("publik/innehall/ordlista.js")
ut = {}
for dim, doms in en.items():
    ut[dim] = {}
    for dom, lst in doms.items():
        ut[dim][dom] = []
        for m in lst:
            d, lv = TEXT[m["id"]]
            assert len(lv) == 4 and all(lv), m["id"]
            ut[dim][dom].append({"id": m["id"], "name": ordl["markers"][m["id"]]["sv"], "definition": d, "levels": lv})
assert set(TEXT) == {m["id"] for d in ut.values() for l in d.values() for m in l}
txt = json.dumps(ut, ensure_ascii=False, indent=1)
if re.search("[–—]", txt): sys.exit("Tankstreck i de svenska texterna")
(rot / "publik/innehall/sv-markorer.js").write_text(
    "// De 72 markörerna på svenska. Namnen kommer ur ordlistan, texterna ur verktyg/sv_text_*.py.\n"
    "// Genererad av verktyg/skapa_sv_markorer.py. Översättning: Claude, granskad av Dan Engström och Martin Rudberg.\n"
    "export default " + txt + ";\n", encoding="utf-8")
print("ok", sum(len(l) for d in ut.values() for l in d.values()))
