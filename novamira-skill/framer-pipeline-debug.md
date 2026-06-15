---
slug: framer-pipeline-debug
title: Framer Pipeline Debug — Guided Troubleshooting
description: Strukturierte Diagnose-Anleitung für fehlgeschlagene framer-v4-pipeline Läufe. Deckt alle bekannten Fehlermuster ab inkl. CI-Bugs, PHP-Fatals, MCP-Fehler und Score-Probleme.
version: "0.7.0"
pipeline_min_version: "0.7.0"
tags: [debug, troubleshooting, framer, pipeline, mcp, ci]
---

# Framer Pipeline Debug — Guided Troubleshooting

## 🔵 Quick Diagnosis (Symptom → Ursache → Fix)

| Symptom | Wahrscheinliche Ursache | Sprung zu |
|---------|------------------------|-----------|
| 500 Error bei `elementor-set-content` | `custom_css` falsch formatiert / `e-svg` Wert kaputt | [500-Errors](#500-errors-bei-elementor-set-content) |
| Styles nicht sichtbar trotz korrekter JSON | `classes` Array falsch strukturiert (nach `add_class`) | [Data-Corruption](#data-corruption-classes-array) |
| Farben falsch / GV nicht aufgelöst | Token-Referenz broken / GV-Drift | [Token-Issues](#token--variable-issues) |
| Bilder laden nicht | `url:null` in image-src (Invariant IV) | [Image-Issues](#image--alt-text-issues) |
| `classes: invalid_value` Error | `$$type: "classes"` fehlt (Guard G1) | [Style-Issues](#rendering-issues-styles-nicht-sichtbar) |
| Container ohne Hintergrund | `background-color` lokal statt `background` (Guard G2/G3) | [CSS-Constraints](#spezifische-css-constraints) |
| Alle Headings gleich (32px, schwarz) | RC-11 Fallback greift | [RC-11-Fallback](#rc-11-fallback) |
| Session 401/419 | MCP-Session abgelaufen (~25-30min) | [MCP-Session](#mcp-session-handshake-debug) |

---

## Schritt 1: Welcher Schritt hat gefailt?

```bash
# rollback-plan.json lesen:
cat rollback-plan.json | jq '.steps[] | select(.status == "failed")'

# validate-report.json:
cat validate-report.json | jq '.summary, .stats'

# MCP-Bridge Log:
cat .pipeline/bridge.log 2>/dev/null | tail -50
```

---

## Diagnose-Entscheidungsbaum

```
Fehler bei PHP-Abilities aus novamira-ability-code-injector/ (Repo-Code)?
  → HINWEIS: Diese Abilities (novamira-adrianv2/adrians-*) sind NICHT live aktiv auf
    solar.local — das WPCode-Snippet-CRUD-System hat kein Live-Aequivalent (Stand: Naming-Fix).
    Fuer Animation/Code-Injection siehe animation-workflow.md (add-custom-js/add-code-snippet).
  → Ist WPCode aktiv? post_type_exists('wpcode_snippet') → false → Plugin deaktiviert
  → novamira_find_wpcode_snippet undefined? → adrians-helpers.php nicht geladen (require_once fehlt)

Fehler: "novamira-extra/..." 404 oder not found?
  → ❌ FALSCHER NAMESPACE — das Plugin heißt novamira-adrianv2, nicht novamira-extra
  → Fix: Alle Calls auf novamira-adrianv2/ umstellen
  → Betrifft: post-build-auto-fix.js (gefixt in Commit 5bb2d3d)

CI alle Jobs grün aber nichts läuft?
  → Prüfe working-directory in .github/workflows/ci.yml (gefixt in Commit 5bb2d3d)
  → paths-Filter feuert auf falsches Verzeichnis?

Score < 85% in validate-v4-tree.js?
  → node scripts/validate-v4-tree.js v4-tree.json --verbose
  → Häufigste Ursache: style IDs mit Bindestrichen (HYPHEN-IN-STYLE-ID)
  → Häufigste Ursache: GV-Farbe als Hardcode (#ffffff statt e-gv-*)
  → DOM-Tiefe ≥ 4? → C7 Check: flatten tree

Score 0%?
  → homepage.xml = hero-section.xml? md5sum prüfen (gefixt in Commit 5bb2d3d)
  → v4-tree.json leer oder kein Array? → convert-xml-to-v4.js direkt debuggen

elementor-set-content gibt 401 zurück?
  → MCP-Session abgelaufen (TTL ~25-30min)
  → Neu initialisieren: mcp-bridge.js → session handshake
  → novamira-adrianv2/setup-v4-foundation erneut aufrufen (gibt neue GV/GC-IDs)

elementor-set-content gibt leere Seite?
  → GV-IDs stale: e-gv-* IDs aus vorheriger Session
  → novamira-adrianv2/setup-v4-foundation nie cachen → fresh IDs holen
  → GC-IDs in styles{} aber nicht in elements? → styles[] muss parallel zu elements[] sein

novamira-adrianv2/adrians-* not found (z.B. adrians-get-snippet, adrians-fix-color-contrast)?
  → ❌ FALSCHES PRAEFIX — "adrians-" existiert in novamira-adrianv2/* NICHT mehr
  → Fix: Praefix entfernen -> novamira-adrianv2/get-snippet wuerde aber AUCH nicht existieren,
    da das WPCode-Snippet-CRUD-System kein Live-Aequivalent hat
  → Siehe animation-workflow.md / font-workflow.md fuer die korrekte Alternative
    (add-custom-js / add-custom-css / add-code-snippet)

## 500-Errors bei elementor-set-content

custom_css falsch formatiert?
  → Muss als `{"raw":"..."}` kommen, nicht als plain String
  → e-svg Widget mit kaputtem `svg`-Wert? → `svg: { "$$type": "svg", "value": "<svg>...</svg>" }`

## RC-11 Fallback

Alle Headings sehen gleich aus (Inter, 32px, #111)?
  → `convert-xml-to-v4.js` Fallback-Code (RC-11) setzt Default-Werte wenn
    `inlineTextStyle` nicht aufgelöst werden kann
  → Fix: `dual-source-workflow` Skill → CSS aus FramerExport extrahieren
  → Oder: `patch-element-styles` mit korrekten font-size/color/font-family Werten

## Data-Corruption: classes Array

Nach `add_class` ist das `classes` Array korrupt?
  → `classes` muss `{ "$$type": "classes", "value": ["gc-xxx"] }` Format haben
  → Repair: `execute-php` mit Korrektur-Script:
    ```php
    $meta = get_post_meta($post_id, '_elementor_data', true);
    // Fix: classes als $$type Wrapper neu schreiben
    update_post_meta($post_id, '_elementor_data', $fixed_meta);
    ```
  → Oder `adrians-rollback-page` auf letzten stabilen Stand

## Token / Variable Issues

GV-Referenz zeigt falsche Farbe?
  → `e-gv-*` ID hat sich geändert (GV-Drift)
  → `novamira-adrianv2/export-design-system` → frische IDs
  → `novamira-adrianv2/variable-audit { "report": "drift" }`

## Image / Alt-Text Issues

Bild lädt nicht?
  → `url:null` im image-src → `url`-Key komplett entfernen (Invariant IV)
  → Korrekt: `{ "$$type": "image-attachment-id", "value": 123 }` (NUR id, kein url)

Alt-Text fehlt?
  → `novamira-adrianv2/add-alt-text-from-context`
  → Oder: `patch-element-styles` mit `alt: { "$$type": "string", "value": "Beschreibung" }`

## Spezifische CSS-Constraints

`background-color` in lokalen Styles = rejected?
  → Elementor V4 akzeptiert NUR `background` (als Objekt) in lokalen Styles
  → `background-color` NUR in Global Classes erlaubt
  → Fix: `background: { "$$type": "background", "value": { "color": {...} } }`

## Rendering-Issues: Styles nicht sichtbar

JSON korrekt, aber Styles werden nicht angewendet?
  → Prüfe: Steht die Style-ID in `settings.classes.value`? (Invariant I — Rendering-Gate)
  → Prüfe: `$$type` Wrapper an allen props?
  → Prüfe: `classes` Array Format: `{ "$$type": "classes", "value": [...] }`
  → Prüfe: Breakpoint `"desktop"` → muss `null` sein (Guard G5)

add-custom-js / add-code-snippet schlägt fehl?
  → post_id fehlt bei add-custom-js? -> Ability ist post_id-scoped (HTML-Widget auf der Seite)
  → add-code-snippet braucht Elementor Pro Custom Code -> list-code-snippets zur Verifikation
  → GSAP laedt nicht? -> CDN-Script-Tag UND Inline-Code im selben Snippet pruefen

GC transform-functions PHP Warning?
  → Bekannter Bug: gc-* mit malformiertem transform-functions prop
  → Fix-Skript: wp-content/novamira-sandbox/gc-transform-validator.php
  → Ursache: GC als raw PHP Array gespeichert statt { $$type, value[] } Wrapper
```

---

## Häufige Fehler & Fixes

| Symptom | Ursache | Fix | Commit |
|---------|---------|-----|--------|
| CI alle Jobs "green" aber nichts geprüft | working-directory: framer-v4-pipeline-v2-main | CI fix | 5bb2d3d |
| PHP Fatal: undefined function novamira_find_wpcode_snippet | require_once helpers fehlt | adrians-helpers.php (Repo-Datei) | 5bb2d3d |
| Score 0% beide Fixtures identisch | homepage.xml = hero-section.xml (identisch) | Fixture fix | 5bb2d3d |
| novamira-extra/* 404 | Falscher Namespace — Plugin heißt novamira-adrianv2 | post-build-auto-fix.js fix | Runde 2 |
| novamira-adrianv2/adrians-* not found | Praefix "adrians-" existiert live nicht mehr | Skills auf novamira-adrianv2/* (ohne Praefix) umgeschrieben | Naming-Fix |
| GSAP-Snippet bricht bei Backticks | addslashes() statt wp_json_encode() | Code-Injector fix (Repo-Datei) | 5bb2d3d |
| inject-animation N×MCP-Calls | forEach loop statt Batch-Ability | inject-animation-code.js fix | Runde 2 |
| DOM-Depth kein Check | validate-v4-tree.js fehlte C7 | checkDomDepth() | 5bb2d3d |
| GC-Generierung wird übersprungen | wizard.js Step 5 war "Optional" | Pflichtschritt | 5bb2d3d |
| meta-tags/schema nicht gesetzt | Native Live-Abilities existieren bereits | novamira-adrianv2/generate-meta-tags + generate-schema-markup (ohne Praefix) | Naming-Fix |

---

## 5-Step Post-Build Recovery (wenn Build kaputt)

```
1. elementor-get-content (skeleton) → Struktur-Check
2. layout-audit → Pass-through finden
3. visual-qa → Overflow/Z-Index
4. responsive-audit → Fehlende Breakpoints
5. patch-element-styles → Gezielt fixen (KEIN Tree-Rebuild!)
```

## Recovery-Tools

### classes Array reparieren (PHP)

```php
// execute-php auf dem Server:
$post_id = 1950;
$data = json_decode(get_post_meta($post_id, '_elementor_data', true), true);
function fix_classes(&$el) {
  if (isset($el['settings']['classes']) && is_array($el['settings']['classes'])) {
    $el['settings']['classes'] = ['$$type' => 'classes', 'value' => $el['settings']['classes']];
  }
  if (isset($el['elements'])) foreach ($el['elements'] as &$child) fix_classes($child);
}
fix_classes($data);
update_post_meta($post_id, '_elementor_data', wp_slash(json_encode($data)));
```

### Rollback auf letzten stabilen Stand

```
novamira-adrianv2/rollback-page { post_id: POST_ID }
```

## Debug-Befehle

```bash
# Vollständige Syntax-Prüfung aller Skripte:
for f in scripts/**/*.js wizard.js; do node --check "$f" && echo "OK: $f"; done

# Unit-Tests:
node --test tests/pipeline.test.js

# validate-v4-tree verbose:
node scripts/validate-v4-tree.js v4-tree.json --mode=warn

# inject-animation single-mode (Debug):
node scripts/inject-animation-code.js --plan animation-plan.json --single-mode

# McpBridge self-test:
node scripts/lib/mcp-bridge.js --self-test

# MD5-Check Fixtures (müssen verschieden sein):
md5sum tools/framer-export/homepage.xml tools/framer-export/hero-section.xml
```

---

## MCP-Session Handshake Debug

```bash
# Manueller Session-Test gegen solar.local:
curl -s -X POST http://solar.local/wp-json/mcp/novamira \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'user:password' | base64)" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"debug","version":"1.0"}}}'
```

Expected: `{"jsonrpc":"2.0","id":1,"result":{"sessionId":"...","capabilities":{...}}}`

---

## Eskalations-Checkliste (wenn nichts hilft)

1. `git log --oneline -5` — aktuellsten Commit prüfen
2. `node -e "import('./scripts/convert-xml-to-v4.js')"` — direkt ausführen
3. `mcp-adapter-discover-abilities` live abfragen — Ability-Liste verifizieren
4. `tasks/todo.md` öffnen — bekannte offene Issues
5. `PIPELINE_AUDIT_REPORT.md` und `V4_DESIGN_SCHEMA_REPORT.md` lesen
