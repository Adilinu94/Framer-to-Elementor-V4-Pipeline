# UBBAUPLAN — Framer → Elementor V4 Pipeline v1.0

**Datum:** 15. Juni 2026
**Ausgangspunkt:** E2E-Test mit massiven qualitativen Abweichungen (8 systematische Lücken)
**Ziel:** Vollautomatisierte Pipeline mit visuell korrektem Output
**Strategie:** Dual-Source-Ansatz (Unframer MCP für Struktur + FramerExport/Crawler für CSS)

---

## 0. GRUNDSATZENTSCHEIDUNGEN

### 0.1 Unframer MCP kann NICHT modifiziert werden

Der Unframer MCP (`mcp.unframer.co`) ist ein externer Service. Wir können keine neuen Endpunkte
(`getColorStyles`, `getTextStyles`, `getComponentXml`) hinzufügen. Alle Style-Daten müssen aus
anderen Quellen kommen.

**Konsequenz:** Die gesamte Strategie muss auf dem Dual-Source-Ansatz basieren.

### 0.2 Architektur-Entscheidung: Dual-Source (Option D)

```
QUELLE 1: Unframer MCP          → Struktur (DOM-Baum, Komponenten, Style-REFERENZEN)
QUELLE 2: FramerExport/Publikation → Styling  (CSS-Werte, Farben, Fonts, Breakpoints)
         ↓
    CROSS-VALIDATION             → Token-Mapping (Referenz → echter CSS-Wert)
         ↓
    DESIGN SYSTEM                → Global Variables + Global Classes
         ↓
    V4 WIDGET TREE               → convert-xml-to-v4.js MIT Tokens
         ↓
    BUILD + QA                   → set-content → Screenshot-Vergleich
```

### 0.3 CSS-Quellen-Priorität

| Quelle | Priorität | Begründung |
|--------|-----------|------------|
| FramerExport CLI (lokaler HTML/CSS-Mirror) | 🥇 PRIMÄR | Bereits im Wizard integriert, liefert komplette CSS-Dateien |
| Publizierte Framer-Seite (Browser-Crawl) | 🥈 FALLBACK | Wenn FramerExport nicht verfügbar / fehlschlägt |
| Built-in Style-Resolver (Heuristik) | 🥉 LETZTE INSTANZ | Wenn beide CSS-Quellen ausfallen |

---

## DEEP RESEARCH — Offene Fragen vor Umbau-Beginn

Bevor wir mit Phase 1 beginnen, müssen 3 kritische Fragen recherchiert werden:

### Research-Frage 1: FramerExport CSS-Daten

- [ ] Welche CSS-Dateien produziert FramerExport genau? (`styles.css`, Inline-`<style>`-Blöcke?)
- [ ] Enthalten diese CSS-Dateien die aufgelösten Design-Tokens (Farben als Hex/RGB, Font-Families)?
- [ ] Wie sehen die CSS-Klassennamen aus? Können wir sie mit den Unframer `inlineTextStyle`-Referenzen matchen?
- [ ] Gibt es eine 1:1-Mapping-Tabelle (Framer-Style-Pfad → CSS-Klasse)?
- [ ] Beispiel-Output eines FramerExport-Laufs analysieren

### Research-Frage 2: Elementor V4 Style-System

- [ ] Akzeptiert `elementor-set-content` lokale `background-color`-Styles, oder MÜSSEN es Global Classes sein?
- [ ] Was ist das exakte, aktuelle Schema für `e-button`-Styling (background, border-radius, padding)?
- [ ] Wie werden Google Fonts in V4 enqueued? (`resolve-fonts.js` → WordPress?)
- [ ] Wie genau funktioniert das `variants`-System für responsive Breakpoints?
- [ ] Test: Ein minimales V4-Tree mit korrektem Button-Styling an test4 senden

### Research-Frage 3: Python-Pipeline-Code

- [ ] Ist der Code (`framer_to_elementor.py`, `v4_converter.py`, `framer_pipeline.py`) irgendwo verfügbar?
- [ ] Falls nicht: Können wir die 7 dokumentierten Bugs + 5 Invarianten aus der SPEC übernehmen?
- [ ] Was macht die Python-Pipeline konkret anders/besser als unser Node.js-Converter?
- [ ] `.elements.json` + `.variables.json` + `.global_classes.json` als getrennte Outputs — sinnvoll?

### Research-Frage 4 (Bonus): Unframer MCP Limitationen

- [ ] Gibt es versteckte/undokumentierte Endpunkte? (`tools/list` zeigt nur 4 Tools)
- [ ] Kann `getNodeXml` mit `includeStyles: true` aufgerufen werden?
- [ ] Gibt es einen Weg, die Framer-Projekt-Styles über die Unframer-Website-API zu bekommen?

---

## PHASE 1: QUICK-WINS & SKILLS-ÜBERNAHME (Tag 1)

**Ziel:** Sofortige Verbesserungen ohne Architektur-Änderungen.
**Aufwand:** ~2 Stunden

### 1.1 Skills aus ki-2-elementor-master kopieren

```bash
# Von: C:\Users\adini\Desktop\ki-2-elementor-master\skills\
# Nach: C:\Users\adini\Desktop\Umbau\framer-v4-pipeline-v2-main\novamira-skill\
```

| Skill | Datei | Nutzen |
|-------|-------|--------|
| `elementor-v4-build-checklist` | `build-checklist.md` | 12-Guard Pre-Build-Check |
| `elementor-v4-style-property-quick-reference` | `style-props-quickref.md` | Korrekte $$type-Formate für alle 30 Properties |
| `client-design-token-setup-protocol` | `design-token-protocol.md` | Variables → Classes in 5 Phasen |
| `framer-responsive-extractor` | `responsive-extractor.md` | Responsive Breakpoints aus CSS |
| `framer-dual-source-to-v4` | `dual-source-workflow.md` | DER Goldstandard-Workflow |
| `elementor-v4-visual-qa` | `visual-qa.md` | Browser-basierter Screenshot-Vergleich |
| `framer-token-validator` | `token-validator.md` | Token-Mapping-Validierung |
| `global-class-pattern-analyzer` | `gc-pattern-analyzer.md` | Style-Pattern → Global Classes |
| `elementor-v4-error-recovery` | `error-recovery.md` | Fehlerbehebung nach Build-Fehlern |
| `design-system-reference` | `design-system-ref.md` | Design-System-Referenz |

**Aktion:** 10 Skills kopieren, in `session-start-checklist.md` registrieren.

### 1.2 Bug 3 Minimal-Fix (20 Zeilen)

```javascript
// convert-xml-to-v4.js: STATT Hintergrundfarbe zu verwerfen,
// ALS LOKALEN STYLE SETZEN (minimale Lösung)

// ALT (Zeile 540-542):
if (resolved) {
  warn(`background.color '${bgVal}' muss als Global Class gesetzt werden (Bug 3). Übersprungen.`);
}

// NEU:
if (resolved) {
  props['background-color'] = resolved;  // ← DIREKT SETZEN
  warn(`background.color '${bgVal}' als lokaler Style gesetzt (Bug 3 workaround).`);
}
```

**Aktion:** `str_replace` in `convert-xml-to-v4.js`, beide Stellen (e-flexbox + e-div-block).

### 1.3 RC-11 Fallback verbessern (30 Zeilen)

```javascript
// convert-xml-to-v4.js: STATT statischem Fallback,
// inlineTextStyle-Referenz parsen und Größe ableiten

// Style-Heuristik aus Referenz-Pfad:
// "/Heading/Heading 1" → 68px, 700, #FFFFFF (oder dark-mode aware)
// "/Heading/Heading 2" → 48px, 600
// "/Heading/Heading 3" → 32px, 600
// "/Body/Body-20px-Medium" → 20px, 500
// "/Body/Body-16px-Medium" → 16px, 500
// "/Body/Body S" → 14px, 400

const TEXT_STYLE_FALLBACKS = {
  'Heading 1': { size: '68px', weight: '700', color: '#111111' },
  'Heading 2': { size: '48px', weight: '600', color: '#111111' },
  'Heading 3': { size: '32px', weight: '600', color: '#111111' },
  'Heading 4': { size: '24px', weight: '600', color: '#111111' },
  'Body-20px':  { size: '20px', weight: '400', color: '#444444' },
  'Body-16px':  { size: '16px', weight: '400', color: '#444444' },
  'Body S':     { size: '14px', weight: '400', color: '#666666' },
};
```

**Aktion:** In `buildStyleProps()` die `inlineTextStyle`-Attribut-Referenz parsen und Fallback daraus ableiten.

### 1.4 Bug 8 erweitern — Komponenten-Props extrahieren (15 Zeilen)

```javascript
// extractComponentText() in convert-xml-to-v4.js:
// Uppercase-Camel-Keys NICHT pauschal filtern, sondern als
// Text-Kandidaten prüfen (sie enthalten die Property-Werte)

// ALT: if (/^[A-Z]/.test(key)) continue;
// NEU: Nur filtern wenn es bekannte Style-Keys sind
const STYLE_ATTR_KEYS = new Set([
  'backgroundColor', 'backgroundImage', 'borderRadius', 'fontFamily',
  'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'opacity',
  'stackDirection', 'stackGap', 'stackDistribution', 'stackAlignment',
]);
if (STYLE_ATTR_KEYS.has(key)) continue;
```

**Aktion:** `str_replace` in `extractComponentText()`.

### 1.5 Tests & Commit

- [ ] Alle 128 Pipeline-Tests müssen weiterhin grün sein
- [ ] Manueller Test: Hero-XML konvertieren, prüfen ob Hintergrundfarbe jetzt im Tree ist
- [ ] Commit: `fix: Bug 3 + RC-11 + Bug 8 quick-wins`

---

## PHASE 2: DUAL-SOURCE CSS-EXTRAKTION (Tag 2-3)

**Ziel:** CSS-Werte aus FramerExport extrahieren und als Token-Mapping bereitstellen.
**Aufwand:** ~2 Tage

### 2.1 Neues Script: `extract-framer-css-tokens.js`

Dieses Script:
1. Liest `styles.css` und `<style>`-Blöcke aus FramerExport-Output
2. Extrahiert alle CSS-Klassen mit ihren Properties
3. Erstellt eine Token-Map: Style-Pfad → CSS-Properties

```javascript
// Input:  FramerExport/<project>/index.html + styles.css
// Output: token-mapping.json

{
  "colors": {
    "/Theme Color/Very Dark Green": {
      "hex": "#061D13",
      "rgb": "rgb(6, 29, 19)",
      "gv_id": null  // wird erst nach GV-Erstellung befüllt
    },
    "/Theme Color/Light Lime Green": {
      "hex": "#DFFFA3",
      "rgb": "rgb(223, 255, 163)",
      "gv_id": null
    }
  },
  "textStyles": {
    "/Heading/Heading 1": {
      "fontFamily": "Inter Display",
      "fontSize": "68px",
      "fontWeight": "600",
      "color": "#FFFFFF",
      "lineHeight": "1.1"
    },
    "/Body/Body-20px-Medium": {
      "fontFamily": "Inter",
      "fontSize": "20px",
      "fontWeight": "500",
      "color": "rgb(194, 194, 194)",
      "lineHeight": "1.5"
    }
  },
  "breakpoints": {
    "tablet": { "minWidth": "768px", "maxWidth": "1024px" },
    "mobile": { "minWidth": "0px", "maxWidth": "767px" }
  }
}
```

### 2.2 Integration in `convert-xml-to-v4.js`

Der Converter muss lernen, Token-Referenzen aufzulösen:

```javascript
// convert-xml-to-v4.js: NEUER Code in buildStyleProps()

// Style-Referenz aus Unframer-XML:
// <Node inlineTextStyle="/Heading/Heading 1">

const textStyleRef = attrs.inlineTextStyle;  // ← NEU: dieses Attribut lesen!
if (textStyleRef && tokenMapping?.textStyles?.[textStyleRef]) {
  const style = tokenMapping.textStyles[textStyleRef];
  if (style.fontFamily) props['font-family'] = resolveFont(style.fontFamily, ...);
  if (style.fontSize)   props['font-size']   = wrapSize(style.fontSize);
  if (style.fontWeight) props['font-weight'] = wrapType('string', style.fontWeight);
  if (style.color)      props['color']       = resolveColor(style.color, ...);
  if (style.lineHeight) props['line-height'] = resolveLineHeight(style.lineHeight);
}

// Farb-Referenz aus Unframer-XML:
// <Node backgroundColor="/Theme Color/Very Dark Green">

const bgColorRef = attrs.backgroundColor;
if (bgColorRef && tokenMapping?.colors?.[bgColorRef]) {
  const color = tokenMapping.colors[bgColorRef];
  if (color.gv_id) {
    props['background-color'] = wrapGvColor(color.gv_id);
  } else if (color.hex) {
    props['background-color'] = wrapColor(color.hex);
  }
}
```

### 2.3 Fallback: Browser-Crawl (wenn FramerExport nicht verfügbar)

Neues Script: `crawl-framer-css.js`

- Öffnet die publizierte Framer-Seite via Puppeteer/Playwright oder fetch
- Extrahiert alle `<style>`-Blöcke
- Parst CSS und erzeugt dieselbe Token-Map wie 2.1
- Cached das Ergebnis (1h TTL)

### 2.4 Wizard-Integration

```javascript
// wizard.js: NEUER Schritt nach FramerExport

// Schritt 3.5: CSS-Tokens extrahieren
await runStep('CSS-Token-Extraktion', async () => {
  const exportDir = getFramerExportDir();
  const tokenMap = await runScript('extract-framer-css-tokens.js', [
    '--html', path.join(exportDir, 'index.html'),
    '--css', path.join(exportDir, 'styles.css'),
    '--output', path.join(exportDir, 'token-mapping.json'),
  ]);
  
  if (!tokenMap) {
    // Fallback: Browser-Crawl
    log.info('FramerExport CSS nicht verfügbar, crawle publizierte Seite...');
    tokenMap = await runScript('crawl-framer-css.js', [
      '--url', framerUrl,
      '--output', path.join(exportDir, 'token-mapping.json'),
    ]);
  }
  
  return tokenMap;
});

// Schritt 4: convert-xml-to-v4.js MIT Tokens
await runScript('convert-xml-to-v4.js', [
  '--xml', xmlPath,
  '--tokens', tokenMapPath,    // ← JETZT MIT TOKENS!
  '--output', v4TreePath,
]);
```

### 2.5 Test: E2E mit CSS-Tokens

- [ ] FramerExport auf `hilarious-workshops-284047.framer.app` ausführen
- [ ] `extract-framer-css-tokens.js` ausführen → token-mapping.json
- [ ] `convert-xml-to-v4.js --tokens token-mapping.json` ausführen
- [ ] Prüfen: Hat der Tree jetzt korrekte Farben, Fonts, Größen?
- [ ] Auf test4 deployen und visuell vergleichen

---

## PHASE 3: DESIGN-SYSTEM-AUTOMATISIERUNG (Tag 4-5)

**Ziel:** Global Variables + Global Classes automatisch aus Token-Mapping erstellen.
**Aufwand:** ~2 Tage

### 3.1 Workflow: Vom Token-Mapping zum Design-System

```
token-mapping.json
    │
    ├── colors → adrians-batch-create-variables (type: color)
    │              → e-gv-XXXXXXXX IDs zurück in Token-Map schreiben
    │
    ├── textStyles → adrians-batch-create-variables (type: font)
    │                  → e-gv-XXXXXXXX IDs
    │
    ├── sizes → adrians-batch-create-variables (type: size)
    │             → e-gv-XXXXXXXX IDs
    │
    └── → elementor-create-global-class (×N)
           → gc-XXXXXXXXXXXXXXXXX IDs
```

### 3.2 Neues Script: `setup-design-system.js`

```javascript
// Liest token-mapping.json
// Ruft Novamira MCP auf:
//   1. batch-create-variables für Farben
//   2. batch-create-variables für Fonts
//   3. create-global-class für jede semantische Klasse
//   4. apply-variable-to-class für jedes Binding
// Schreibt aktualisiertes token-mapping.json mit gv_ids
```

### 3.3 Schritt-für-Schritt:

```
Schritt 1: FARB-VARIABLEN
  MCP: adrians-batch-create-variables
  Input:  [{ name: "Theme Color / Very Dark Green", type: "color", value: "#061D13" }, ...]
  Output: [{ name: "...", gv_id: "e-gv-A1B2C3D" }, ...]
  
Schritt 2: FONT-VARIABLEN
  MCP: adrians-batch-create-variables
  Input:  [{ name: "Inter Display", type: "font", value: "Inter Display" }, ...]
  Output: [{ name: "...", gv_id: "e-gv-E5F6G7H" }, ...]

Schritt 3: GLOBAL CLASSES
  MCP: elementor-create-global-class (×N)
  Input:  { name: "Hero Background", type: "background" }
  Output: { gc_id: "gc-XYZ..." }

Schritt 4: VARIABLE-BINDINGS
  MCP: adrians-apply-variable-to-class
  Input:  { class_id: "gc-XYZ...", variable_id: "e-gv-A1B2C3D", property: "background-color" }

Schritt 5: FONT-ENQUEUING
  Script: resolve-fonts.js (existiert bereits)
  MCP: adrians-batch-media-upload (für lokale Fonts)
  WP:  Google Fonts API (für Google Fonts)
```

### 3.4 Integration in convert-xml-to-v4.js

Nachdem Global Classes existieren, müssen sie im V4-Tree referenziert werden:

```javascript
// Statt lokalem Style:
// styles: { "fenode1": { variants: [{ props: { "background-color": ... } }] } }

// Global Class referenzieren:
settings: {
  classes: { "$$type": "classes", "value": ["gc-XYZ...", "s-fenode1"] }
}
styles: {
  "s-fenode1": {
    variants: [{
      props: {
        // NUR widget-spezifische Styles (padding, grid),
        // KEINE Farben/Fonts mehr!
      }
    }]
  }
}
```

---

## PHASE 4: convert-xml-to-v4.js UMBAU (Tag 5-7)

**Ziel:** Den Converter so umbauen, dass er MIT Token-Mapping korrekte Outputs produziert.
**Aufwand:** ~3 Tage

### 4.1 Alle Änderungen im Überblick

| Änderung | Zeilen | Impact |
|----------|--------|--------|
| `inlineTextStyle` parsen + auflösen | +40 | 🔴 L1, L3, L4 |
| `backgroundColor`-Pfad auflösen | +30 | 🔴 L2 |
| Bug 3 fix (nicht verwerfen) | -10/+5 | 🔴 L2 |
| RC-11 verbessern (Style-Fallbacks) | +50 | 🔴 L3 |
| Bug 8 erweitern (Props extrahieren) | +10 | 🟡 L5 |
| Komponenten-Rekursion (getNodeXml) | +60 | 🟡 L5 |
| Responsive Variants erzeugen | +80 | 🟡 L7 |
| Global Class Referenzen statt lokal | +40 | 🔴 L6 |

### 4.2 Komponenten-Auflösung (L5)

```javascript
// convert-xml-to-v4.js: NEUE Funktion

async function resolveComponent(componentId, unframerUrl) {
  // Rufe Unframer MCP auf: getNodeXml({ nodeId: componentId })
  const xml = await fetchUnframerNode(componentId, unframerUrl);
  // Konvertiere das Komponenten-XML in V4-Widgets
  const tokens = tokenizeXml(xml);
  const tree = buildTree(tokens);
  return tree.map(node => convertNode(node, tokenMapping, fontResolution, imageMap));
}

// In convertNode(), wenn widgetType === 'e-component':
if (attrs.componentId && unframerUrl) {
  const componentTree = await resolveComponent(attrs.componentId, unframerUrl);
  // Ersetze e-component-Node mit aufgelöstem Widget-Tree
  // Übertrage Property-Overrides aus den XML-Attributen
  return mergeComponentWithOverrides(componentTree, attrs);
}
```

### 4.3 Responsive Variants (L7)

```javascript
// convert-xml-to-v4.js: NEUE Logik

// Unframer-XML enthält:
// <Desktop nodeId="WQLkyLRf1">...</Desktop>
// <Tablet  nodeId="Px0QA3Mz8">...</Tablet>
// <Phone   nodeId="QoxZ85cXX">...</Phone>

// Für Tablet und Phone: getNodeXml(nodeId) aufrufen,
// Kinder extrahieren, als variants[] in die Desktop-Style-Definition einweben.

async function buildResponsiveVariants(desktopNode, tabletNodeId, phoneNodeId, unframerUrl) {
  const variants = [
    { meta: { breakpoint: 'desktop', state: null }, props: desktopNode.props }
  ];
  
  if (tabletNodeId) {
    const tabletXml = await fetchUnframerNode(tabletNodeId, unframerUrl);
    const tabletProps = extractPropsFromXml(tabletXml);
    variants.push({ meta: { breakpoint: 'tablet', state: null }, props: tabletProps });
  }
  
  if (phoneNodeId) {
    const phoneXml = await fetchUnframerNode(phoneNodeId, unframerUrl);
    const phoneProps = extractPropsFromXml(phoneXml);
    variants.push({ meta: { breakpoint: 'mobile', state: null }, props: phoneProps });
  }
  
  return variants;
}
```

### 4.4 Tests für den umgebauten Converter

- [ ] Unit-Test: Token-Mapping wird korrekt aufgelöst
- [ ] Unit-Test: `inlineTextStyle` → CSS-Properties
- [ ] Unit-Test: `backgroundColor="/Theme Color/X"` → korrekte Farbe
- [ ] Unit-Test: Komponenten-Rekursion
- [ ] Unit-Test: Responsive Variants
- [ ] Alle 128 existierenden Tests müssen weiterhin grün sein

---

## PHASE 5: BUILD-QUALITÄT & VISUAL QA (Tag 7-8)

**Ziel:** Automatische Qualitätssicherung nach jedem Build.
**Aufwand:** ~2 Tage

### 5.1 Pre-Build-Validation

```javascript
// Neuer Wizard-Schritt VOR elementor-set-content

await runStep('Pre-Build-Validation', async () => {
  const result = await runScript('framer-pre-build-validate.js', [
    '--tree', v4TreePath,
    '--token-map', tokenMapPath,
    '--min-score', '85',
  ]);
  
  if (result.score < 85) {
    log.error(`Validation score ${result.score}% < 85% — Build ABGEBROCHEN.`);
    log.error(`Fehler: ${result.errors.join(', ')}`);
    throw new Error('Pre-build validation failed');
  }
  
  log.success(`Pre-build validation: ${result.score}% (${result.errors.length} errors)`);
});
```

### 5.2 Screenshot-Vergleich (Visual QA)

```javascript
// Neuer Wizard-Schritt NACH elementor-set-content

await runStep('Visual QA', async () => {
  // 1. Screenshot der Framer-Seite
  const framerScreenshot = await takeScreenshot(framerUrl, { selector: 'hero' });
  
  // 2. Screenshot der gebauten Elementor-Seite
  const elementorUrl = `https://test4.nick-webdesign.de/?page_id=${postId}`;
  const elementorScreenshot = await takeScreenshot(elementorUrl, { selector: 'hero' });
  
  // 3. Pixel-Differenz berechnen
  const diff = await runScript('visual-qa.js', [
    '--reference', framerScreenshot,
    '--candidate', elementorScreenshot,
    '--threshold', '0.05',  // 5% Abweichung toleriert
    '--output', 'qa-report.json',
  ]);
  
  if (diff.score < 90) {
    log.warn(`Visual QA: ${diff.score}% Übereinstimmung — Nachbesserung nötig`);
    // 4. Automatische Patches vorschlagen
    const patches = diff.suggestions.map(s => ({
      element_id: s.elementId,
      style_id: s.styleId,
      props: s.correctedProps,
    }));
    log.info(`${patches.length} Patch-Vorschläge generiert.`);
  }
});
```

### 5.3 Post-Build Auto-Fix

```javascript
// Bestehendes post-build-auto-fix.js integrieren
// + Neue Fähigkeit: Pixel-Diff → Patch-Vorschläge

await runStep('Auto-Fix', async () => {
  await runScript('post-build-auto-fix.js', [
    '--post-id', postId,
    '--qa-report', 'qa-report.json',
    '--auto-apply',  // ← Automatisch anwenden!
  ]);
});
```

---

## PHASE 6: WIZARD-INTEGRATION & E2E-TEST (Tag 8-10)

**Ziel:** Alles im Wizard zusammenführen und mit einem kompletten E2E-Test validieren.
**Aufwand:** ~3 Tage

### 6.1 Neuer Wizard-Workflow

```
Schritt 1:  FramerExport                    (bestehend, gecached)
Schritt 1.5: CSS-Token-Extraktion           (NEU — Phase 2)
Schritt 1.6: Browser-Crawl-Fallback          (NEU — Phase 2, Fallback)
Schritt 2:  Unframer MCP getProjectXml       (NEU — bisher nur XML-Datei)
Schritt 2.5: Unframer MCP getNodeXml(hero)   (NEU — gezielt Hero holen)
Schritt 3:  Cross-Validate Sources           (bestehend, jetzt MIT CSS-Daten)
Schritt 4:  Token-Mapping validieren         (NEU — validate-token-mapping.js)
Schritt 5:  Design System aufbauen           (NEU — Phase 3)
Schritt 5.5: resolve-fonts.js                (bestehend, jetzt AKTIV)
Schritt 6:  convert-xml-to-v4.js             (bestehend, jetzt MIT Tokens)
Schritt 7:  generate-global-classes.js       (bestehend, jetzt AKTIV)
Schritt 8:  framer-pre-build-validate.js     (NEU — 85% Gate)
Schritt 9:  elementor-set-content            (bestehend)
Schritt 10: Visual QA (Screenshot-Vergleich) (NEU — Phase 5)
Schritt 11: post-build-auto-fix.js           (bestehend, jetzt AKTIV)
```

### 6.2 Non-Interactive Mode

```bash
# Kompletter automatisierter Durchlauf:
node wizard.js --non-interactive \
  --url https://hilarious-workshops-284047.framer.app/ \
  --target https://test4.nick-webdesign.de \
  --post-id 0 \
  --section hero \
  --design-system auto \
  --auto-fix
```

### 6.3 E2E-Test

```javascript
// tests/e2e.test.js: NEUER Test
test('E2E: Kompletter Dual-Source Build mit visuellem Vergleich', async () => {
  // 1. FramerExport ausführen
  const exportDir = await runFramerExport(FRAMER_URL);
  
  // 2. CSS-Tokens extrahieren
  const tokenMap = await runScript('extract-framer-css-tokens.js', ...);
  assert.ok(tokenMap.colors, 'Farb-Tokens extrahiert');
  assert.ok(tokenMap.textStyles, 'Text-Style-Tokens extrahiert');
  
  // 3. Unframer XML holen
  const xml = await fetchUnframerNode(HERO_NODE_ID);
  assert.ok(xml.includes('HeroSection'), 'Hero-XML enthält HeroSection');
  
  // 4. Zu V4 konvertieren MIT Tokens
  const v4Tree = await runScript('convert-xml-to-v4.js', [
    '--xml-string', xml,
    '--tokens', tokenMapPath,
  ]);
  
  // 5. Validieren
  const validation = validateV4Tree(v4Tree);
  assert.ok(validation.passed, 'V4-Tree-Validierung bestanden');
  
  // 6. Design System aufbauen
  const ds = await setupDesignSystem(tokenMap);
  assert.ok(ds.variables.length > 0, 'Variables erstellt');
  assert.ok(ds.classes.length > 0, 'Global Classes erstellt');
  
  // 7. Auf Test-Seite deployen
  const result = await deployToWordpress(v4Tree, POST_ID);
  assert.ok(result.success, 'Deployment erfolgreich');
  
  // 8. Visuell vergleichen
  const diff = await visualQA(FRAMER_URL, WORDPRESS_URL);
  assert.ok(diff.score >= 85, `Visual QA Score ${diff.score}% >= 85%`);
});
```

---

## ZEITPLAN

| Phase | Beschreibung | Aufwand | Abhängigkeiten |
|-------|-------------|---------|----------------|
| **Research** | 3-4 kritische Fragen recherchieren | 0.5 Tage | - |
| **Phase 1** | Quick-Wins & Skills kopieren | 1 Tag | Research abgeschlossen |
| **Phase 2** | Dual-Source CSS-Extraktion | 2 Tage | Phase 1 |
| **Phase 3** | Design-System-Automatisierung | 2 Tage | Phase 2 |
| **Phase 4** | convert-xml-to-v4.js Umbau | 3 Tage | Phase 2+3 |
| **Phase 5** | Build-Qualität & Visual QA | 2 Tage | Phase 4 |
| **Phase 6** | Wizard-Integration & E2E-Test | 3 Tage | Phase 4+5 |
| **GESAMT** | | **~2 Wochen** | |

---

## ERFOLGSKRITERIEN

Nach Abschluss aller Phasen muss die Pipeline:

1. ✅ **Hintergrundfarben** korrekt aus FramerExport extrahieren und setzen
2. ✅ **Typografie** (Font-Family, Größe, Gewicht, Farbe) aus CSS-Tokens auflösen
3. ✅ **Buttons** mit korrektem Styling (Background, Border-Radius, Padding) rendern
4. ✅ **Global Variables** automatisch aus Token-Mapping erstellen
5. ✅ **Global Classes** automatisch generieren und referenzieren
6. ✅ **Responsive Breakpoints** als Variants in den Tree einweben
7. ✅ **Komponenten** (PrimaryButton, Feature) aus Unframer auflösen
8. ✅ **Visual QA** nach jedem Build mit ≥85% Score

---

## RISIKEN & FALLBACKS

| Risiko | Eintrittswahr. | Fallback |
|--------|---------------|----------|
| FramerExport liefert keine CSS-Dateien | Mittel | Browser-Crawl als Fallback (2.3) |
| Unframer MCP ändert API | Niedrig | Caching + Version-Pinning |
| Elementor V4 Style-Schema ändert sich | Mittel | `elementor-get-style-schema` vor Build abrufen |
| Google Fonts nicht verfügbar | Niedrig | Lokale Fonts via FramerExport |
| Komponenten-Rekursion zu tief/timeout | Mittel | Max-Rekursionstiefe (3) + Timeout (30s) |
| Pixel-Diff zu sensitiv | Hoch | Schwellwert konfigurierbar (default 5%) |
