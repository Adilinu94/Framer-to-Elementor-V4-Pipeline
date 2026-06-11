# Framer V4 Pipeline V2 — Verbesserungsprojekt

## What This Is
Production-Hardening des `framer-v4-pipeline-v2` Toolkits: Security (XSS, MIME-Spoofing, Path-Traversal), Reliability (Checkpoint-System, Retry-Logik, Error-Katalog), Performance (Batched-Calls, Parallel-Execution), und Developer-Experience (Dry-Run, Preflight, Progress-Bar).

## Core Value
Eine stabile, sichere und schnelle Framer→Elementor V4 Pipeline die direkt mit WordPress via JSON-RPC 2.0 kommuniziert — ohne manuelle Agent-Zwischenschritte für Routine-Operationen.

## Why Now
- **Audit Report** (`novamira-improvement-2026-06/report.md`): 46 Items, 47 Findings — 13 High, 22 Medium, 12 Low
- **Session 2026-06-11**: Integration Fixes A-H komplett umgesetzt (JSON-RPC 2.0, McpBridge, REST-Fallback, GC/Asset-Execution)
- **Tests**: 56/56 grün (44 pipeline + 12 e2e), 4/4 integration
- **QA-Lage**: `qa-report.json` → `overall_status: "errors"`, 11 Layout-Issues offen
- **Security**: 2 High-Severity Findings noch offen (0.5.4 XSS custom-js, 0.5.5 SAST)

## Requirements

### Active (Phase 0 — Fundament)
- **VER-01**: Versionsdrift fixen (`package.json` 0.3.1→0.7.0, CHANGELOG.md, Doku-Stamps)
- **ENV-01**: `.env.example` vervollständigen (16 Variablen)
- **CLI-01**: `wizard.js preflight` Subcommand (8 Checks, farbige Tabelle)

### Active (Phase 0.5 — Security)
- **SEC-01**: XSS in `add-custom-js` — `unfiltered_html` Capability-Gate (B9)
- **SEC-02**: SAST-Integration — `psalm.xml` mit `--taint-analysis` (D1)

### Validated (bereits erledigt)
- ✅ 0.5.1 XSS batch-build-page (B5)
- ✅ 0.5.2 MIME-Spoofing media-upload (B7)
- ✅ 0.5.3 PHP-Sandbox-Audit (B8)
- ✅ 0.5.6 Path-Traversal media-upload (D6)
- ✅ 0.5.7 axe-core in Visual-QA (F1)
- ✅ 0.2 Schema-Dedup via sync-schema.js

### Completed (Session 2026-06-11)
- ✅ Integration Fixes A-H (McpBridge JSON-RPC 2.0, REST-Fallback, --execute für GC/Assets/Check)
- ✅ `html-to-widget-plan.js` — Brücke zu adrians-html-to-elementor-widget-plan
- ✅ Windows ESM Bugfix (`pathToFileURL` in pipeline.test.js)
- ✅ Schema-Fixture + Test-Fixes

### Out of Scope (v0.7.0)
- Phase 4 (Pipeline-as-a-Service, Build-Versioning, Multi-Site)
- Phase 5.1 (WCAG 2.2 A11y-Migration) — deferred auf v0.8.0
- Wild Ideas W1-W12

## Context
- **Working dir:** `C:\Users\adini\Desktop\Umbau\`
- **Pipeline dir:** `framer-v4-pipeline-v2-main/`
- **V2-Plugin dir:** `novamira-adrianv2/`
- **Source plan:** `novamira-adrianv2/FRAMER-PIPELINE-IMPROVEMENT-PLAN.md`
- **Audit:** `novamira-adrianv2/novamira-improvement-2026-06/report.md` (47 Findings)
- **Test env:** solar.local (WordPress + Elementor Pro + Novamira MCP)
- **Repo:** https://github.com/Adilinu94/framer-v4-pipeline-v2
- **Tooling:** Node 18+ ESM, PHP 8.1, WordPress 6.9+, Elementor Pro V4 Atomic
- **MCP:** 109 Abilities via `novamira-solar-local` (57 V2-Plugin + 52 Novamira)

## Constraints
- **Keine Breaking Changes** an bestehenden Pipeline-Scripts — alle Fixes additiv
- **Tests müssen grün bleiben** (56/56 pipeline+e2e, 4/4 integration)
- **Node 18+ ESM** — kein CommonJS, kein require()
- **Windows-Kompatibilität** — BASH via Git-Bash, Pfade mit `/` oder `pathToFileURL`
- **TLS**: Self-signed cert auf solar.local → `NODE_TLS_REJECT_UNAUTHORIZED=0`

## Key Decisions

| # | Decision | Rationale | Date |
|---|---|---|---|
| 1 | JSON-RPC 2.0 + Session-Handshake in mcp-bridge.js | Standard-Protokoll, session-basierte Auth, REST-Fallback | 2026-06-11 |
| 2 | McpBridge als zentrale Call-Schicht | Alle Scripts rufen `mcp.call()` statt direkter HTTP-Calls | 2026-06-11 |
| 3 | 3-stufiger Fallback in allen Scripts | McpBridge → Plan-Generator → Fehler. Kein Blindflug | 2026-06-11 |
| 4 | Phase 0 vor Phase 1-5 | Fundament-Arbeit (Versionsdrift, Preflight) muss vor allen weiteren Fixes passieren | 2026-06-11 |
| 5 | Psalm Level 4 strict mit taint-analysis | Fängt SQLi/XSS vor Release; niedrigschwelliger Einstieg | 2026-06-11 |
| 6 | GSD als Projekt-Framework | Strukturierte Phasen, Plan-basierte Ausführung, STATE-Tracking | 2026-06-11 |

## Reference Index
- **Verbesserungsplan:** `novamira-adrianv2/FRAMER-PIPELINE-IMPROVEMENT-PLAN.md`
- **Audit Report:** `novamira-adrianv2/novamira-improvement-2026-06/report.md`
- **Pipeline Blueprint:** `framer-v4-pipeline-v2-main/BLUEPRINT.md`
- **Integration Plan:** `framer-v4-pipeline-v2-main/INTEGRATION-PLAN.md`
- **GSD Requirements:** `.planning/REQUIREMENTS.md`
- **GSD Roadmap:** `.planning/ROADMAP.md`
- **GSD State:** `.planning/STATE.md`
