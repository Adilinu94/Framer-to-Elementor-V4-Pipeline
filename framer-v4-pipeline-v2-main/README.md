# Framer → Elementor V4 Pipeline V2

Standalone-Pipeline zur Konvertierung von **Framer-Websites** in **Elementor V4 Atomic Widget-Trees** für WordPress. Basiert auf einer 3-Wege-Symbiose: Unframer MCP (live Struktur) + FramerExport CLI (Assets/CSS) + Novamira MCP (WordPress Build).

## Voraussetzungen

- Node.js ≥ 18
- Unframer MCP (`getNodeXml` in Tool-Liste)
- Novamira MCP (WordPress-Seite mit Elementor V4)
- FramerExport CLI

## Schnellstart

```bash
node wizard.js          # Interaktiver CLI-Wizard (empfohlen)
npm test                # 33 Unit-Tests
npm run test:e2e        # 12 E2E-Tests
```

## Pipeline-Phasen

| Phase | Beschreibung | Befehl |
|-------|-------------|--------|
| 0 | MCP-Check | Wizard |
| 1 | FramerExport — HTML/CSS/Assets lokal spiegeln | Wizard |
| 2 | Token-Extraktion | `npm run token-extract` |
| 3 | Variables in WordPress anlegen | `adrians-batch-create-variables` |
| 4 | Konvertierung + GC + Media | `convert` → `auto-scale` → `gc-generate` → `patch-media` |
| 5 | Validierung (Score ≥ 85%) | `npm run validate` + `npm run schema-validate` |
| 6 | Cross-Validation | `npm run cross-validate` |
| 7 | WordPress Build | `elementor-set-content` (Array!) |
| 8 | Post-Build QA | `npm run check-binding` + 4× Novamira MCP Audits |

## npm-Scripts

```bash
# Tests
npm test                  # 33 Unit-Tests (framer-utils, converter, guards…)
npm run test:e2e          # 12 E2E-Tests (kompletter Pipeline-Durchlauf)
npm run test:all          # beides

# Pipeline (Skill-konforme Kurzformen)
npm run token-extract     # design-token-extractor.js → tokens/token-mapping.json + variables-plan.json
npm run validate          # framer-pre-build-validate.js → 12 Guards, Score ≥ 85%
npm run schema-validate   # validate-v4-tree.js → 5 Checks inkl. $$type-Korrektheit
npm run check-binding     # verify-build-binding.js → Invariant I Post-Build-Check
npm run gc-generate       # generate-global-classes.js → tokens/gc-plan.json
npm run cross-validate    # cross-validate-sources.js → 7 Checks (inkl. GV_ID_DRIFT)
npm run convert           # convert-xml-to-v4.js → v4-tree.json
npm run auto-scale        # auto-scale-responsive.js → tablet/mobile Varianten
npm run patch-media       # patch-v4-tree-media-ids.js → Invariant IV
npm run asset-queue       # asset-to-wp-media.js → WP Media Upload-Queue
npm run dependency-graph  # build-dependency-graph.js → Build-Reihenfolge (Kahn)
npm run export-mcp-plan   # export-mcp-xml.js → getNodeXml-Plan
npm run visual-qa         # visual-qa.js → Browser-Screenshots (Playwright/Puppeteer/dry-run)
```

## Workflow (vollständig)

```bash
# Phase 2 — Token-Extraktion
npm run token-extract -- \
  --html FramerExport/index.html \
  --design-system design-system-export.json \  # ← Löst e-gv-* IDs automatisch auf
  --output tokens/token-mapping.json \
  --variables-plan tokens/variables-plan.json

# Phase 3 — Variables in WP anlegen
# → variables-plan.json → mcpCall ausführen: novamira/adrians-batch-create-variables { variables, strategy: "skip" }
# → novamira/adrians-export-design-system { what: "all" } → design-system-export.json
# → npm run token-extract -- ... --design-system design-system-export.json (GV-IDs eintragen)

# Phase 4 — Konvertierung
npm run convert -- --xml framer-nodes.xml --output v4-tree.json
npm run auto-scale -- v4-tree.json v4-tree-scaled.json
npm run gc-generate -- --tree v4-tree-scaled.json --variables tokens/token-mapping.json --output tokens/gc-plan.json
npm run patch-media -- v4-tree-scaled.json tokens/image-map.json v4-tree-patched.json

# Phase 5 — Validierung
npm run validate -- --tree v4-tree-patched.json --output reports/pre-build-report.json
npm run schema-validate -- v4-tree-patched.json

# Phase 6 — Cross-Validation
npm run cross-validate -- \
  --mcp-json tokens/mcp-tokens.json \
  --export-dir FramerExport/ \
  --token-mapping tokens/token-mapping.json \  # ← für GV_ID_DRIFT Check 7
  --design-system design-system-export.json

# Phase 7 — Build
# novamira/adrians-setup-v4-foundation { post_id }
# novamira/elementor-set-content { post_id, content: [ARRAY!] }

# Phase 8 — Post-Build QA
npm run check-binding -- elementor-dump.json          # Invariant I
# novamira/adrians-layout-audit { post_id }            # ⭐ NEU: Nesting, Pass-through, Grid-Kandidaten
# novamira/adrians-visual-qa { post_id }               # overflow, z-index
# novamira/adrians-responsive-audit { post_id }        # Breakpoint-Coverage
# novamira/adrians-class-audit { scope: "post_ids", post_ids: [ID] } # unused GCs
# novamira/adrians-variable-audit { report: "drift" }  # ⭐ NEU: e-gv-* Drift-Check (Fix 5 ✓)
npm run visual-qa -- --post-id <ID> --wp-url <URL> --dry-run

# Batch-Zugriff auf mehrere Posts (Fix 4 ✓):
# novamira/adrians-batch-get-content { post_ids: [ID1, ID2, ...], mode: "skeleton" }
```

## Artefakt-Dateinamen

```
framer-nodes.xml              ← Unframer getNodeXml Output
FramerExport/                 ← Lokaler HTML/CSS/Asset-Export
design-system-export.json     ← adrians-export-design-system (LIVE, nie cachen!)
tokens/token-mapping.json     ← CSS-Tokens → e-gv-* IDs
tokens/variables-plan.json    ← MCP-Calls für adrians-batch-create-variables
tokens/image-map.json         ← Framer-URL → WP Media ID
tokens/gc-plan.json           ← GC-Vorschläge + post_build_steps
v4-tree.json                  ← convert-xml-to-v4 Output
v4-tree-scaled.json           ← auto-scale-responsive Output
v4-tree-patched.json          ← patch-v4-tree-media-ids Output (Build-Input!)
reports/pre-build-report.json ← framer-pre-build-validate Output
elementor-dump.json           ← elementor-get-content Output (Post-Build QA)
build-manifest.json           ← Wizard Summary mit allen Pfaden
```

## Kritische Invarianten

| # | Regel |
|---|-------|
| I | Jede ID in `element.styles` MUSS in `settings.classes.value` existieren |
| II | Visuelle Props (color, padding…) NIEMALS in `settings` — nur in `styles` |
| III | Style-IDs: nur `[a-z][a-z0-9_]*` — KEINE Bindestriche (`shero` nicht `s-hero`) |
| IV | Wenn `image-src.value.id` gesetzt: `url`-Key darf NICHT existieren (nie `url: null`) |
| V | `custom_css`: immer `{"raw": "..."}` — nie plain String |
| API | `elementor-set-content.content` = **Array**, nie einzelnes Objekt |
| API | `adrians-batch-create-variables`: Parameter heißt `strategy`, NICHT `conflict_resolution` |
| ADAPTER | `mcp-adapter-execute-ability`: Parameter heißt **`ability_name`** (nicht `ability`, nicht `abilityName`) — betrifft solar.local und alle Adapter-Instanzen |
| ADAPTER | Signatur: `{ ability_name: string, parameters: object }` — beide Felder required |
| ELEMENT_ID | `adrians-add-element` akzeptiert jetzt `element_id` (kebab-case) → wird `data-id` + CSS-Klasse `s-<id>` auf Server. `uniqueWidgetId()` Output direkt verwenden — macht `adrians-patch-element-styles` danach präziser |
| BATCH_GET | `adrians-batch-get-content` ersetzt N×`elementor-get-content` Calls. Max 50 Posts, Modi: skeleton/settings/full. Fix 4 damit **obsolet** |
| VAR_AUDIT | `adrians-variable-audit` scannt e-gv-* Drift Site-weit. `report: "drift"` für nur Broken References. Fix 5 damit **obsolet** |

## 12 Guards (framer-pre-build-validate)

| Guard | Beschreibung |
|-------|-------------|
| TOKEN_EXISTENCE | Alle `e-gv-*` IDs in token-mapping.json vorhanden? |
| COLOR_CONSISTENCY | Alle Global-Color-Variable-Referenzen valide? |
| FONT_RESOLUTION | Alle Font-Variablen aufgelöst? |
| BREAKPOINT_CONSISTENCY | Nur `null/tablet/mobile/desktop`? |
| STYLE_CLASSES_BINDING | Style-ID in `settings.classes.value`? **(Invariant I)** |
| NO_HARDCODED_HEX | Keine rohen `#rrggbb` in Props? |
| NO_PLAIN_STRINGS | Keine unwrapped `e-gv-*`? |
| FONT_NAMES_QUOTED | Mehrteilige Font-Namen gequoted? |
| BASE_VARIANT_NULL | Erste Variante `breakpoint: null`? |
| TABLET_VARIANTS | Mobile → Tablet auch vorhanden? |
| BACKGROUND_COLOR_GC | `background.color` via Global Class? |
| IMAGE_SRC_FORMAT | `image-src` hat `id` **oder** `url`, nie beides? **(Invariant IV)** |

Score ≥ 85% → Build OK · Score < 85% → **BLOCKED**

## GC-Workflow (Global Classes)

```
Es gibt KEINE elementor-create-global-class Ability.
GCs entstehen IMPLIZIT wenn der Tree via elementor-set-content geschrieben wird.

1. npm run gc-generate → gc-plan.json  (suggested_classes[])
2. V4 Tree: gc-* Style-IDs eintragen (gc-text-xl, gc-section-main, …)
3. elementor-set-content → GCs automatisch registriert
4. adrians-add-global-class-variant → responsive Varianten (tablet/mobile)
5. adrians-apply-variable-to-class → Design-Token binden
6. adrians-batch-class → GC auf N Elemente gleichzeitig anwenden
```

## Novamira Adrians Extra — neue Abilities (v1.0.0)

| Ability | Wann nutzen |
|---------|-------------|
| `adrians-layout-audit` | **Post-Build pflicht** — erkennt Pass-through-Container, Deep-Nesting >3, Single-Child-Wrapper, Grid-Kandidaten, Kicker-Rows. Serverseitig, kein Script nötig |
| `adrians-html-to-elementor-widget-plan` | Framer-HTML direkt → V4 Widget-Plan analysieren. Potenzielle Alternative zu convert-xml-to-v4.js für HTML-Input (testen!) |
| `adrians-kit-convert-v3-to-v4` | v3 Kit automatisch zu v4 migrieren: Farben → Variablen, Typo → Global Classes, Responsive Variants. 4 Phasen, 1 Call. Ersetzt manuelle Token-Extraktion bei v3-Kits |
| `adrians-add-global-class-variant` | Responsive Breakpoint-Variant auf Global Class hinzufügen (tablet/mobile) ohne Tree-Rebuild |
| `adrians-edit-global-class-variant` | Variant nach Index oder breakpoint+state patchen |
| `adrians-list-class-variants` | Alle Variants einer Global Class mit Breakpoints und Props inspizieren |
| `adrians-apply-variable-to-class` | CSS-Property in Global Class auf v4 Variable binden (`var(--e-global-color-xxx)`) |
| `adrians-page-markdown` | Elementor-Seite als Markdown lesen (YAML frontmatter). Nützlich für Content-Audit und Diff nach Set-Content |
| `adrians-clone-element` | Element + Subtree klonen, IDs regenerieren. Für Component-Bibliothek und Section-Wiederverwendung |
| `adrians-reorder-element` | Element innerhalb/zwischen Parents verschieben |
| `adrians-batch-get-content` | **Fix 4 ✓** — N Posts in einem Call holen (max 50). skeleton/settings/full |
| `adrians-variable-audit` | **Fix 5 ✓** — e-gv-* Drift und unused Variables Site-weit finden |

## Fehlertabelle

| Fehler | Ursache | Fix |
|--------|---------|-----|
| `class_name_contains_spaces` | Hyphen in Style-ID | Style-ID umbenennen (kein `-`) |
| `STYLE_CLASSES_BINDING FAIL` | Style-ID fehlt in `classes.value` | In `settings.classes.value` eintragen |
| Bild lädt nicht | `url: null` in image-src | `url`-Key komplett entfernen |
| Falsche Farben | GV-ID Drift nach Kit-Update | `adrians-export-design-system` → `cross-validate --design-system` |
| `elementor-set-content` Timeout | Tree zu groß | `npm run dependency-graph` → sektionsweise bauen |
| `custom_css` crasht | Plain String | `{"raw": "..."}` Format erzwingen |
| Variables nicht angelegt | Falscher API-Parameter | `strategy: "skip"` (NICHT `conflict_resolution`) |
| GV-IDs `null` nach Phase 3 | Design-System nicht übergeben | `--design-system design-system-export.json` |

## Struktur

```
framer-v4-pipeline-v2/
├── wizard.js                            # Interaktiver CLI-Entry-Point
├── package.json
├── schemas/v4-prop-type-schema.json     # $$type Referenz
├── novamira-skill/                      # WordPress-Skill für den Agenten
│   ├── framer-v4-pipeline.md
│   └── install-skill.js
├── scripts/
│   ├── lib/framer-utils.js              # Shared Utilities
│   ├── design-token-extractor.js        # Phase 2: Tokens → GV-IDs
│   ├── extract-framer-styles.js         # Phase 2: CSS → Farben/Typo/Spacing
│   ├── extract-image-urls.js            # Phase 2: Bilder/Videos/SVGs
│   ├── extract-responsive-breakpoints.js # Phase 2: @media → V4 Varianten
│   ├── resolve-fonts.js                 # Phase 2: Framer-Fonts → woff2/GF
│   ├── convert-xml-to-v4.js             # Phase 4: Framer XML → V4 Tree
│   ├── auto-scale-responsive.js         # Phase 4: Tablet/Mobile Varianten
│   ├── generate-global-classes.js       # Phase 4: GC-Vorschläge
│   ├── patch-v4-tree-media-ids.js       # Phase 4: URL → WP Media ID
│   ├── framer-pre-build-validate.js     # Phase 5: 12 Guards
│   ├── validate-v4-tree.js              # Phase 5: $$type Schema
│   ├── cross-validate-sources.js        # Phase 6: 7 Checks inkl. GV_ID_DRIFT
│   ├── verify-build-binding.js          # Phase 8: Invariant I Post-Build
│   ├── visual-qa.js                     # Phase 8: Browser-Screenshots
│   ├── asset-to-wp-media.js             # Asset Upload-Queue
│   ├── build-dependency-graph.js        # Kahn-Algorithmus Build-Reihenfolge
│   └── export-mcp-xml.js                # getNodeXml Plan-Generator
└── tests/
    ├── pipeline.test.js                 # 33 Unit-Tests
    └── e2e.test.js                      # 12 E2E-Tests
```

## Changelog

### v0.3.2 — Scalar Hero-Test Fixes (2026-06-06)

**convert-xml-to-v4.js — 5 Bugs gefixt:**

| Bug | Problem | Fix |
|-----|---------|-----|
| 1 | Text-Content verloren — `value: "true"` statt echtem Text | Tokenizer emittiert jetzt `text`-Tokens zwischen Tags; `buildTree` akkumuliert `_textContent`; `convertNode` nutzt Attribut-Text **oder** Child-Text |
| 3 | 12-fache Container-Verschachtelung | `isPassThroughContainer()`: Single-Child-Frames ohne Layout-Props werden geflattened (Kinder direkt hochgezogen) |
| 4 | Novamira Adapter-Parameter falsch | Dokumentiert: Parameter heißt `ability_name` (nicht `ability`/`abilityName`) — betrifft solar.local / alle Adapter-Instanzen |
| 5 | Duplicate Widget-IDs (`node-7` 5×) | `uniqueWidgetId()` mit Counter — analog zu `uniqueStyleId()` |
| 6 | SVG-Circles → `e-flexbox` statt `e-svg` | `determineWidgetType` erkennt SVG-Tags/Attribute; `serializeSvgNode()` serialisiert Sub-Tree zurück zu Markup |

**Alle 33 Unit-Tests weiterhin grün.**
