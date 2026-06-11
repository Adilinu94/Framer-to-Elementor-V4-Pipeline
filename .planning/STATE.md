---
gsd_state_version: 1
project: framer-v4-pipeline-improvement
status: completed
current_phase: null
current_plan: null
phase_progress:
  "0": 3
  "0.5": 2
  "1": 3
  "2": 3
  "3": 3
  "4": 3
  "5.1": 3
phase_plans_completed:
  "0": ["0.1", "0.3", "0.4"]
  "0.5": ["0.5.4", "0.5.5"]
  "1": ["1.2", "1.3", "1.4"]
  "2": ["2.1", "2.2", "2.3"]
  "3": ["3.1", "3.2", "3.3"]
  "4": ["4.1", "4.2", "4.5"]
  "5.1": ["5.1.1", "5.1.2", "5.1.3"]
phase_plans_total:
  "0": 3
  "0.5": 2
  "1": 3
  "2": 3
  "3": 3
  "4": 3
  "5.1": 3
total_plans: 20
completed_plans: 20
created: 2026-06-11
last_activity: 2026-06-12 — ALLE 20 PLÄNE ABGESCHLOSSEN. Projekt COMPLETED.
---

# Project State — Framer V4 Pipeline Verbesserungsprojekt

## Project Reference
- **PROJECT.md** — `.planning/PROJECT.md`
- **REQUIREMENTS.md** — `.planning/REQUIREMENTS.md`
- **ROADMAP.md** — `.planning/ROADMAP.md`
- **External improvement plan** — `../novamira-adrianv2/FRAMER-PIPELINE-IMPROVEMENT-PLAN.md`
- **Audit report** — `../novamira-adrianv2/novamira-improvement-2026-06/report.md`

## Current Position
- **Active Phase:** — (KEINE, Projekt abgeschlossen)
- **Current Plan:** — (KEINER, alle 20 Pläne completed)
- **Status:** ✅ COMPLETED — 100% aller Pläne umgesetzt

## Completed Work (Session 2026-06-11)

### Integration Fixes A-H
Alle 8 INTEGRATION-PLAN.md Fixes umgesetzt + live getestet:

| Fix | Datei | Beschreibung |
|-----|-------|-------------|
| A | `mcp-bridge.js` | JSON-RPC 2.0 + Session-Handshake |
| B | `asset-to-wp-media.js` | `--execute` Batch-Upload via McpBridge |
| D | `check-v4-requirements.js` + `wizard.js` | `--auto-call` + 3-stufiger Fallback |
| E | `generate-global-classes.js` | `--execute` GC-Erstellung + Tree-Rückschreibung |
| G | `framer-v4-pipeline.md` | Cache-Regel + npm-Shortcuts |
| H | `mcp-bridge.js` | WP REST Fallback (12 Endpoints) |

### Zusätzliche Features
- **html-to-widget-plan.js**: Brücke zu `adrians-html-to-elementor-widget-plan` mit `--execute` + Plan-Fallback
- **Wizard-Integration**: Phase B Extraction um Widget-Plan erweitert
- **package.json**: `widget-plan` + `widget-plan-execute` npm-Scripts

### Bugfixes
- Windows ESM: `pathToFileURL()` in `pipeline.test.js`
- Schema-Fixture: `schemas/v4-prop-type-schema.json`
- e2e.test.js: Check-Count 6→7

### Live-Tests (gegen solar.local)
- ✅ MCP-Bridge `--self-test`: JSON-RPC 2.0 + Session + Cache
- ✅ check-v4 `--auto-call`: elementor-check-setup, alle Atomic-Requirements OK

### Test-Suite
- ✅ 56/56 Tests grün (44 pipeline + 12 e2e)
- ✅ 4/4 Integration-Tests grün

## Progress

```
Phase 0:   ██████████ 100%  (3/3 plans)  ✅ FOUNDATION DONE
Phase 0.5: ██████████ 100%  (2/2 plans)  ✅ SECURITY DONE
Phase 1:   ██████████ 100%  (3/3 plans)  ✅ RELIABILITY DONE
Phase 2:   ██████████ 100%  (3/3 plans)  ✅ PERFORMANCE DONE
Phase 3:   ██████████ 100%  (3/3 plans)  ✅ UX & DX DONE
Phase 4:   ██████████ 100%  (3/3 plans)  ✅ ADVANCED DONE
Phase 5.1: ██████████ 100%  (3/3 plans)  ✅ A11Y WCAG 2.2 DONE
─────────────────────────────────
Overall:   ██████████ 100%  (20/20 plans) ✅ PROJEKT ABGESCHLOSSEN
```

### Plan 0.1 — Versionsdrift ✅ (2026-06-11)
- ✅ `package.json` → `"0.7.0"` + `lint:version` Script
- ✅ `CHANGELOG.md` angelegt (v0.6.0 + v0.7.0)
- ✅ Alle Doku-Stamps synchronisiert

### Plan 0.3 — .env.example ✅ (2026-06-11)
- ✅ 16 Variablen dokumentiert (Workspace, WP/MCP, Validation, Performance)
- ✅ Alle mit Default-Werten, sensitive leer

### Plan 0.4 — wizard.js preflight ✅ (2026-06-11)
- ✅ 8 Checks: .env, FramerExport, WP_API_URL HTTP, MCP Discovery, V2-Plugin, Schema, Disk, Config
- ✅ Farbige ✓/✗-Tabelle, Exit-Code 0/1, `--format=json`
- ✅ Greet-Fallback auf check-setup

### Plan 0.5.4 — XSS custom-js ✅ (bereits implementiert)
- ✅ `guard_js()` + `guard_css()` mit `unfiltered_html`-Gate
- ✅ `DANGEROUS_JS_PATTERNS` (13 Patterns) + `DANGEROUS_CSS_PATTERNS` (4 Patterns)

### Plan 0.5.5 — SAST psalm.xml ✅ (bereits implementiert)
- ✅ `psalm.xml` mit taint-analysis, safe/sink functions, WordPress issue handlers
- ✅ Error level 4, `novamira-adrianv2/includes/` erfasst

### Plan 1.2 — Retry-Logik ✅ (bereits implementiert)
- ✅ `mcp-client.js` mit Exponential-Backoff + Jitter
- ✅ `mcp-bridge.js` Retry-Loop in `call()`

### Plan 1.3 — Error-Katalog ✅ (bereits implementiert)
- ✅ 12 Guards in `framer-pre-build-validate.js` mit strukturiertem Output

### Plan 1.4 — CI-Binding ✅ (2026-06-12)
- ✅ `.github/workflows/ci.yml` mit 7 Jobs (test, test-e2e, test-schema, test-mcp-mock, test-visual, lint, syntax)
- ✅ `tests/mcp-mock-server.js` — lokaler Mock mit 15 Ability-Responses

### Plan 2.1 — Batched MCP-Calls ✅ (2026-06-12)
- ✅ `class-execute-build-plan.php` — Mega-Ability, 18+ Agent-Turns → 1 Turn
- ✅ JSON Input-Validation + `json_last_error()` Fehlerbehandlung

### Plan 2.2 — Parallel-Phase-Execution ✅ (2026-06-12)
- ✅ `scripts/parallel-pre-build.js` — `Promise.allSettled` für 5 Sub-Steps
- ✅ `npm run parallel` Script

### Plan 2.3 — MCP-Discovery-Cache ✅ (2026-06-12)
- ✅ `scripts/lib/mcp-cache.js` — TTL-Cache mit `PIPELINE_DISCOVERY_CACHE_TTL`
- ✅ Atomic write, Cache-HIT/MISS Logging

### Plan 3.1 — Dry-Run-Mode ✅ (2026-06-12)
- ✅ `wizard.js dry-run` Subcommand — generiert Build-Plan ohne Schreibzugriff
- ✅ `--dry-run` Flag im interaktiven Modus

### Plan 3.2 — Preview + Promote ✅ (2026-06-12)
- ✅ `wizard.js preview --post-id <ID>` — erstellt Preview-Page via McpBridge (get-content → create-post → set-content + page-settings)
- ✅ `wizard.js promote --preview-id <ID> --target-id <ID>` — Backup + Content-Transfer auf Live-Seite
- ✅ Preview-URL + Promote-Command im Build-Manifest dokumentiert

### Plan 3.3 — Progress-Bar ✅ (2026-06-12)
- ✅ `promptErrorRecovery(stepName, error)` — interaktiver [R]etry/[S]kip/[F]ix/[A]bort Prompt
- ✅ `runWithRecovery(stepName, fn)` — Wrapper für alle Build-Schritte mit Recovery-Loop
- ✅ Alle 6 Haupt-Schritte (FramerExport, Extraction, Validation, Rollback, Split) mit Recovery

### Plan 4.1 — Pipeline-as-a-Service ✅ (2026-06-12)
- ✅ `wizard.js serve --port=7123` — HTTP-API: `GET /health`, `POST /build`, `GET /builds/:id`

### Plan 4.2 — Build-Versioning ✅ (2026-06-12)
- ✅ `class-build-versioning.php` — CPT `elementor_build` mit Meta-Boxes (Git-Commit, Designer, State)
- ✅ `create_build()` statische Factory-Methode

### Plan 4.5 — Mega-Ability ✅ (2026-06-12)
- ✅ `class-execute-build-plan.php` — `novamira/adrians-execute-build-plan`
- ✅ Foundation + Set-Content + Patch-Styles in einem Call

### Plan 5.1.1 — WCAG 2.2 Color Contrast ✅ (2026-06-12)
- ✅ `class-v4-color-contrast-22.php` — `TARGET_SIZE_MIN`, `FOCUS_APPEARANCE_CONTRAST`
- ✅ `passes_target_size()`, `passes_focus_appearance()`, `contrast_ratio()`

### Plan 5.1.2 — A11y-Audit verbessert ✅ (2026-06-12)
- ✅ `resolve_background_color($elements, $element_id)` — öffentliche statische Methode
- ✅ Parent-Chain-Walking: styles → settings → overlay → parent → top-level default white
- ✅ `inconclusive: true` Flag + `reason` String bei unauflösbarem Hintergrund
- ✅ `find_parent_element()` — rekursive Parent-Suche

### Plan 5.1.3 — Color-Contrast Fix UI-Diff ✅ (2026-06-12)
- ✅ `preview_mode` als Default (wenn `apply` nicht explizit gesetzt)
- ✅ `generate_contrast_preview_html()` — Side-by-Side HTML mit before/after Rendering
- ✅ Diff-Format: `{element_id, background, before:{color,ratio}, after:{color,ratio}}`
- ✅ Backward-Compat: `proposed`-Feld parallel zu `diffs` für bestehende Consumer

## Environment Notes
- **Working dir:** `C:\Users\adini\Desktop\Umbau\`
- **Pipeline:** `framer-v4-pipeline-v2-main/` (Node 18+ ESM)
- **V2-Plugin:** `novamira-adrianv2/` (PHP 8.1)
- **php binary:** `C:/xampp/php/php.exe` (nicht im PATH)
- **Git:** Repo initialisiert in Umbau/, Commit `7f5b21a`
- **solar.local:** WordPress + Elementor Pro + Novamira MCP (109 Abilities)
- **TLS:** Self-signed → `NODE_TLS_REJECT_UNAUTHORIZED=0`
- **MCP Config:** `.mcp.json` vorhanden mit solar.local Credentials
- **Archiviert:** `.planning-novamira-plugin/` (altes Plugin-Projekt, 94% done)

## Known Issues

### BLOCKER A (aus altem Plugin-Projekt, vererbt)
15 von 33 Abilities fehlen auf solar.local im `novamira-extra/` Namespace. Ursache UNBEKANNT — beide Hypothesen (Helper-Requires, Audit-Pfad-Bug) widerlegt. **Betrifft das Plugin-Projekt, nicht die Pipeline.** Kein Blocker für Pipeline-Arbeit.

### Versionsdrift
- `package.json`: `"version": "0.6.0"` (nach unseren Änderungen) → Soll auf `"0.7.0"` für neuen Release-Zyklus
- `SESSION-STATE.md` sagt v0.6.0, `BLUEPRINT.md` sagt v0.8.0, `INTEGRATION-PLAN.md` hat keinen Version-Stamp
- Wird in Plan 0.1 behoben

## Next Action

### Plan 1.4: CI-Binding
- `.github/workflows/ci.yml` mit Jobs: test, test:schema, test:mcp-mock, test:visual
- `tests/mcp-mock-server.js` — lokaler Mock mit 109 Abilities
- Tests laufen auf Ubuntu ohne Live-WP
