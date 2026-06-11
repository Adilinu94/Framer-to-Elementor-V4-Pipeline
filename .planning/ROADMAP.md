# Roadmap — Framer V4 Pipeline Verbesserungsprojekt

> **Source of truth for detailed improvement specs is `../novamira-adrianv2/FRAMER-PIPELINE-IMPROVEMENT-PLAN.md`**. This file tracks phase structure, plan boundaries, and completion status.

## Overview
Production-Hardening in 7 Phasen. Start mit Fundament + Security (Phase 0 + 0.5), dann Reliability + Performance (1 + 2), schließlich DX + Advanced (3 + 4 + 5.1).

```
Phase 0 (FOUNDATION)  →  Phase 0.5 (SECURITY)  →  Phase 1 (RELIABILITY)
     3 days                    2 days                    3 days

Phase 2 (PERFORMANCE)  →  Phase 3 (DX)  →  Phase 4 (ADVANCED)  →  Phase 5.1 (A11Y)
     2 days                  2 days              5 days                  5 days
```

## Phases

### Phase 0 — Fundament
**Tag:** FOUNDATION | **Plans:** 3 | **Est:** 3h | **Priority:** CRITICAL

- **Goal:** Basis-Ordnung herstellen: Versionen synchron, Environment dokumentiert, Preflight-Checks automatisiert
- **Depends on:** nothing
- **Stop gate:** Preflight muss auf solar.local grün sein

**Plans:**
- 0.1 Versionsdrift fixen + CHANGELOG.md
- 0.3 `.env.example` vervollständigen
- 0.4 `wizard.js preflight` Subcommand

### Phase 0.5 — Security-Hardening Sprint
**Tag:** SECURITY | **Plans:** 2 | **Est:** 2h | **Priority:** HIGH

- **Goal:** Alle 7 High-Severity Findings geschlossen (5 ✅ done, 2 offen)
- **Depends on:** Phase 0
- **Stop gate:** psalm --taint-analysis = 0 Errors

**Plans:**
- 0.5.4 XSS via `add-custom-js` (B9) — `unfiltered_html` Gate
- 0.5.5 SAST-Integration — `psalm.xml` mit taint-analysis

### Phase 1 — Reliability
**Tag:** RELIABILITY | **Plans:** 3 | **Est:** 8h | **Priority:** HIGH

- **Goal:** 11 offene Layout-Issues killen, Retry-Logik, strukturierte Errors, CI
- **Depends on:** Phase 0 + 0.5
- **Stop gate:** CI grün auf Ubuntu ohne Live-WP

**Plans:**
- 1.2 Retry-Logik mit Exponential-Backoff
- 1.3 Strukturierter Error-Katalog (12 Guards)
- 1.4 CI-Binding (GitHub Actions + MCP-Mock)

### Phase 2 — Performance
**Tag:** PERFORMANCE | **Plans:** 3 | **Est:** 6h | **Priority:** MEDIUM

- **Goal:** Build-Zeit von ~8 Min auf ~2 Min, Visual-QA von 45s auf 3s
- **Depends on:** Phase 1
- **Stop gate:** Build < 3 Min auf solar.local

**Plans:**
- 2.1 Batched MCP-Calls (batch-build-page)
- 2.2 Parallel-Phase-Execution
- 2.3 MCP-Discovery-Cache

### Phase 3 — UX & Developer Experience
**Tag:** DX | **Plans:** 3 | **Est:** 6h | **Priority:** MEDIUM

- **Goal:** Dry-Run, Live-Preview, Progress-Bar, actionable Errors
- **Depends on:** Phase 1 + 2
- **Stop gate:** `wizard.js build --dry-run` liefert vollständigen Plan ohne Schreibzugriff

**Plans:**
- 3.1 Dry-Run-Mode
- 3.2 Preview + Promote (Preview-Page mit Hash)
- 3.3 Progress-Bar + Interaktive Fehlerbehandlung

### Phase 4 — Advanced
**Tag:** ADVANCED | **Plans:** 3 | **Est:** 5 Tage | **Priority:** LOW

- **Goal:** Pipeline-as-a-Service, Build-Versioning, Mega-Ability
- **Depends on:** Phase 3
- **Stop gate:** `wizard.js serve --port=7123` akzeptiert POST /build

**Plans:**
- 4.1 Pipeline-as-a-Service (HTTP-API)
- 4.2 Build-Versioning in WordPress (CPT elementor-build)
- 4.5 Mega-Ability (execute-build-plan, 18 Turns → 1)

### Phase 5.1 — A11y-Migration WCAG 2.2
**Tag:** A11Y | **Plans:** 3 | **Est:** 5 Tage | **Priority:** LOW

- **Goal:** WCAG 2.2 Konformität, A11y-Audit verbessert, Color-Contrast Diff-UI
- **Depends on:** Phase 3
- **Stop gate:** axe-core Report: 0 critical violations auf 5 Test-Pages

**Plans:**
- 5.1.1 WCAG 2.2 in V4_Color_Contrast (Target-Size, Focus-Appearance)
- 5.1.2 A11y-Audit-Ability verbessern (Background-Resolution)
- 5.1.3 Color-Contrast-Fix UI-Diff (Preview vor Apply)

## Plan Inventory (20 total)

| # | Plan | Phase | Priority | Status |
|---|---|---|---|---|
| 0.1 | Versionsdrift + CHANGELOG | 0 | CRITICAL | open |
| 0.3 | .env.example vervollständigen | 0 | HIGH | open |
| 0.4 | wizard.js preflight | 0 | HIGH | open |
| 0.5.4 | XSS custom-js (B9) | 0.5 | HIGH | open |
| 0.5.5 | SAST psalm.xml (D1) | 0.5 | HIGH | open |
| 1.2 | Retry-Logik Exponential-Backoff | 1 | HIGH | open |
| 1.3 | Strukturierter Error-Katalog | 1 | HIGH | open |
| 1.4 | CI-Binding GitHub Actions | 1 | HIGH | open |
| 2.1 | Batched MCP-Calls | 2 | MEDIUM | open |
| 2.2 | Parallel-Phase-Execution | 2 | MEDIUM | open |
| 2.3 | MCP-Discovery-Cache | 2 | MEDIUM | open |
| 3.1 | Dry-Run-Mode | 3 | MEDIUM | open |
| 3.2 | Preview + Promote | 3 | MEDIUM | open |
| 3.3 | Progress-Bar + Fehler-Prompt | 3 | MEDIUM | open |
| 4.1 | Pipeline-as-a-Service | 4 | LOW | open |
| 4.2 | Build-Versioning WP | 4 | LOW | open |
| 4.5 | Mega-Ability | 4 | LOW | open |
| 5.1.1 | WCAG 2.2 Color-Contrast | 5.1 | LOW | open |
| 5.1.2 | A11y-Audit verbessern | 5.1 | LOW | open |
| 5.1.3 | Color-Contrast UI-Diff | 5.1 | LOW | open |

## Completed Plans (Session 2026-06-11)

| # | Plan | Status |
|---|---|---|
| Fix A | mcp-bridge.js JSON-RPC 2.0 + Session-Handshake | ✅ done |
| Fix B | asset-to-wp-media.js --execute | ✅ done |
| Fix D | check-v4-requirements.js --auto-call | ✅ done |
| Fix E | generate-global-classes.js --execute | ✅ done |
| Fix G | framer-v4-pipeline.md Cache-Regel | ✅ done |
| Fix H | mcp-bridge.js WP REST Fallback | ✅ done |
| — | html-to-widget-plan.js | ✅ done |
| — | Windows ESM Bugfix | ✅ done |
| — | Schema-Fixture + Test-Fixes | ✅ done |
