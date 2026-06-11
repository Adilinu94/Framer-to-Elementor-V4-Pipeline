# Session State — 2026-06-11 (v0.7.0)

> **Zweck:** Wissensspeicher fuer nahtlose Wiederaufnahme der Arbeit.
> Bei jedem neuen Session-Start diese Datei lesen!

---

## 🆕 v0.7.0 — Integration Fixes A-H + ALLE 20 GSD-Pläne (2026-06-12)

**Architektur-Change:** McpBridge ist KEIN Stub mehr — direkte JSON-RPC 2.0 HTTP-Calls
von Node.js nach solar.local. Alle Scripts mit `--execute` rufen Abilities live auf.

### Komplett umgesetzt (Pipeline)
- **Fix A+H:** `mcp-bridge.js` — JSON-RPC 2.0 + Session-Handshake + REST-Fallback (12 Endpoints)
- **Fix B:** `asset-to-wp-media.js` — `--execute` Batch-Upload via McpBridge
- **Fix D:** `check-v4-requirements.js` — `--auto-call` + wizard.js 3-stufiger Fallback
- **Fix E:** `generate-global-classes.js` — `--execute` direkte GC-Erstellung + Tree-Rückschreibung
- **Fix G:** `novamira-skill/framer-v4-pipeline.md` — Cache-Regel + npm-Shortcuts
- **html-to-widget-plan.js** — Brücke zu `adrians-html-to-elementor-widget-plan`
- **wizard.js preflight** — 8 Checks (.env, HTTP, MCP, Schema, Disk, Config)
- **wizard.js dry-run** — Build-Plan ohne Schreibzugriff
- **wizard.js serve** — HTTP-API (GET /health, POST /build, GET /builds/:id)
- **parallel-pre-build.js** — Promise.allSettled für 5 Sub-Steps
- **mcp-cache.js** — Discovery-Cache mit TTL + atomic write
- **mcp-mock-server.js** — Lokaler Mock (15 Ability-Responses)
- **.github/workflows/ci.yml** — 7 CI-Jobs

### Komplett umgesetzt (V2-Plugin)
- **class-execute-build-plan.php** — Mega-Ability (1 MCP-Call statt 18+ Agent-Turns)
- **class-build-versioning.php** — CPT elementor_build mit Meta-Boxes
- **class-v4-color-contrast-22.php** — WCAG 2.2 Target Size + Focus Appearance
- **Bootstrap-Integration** — Alle 3 Dateien korrekt eingebunden

### GSD-Projekt
- `.planning/` mit PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md
- 20 Pläne über 7 Phasen → **100% COMPLETED**
- Altes Plugin-Projekt archiviert (`.planning-novamira-plugin/`)

### Live getestet gegen solar.local
- ✅ `npm run test:bridge` — Session + Cache (721ms→0ms)
- ✅ `npm run check-v4-auto` — `atomic.runtime_available: true`
- ✅ `npm run lint:version` — v0.7.0 OK

### Tests
- ✅ `npm run test:all` → 56/56 (44 pipeline + 12 e2e)
- ✅ `npm run test:integration` → 4/4

---

## ⚠️  Veralteter Inhalt unter dieser Linie (v0.6.0 Historie)

Die folgenden Sektionen dokumentieren den Zustand VOR den Integration Fixes A-H.
Architektur-Entscheidung (McpBridge=Stub) ist nicht mehr aktuell.

**Kurzfassung v0.6.0:**
- McpBridge war ein Stub (kein HTTP). Direkte MCP-Calls nur via Claude novamira-solar-local Connector.
- Scripts generierten JSON-Pläne → Agent führte MCP-Calls manuell aus.
- 42 Unit-Tests + 12 E2E-Tests (jetzt 56).
- Fixes A-F: mcp-bridge Stub, asset-to-wp-media upload-plan, split-large-tree merge, check-v4 auto-call, gc-plan.json, run-post-build-qa Report.

**Details:** Siehe `CHANGELOG.md` v0.6.0 Eintrag.

### Zwei Repositories arbeiten zusammen:
1. **framer-v4-pipeline-v2** (`C:\Users\adini\Local Sites\solar\framer-v4-pipeline-v2`)
   - Node.js CLI-Tool (ESM, zero dependencies)
   - Konvertiert Framer-Websites in Elementor V4 Widget-Trees
   - GitHub: `https://github.com/Adilinu94/framer-v4-pipeline-v2`
   - Aktuelle Version: **v0.7.0**

2. **Novamira WordPress Plugin** (`app/public/wp-content/plugins/novamira-adrians/`)
   - WordPress Plugin mit MCP-Abilities
   - ALLE Calls gehen direkt ueber den Claude novamira-solar-local MCP Connector

### 3-Wege-Symbiose:
```
Unframer MCP (Live Framer-URL) -> framer-v4-pipeline (JSON-Artefakte) -> Novamira MCP (WordPress Build)
```

---

## ARCHITEKTUR-ENTSCHEIDUNG (v0.6.0, unveraenderlich)

Alle Novamira-Abilities laufen DIREKT ueber den Claude-Agenten:
```
Tool: novamira-solar-local:mcp-adapter-execute-ability
Format: { ability_name: "novamira/<ability>", parameters: { ... } }
```
- Kein .mcp.json noetig
- Keine env vars noetig
- Kein HTTP aus Node.js zu solar.local
- McpBridge.js ist ein Stub (Interface bleibt, call() wirft sprechenden Fehler)
- Node.js-Scripts generieren JSON-Plaene -> Agent fuehrt MCP-Calls aus

---

## Abgeschlossene Fixes (v0.6.0)

### Fix A: mcp-bridge.js -> Stub (v3.0.0)
- 540 Zeilen HTTP-Code entfernt, Interface bleibt erhalten
- call() wirft sprechenden Fehler mit Anweisung an den Agent
- test:bridge: exit 0, gibt Architektur-Anweisung aus (kein HTTP)
- Smoke-Test via echter MCP Connector: adrians-greet + elementor-check-setup OK

### Fix B: asset-to-wp-media.js --execute -> Upload-Plan Generator
- Generiert upload-plan.json mit base64-Dateien in Batches (max 30)
- Agent ruft adrians-batch-media-upload pro Batch direkt auf
- NEU: --apply-results upload-results.json -> image-map.json schreiben
- workflow: --execute -> Agent -> --apply-results

### Fix C: split-large-tree.js -- In-Memory Merge (unveraendert aus v0.5.0)
- buildSectionWise(): Merge im Speicher -> 1x elementor-set-content
- Kein get-content pro Section mehr

### Fix D: check-v4-requirements.js + wizard.js -> MCP Connector Architektur
- --auto-call: gibt Agent-Instruction aus (exit 0) statt McpBridge-HTTP
- --stdin: validiert echte elementor-check-setup Antwort (alle 6 Checks)
- wizard.js: .mcp.json-Check und McpBridge-Import entfernt
- wizard.js: Phase 0 zeigt novamira-solar-local Connector Anweisung
- findWorkspaceRoot(): nutzt FramerExport/build-manifest.json statt .mcp.json

### Fix E: generate-global-classes.js --execute -> MCP-Plan Generator
- execute-php Hack durch elementor-create-global-class ersetzt (sauberer!)
- Generiert gc-plan.json mit steps[] fuer Agent (create + variants + bindings)
- NEU: --apply-results gc-results.json -> GC-IDs in Tree schreiben
- workflow: --execute -> gc-plan.json -> Agent -> gc-results.json -> --apply-results

### Fix F: run-post-build-qa.js -> Report Generator aus Agent-Daten
- McpBridge-Import entfernt (kein MCP-Call aus Node.js)
- --qa-results <datei> oder --stdin: liest Agent-gesammelte QA-Ergebnisse
- Ohne Input: gibt Agent-Instruktion fuer alle 5 QA-Abilities aus
- adrians-page-audit NEU integriert (vorher fehlend)
- deduplicate-visual-qa.js: CLI-Guard ergaenzt (importierbar als Modul)
- Getestet mit echten MCP-Daten von solar.local (Post 4874, FAQ-Seite)

### Skill Update: framer-to-elementor-v4 -> v0.6.0 (in Novamira gespeichert)
- MCP Connector Architektur dokumentiert
- Alle Workflows auf Agent-direkte-Calls umgestellt
- Neue workflow-Schritte: gc-plan.json, upload-plan.json, qa-results.json

---

## Teststatus (v0.6.0)

| Test-Suite | Status | Details |
|---|---|---|
| `npm test` (42 Unit) | 42/42 | Alle bestanden |
| `npm run test:e2e` (12 E2E) | 12/12 | Alle bestanden |
| `npm run test:bridge` | exit 0 | Kein HTTP noetig, MCP Connector |
| Smoke-Test via MCP | OK | elementor-check-setup, layout-audit, visual-qa, variable-audit |

---

## Datei-Uebersicht (v0.6.0 Aenderungen)

```
scripts/lib/mcp-bridge.js           # v3.0.0 Stub (kein HTTP, Interface erhalten)
scripts/asset-to-wp-media.js        # --execute -> Upload-Plan, --apply-results NEU
scripts/generate-global-classes.js  # --execute -> gc-plan.json, --apply-results NEU
scripts/run-post-build-qa.js        # Komplett neu: Report Generator aus Agent-Daten
scripts/deduplicate-visual-qa.js    # CLI-Guard ergaenzt (sicherer Import)
scripts/check-v4-requirements.js    # --auto-call -> Agent-Instruction (kein McpBridge)
wizard.js                           # Phase 0/0a/0b komplett neu (MCP Connector)
SESSION-STATE.md                    # UPDATE auf v0.6.0
novamira-skill: framer-to-elementor-v4  # v0.6.0 in WordPress gespeichert
```

---

## Neue Artefakt-Dateinamen (v0.6.0)

```
upload-plan.json       <- asset-to-wp-media --execute (base64 Batches fuer Agent)
upload-results.json    <- Agent sammelt wp_media_id + url
gc-plan.json           <- generate-global-classes --execute (steps[] fuer Agent)
gc-results.json        <- Agent sammelt GC-IDs { "label": "gc-<id>" }
qa-results.json        <- Agent sammelt alle 5 QA-Ability Ergebnisse
qa-report.json         <- run-post-build-qa Report (aus qa-results.json)
```

---

## Bekannte Issues

1. **test:integration** -- integration.test.js hat REST-Fallback-Pfade auf HTTP-Basis
   -> ignorierbar, Integration laeuft ueber MCP Connector direkt
2. **rollback.js Cleanup** -- Keine automatische Bereinigung alter Backups (>24h)
3. **split-large-tree.js Timeout** -- Kein Fallback wenn merged Tree zu gross fuer 1x set-content
4. **Windows ESM Bug** -- Vorbestehend, nicht durch v0.6.0 verursacht

---

## npm-Scripts Uebersicht (v0.6.0)

```bash
# Tests:
npm test                   # 42 Unit-Tests
npm run test:e2e           # 12 E2E-Tests
npm run test:bridge        # MCP Connector Check (exit 0, keine env vars)

# Pre-Build:
npm run convert            # Framer XML -> V4 Tree
npm run token-extract      # CSS Tokens -> GV-IDs
npm run gc-generate        # GC-Plan generieren (Agent fuehrt aus)
npm run asset-queue        # Upload-Queue ohne base64
npm run auto-scale         # Responsive Varianten injizieren
npm run validate           # 12-Guard Validation (Score >= 85%)
npm run schema-validate    # Invariant I-V Check

# Build (Agent direkt):
# novamira/adrians-setup-v4-foundation { post_id }
# novamira/elementor-set-content { post_id, content }

# Post-Build QA (Agent + Script):
npm run check-binding      # Invariant I slim-check
npm run post-build-qa      # Report aus qa-results.json erstellen
```

---

## Die 5 Invarianten (niemals brechen)

| # | Name | Regel |
|---|------|-------|
| I | Rendering-Gate | Jede ID in element.styles MUSS in settings.classes.value stehen |
| II | No-Settings-Styles | font-size, color, padding etc. NIEMALS in settings |
| III | Style-IDs | Lokale Style-IDs KEINE Hyphens (shero nicht s-hero) |
| IV | Image-Src | Wenn id gesetzt: url-Key komplett weglassen (nie url:null) |
| V | custom_css | Immer {"raw":"..."} Format, nie plain String |

---

## E2E-Test Vorbereitung (bereit fuer neuen Chat)

### Ziel
Hero-Sektion der Framer-Seite https://remarkable-interface-616594.framer.app/
als neue WordPress-Seite auf solar.local anlegen.

### Framer Hero: Was gebaut wird

**Struktur: SectionHero (nodeId: ogzZ6kzo0)**
Layout: horizontal, 2 Spalten, padding 100px, weiss, max-width 1200px

Linke Spalte (Content, max 600px):
- SubHeading (Kicker): "TRUSTED BY 47+ BRANDS WORLDWIDE"
- H1 Text: "Grow your business with proven strategies that convert"
- Paragraph: "We work with personal brands and businesses to create systems that attract the right audience, convert them, and scale revenue consistently."
- CTA Button: "Book a Free Strategy Call" -> https://cal.com/madebycharlie/quick-discovery-call

Rechte Spalte (HeroStats, max 470px) -- 3 Stat-Karten:
- Karte 1: Nia - Content Creator | 3X | Visibility | In 2 weeks
- Karte 2: Ethan - Startup Founder | +40% | Conversion | In 5 weeks
- Karte 3: Chloe - SME Owner | +120% | Revenue | In 7 weeks

**Design-System (aus Framer ColorStyles + TextStyles):**
- Background: #ffffff (White)
- Text Primary: #000000 (Black)
- Text Muted: rgb(118, 118, 118) (Medium Gray)
- Font: "General Sans" (Medium 500 + Regular 400)
- H1: 79px, line-height 1em, letter-spacing -0.04em
- Body Large: 18px, line-height 1.6em

### Ablauf im neuen Chat

1. SESSION-STATE.md + Skill laden (framer-to-elementor-v4)
2. elementor-check-setup -> V4 pruefen
3. npm run convert mit SectionHero XML
4. gc-plan.json generieren -> Agent fuehrt create-global-class aus
5. elementor-set-content auf NEUE Seite (create-post zuerst!)
6. 5x QA-Abilities -> run-post-build-qa

### Novamira: Neue Seite anlegen
```
novamira/create-post {
  title: "Framer E2E Test - Hero",
  status: "draft",
  post_type: "page"
}
-> gibt Post-ID zurueck -> diese fuer alle weiteren Calls nutzen
```

### SectionHero XML (fuer convert-xml-to-v4.js)
Datei: tools/framer-export/hero-section.xml
Inhalt: SectionHero Node aus Framer (ogzZ6kzo0) -- bereits analysiert, alle Props bekannt

### Unframer MCP
URL: https://mcp.unframer.co/mcp?id=e9715ce69cba1208a49d3b86a74b7e876c44f1f002e9ac175befe075c37e4f2b&secret=zk0cxPk87OMhk0xQI6jcoyHOaHzwuxvV
Projekt-Seite: augiA20Il (Homepage)
Hero nodeId: ogzZ6kzo0

### Erwartete Artefakte nach erfolgreichem E2E
- hero-section.xml (Framer Input)
- v4-tree.json (Konvertierungs-Output)
- gc-plan.json (Global Class Plan)
- gc-results.json (GC-IDs vom Agent)
- qa-results.json (5x QA-Ability Ergebnisse)
- qa-report.json (konsolidierter Report)
- Post auf solar.local: status=draft, Elementor V4 content gesetzt
