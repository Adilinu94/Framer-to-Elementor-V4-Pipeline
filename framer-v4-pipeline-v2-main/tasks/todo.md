# Task: section-compare.js -- 7 Bugs + Verbesserungen

## Gefundene Probleme (Code-Analyse)

### Bug 1 -- KRITISCH: Doppelter Browser-Launch in screenshotWithPlaywright (Zeile 270-275)
```js
const ctx = await pw.chromium.launch(...).then(b => b.newContext(...)); // LEAK! nie geschlossen
const browser = await pw.chromium.launch(...); // zweiter, paralleler Launch
```
Ergebnis: Pro Screenshot wird ein Zombie-Browser-Prozess zurückgelassen.

### Bug 2 -- KRITISCH: Scroll-Position falsch beim clip (Zeile 315/384)
```js
await page.evaluate((b) => window.scrollTo(b.x, b.y), bounds); // scrollt zur x,y Absolut-Koordinate
screenshotOpts.clip = { x: 0, y: 0, width: ..., height: ... };
```
Nach scrollTo(b.x, b.y) beginnt das clip bei y=0 des Viewports -- korrekt.
Aber: `window.scrollTo(b.x, b.y)` nutzt b.x als horizontalen Scroll-Offset!
Richtig wäre: `window.scrollTo(0, b.y)` -- kein horizontales Scrollen.

### Bug 3 -- MITTEL: networkidle bei Framer zu kurz (1500ms default)
Framer lädt WebFonts + Animations lazy. 1500ms reicht oft nicht.
Besser: 2500ms default + zusätzliche document.fonts.ready Prüfung.

### Bug 4 -- MITTEL: Hardcoded Abweichungs-Liste im HTML-Report (Zeile 539-548)
"Bekannte Abweichungen -- Hero-Section" ist fest ins Template eingebaut.
Problem: Report wird für ALLE Sections genutzt (--section features, --section cta etc.)
aber zeigt immer die Hero-Abweichungen. Muss generisch oder leer sein.

### Bug 5 -- SCHWACH: `loading="lazy"` auf Inline-Base64-Bilder (Zeile 452)
Base64-Bilder sind bereits im DOM -- lazy loading hat keinen Effekt,
kann aber in manchen Browsern dazu führen dass das Bild kurz nicht gerendert
wird bei Screenshot-Automation. Soll `loading="eager"` sein.

### Bug 6 -- SCHWACH: findSectionBounds ignoriert sticky/fixed Header
scrollIntoView positioniert den Header hinter den Sticky-Bar.
Kein Offset für typische WP-Admin-Bar (32px) oder Elementor-Sticky-Header.

### Bug 7 -- NEU FEATURE: Kein Pixel-Diff-Score im JSON-Report
compare-report.json enthält keine quantitative Ähnlichkeits-Metrik.
CI kann nicht automatisch erkennen ob es besser oder schlechter wurde.
Native Lösung ohne npm: einfacher Histogram-Hash (keine externe Lib nötig).

## Plan

### Schritt 1: Bug 1 + 2 fixen (screenshotWithPlaywright)
### Schritt 2: Bug 3 fixen (Font-Wartelogik + wait-after-load default)
### Schritt 3: Bug 4 fixen (generische Deviations-Liste)
### Schritt 4: Bug 5 fixen (loading eager)
### Schritt 5: Bug 6 fixen (scrollIntoView Offset)
### Schritt 6: Bug 7 -- Pixel-Hash-Score im JSON-Report (keine externe Dep)
### Schritt 7: Tests aktualisieren (neuer default, neues JSON-Feld)
### Schritt 8: Alle Tests grün verifizieren

## Checkboxen
- [ ] Bug 1: Zombie-Browser-Fix
- [ ] Bug 2: Scroll-X-Fix
- [ ] Bug 3: Font-Wartezeit
- [ ] Bug 4: Hardcoded Deviations entfernen
- [ ] Bug 5: loading=eager
- [ ] Bug 6: scrollIntoView Offset
- [ ] Bug 7: pixelHash Score im JSON
- [ ] Tests grün: 42 + 12 + 10
