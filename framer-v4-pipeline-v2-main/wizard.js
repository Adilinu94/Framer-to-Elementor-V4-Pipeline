#!/usr/bin/env node
/**
 * Framer → Elementor V4 Pipeline V2: Interactive CLI Wizard
 * 
 * Zentraler Entry-Point für die Framer-zu-V4-Konvertierung.
 * Orchestriert Pre-Build-Extraktion, Validierung und generiert das Build-Manifest.
 */

import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = __dirname;
const pipelineDir = __dirname;
const nodeBin = process.execPath;
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const rl = readline.createInterface({ input, output });

// Helper: Colored console output
const log = {
  info: (msg) => console.log(`\n🔵 [INFO] ${msg}`),
  success: (msg) => console.log(`\n✅ [SUCCESS] ${msg}`),
  warn: (msg) => console.log(`\n⚠️  [WARN] ${msg}`),
  error: (msg) => console.log(`\n❌ [ERROR] ${msg}`),
  step: (msg) => console.log(`\n▶️  [STEP] ${msg}`),
};

function findWorkspaceRoot() {
  if (process.env.FRAMER_PIPELINE_ROOT) return path.resolve(process.env.FRAMER_PIPELINE_ROOT);
  const candidates = [
    process.cwd(),
    repoDir,
    path.resolve(repoDir, '..'),
  ];
  return candidates.find(dir =>
    existsSync(path.join(dir, 'tools', 'framer-export')) ||
    existsSync(path.join(dir, 'FramerExport')) ||
    existsSync(path.join(dir, 'build-manifest.json'))
  ) || repoDir;
}

const rootDir = findWorkspaceRoot();

function findFramerExportDir() {
  const candidates = [
    process.env.FRAMER_EXPORT_DIR,
    path.join(rootDir, 'tools', 'framer-export'),
    path.join(rootDir, 'FramerExport'),
    path.resolve(rootDir, '..', 'FramerExport'),
  ].filter(Boolean).map(p => path.resolve(p));
  return candidates.find(dir => existsSync(dir)) || null;
}

async function runFile(command, args, description, cwd = rootDir) {
  log.step(description);
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { cwd, maxBuffer: 1024 * 1024 * 20 });
    if (stderr) log.warn(stderr);
    log.success(`${description} abgeschlossen.`);
    return stdout;
  } catch (error) {
    log.error(`${description} fehlgeschlagen.`);
    console.error(error.message);
    throw error;
  }
}

async function findIndexHtmlDirs(baseDir) {
  const found = [];
  async function scan(dir, depth = 0) {
    if (depth > 3) return;
    if (!existsSync(dir)) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    if (entries.some(e => e.isFile() && e.name === 'index.html')) {
      const stat = await fs.stat(path.join(dir, 'index.html'));
      found.push({ dir, mtimeMs: stat.mtimeMs });
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await scan(path.join(dir, entry.name), depth + 1);
      }
    }
  }
  await scan(baseDir);
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 FRAMER → ELEMENTOR V4 PIPELINE V2 WIZARD');
  console.log('='.repeat(60) + '\n');

  // PHASE 0: MCP CONNECTION CHECK
  // Architektur: Alle Novamira-Calls laufen direkt ueber den Claude novamira-solar-local
  // MCP Connector. Kein .mcp.json, keine env vars, keine mcp-bridge.js HTTP-Calls.
  log.step('Phase 0: MCP Connector Pruefung...');
  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │  NOVAMIRA MCP CONNECTOR                                 │
  │                                                         │
  │  Tool:   novamira-solar-local:mcp-adapter-execute-ability│
  │  Format: { ability_name: "novamira/...", parameters: {} }│
  │                                                         │
  │  Kein .mcp.json noetig. Kein HTTP aus Node.js.          │
  │  Der Agent ruft alle Abilities direkt auf.              │
  └─────────────────────────────────────────────────────────┘
  `);

  // PHASE 0.2: SCHEMA SYNC (Fail-Fast)
  // Holt das kanonische Prop-Schema vom V2-Plugin via REST.
  // Bricht den Build ab, wenn der Endpoint nicht erreichbar ist.
  log.step('Phase 0.2: Schema-Sync mit V2-Plugin...');
  try {
    await runFile(
      nodeBin,
      [path.join(pipelineDir, 'scripts', 'sync-schema.js'), '--verbose'],
      'Prop-Schema vom V2-Plugin synchronisieren',
      pipelineDir
    );
    log.success('Prop-Schema erfolgreich synchronisiert.');
  } catch (err) {
    log.error('SCHEMA-SYNC FEHLGESCHLAGEN — Build abgebrochen.');
    log.error('Stelle sicher, dass:');
    console.error('  1. Die WordPress-Seite läuft und erreichbar ist');
    console.error('  2. Das Novamira AdrianV2 Plugin aktiviert ist');
    console.error('  3. WP_API_URL env var oder --url in sync-schema.js gesetzt ist');
    rl.close();
    process.exit(1);
  }

  // PHASE 0a: V4 ATOMIC REQUIREMENTS CHECK (Fix D — Auto-Call via McpBridge)
  // Ruft elementor-check-setup direkt via mcp-bridge.js auf.
  // Fallback: gespeicherte JSON-Datei, oder Guidance-Ausgabe.
  log.step('Phase 0a: V4 Atomic Requirements Check...');

  let v4CheckPassed = false;

  // 1. Primär: --auto-call (direkter McpBridge-Call)
  try {
    await runFile(
      nodeBin,
      [path.join(pipelineDir, 'scripts', 'check-v4-requirements.js'), '--auto-call'],
      'V4 Requirements Check (elementor-check-setup via McpBridge)',
      pipelineDir
    );
    v4CheckPassed = true;
    log.success('V4 Atomic Requirements erfüllt (Auto-Call).');
  } catch (err) {
    log.warn(`V4 Auto-Check fehlgeschlagen: ${String(err).slice(0, 200)}`);
  }

  // 2. Fallback: Gespeicherte Datei (wenn Auto-Call nicht verfügbar)
  if (!v4CheckPassed) {
    const setupCheckPath = path.join(rootDir, 'reports', 'elementor-check-setup.json');
    if (existsSync(setupCheckPath)) {
      try {
        await runFile(
          nodeBin,
          [path.join(pipelineDir, 'scripts', 'check-v4-requirements.js'), '--check-setup-json', setupCheckPath],
          'V4 Requirements Check (gespeicherte Datei)'
        );
        v4CheckPassed = true;
        log.success('V4 Atomic Requirements erfüllt (gespeicherte Datei).');
      } catch (err) {
        if (err.message?.includes('exit code 1') || err.code === 1) {
          log.error('HARD STOP: Elementor V4 Atomic Widgets sind nicht aktiviert!');
          log.error('Bitte zuerst in WordPress beheben:');
          console.error('\n  1. Elementor → Settings → Features → "Atomic Widgets" → ON');
          console.error('  2. Elementor → Tools → Regenerate CSS & Data → Cache leeren');
          console.error('  3. Wizard erneut starten\n');
          rl.close();
          process.exit(1);
        }
        log.warn(`V4-Check-Warnung: ${err.message} — Pipeline startet auf eigene Gefahr.`);
      }
    }
  }

  // 3. Guidance (wenn nichts funktioniert hat)
  if (!v4CheckPassed) {
    await runFile(
      nodeBin,
      [path.join(pipelineDir, 'scripts', 'check-v4-requirements.js'), '--guidance'],
      'V4 Requirements Guidance'
    ).catch(() => {});
    log.info('V4-Check nicht automatisch möglich — bitte manuell in WordPress prüfen.');
    log.info('Elementor → Settings → Features → "Atomic Widgets" muss ON sein.');
  }

  // Phase 1.3/1.4 variables — declared OUTSIDE try so catch block can access them
  let targetPostIdNum = null;
  let rollbackPlanPath = null;
  let splitPlanPath = null;

  try {
    // 1. Framer URL
    const framerUrl = await rl.question('🌐 Framer-URL der Quellseite: ');
    if (!framerUrl.startsWith('http')) {
      throw new Error('Ungültige URL. Muss mit http:// oder https:// beginnen.');
    }

    // 2. Scope
    const scope = await rl.question('🎯 Scope (Enter für "ganze Seite" oder Komma-separierte Abschnittsnamen): ');
    const targetScope = scope.trim() || 'full-page';

    // 3. WP Environment
    const environments = ['testseite.nick-webdesign.de', 'treetsshop.local', 'anderer (manuell eingeben)'];
    console.log('\nVerfügbare Umgebungen:');
    environments.forEach((env, i) => console.log(`  ${i + 1}. ${env}`));
    const envChoice = await rl.question('🖥️  Ziel-Umgebung (1-3 oder Name): ');
    let wpEnv = envChoice.trim();
    if (envChoice === '1') wpEnv = environments[0];
    else if (envChoice === '2') wpEnv = environments[1];
    else if (envChoice === '3') wpEnv = await rl.question('Bitte gib die manuelle URL/domain ein: ');

    // 4. Target Post ID
    const postIdInput = await rl.question('📝 Ziel-Post-ID (oder "new" für neue Seite): ');
    const targetPostId = postIdInput.trim().toLowerCase() === 'new' ? 'new' : postIdInput.trim();

    console.log('\n' + '='.repeat(60));
    log.info('Konfiguration zusammengefasst. Starte Pre-Build-Pipeline...');
    console.log(`   URL: ${framerUrl}`);
    console.log(`   Scope: ${targetScope}`);
    console.log(`   Umgebung: ${wpEnv}`);
    console.log(`   Ziel-Post-ID: ${targetPostId}`);
    console.log('='.repeat(60) + '\n');

    const confirm = await rl.question('⚠️  Mit diesen Einstellungen fortfahren? (j/N): ');
    if (confirm.toLowerCase() !== 'j' && confirm.toLowerCase() !== 'y') {
      log.info('Abgebrochen.');
      rl.close();
      return;
    }

    // --- PRE-BUILD PIPELINE EXECUTION ---
    
    // Schritt A: FramerExport Symbiose
    const exportFolderName = `framer-${framerUrl.replace(/^https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').substring(0, 30)}`;
    let exportDir = path.join(rootDir, 'exports', exportFolderName);
    
    log.step(`Starte FramerExport in dediziertem Ordner: ${exportDir}`);
    try {
      await fs.mkdir(exportDir, { recursive: true });

      const framerExportDir = findFramerExportDir();
      if (!framerExportDir) {
        throw new Error('FramerExport nicht gefunden. Setze FRAMER_EXPORT_DIR oder lege FramerExport unter tools/framer-export bzw. FramerExport ab.');
      }

      const packageJson = await readJsonIfExists(path.join(framerExportDir, 'package.json'));
      const before = await findIndexHtmlDirs(framerExportDir);
      if (packageJson?.scripts?.dev) {
        log.info(`Befehl: npm run dev -- <framer-url> in ${framerExportDir}`);
        await runFile(npmBin, ['run', 'dev', '--', framerUrl], 'FramerExport ausführen', framerExportDir);
      } else if (existsSync(path.join(framerExportDir, 'src', 'cli', 'index.ts'))) {
        log.info(`Befehl: npx tsx src/cli/index.ts <framer-url> --platform framer in ${framerExportDir}`);
        await runFile(npxBin, ['tsx', 'src/cli/index.ts', framerUrl, '--platform', 'framer'], 'FramerExport ausführen', framerExportDir);
      } else {
        throw new Error(`Kein unterstützter FramerExport-Einstieg in ${framerExportDir} gefunden.`);
      }

      const after = await findIndexHtmlDirs(framerExportDir);
      const beforeDirs = new Set(before.map(e => path.resolve(e.dir).toLowerCase()));
      const generated = after.find(e => !beforeDirs.has(path.resolve(e.dir).toLowerCase())) || after[0];
      if (!generated) throw new Error('FramerExport hat kein index.html erzeugt.');
      exportDir = generated.dir;
      log.success('FramerExport erfolgreich abgeschlossen. Lokales Mirror erstellt.');
    } catch (e) {
      log.error('FramerExport fehlgeschlagen. Bitte prüfe die URL und stelle sicher, dass "npx tsx" verfügbar ist.');
      console.error(e.message);
      rl.close();
      return;
    }

    // Schritt B: Asset & Structure Extraction (auf dem FramerExport-Output)
    const exportHtml = path.join(exportDir, 'index.html');
    const tokensDir = path.join(exportDir, 'tokens');
    const assetsDir = path.join(exportDir, 'assets');
    await fs.mkdir(tokensDir, { recursive: true });
    await fs.mkdir(assetsDir, { recursive: true });
    const extractionSteps = [
      { args: ['scripts/extract-image-urls.js', '--html', exportHtml, '--output', path.join(assetsDir, 'image-manifest.json')], desc: 'Extrahiere Bild-URLs aus Framer-Export' },
      { args: ['scripts/resolve-fonts.js', '--html', exportHtml, '--fonts-dir', path.join(assetsDir, 'fonts'), '--output', path.join(tokensDir, 'font-resolution.json')], desc: 'Löse Font-Referenzen auf' },
      { args: ['scripts/extract-responsive-breakpoints.js', '--css', exportHtml, '--output', path.join(tokensDir, 'responsive-breakpoints.json')], desc: 'Extrahiere Responsive Breakpoints' },
      { args: ['scripts/extract-framer-styles.js', '--html', exportHtml, '--output', path.join(tokensDir, 'extracted-styles.json')], desc: 'Extrahiere CSS-Properties und Variablen' },
      { args: ['scripts/design-token-extractor.js', '--html', exportHtml, '--output', path.join(tokensDir, 'token-mapping.json'), '--variables-plan', path.join(tokensDir, 'variables-plan.json')], desc: 'Erzeuge Design-Token-Mapping und Variablen-Plan' }
    ];

    for (const step of extractionSteps) {
      try {
        // Nutze pipelineDir (framer-v4-pipeline-v2) als Arbeitsverzeichnis für die lokalen Scripts
        await runFile(nodeBin, step.args, step.desc, pipelineDir);
      } catch (err) {
        log.warn(`Script fehlgeschlagen oder nicht gefunden: ${step.desc}.`);
      }
    }

    // Schritt C: Pre-Build Validation (12 Guards)
    const treePath = path.join(rootDir, 'v4-tree.json');
    if (existsSync(treePath)) {
      try {
        const validationReportPath = path.join(rootDir, 'validation-report.json');
        await runFile(nodeBin, [
          'scripts/framer-pre-build-validate.js',
          '--tree', treePath,
          '--output', validationReportPath,
        ], 'Führe 12-Guard Pre-Build-Validierung durch', pipelineDir);
        
        const reportPath = validationReportPath;
        try {
          const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
          const score = report.meta?.score || report.score || 0;
          if (score < 85) {
            log.error(`Validation Score zu niedrig: ${score}%. Mindestens 85% erforderlich.`);
            log.info('Bitte prüfe validation-report.json und behebe die Fehler, bevor du fortfährst.');
            rl.close();
            return;
          }
          log.success(`Validation bestanden mit Score: ${score}%`);
        } catch (e) {
          log.warn('Konnte validation-report.json nicht parsen. Gehe von manuellem Check aus.');
        }
      } catch (err) {
        log.error('Pre-Build-Validierung fehlgeschlagen. Build wird abgebrochen.');
        rl.close();
        return;
      }
    } else {
      log.warn('v4-tree.json nicht gefunden. Überspringe Pre-Build-Validierung.');
      log.info('Hinweis: Führe manuell `node scripts/convert-xml-to-v4.js` oder ein ähnliches Tool aus, um den Tree zu generieren, bevor du den Build startest.');
    }

    // ── PHASE 1.3: ROLLBACK BACKUP PLAN ──────────────────────────────────
    // Generiert einen MCP-Execution-Plan zum Sichern des aktuellen
    // Seiteninhalts VOR dem Build. Der Agent muss die MCP-Calls
    // ausführen und die Ergebnisse an RollbackManager.backupPlan()
    // zurückgeben, um das Backup zu persistieren.
    //
    // Nur bei numerischer Post-ID (kein "new").
    targetPostIdNum = targetPostId !== 'new' ? parseInt(targetPostId, 10) : null;
    rollbackPlanPath = null;
    splitPlanPath = null;

    if (targetPostIdNum && !isNaN(targetPostIdNum)) {
      log.step('Phase 1.3: Rollback-Backup-Plan generieren...');
      try {
        const { RollbackManager } = await import(
          pathToFileURL(path.join(pipelineDir, 'scripts', 'lib', 'rollback.js')).href
        );
        const rb = new RollbackManager();
        const { plan } = rb.backupPlan(targetPostIdNum);
        if (plan) {
          rollbackPlanPath = path.join(rootDir, 'rollback-plan.json');
          await fs.writeFile(rollbackPlanPath, JSON.stringify(plan, null, 2), 'utf8');
          log.success(`Rollback-Plan gespeichert: ${path.relative(rootDir, rollbackPlanPath)}`);
          console.error(`  → ${plan.mcp_calls.length} MCP-Calls (elementor-get-content + adrians-page-settings)`);
          console.error('  → Agent: MCP-Calls ausführen → Ergebnisse an RollbackManager.backupPlan() übergeben');
        } else {
          log.info('Backup existiert bereits — überspringe.');
        }
      } catch (err) {
        log.warn(`Rollback-Plan fehlgeschlagen: ${err.message}`);
        log.warn('Build wird ohne Rollback-Sicherung fortgesetzt.');
      }
    } else {
      log.info('Phase 1.3 übersprungen (neue Seite — kein Backup nötig).');
    }

    // ── PHASE 1.4: SPLIT-LARGE-TREE CHECK ────────────────────────────────
    // Prüft ob der v4-tree.json zu groß für einen einzelnen
    // elementor-set-content Call ist und splittet in Sections.
    if (existsSync(treePath) && targetPostIdNum) {
      log.step('Phase 1.4: Large-Tree-Split-Check...');
      try {
        const splitStdout = await runFile(
          nodeBin,
          [
            path.join(pipelineDir, 'scripts', 'lib', 'split-large-tree.js'),
            '--plan', treePath,
            '--post-id', String(targetPostIdNum),
          ],
          'V4-Tree auf Section-Split prüfen',
          pipelineDir
        );
        if (splitStdout) {
          const splitResult = JSON.parse(splitStdout);
          const sectionCount = splitResult.sections?.length || 0;
          splitPlanPath = path.join(rootDir, 'split-plan.json');
          await fs.writeFile(splitPlanPath, splitStdout, 'utf8');
          if (sectionCount > 1) {
            log.warn(`Tree hat ${splitResult.totalElements} Elemente → in ${sectionCount} Sections gesplittet.`);
            console.error(`  → Split-Plan: ${path.relative(rootDir, splitPlanPath)}`);
            console.error('  → Agent: MCP-Calls aus split-plan.json sequenziell ausführen');
          } else {
            log.success(`Tree passt in einen Build-Call (${splitResult.totalElements} Elemente).`);
          }
        }
      } catch (err) {
        log.warn(`Split-Check: ${err.message}`);
        log.info('Build mit ungesplittetem Tree fortsetzen.');
      }
    } else if (!existsSync(treePath)) {
      log.info('Phase 1.4 übersprungen (v4-tree.json nicht vorhanden).');
    }

    // Schritt D: Manifest Generierung (Fix 5 - Single Source of Truth)
    // BLUEPRINT.md ist der Master. Manifest referenziert nur noch dorthin.
    log.step('Generiere Build-Manifest...');
    const manifest = {
      timestamp: new Date().toISOString(),
      framerUrl,
      scope: targetScope,
      wpEnvironment: wpEnv,
      targetPostId: targetPostId,
      exportFolder: exportFolderName,
      artifacts: {
        v4Tree: existsSync(treePath) ? 'v4-tree.json' : 'pending (manuell erstellen)',
        imageManifest: path.relative(rootDir, path.join(exportDir, 'assets', 'image-manifest.json')).replace(/\\/g, '/'),
        fontResolution: path.relative(rootDir, path.join(exportDir, 'tokens', 'font-resolution.json')).replace(/\\/g, '/'),
        responsive: path.relative(rootDir, path.join(exportDir, 'tokens', 'responsive-breakpoints.json')).replace(/\\/g, '/'),
        extractedStyles: path.relative(rootDir, path.join(exportDir, 'tokens', 'extracted-styles.json')).replace(/\\/g, '/'),
        tokenMapping: path.relative(rootDir, path.join(exportDir, 'tokens', 'token-mapping.json')).replace(/\\/g, '/'),
        variablesPlan: path.relative(rootDir, path.join(exportDir, 'tokens', 'variables-plan.json')).replace(/\\/g, '/'),
        validation: existsSync(treePath) ? 'validation-report.json' : 'pending'
      },
      nextSteps: [
        '=== PRE-BUILD ===',
        '1. v4-tree.json generieren (convert-xml-to-v4.js oder Novamira Framer-Pipeline Skill).',
        '2. MCP: novamira/adrians-export-design-system { what: all } -> design-system-export.json speichern.',
        '3. GV-IDs aus design-system-export.json in v4-tree.json eintragen (design-token-extractor.js).',
        '4. Optional: cross-validate-sources.js --design-system design-system-export.json --tree v4-tree.json',
        '5. Optional: generate-global-classes.js und asset-to-wp-media.js ausfuehren.',
        '6. patch-v4-tree-media-ids.js ausfuehren (Invariant IV).',
        '7. framer-pre-build-validate.js --tree v4-tree.json (Score muss >= 85 sein).',
        '=== ROLLBACK & SPLIT (NEU Phase 1.3/1.4) ===',
        `8. ROLLBACK: MCP-Calls aus ${rollbackPlanPath ? path.relative(rootDir, rollbackPlanPath) : 'rollback-plan.json'} ausfuehren.`,
        `   → elementor-get-content + adrians-page-settings → Ergebnisse an RollbackManager.backupPlan() uebergeben.`,
        `9. SPLIT:  ${splitPlanPath ? `Falls Tree >50 Elemente → MCP-Calls aus ${path.relative(rootDir, splitPlanPath)} ausfuehren.` : 'Tree passt in einen Call — siehe split-plan.json.'}`,
        '=== BUILD ===',
        '10. MCP: novamira/adrians-setup-v4-foundation { post_id: <ID> } aufrufen -> session-ids sichern.',
        '11. MCP: novamira/elementor-set-content (NICHT adrians-batch-build-page fuer Framer-Trees!).',
        '=== ROLLBACK BEI FEHLER ===',
        '    Bei Build-Fehler: RollbackManager.restorePlan(postId) aufrufen → restore-plan.json ausfuehren.',
        '=== POST-BUILD QA ===',
        '12. MCP: novamira/elementor-get-content -> als elementor-dump.json speichern.',
        '13. verify-build-binding.js elementor-dump.json (Invariant I).',
        '14. validate-v4-tree.js elementor-dump.json (Invariant I-V).',
        '15. MCP: novamira/adrians-layout-audit { post_id: <ID> } -- Pass-through, Nesting, Grid-Kandidaten.',
        '16. MCP: novamira/adrians-visual-qa { post_id: <ID>, breakpoints: [desktop, tablet, mobile] }.',
        '17. MCP: novamira/adrians-responsive-audit { post_id: <ID> } -- Breakpoint-Coverage.',
        '18. MCP: novamira/adrians-variable-audit { report: "drift" } -- e-gv-* Drift-Check (Fix 5).',
        '19. Bei Style-Fehlern: adrians-patch-element-styles { post_id, patches: [{element_id, ...}] }.',
        '    Hinweis: element_id in adrians-add-element setzen -> macht patch-element-styles praeziser.',
        '20. Bei GC-Problemen: adrians-add-global-class-variant / adrians-edit-global-class-variant.',
        '    Kein Tree-Rebuild noetig fuer Responsive-Fixes auf Global Classes.'
      ]
    };

    const manifestPath = path.join(rootDir, 'build-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    log.success(`Build-Manifest gespeichert unter: ${manifestPath}`);

    console.log('\n' + '='.repeat(60));
    log.success('🎉 PRE-BUILD PHASE ABGESCHLOSSEN');
    console.log('='.repeat(60));
    console.log('\nNaechste Schritte: Folge der nextSteps-Liste in build-manifest.json.');
    console.log('Alle 20 Schritte sind in der richtigen Reihenfolge dokumentiert.');
    console.log('Wichtig: Schritt 8 (Rollback), 9 (Split) und 15-16 (Layout-Audit + Visual-QA) nicht ueberspringen!');
    console.log('NEU (v1.0.0 Extra): layout-audit, variable-audit, batch-get-content, GC-Variant-Abilities verfuegbar.');

  } catch (error) {
    log.error('Ein kritischer Fehler ist im Wizard aufgetreten:');
    console.error(error);

    // ── ROLLBACK RESTORE GUIDANCE ──────────────────────────────────────
    // Wenn ein Backup existiert, zeige den Restore-Pfad an.
    if (targetPostIdNum && !isNaN(targetPostIdNum)) {
      try {
        const { RollbackManager } = await import(
          pathToFileURL(path.join(pipelineDir, 'scripts', 'lib', 'rollback.js')).href
        );
        const rb = new RollbackManager();
        if (rb.hasBackup(targetPostIdNum)) {
          const restoreOutput = rb.restorePlan(targetPostIdNum);
          const restorePlanPath = path.join(rootDir, 'restore-plan.json');
          await fs.writeFile(restorePlanPath, JSON.stringify(restoreOutput.plan, null, 2), 'utf8');
          log.warn('ROLLBACK: Ein Backup existiert. Restore-Plan wurde erstellt:');
          console.error(`  → ${path.relative(rootDir, restorePlanPath)}`);
          console.error('  → Agent: MCP-Calls aus restore-plan.json ausführen, um den alten Stand wiederherzustellen.');
        }
      } catch (_) {
        // Rollback-Modul nicht verfügbar — keine Restore-Guidance möglich
      }
    }
  } finally {
    rl.close();
  }
}

main();
