# Changelog — framer-v4-pipeline-v2

## [v0.7.0] — 2026-06-12

### Added
- `html-to-widget-plan.js`: Brücke zu `novamira/adrians-html-to-elementor-widget-plan` mit `--execute` (McpBridge) + Plan-Fallback + Wizard-Integration
- `widget-plan` + `widget-plan-execute` npm-Scripts
- `lint:version` Script: checkt `package.json` Version gegen `CHANGELOG.md`
- `.env.example`: 16 Variablen (Workspace, MCP, Validation, Performance)
- `wizard.js preflight` Subcommand: 8 Checks, farbige ✓/✗-Tabelle, `--format=json`
- `wizard.js dry-run` Subcommand: Build-Plan ohne Schreibzugriff
- `wizard.js preview` Subcommand: Preview-Page via McpBridge (get→create→set)
- `wizard.js promote` Subcommand: Backup + Content-Transfer auf Live-Seite
- `wizard.js` interaktive Error Recovery: [R]etry/[S]kip/[F]ix/[A]bort + `runWithRecovery()`
- `wizard.js serve` Subcommand: HTTP-API (`GET /health`, `POST /build`, `GET /builds/:id`)
- `scripts/parallel-pre-build.js`: `Promise.allSettled` für 5 parallele Sub-Steps
- `scripts/lib/mcp-cache.js`: MCP-Discovery-Cache mit TTL + atomic write
- `tests/mcp-mock-server.js`: Lokaler Mock mit 15 Ability-Responses
- `.github/workflows/ci.yml`: 7 CI-Jobs (test, e2e, schema, mcp-mock, visual, lint, syntax)

### V2-Plugin (novamira-adrianv2)
- `class-execute-build-plan.php`: Mega-Ability — 18+ Agent-Turns → 1 Turn
- `class-build-versioning.php`: CPT `elementor_build` mit Meta-Boxes
- `class-v4-color-contrast-22.php`: WCAG 2.2 — Target Size + Focus Appearance
- `resolve_background_color()`: Öffentliche A11y-Methode mit Parent-Chain-Walking + `inconclusive` Flag
- `fix-color-contrast` preview-Mode: HTML Side-by-Side Diff + Backward-Compat `proposed` Feld

### Changed
- **Versionsdrift behoben**: `package.json` → `0.7.0`, alle Doku-Stamps synchronisiert
- `wizard.js`: Preflight + Dry-Run + Serve Subcommands integriert
- `bootstrap.php` (main): `class-build-versioning.php` + `class-v4-color-contrast-22.php` geladen
- `bootstrap.php` (elementor): `class-execute-build-plan.php` in Dateiliste + Auto-Registration
- `BLUEPRINT.md`, `INTEGRATION-PLAN.md`, `SESSION-STATE.md`: auf v0.7.0 synchronisiert

### Infrastructure
- GSD-Projekt initialisiert (`.planning/`) — 20 Pläne, 7 Phasen, 100% completed
- Altes Plugin-Projekt archiviert (`.planning-novamira-plugin/`)
- `CHANGELOG.md` als Release-Historie

## [v0.6.0] — 2026-06-11

### Added
- **Integration Fixes A-H** (INTEGRATION-PLAN.md vollständig umgesetzt):
  - **Fix A**: `mcp-bridge.js` — JSON-RPC 2.0 Protokoll + Session-Handshake (`--self-test`)
  - **Fix B**: `asset-to-wp-media.js` — `--execute` Batch-Upload via McpBridge
  - **Fix D**: `check-v4-requirements.js` — `--auto-call` via McpBridge + `wizard.js` 3-stufiger Fallback
  - **Fix E**: `generate-global-classes.js` — `--execute` direkte GC-Erstellung + Tree-Rückschreibung
  - **Fix G**: `novamira-skill/framer-v4-pipeline.md` — Cache-Regel-Doku + npm-Shortcuts
  - **Fix H**: `mcp-bridge.js` — WP REST Fallback für 12 Endpoints
- npm-Scripts: `gc-execute`, `asset-upload`, `check-v4-auto`, `test:bridge`, `widget-plan`, `widget-plan-execute`
- `schemas/v4-prop-type-schema.json` Fixture für E2E-Tests
- `.mcp.json` Konfigurationsdatei für solar.local

### Fixed
- **Windows ESM Bug** (`ERR_UNSUPPORTED_ESM_URL_SCHEME`): `pipeline.test.js` nutzt `pathToFileURL()`
- **E2E-10 Check-Count**: 6→7 (A1 a11y hinzugekommen)
- `.gitignore`: `.mcp.json` hinzugefügt

### Tested
- MCP-Bridge `--self-test` + `check-v4 --auto-call` live gegen solar.local ✅
- `npm run test:all` → 56/56 ✅ | `npm run test:integration` → 4/4 ✅
