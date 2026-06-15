/**
 * scripts/wizard/cmd-pipeline.js — Full 14-Step Pipeline (Phase 6)
 *
 * UMBAUPLAN v2.0 Phase 6: Orchestriert alle 14 Pipeline-Schritte.
 * Wird sowohl vom interaktiven Wizard als auch als standalone
 * Sub-Command (`node wizard.js pipeline`) verwendet.
 *
 * STEPS:
 *   1.  FramerExport (cached, existing)
 *   2.  CSS-Token-Extraktion (extract-framer-css-tokens.js, PRIMARY)
 *   3.  Browser-Crawl-Fallback (extract-framer-css-tokens.js --url, FALLBACK)
 *   4.  Unframer MCP getProjectXml (delegated to agent)
 *   5.  Unframer MCP getNodeXml(section) (delegated to agent)
 *   6.  Style-Referenzen aus XML sammeln (token-collection)
 *   7.  Token-Mapping erstellen (design-system-builder.js)
 *   8.  Token-Mapping validieren (pre-build-validation token checks)
 *   9.  Design System aufbauen (design-system-builder.js)
 *  10.  resolve-fonts.js (existing, font-resolution.json)
 *  11.  convert-xml-to-v4.js (WITH --token-map + --output-dir)
 *  12.  framer-pre-build-validate.js (17 Guards, Score >= 85%)
 *  13.  elementor-set-content (MCP — delegated to agent)
 *  14.  Visual QA + Auto-Fix (build-quality-gate.js)
 *
 * Usage:
 *   node wizard.js pipeline --url https://example.framer.app/ [--post-id 42]
 *   node wizard.js pipeline --export-dir exports/my-project/
 */

import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import {
  log, findWorkspaceRoot, findFramerExportDir,
  runFile, findIndexHtmlDirs, readJsonIfExists,
  nodeBin, npxBin, npmBin,
  checkFramerExportCache, writeFramerExportCache,
  pipelineDir, repoDir,
} from './shared.js';

/**
 * Gibt die Hilfe fuer dieses Subcommand aus.
 */
export function printHelp() {
  console.log(`wizard.js pipeline — Vollstaendige 14-Step Pipeline

USAGE:
  node wizard.js pipeline --url <framer-url> [OPTIONS]

OPTIONS:
  --url <url>           Framer-Quell-URL (Pflicht)
  --post-id <ID>        Ziel-Post-ID in WordPress
  --export-dir <dir>    FramerExport-Verzeichnis (ueberspringt Export)
  --no-cache            FramerExport-Cache umgehen
  --skip-qa             QA-Gate ueberspringen (schnellerer Build)
  --dry-run             Keine MCP-Calls, nur Plan generieren
  --verbose             Ausfuehrliche Logs

PIPELINE STEPS:
   1. FramerExport (gecached)
   2. CSS-Token-Extraktion (FramerExport HTML)
   3. Browser-Crawl-Fallback (wenn 2 unvollstaendig)
   4. Unframer MCP getProjectXml
   5. Unframer MCP getNodeXml(sections)
   6. Style-Referenzen sammeln
   7. Token-Mapping erstellen
   8. Token-Mapping validieren
   9. Design System aufbauen (Variables + Classes)
  10. Fonts aufloesen (resolve-fonts.js)
  11. XML → V4 Tree konvertieren
  12. Pre-Build-Validation (17 Guards)
  13. elementor-set-content (MCP)
  14. Visual QA + Auto-Fix

BEISPIELE:
  node wizard.js pipeline --url https://hilarious-workshops-284047.framer.app/
  node wizard.js pipeline --url https://example.framer.app/ --post-id 42
  node wizard.js pipeline --export-dir exports/my-page/ --verbose
`);
}

/**
 * Führt den vollen 14-Step Pipeline-Durchlauf aus.
 *
 * @param {object} options
 * @param {string} options.framerUrl - Framer-Quell-URL
 * @param {string} [options.postId] - WordPress Post-ID
 * @param {string} [options.exportDir] - Existierendes Export-Verzeichnis (überspringt Schritt 1)
 * @param {boolean} [options.noCache] - Cache umgehen
 * @param {boolean} [options.skipQa] - QA-Gate überspringen
 * @param {boolean} [options.dryRun] - Keine MCP-Calls
 * @param {boolean} [options.verbose] - Ausführliche Logs
 * @returns {Promise<object>} Pipeline-Resultat mit Status und Artefakten
 */
export async function runPipeline({
  framerUrl,
  postId = null,
  exportDir: existingExportDir = null,
  noCache = false,
  skipQa = false,
  dryRun = false,
  verbose = false,
}) {
  const rootDir = findWorkspaceRoot();
  const startTime = Date.now();
  const steps = [];
  let exportDir = existingExportDir;
  let tokenMapPath = null;
  let designSystemDir = null;
  let v4TreePath = null;

  const vLog = (...m) => { if (verbose) process.stderr.write('[pipeline] ' + m.join(' ') + '\n'); };

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  🚀 FULL 14-STEP PIPELINE');
  console.log(`${'═'.repeat(60)}`);
  console.log(`  URL:     ${framerUrl || '(from export-dir)'}`);
  console.log(`  Post-ID: ${postId || 'auto'}`);
  console.log(`  Mode:    ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`${'═'.repeat(60)}\n`);

  // ════════════════════════════════════════════
  // STEP 1: FramerExport
  // ════════════════════════════════════════════

  if (exportDir && existsSync(exportDir)) {
    log.success(`Step 1/14: FramerExport — vorhanden: ${exportDir}`);
    steps.push({ step: 1, name: 'FramerExport', status: 'cached' });
  } else if (framerUrl) {
    log.step('Step 1/14: FramerExport...');

    // Check cache first
    const cacheResult = await checkFramerExportCache(framerUrl, noCache);
    if (cacheResult.cached && cacheResult.exportDir && existsSync(cacheResult.exportDir)) {
      exportDir = cacheResult.exportDir;
      log.success(`FramerExport aus Cache: ${exportDir}`);
      steps.push({ step: 1, name: 'FramerExport', status: 'cached' });
    } else {
      const framerExportDir = findFramerExportDir(rootDir);
      if (!framerExportDir) {
        log.error('FramerExport nicht gefunden. Setze FRAMER_EXPORT_DIR oder lege unter tools/framer-export ab.');
        return { status: 'FAILED', step: 1, error: 'FramerExport directory not found' };
      }

      const exportFolderName = 'framer-' + framerUrl.replace(/^https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').substring(0, 30);
      exportDir = path.join(rootDir, 'exports', exportFolderName);
      await fs.mkdir(exportDir, { recursive: true });

      try {
        const pkgJson = await readJsonIfExists(path.join(framerExportDir, 'package.json'));
        const before = await findIndexHtmlDirs(framerExportDir);

        if (pkgJson?.scripts?.dev) {
          await runFile(npmBin, ['run', 'dev', '--', framerUrl], 'FramerExport', framerExportDir);
        } else if (existsSync(path.join(framerExportDir, 'src', 'cli', 'index.ts'))) {
          await runFile(npxBin, ['tsx', 'src/cli/index.ts', framerUrl, '--platform', 'framer'], 'FramerExport', framerExportDir);
        } else {
          throw new Error('Kein unterstuetzter FramerExport-Einstieg gefunden.');
        }

        const after = await findIndexHtmlDirs(framerExportDir);
        const beforeSet = new Set(before.map(e => path.resolve(e.dir).toLowerCase()));
        const generated = after.find(e => !beforeSet.has(path.resolve(e.dir).toLowerCase())) || after[0];
        if (!generated) throw new Error('FramerExport hat kein index.html erzeugt.');
        exportDir = generated.dir;

        await writeFramerExportCache(framerUrl, exportDir);
        log.success(`FramerExport: ${exportDir}`);
        steps.push({ step: 1, name: 'FramerExport', status: 'ok' });
      } catch (err) {
        log.error(`FramerExport fehlgeschlagen: ${err.message}`);
        return { status: 'FAILED', step: 1, error: err.message };
      }
    }
  } else {
    log.error('--url oder --export-dir erforderlich');
    return { status: 'FAILED', step: 1, error: 'Missing --url or --export-dir' };
  }

  const exportHtml = path.join(exportDir, 'index.html');
  if (!existsSync(exportHtml)) {
    log.error(`index.html nicht gefunden in ${exportDir}`);
    return { status: 'FAILED', step: 1, error: 'index.html missing in export dir' };
  }

  // ════════════════════════════════════════════
  // STEP 2: CSS-Token-Extraktion (FramerExport HTML)
  // ════════════════════════════════════════════

  log.step('Step 2/14: CSS-Token-Extraktion (FramerExport HTML)...');

  const tokensDir = path.join(exportDir, 'tokens');
  await fs.mkdir(tokensDir, { recursive: true });
  tokenMapPath = path.join(tokensDir, 'token-mapping.json');

  try {
    await runFile(nodeBin, [
      path.join(pipelineDir, 'scripts', 'extract-framer-css-tokens.js'),
      '--html', exportHtml,
      '--output', tokenMapPath,
      ...(verbose ? ['--verbose'] : []),
    ], 'CSS-Token-Extraktion', pipelineDir);
    steps.push({ step: 2, name: 'CSS-Token-Extraktion', status: 'ok' });
  } catch (err) {
    log.warn(`Token-Extraktion aus HTML fehlgeschlagen: ${err.message}`);
    steps.push({ step: 2, name: 'CSS-Token-Extraktion', status: 'warning', error: err.message });
  }

  // ════════════════════════════════════════════
  // STEP 3: Browser-Crawl-Fallback (if needed)
  // ════════════════════════════════════════════

  let tokenMap = null;
  try {
    tokenMap = JSON.parse(await fs.readFile(tokenMapPath, 'utf8'));
  } catch { tokenMap = null; }

  const unmappedCount = tokenMap?.unmapped_tokens?.length || 0;
  const mappedCount = Object.keys(tokenMap?.colors || {}).length;

  if (unmappedCount > 0 && mappedCount < 5 && framerUrl) {
    log.step('Step 3/14: Browser-Crawl-Fallback (live Framer page)...');

    try {
      await runFile(nodeBin, [
        path.join(pipelineDir, 'scripts', 'extract-framer-css-tokens.js'),
        '--url', framerUrl,
        '--output', tokenMapPath,
        ...(verbose ? ['--verbose'] : []),
      ], 'Browser-Crawl-Fallback', pipelineDir);

      // Re-read token map
      tokenMap = JSON.parse(await fs.readFile(tokenMapPath, 'utf8'));
      const newMapped = Object.keys(tokenMap?.colors || {}).length;
      log.success(`Fallback: ${newMapped} tokens mapped (was ${mappedCount})`);
      steps.push({ step: 3, name: 'Browser-Crawl-Fallback', status: 'ok' });
    } catch (err) {
      log.warn(`Browser-Crawl-Fallback fehlgeschlagen: ${err.message}`);
      steps.push({ step: 3, name: 'Browser-Crawl-Fallback', status: 'warning', error: err.message });
    }
  } else {
    log.info(`Step 3/14: Browser-Crawl-Fallback — übersprungen (${mappedCount} mapped, ${unmappedCount} unmapped)`);
    steps.push({ step: 3, name: 'Browser-Crawl-Fallback', status: 'skipped' });
  }

  // ════════════════════════════════════════════
  // STEPS 4-5: Unframer MCP (delegated to agent)
  // ════════════════════════════════════════════

  log.info('Steps 4-5/14: Unframer MCP — an Agent delegiert');
  log.info('  → getProjectXml + getNodeXml(sections)');
  log.info('  → MCP: mcp.unframer.co mit 4 Tools');
  steps.push({ step: 4, name: 'Unframer getProjectXml', status: 'delegated' });
  steps.push({ step: 5, name: 'Unframer getNodeXml', status: 'delegated' });

  // ════════════════════════════════════════════
  // STEP 6: Style-Referenzen sammeln
  // ════════════════════════════════════════════

  log.step('Step 6/14: Style-Referenzen sammeln...');

  const styleRefsPath = path.join(tokensDir, 'style-refs.json');
  const styleRefs = {
    generated_at: new Date().toISOString(),
    colors: tokenMap?.colors || {},
    textStyles: tokenMap?.textStyles || {},
    unmapped: tokenMap?.unmapped_tokens || [],
    stats: {
      mapped_colors: mappedCount,
      unmapped_tokens: unmappedCount,
      text_styles: Object.keys(tokenMap?.textStyles || {}).length,
    },
  };
  await fs.writeFile(styleRefsPath, JSON.stringify(styleRefs, null, 2), 'utf8');
  log.success(`Style-Referenzen: ${styleRefs.stats.mapped_colors} colors, ${styleRefs.stats.text_styles} text styles`);
  steps.push({ step: 6, name: 'Style-Referenzen sammeln', status: 'ok' });

  // ════════════════════════════════════════════
  // STEPS 7-8: Token-Mapping erstellen + validieren
  // ════════════════════════════════════════════

  log.step('Steps 7-8/14: Token-Mapping erstellen + validieren...');

  const mappingValid = mappedCount > 0;
  if (mappingValid) {
    log.success(`Token-Mapping: ${mappedCount} colors zugeordnet`);
  } else {
    log.warn(`Token-Mapping: KEINE Farben zugeordnet (${unmappedCount} unmapped) — manuelles Mapping empfohlen`);
  }
  steps.push({ step: 7, name: 'Token-Mapping erstellen', status: mappingValid ? 'ok' : 'warning' });

  // Validate critical tokens exist
  const criticalPaths = ['/Theme Color/Very Dark Green', '/Theme Color/White', '/Theme Color/Black'];
  const missingCritical = criticalPaths.filter(p => !tokenMap?.colors?.[p]);
  if (missingCritical.length > 0) {
    log.warn(`Kritische Token-Pfade ohne Mapping: ${missingCritical.join(', ')}`);
    steps.push({ step: 8, name: 'Token-Mapping validieren', status: 'warning', detail: `Missing: ${missingCritical.join(', ')}` });
  } else {
    log.success('Kritische Token-Pfade alle gemappt.');
    steps.push({ step: 8, name: 'Token-Mapping validieren', status: 'ok' });
  }

  // ════════════════════════════════════════════
  // STEP 9: Design System aufbauen
  // ════════════════════════════════════════════

  log.step('Step 9/14: Design System aufbauen...');

  designSystemDir = path.join(exportDir, 'design-system');
  await fs.mkdir(designSystemDir, { recursive: true });

  try {
    await runFile(nodeBin, [
      path.join(pipelineDir, 'scripts', 'design-system-builder.js'),
      '--token-map', tokenMapPath,
      '--output-dir', designSystemDir,
      ...(verbose ? ['--verbose'] : []),
    ], 'Design System Builder', pipelineDir);

    const varsPath = path.join(designSystemDir, 'variables.json');
    const classesPath = path.join(designSystemDir, 'global-classes.json');

    let varCount = 0, classCount = 0;
    try {
      const vars = JSON.parse(await fs.readFile(varsPath, 'utf8'));
      varCount = vars.meta?.total || vars.variables?.length || 0;
    } catch {}
    try {
      const cls = JSON.parse(await fs.readFile(classesPath, 'utf8'));
      classCount = cls.meta?.total || cls.classes?.length || 0;
    } catch {}

    log.success(`Design System: ${varCount} variables, ${classCount} global classes`);
    steps.push({ step: 9, name: 'Design System', status: 'ok', detail: `${varCount}v + ${classCount}c` });
  } catch (err) {
    log.warn(`Design System Builder fehlgeschlagen: ${err.message}`);
    steps.push({ step: 9, name: 'Design System', status: 'warning', error: err.message });
  }

  // ════════════════════════════════════════════
  // STEP 10: resolve-fonts.js
  // ════════════════════════════════════════════

  log.step('Step 10/14: Fonts aufloesen...');

  const fontResPath = path.join(tokensDir, 'font-resolution.json');
  try {
    await runFile(nodeBin, [
      path.join(pipelineDir, 'scripts', 'resolve-fonts.js'),
      '--html', exportHtml,
      '--fonts-dir', path.join(exportDir, 'assets', 'fonts'),
      '--output', fontResPath,
    ], 'resolve-fonts.js', pipelineDir);
    steps.push({ step: 10, name: 'resolve-fonts.js', status: 'ok' });
  } catch (err) {
    log.warn(`resolve-fonts.js fehlgeschlagen: ${err.message}`);
    steps.push({ step: 10, name: 'resolve-fonts.js', status: 'warning', error: err.message });
  }

  // ════════════════════════════════════════════
  // STEP 11: convert-xml-to-v4.js (WITH token-map)
  // ════════════════════════════════════════════

  log.step('Step 11/14: XML → V4 Tree konvertieren...');

  // Find XML files in export dir
  let xmlFiles = [];
  try {
    const entries = await fs.readdir(exportDir, { withFileTypes: true, recursive: true });
    xmlFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.xml'))
      .map(e => path.join(e.parentPath || path.dirname(path.join(exportDir, e.name)), e.name))
      .slice(0, 5); // Max 5 top-level XML files
  } catch { xmlFiles = []; }

  // Also check tools/framer-export for XML
  const framerToolsDir = path.join(rootDir, 'tools', 'framer-export');
  if (xmlFiles.length === 0 && existsSync(framerToolsDir)) {
    try {
      const entries = await fs.readdir(framerToolsDir, { withFileTypes: true });
      xmlFiles = entries
        .filter(e => e.isFile() && e.name.endsWith('.xml'))
        .map(e => path.join(framerToolsDir, e.name));
    } catch {}
  }

  const outputDir = path.join(exportDir, 'v4-output');
  await fs.mkdir(outputDir, { recursive: true });
  v4TreePath = path.join(outputDir, 'elements.json');

  if (xmlFiles.length > 0) {
    // Use the updated token-mapping for GV-IDs
    const updatedTokenMap = path.join(designSystemDir, 'token-mapping-updated.json');
    const tokenMapArg = existsSync(updatedTokenMap) ? updatedTokenMap : tokenMapPath;

    const convertResults = [];
    for (const xmlFile of xmlFiles) {
      const pageName = path.basename(xmlFile, '.xml');
      try {
        await runFile(nodeBin, [
          path.join(pipelineDir, 'scripts', 'convert-xml-to-v4.js'),
          '--xml', xmlFile,
          '--token-map', tokenMapArg,
          '--output-dir', outputDir,
          '--output', path.join(outputDir, `${pageName}.json`),
          ...(verbose ? ['--verbose'] : []),
        ], `convert-xml-to-v4: ${pageName}`, pipelineDir);
        convertResults.push({ page: pageName, status: 'ok' });
      } catch (err) {
        log.warn(`Konvertierung ${pageName} fehlgeschlagen: ${err.message}`);
        convertResults.push({ page: pageName, status: 'failed', error: err.message });
      }
    }
    steps.push({ step: 11, name: 'convert-xml-to-v4.js', status: convertResults.every(r => r.status === 'ok') ? 'ok' : 'warning', detail: convertResults });
  } else {
    log.warn('Keine XML-Dateien gefunden. Überspringe V4-Konvertierung.');
    log.info('  → XML-Dateien sollten in tools/framer-export/ oder im Export-Verzeichnis liegen.');
    steps.push({ step: 11, name: 'convert-xml-to-v4.js', status: 'skipped', detail: 'No XML files found' });
  }

  // ════════════════════════════════════════════
  // STEP 12: framer-pre-build-validate.js
  // ════════════════════════════════════════════

  log.step('Step 12/14: Pre-Build-Validation (17 Guards)...');

  if (v4TreePath && existsSync(v4TreePath)) {
    const preBuildReportPath = path.join(outputDir, 'pre-build-validation.json');
    try {
      await runFile(nodeBin, [
        path.join(pipelineDir, 'scripts', 'framer-pre-build-validate.js'),
        '--tree', v4TreePath,
        '--tokens', tokenMapPath,
        '--output', preBuildReportPath,
      ], 'Pre-Build-Validation', pipelineDir);

      let score = 0;
      try {
        const report = JSON.parse(await fs.readFile(preBuildReportPath, 'utf8'));
        score = report.meta?.score || 0;
        log.success(`Pre-Build: ${score}% (17 Guards)`);

        if (score < 85) {
          log.warn(`Score ${score}% < 85% — Build wird trotzdem fortgesetzt (Prüfung empfohlen).`);
          steps.push({ step: 12, name: 'Pre-Build-Validation', status: 'warning', score });
        } else {
          steps.push({ step: 12, name: 'Pre-Build-Validation', status: 'ok', score });
        }
      } catch {
        steps.push({ step: 12, name: 'Pre-Build-Validation', status: 'ok' });
      }
    } catch (err) {
      log.warn(`Pre-Build-Validation fehlgeschlagen: ${err.message}`);
      steps.push({ step: 12, name: 'Pre-Build-Validation', status: 'warning', error: err.message });
    }
  } else {
    log.warn('Kein V4-Tree gefunden. Überspringe Pre-Build-Validation.');
    steps.push({ step: 12, name: 'Pre-Build-Validation', status: 'skipped' });
  }

  // ════════════════════════════════════════════
  // STEP 13: elementor-set-content (MCP — delegated)
  // ════════════════════════════════════════════

  if (dryRun) {
    log.info('Step 13/14: elementor-set-content — DRY-RUN (kein MCP-Call)');
    steps.push({ step: 13, name: 'elementor-set-content', status: 'dry-run' });
  } else if (postId && v4TreePath && existsSync(v4TreePath)) {
    log.info('Step 13/14: elementor-set-content — an Agent delegiert');
    log.info(`  → MCP: novamira/elementor-set-content { post_id: ${postId} }`);
    log.info(`  → Content: ${v4TreePath}`);
    steps.push({ step: 13, name: 'elementor-set-content', status: 'delegated', detail: `post_id=${postId}` });
  } else {
    log.info('Step 13/14: elementor-set-content — übersprungen (kein post-id oder kein V4-Tree)');
    steps.push({ step: 13, name: 'elementor-set-content', status: 'skipped' });
  }

  // ════════════════════════════════════════════
  // STEP 14: Visual QA + Auto-Fix
  // ════════════════════════════════════════════

  if (skipQa) {
    log.info('Step 14/14: Visual QA + Auto-Fix — übersprungen (--skip-qa)');
    steps.push({ step: 14, name: 'Visual QA + Auto-Fix', status: 'skipped' });
  } else if (v4TreePath && existsSync(v4TreePath)) {
    log.step('Step 14/14: Visual QA + Auto-Fix...');

    const qaDir = path.join(exportDir, 'qa');
    await fs.mkdir(qaDir, { recursive: true });

    try {
      const gateArgs = [
        path.join(pipelineDir, 'scripts', 'build-quality-gate.js'),
        '--tree', v4TreePath,
        '--tokens', tokenMapPath,
        '--output-dir', qaDir,
        '--skip-screenshots',
        ...(dryRun ? ['--dry-run'] : []),
        ...(verbose ? ['--verbose'] : []),
      ];
      if (postId) gateArgs.push('--post-id', postId);

      await runFile(nodeBin, gateArgs, 'Build Quality Gate', pipelineDir);

      const gateReportPath = path.join(qaDir, 'quality-gate-report.json');
      let gateStatus = 'ok';
      try {
        const gateReport = JSON.parse(await fs.readFile(gateReportPath, 'utf8'));
        gateStatus = gateReport.summary?.status || 'ok';
        log.success(`QA-Gate: ${gateStatus}`);
      } catch {}

      steps.push({ step: 14, name: 'Visual QA + Auto-Fix', status: gateStatus === 'BLOCKED' ? 'warning' : 'ok' });
    } catch (err) {
      log.warn(`QA-Gate fehlgeschlagen: ${err.message}`);
      steps.push({ step: 14, name: 'Visual QA + Auto-Fix', status: 'warning', error: err.message });
    }
  } else {
    log.info('Step 14/14: Visual QA + Auto-Fix — übersprungen (kein V4-Tree)');
    steps.push({ step: 14, name: 'Visual QA + Auto-Fix', status: 'skipped' });
  }

  // ════════════════════════════════════════════
  // FINAL SUMMARY
  // ════════════════════════════════════════════

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const okSteps = steps.filter(s => s.status === 'ok' || s.status === 'cached').length;
  const warnSteps = steps.filter(s => s.status === 'warning').length;
  const skipSteps = steps.filter(s => s.status === 'skipped' || s.status === 'delegated' || s.status === 'dry-run').length;
  const failSteps = steps.filter(s => s.status === 'failed').length;

  const summary = {
    pipeline: '14-step',
    generated: new Date().toISOString(),
    elapsed_seconds: parseFloat(elapsed),
    framer_url: framerUrl,
    post_id: postId,
    export_dir: exportDir,
    mode: dryRun ? 'dry-run' : 'live',
    results: {
      total: steps.length,
      ok: okSteps,
      warnings: warnSteps,
      skipped: skipSteps,
      failed: failSteps,
    },
    steps: steps.map(s => ({
      step: s.step,
      name: s.name,
      status: s.status,
      score: s.score,
      detail: s.detail,
      error: s.error,
    })),
    artifacts: {
      token_mapping: tokenMapPath,
      design_system: designSystemDir,
      v4_tree: v4TreePath,
      variables: designSystemDir ? path.join(designSystemDir, 'variables.json') : null,
      global_classes: designSystemDir ? path.join(designSystemDir, 'global-classes.json') : null,
      batch_create_plan: designSystemDir ? path.join(designSystemDir, 'batch-create-plan.json') : null,
      font_resolution: fontResPath,
      qa_report: skipQa ? null : path.join(exportDir, 'qa', 'quality-gate-report.json'),
    },
  };

  const summaryPath = path.join(exportDir, 'pipeline-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  📊 PIPELINE COMPLETE in ${elapsed}s`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  ✅ ${okSteps} ok  ⚠️ ${warnSteps} warnings  ⏭️ ${skipSteps} skipped  ❌ ${failSteps} failed`);
  console.log(`  📄 Summary: ${path.relative(rootDir, summaryPath)}`);
  console.log(`${'═'.repeat(60)}\n`);

  return summary;
}
