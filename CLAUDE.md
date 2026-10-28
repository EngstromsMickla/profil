# Beyond Pilots: profil.mickla.se

Arbetsbeskrivning för den som utvecklar verktyget vidare, människa eller Claude.

## Sammanhang

- Självskattning av digital transformation för byggentreprenörer, byggd på Kefa Kafulumas licentiatavhandling *Beyond Pilots: Digital-Enabled Transformation in Large Construction Contractors* (LiU 2026, doi.org/10.3384/9789181185935) och det tillhörande bedömningsverktyget i Excel.
- Upphov: Dan Engström, Engströms Mickla AB (Dan är biträdande handledare för Kefa). Dan äger verktyget; metoden och markörtexterna är Kefas. Claude föreslår, Dan beslutar.
- Samma användningssituation som Boost: en grupp vid en gemensam skärm, eller en individ, skattar sitt företags styrkor och svagheter. Gruppvariant: var och en skattar först själv, facilitatorn jämför filerna.
- Prototyp v0.1 (2026-10-15) var på engelska. v0.2 (2026-10-28) är tvåspråkig: svenska och engelska med sömlöst språkbyte och en gemensam ordlista.

## Modellen

- 5 domäner (Creating value, Managing change, Scaling pilots, Innovating business models, Corporate-level engagement) × 3 dimensioner (Technological innovation, Business development, Ecosystem evolution) = 15 celler, 72 markörer (24, 21, 27 per dimension).
- Varje markör har fyra nivåer: 1 Absent, 2 Occasional, 3 Often, 4 Consistent. Id som i avhandlingens Fig. 8 (CvT1, MB3, ClE7 osv.).
- Medelnivå = summan av nivåerna / antal besvarade markörer. Avhandlingens normaliserade värde = medelnivå / 4. "Not sure" räknas inte.
- Närmaste forskningsprofil: kortaste avståndet i de tre dimensionerna till Operationally oriented digitalisation (E3), Internally orchestrated transformation (E2) och Advanced transformation (medel av US1 och E1), med totalvärdena i Fig. 8. Anges som vägledande, inte som klassning.
- Formen: teknik minst 0,4 över medel av affär och ekosystem ger "tech"; ekosystem minst 0,3 under de andra ger "eco"; affär minst 0,3 över de andra ger "business"; annars jämn.

## Fasta principer

- Inga tankstreck (varken — eller –) i texter.
- **Ingen data lämnar webbläsaren.** Ingen server, ingen statistik, inga kakor, inga externa typsnitt eller CDN. CSP i `publik/index.html` tillåter bara egna filer.
- Svaren hålls i minnet och i flikens sessionStorage, så att de överlever en omladdning men försvinner när fliken stängs. Ingen localStorage (kontrollen stoppar det). Sparfil (JSON) för att fortsätta senare, jämföra över tid eller ta med till ett grupptillfälle.
- All text läggs in med DOM-metoder och `textContent`, aldrig `innerHTML`. Stilar sätts via CSSOM (style-attribut blockeras av CSP).
- Sparfiler läses försiktigt (`readSaveFile` i `modell.js`): bara kända fält och markör-id, text kapas, nivåer kontrolleras.
- **Publikt repo.** Bara den påhittade exempelfilen i `publik/exempel/`. Excelverktyget och avhandlingen läggs inte i repot.
- Texter ligger i innehållsfiler, inte i koden: `publik/innehall/en.js` och `sv.js` (gränssnitt, profiler, instruktion, samma nycklar), `en-markorer.js` (genererad från Kefas Excel med `verktyg/las_excel.py`) och `sv-markorer.js` (genererad med `verktyg/skapa_sv_markorer.py`).
- Upphovsrad "© Engströms Mickla AB and Linköping University 2026" och krediteringen "Method by Kefa Kafuluma, Linköping University, from an idea by Dan Engström · Site by Engströms Mickla AB" (Dans beslut 2026-10-16: Mickla har gjort sajten, Kefa på LiU har gjort metoden efter en idé från Dan). Svensk version: "© Engströms Mickla AB och Linköpings universitet 2026" och "Metod: Kefa Kafuluma, Linköpings universitet, efter en idé av Dan Engström · Sajt: Engströms Mickla AB". Versionsnummer i `en.js` räknas upp vid varje publicering.

## Struktur

- `publik/`: det som publiceras. `index.html`, `style.css` (Boosts formspråk), `app.js` (vyerna), `modell.js` (beräkningar, sparfil), `innehall/`, `exempel/Exempel_bedomning.json` (påhittat, skapas med `verktyg/skapa_exempel.mjs`), `img/mickla.png`, `CNAME`.
- Vyer: Start (`#start`), Skattning (`#map`, cellerna `#cell-cv-ti` osv.), Profil (`#profile`), Rapport (`#report`, utskrift eller PDF via webbläsaren), Jämför (`#compare`), Ordlista (`#glossary`), Så fungerar det (`#guide`).
- `test/`: Node-tester (`npm test`). `scripts/kontrollera.mjs`: externa adresser, innerHTML, localStorage, tankstreck, CSP, exempelfiler.
- `.github/workflows/publicera.yml`: kontroller och tester före varje publicering.

## Språk och ordlista (v0.2)

- **Ordlistan styr terminologin.** Källan är Excelfilen Ordlista_Beyond_Pilots (flikarna Modellen, Markörer, Begrepp). Svensk term = Dans val om ifyllt, annars Svenska förslag. Översättningen granskas av Dan och bekräftas av Martin Rudberg (Kefas huvudhandledare); Kefa granskar inte svenskan.
- När en ny version av ordlistan kommer: `python3 verktyg/las_ordlista.py Ordlista.xlsx publik/innehall/ordlista.js`, sedan `python3 verktyg/skapa_sv_markorer.py` (markörnamnen hämtas ur ordlistan). Läs varningarna: de visar var ett bortvalt alternativ fortfarande står i de svenska texterna. Ändrade modelltermer rättas i `sv.js` eller `en.js`; testet stoppar publiceringen om de inte stämmer med ordlistan.
- De svenska markörtexterna (definitioner och nivåtexter) ligger i `verktyg/sv_text_ti.py`, `sv_text_bd.py` och `sv_text_ee.py`. Ändra där och kör `skapa_sv_markorer.py`.
- **Språkbytet:** knapparna English och Svenska i sidhuvudet. Språket väljs i ordningen `?lang=` i adressen, valet tidigare i fliken (sessionStorage), webbläsarens språk. Vyn behålls eftersom adressens hash inte beror på språket, och platsen på sidan behålls via `data-anker` (markörer, ordlisteposter) eller elementets plats i strukturen. Svaren och sparfilen är språkneutrala (markör-id), så filer från båda språken kan jämföras. Användarnas egna anteckningar översätts inte; det står i instruktionen.
- **Ordlistevyn** (`#glossary`): modelltermer, de 72 markörnamnen och begreppen, sorterade med `Intl.Collator` på det språk man läser (å, ä, ö sist på svenska), sök på båda språken, filter per typ och länk från markörer till rätt cell.
- Exempelfiler finns på båda språken (`Exempel_bedomning.json`, `Exempel_bedomning_sv.json`).

## Beslut

- Kefa har gett OK till att markör- och nivåtexterna publiceras i det publika repot (2026-10-16).
- Subdomän och repo heter profil (profil.mickla.se), inte mognad: avhandlingen talar om profiler, inte mognadsgrad (Dans beslut 2026-10-16).

## Öppna frågor

- Om profilen ska anpassas för mindre entreprenörer; avhandlingen gäller stora.
- Ordlistan v0.1 är antagen som utkast i v0.2; Dan och Martin granskar den. Kända punkter: B20 approprieringsförmåga mot markörnamnet för ClE6, och B34 koncernnivå mot M17 företagsnivå.

## Test och publicering

Kör `node scripts/kontrollera.mjs` och `npm test`. Kör hela flödet i Playwright (Chromium) i dator- och telefonstorlek: starta, svara i alla celler, profil, rapport, spara fil, jämför två filer, kontrollera att inga anrop görs utanför den egna domänen. Testa också språkbytet mitt i en cell och i profilen, och ordlistans sortering och sök på båda språken. Claude kan publicera direkt till repot när Dan skriver "publicera"; laddar Dan upp själv via webbgränssnittet skapas `.github` med Add file > Create new file. Publicera aldrig utan att Dan har sagt "publicera".
