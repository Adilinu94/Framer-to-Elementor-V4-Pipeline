#!/usr/bin/env node
/**
 * scripts/framer-animation-extractor.js  —  Phase 1.5: Animation Extraction
 *
 * Analysiert einen Framer HTML-Export auf Animationen und generiert
 * eine animation-plan.json für inject-animation-code.js.
 *
 * Erkannte Animations-Typen:
 *   1. CSS @keyframes — als CSS-Snippet für site_wide_header
 *   2. CSS animation/transition Properties — extrahiert + als CSS-Snippet
 *   3. data-framer-appear-id — Framer Scroll-Animationen → GSAP-Plan
 *   4. Inline <script> mit GSAP/ScrollTrigger-Code
 *   5. transform/opacity mit transition → Motion-Hints
 *
 * Usage:
 *   # Aus Framer HTML-Export:
 *   node scripts/framer-animation-extractor.js \
 *     --html exports/framer-page/index.html \
 *     --output exports/framer-page/tokens/animation-plan.json
 *
 *   # Mit Post-ID für post-spezifische Snippets:
 *   node scripts/framer-animation-extractor.js \
 *     --html exports/framer-page/index.html \
 *     --post-id 123 \
 *     --output animation-plan.json
 *
 *   # Nur bestimmte Typen:
 *   node scripts/framer-animation-extractor.js \
 *     --html exports/framer-page/index.html \
 *     --types css,gsap \
 *     --output animation-plan.json
 *
 * Output: animation-plan.json (kompatibel mit inject-animation-code.js --plan)
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

// ─── CLI ARGS ─────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    html:       { type: 'string' },
    'post-id':  { type: 'string' },
    output:     { type: 'string' },
    types:      { type: 'string', default: 'css,gsap,js,framer' },
    verbose:    { type: 'boolean', default: false },
  },
  strict: false,
});

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

const log = (...msg) => { if (args.verbose) process.stderr.write('[anim-extract] ' + msg.join(' ') + '\n'); };

if (!args.html) {
  process.stderr.write('Error: --html <framer-export/index.html> required\n');
  process.exit(2);
}

if (!fs.existsSync(args.html)) {
  process.stderr.write(`Error: HTML file not found: ${args.html}\n`);
  process.exit(2);
}

const enabledTypes = new Set(args.types.split(',').map(t => t.trim().toLowerCase()));
const postId = args['post-id'] ? parseInt(args['post-id'], 10) : undefined;
const html = fs.readFileSync(args.html, 'utf8');

// ─── EXTRACTION FUNCTIONS ─────────────────────────────────────────────────────

/**
 * Extrahiert CSS aus <style>-Blöcken im HTML.
 */
function extractStyleBlocks(htmlContent) {
  const blocks = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(htmlContent)) !== null) {
    blocks.push(m[1]);
  }
  return blocks.join('\n');
}

/**
 * Entfernt @keyframes, @media und @font-face Blöcke aus CSS.
 * Gibt bereinigtes CSS zurück, das nur noch Basis-Regeln enthält.
 */
function stripAtBlocks(css) {
  let cleaned = css;
  const atRules = ['@keyframes', '@media', '@font-face', '@supports', '@document'];
  for (const rule of atRules) {
    const re = new RegExp(`${rule}\\s*[^{]*\\{`, 'g');
    let m;
    // Process in reverse to not invalidate indices
    const toRemove = [];
    while ((m = re.exec(cleaned)) !== null) {
      const startIdx = m.index;
      let depth = 1;
      let endIdx = startIdx + m[0].length;
      while (endIdx < cleaned.length && depth > 0) {
        if (cleaned[endIdx] === '{') depth++;
        else if (cleaned[endIdx] === '}') depth--;
        endIdx++;
      }
      toRemove.push([startIdx, endIdx]);
    }
    for (const [start, end] of [...toRemove].reverse()) {
      cleaned = cleaned.slice(0, start) + cleaned.slice(end);
    }
  }
  return cleaned;
}

/**
 * Extrahiert @keyframes-Blöcke aus CSS.
 * Gibt isolierte Keyframe-Definitionen zurück.
 */
function extractKeyframes(css) {
  const keyframes = [];
  const kfRe = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = kfRe.exec(css)) !== null) {
    const name = m[1];
    const startIdx = m.index + m[0].length;
    let depth = 1;
    let endIdx = startIdx;
    while (endIdx < css.length && depth > 0) {
      if (css[endIdx] === '{') depth++;
      else if (css[endIdx] === '}') depth--;
      endIdx++;
    }
    const body = css.slice(startIdx, endIdx - 1).trim();
    keyframes.push({
      name,
      code: `@keyframes ${name} {\n${body}\n}`,
    });
  }
  return keyframes;
}

/**
 * Extrahiert CSS-Regeln die animation-* oder transition-* Properties enthalten.
 * Operiert auf bereinigtem CSS (ohne @keyframes/@media/@font-face).
 */
function extractAnimatedRules(css) {
  // Strip @-rules first to avoid matching their internals
  const cleanedCss = stripAtBlocks(css);
  const rules = [];
  const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
  let m;
  while ((m = ruleRe.exec(cleanedCss)) !== null) {
    const selector = m[1].trim();
    const body = m[2].trim();

    // Prüfe ob die Rule animation/transition enthält
    const hasAnimation = /animation\s*[^-]/.test(body);
    const hasTransition = /transition\s*[^-:]/.test(body);

    if (hasAnimation || hasTransition) {
      const decls = {};
      const propRe = /([\w-]+)\s*:\s*([^;!]+)/g;
      let pm;
      while ((pm = propRe.exec(body)) !== null) {
        decls[pm[1].trim()] = pm[2].trim();
      }
      rules.push({
        selector,
        type: hasAnimation ? 'animation' : 'transition',
        declarations: decls,
      });
    }
  }
  return rules;
}

/**
 * Sucht nach data-framer-appear-id Attributen (Framer Scroll-Animationen).
 */
function extractFramerAppearAnimations(htmlContent) {
  const appears = [];
  const appearRe = /<[^>]*\sdata-framer-appear-id\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  let m;
  while ((m = appearRe.exec(htmlContent)) !== null) {
    const appearId = m[1];
    const tagMatch = m[0];
    // Versuche, den Element-Typ zu erkennen
    const tagRe = /^<(\w+)/;
    const tagM = tagMatch.match(tagRe);
    const elTag = tagM ? tagM[1] : 'div';

    // Verwende data-framer-appear-id als eindeutigen Attribut-Selektor
    // Escapen von Sonderzeichen im ID-Wert (doppelte Anführungszeichen)
    const safeId = appearId.replace(/"/g, '\\"');
    const selector = `[data-framer-appear-id="${safeId}"]`;

    // Dedupliziere nach appear-id
    if (!appears.some(a => a.appearId === appearId)) {
      appears.push({
        appearId,
        selector,
        tag: elTag,
        // Standard-Framer-Appear: opacity 0→1 + translateY 20px→0
        suggestedAnimation: {
          from: { opacity: 0, y: 20 },
          to: { opacity: 1, y: 0 },
          duration: 0.6,
          ease: 'power2.out',
        },
      });
    }
  }

  return appears;
}

/**
 * Extrahiert <script>-Tags mit potentiellem GSAP/Animations-Code.
 * Ignoriert framework-spezifische Scripts (React, Vue, etc.).
 */
function extractScriptBlocks(htmlContent) {
  const scripts = [];
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(htmlContent)) !== null) {
    const code = m[1].trim();
    if (!code) continue;

    // Prüfe auf Animation-Relevanz
    const isGSAP = /\bgsap\.|ScrollTrigger|gsap\.to|gsap\.from|gsap\.timeline/i.test(code);
    const isAnimation = /\banimat|\.animate\(|requestAnimationFrame|intersectionObserver/i.test(code);
    const isTransform = /\btransform\b|\.style\.\w+/i.test(code) && code.length > 50;

    if (isGSAP || isAnimation || isTransform) {
      const type = isGSAP ? 'gsap' : 'js';
      // Extrahiere GSAP-Plugins
      const gsapPlugins = [];
      if (isGSAP) {
        if (/ScrollTrigger/i.test(code)) gsapPlugins.push('ScrollTrigger');
        if (/SplitText/i.test(code)) gsapPlugins.push('SplitText');
        if (/ScrollToPlugin/i.test(code)) gsapPlugins.push('ScrollToPlugin');
        if (/Flip\b/i.test(code)) gsapPlugins.push('Flip');
        if (/Observer/i.test(code)) gsapPlugins.push('Observer');
        if (/Draggable/i.test(code)) gsapPlugins.push('Draggable');
        if (/MotionPathPlugin/i.test(code)) gsapPlugins.push('MotionPathPlugin');
      }

      scripts.push({
        type,
        code,
        gsap_plugins: gsapPlugins,
        length: code.length,
        hasGSAP: isGSAP,
      });
    }
  }
  return scripts;
}

// ─── SNIPPET BUILDERS ─────────────────────────────────────────────────────────

function buildLocation(isPostSpecific) {
  return isPostSpecific ? undefined : 'site_wide_header';
}

function buildKeyframeSnippets(keyframes, isPostSpecific) {
  if (keyframes.length === 0) return [];

  // Gruppiere alle Keyframes in einen CSS-Snippet
  const code = keyframes.map(kf => kf.code).join('\n\n');
  const names = keyframes.map(kf => kf.name).join(', ');

  return [{
    title: `CSS Keyframes: ${names}`,
    type: 'css',
    code,
    location: buildLocation(isPostSpecific),
    post_id: isPostSpecific ? postId : undefined,
    description: `${keyframes.length} @keyframes definiert (${names})`,
    tags: ['framer', 'keyframes', 'css', 'animation'],
    on_conflict: 'replace',
    priority: 10,
  }];
}

function buildAnimationRulesSnippet(animatedRules, isPostSpecific) {
  if (animatedRules.length === 0) return [];

  // Baue CSS-Snippet mit allen animation/transition Rules
  const rules = animatedRules.map(r =>
    `${r.selector} {\n${Object.entries(r.declarations).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`
  ).join('\n\n');

  return [{
    title: 'Framer CSS Animations & Transitions',
    type: 'css',
    code: rules,
    location: buildLocation(isPostSpecific),
    post_id: isPostSpecific ? postId : undefined,
    description: `${animatedRules.length} animated CSS rules extrahiert`,
    tags: ['framer', 'animation', 'transition', 'css'],
    on_conflict: 'replace',
    priority: 20,
  }];
}

function buildFramerAppearSnippet(appears, isPostSpecific) {
  if (appears.length === 0) return [];

  // Generiere GSAP-Code für Scroll-basierte Fade-In-Up Animationen
  const gsapConfigs = appears.map((a, i) => {
    const { from, to, duration, ease } = a.suggestedAnimation;
    return (
      `  // ${a.selector}  (appear-id: ${a.appearId})\n` +
      `  gsap.fromTo('${a.selector}',\n` +
      `    { opacity: ${from.opacity}, y: ${from.y} },\n` +
      `    {\n` +
      `      opacity: ${to.opacity}, y: ${to.y},\n` +
      `      duration: ${duration},\n` +
      `      ease: '${ease}',\n` +
      `      scrollTrigger: {\n` +
      `        trigger: '${a.selector}',\n` +
      `        start: 'top 85%',\n` +
      `        toggleActions: 'play none none reverse',\n` +
      `      },\n` +
      `    }\n` +
      `  );`
    );
  }).join('\n\n');

  const code = (
    `// Framer Scroll-Animationen (${appears.length} Elemente)\n` +
    `// Generiert aus data-framer-appear-id Attributen\n` +
    `// GSAP + ScrollTrigger erforderlich\n\n` +
    `document.addEventListener('DOMContentLoaded', () => {\n` +
    `  gsap.registerPlugin(ScrollTrigger);\n\n` +
    `${gsapConfigs}\n` +
    `});\n`
  );

  return [{
    title: `Framer Scroll Appear (${appears.length} Elemente)`,
    type: 'gsap',
    code,
    location: 'site_wide_footer',
    post_id: isPostSpecific ? postId : undefined,
    gsap_version: '3.12.5',
    gsap_plugins: ['ScrollTrigger'],
    description: `${appears.length} Elemente mit data-framer-appear-id → GSAP ScrollTrigger`,
    tags: ['framer', 'scroll', 'appear', 'gsap', 'scrolltrigger'],
    on_conflict: 'replace',
    priority: 30,
  }];
}

function buildScriptSnippets(scripts, isPostSpecific) {
  return scripts.map((s, i) => ({
    title: `Framer Script #${i + 1} (${s.type.toUpperCase()})`,
    type: s.type,
    code: s.code,
    location: 'site_wide_footer',
    post_id: isPostSpecific ? postId : undefined,
    gsap_version: s.hasGSAP ? '3.12.5' : undefined,
    gsap_plugins: s.gsap_plugins.length > 0 ? s.gsap_plugins : undefined,
    description: `${s.length} chars ${s.type} code${s.hasGSAP ? ' mit GSAP' : ''}`,
    tags: ['framer', s.type, ...(s.hasGSAP ? ['gsap'] : [])],
    on_conflict: 'replace',
    priority: 40 + i,
  }));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

log('Reading HTML:', args.html);

const cssContent = extractStyleBlocks(html);
log(`  CSS from style blocks: ${cssContent.length} chars`);

const isPostSpecific = !!postId;
const snippets = [];

// ── Extrahiere ALLE Daten EINMAL (cached) ──────────────────────────────────

const keyframes     = enabledTypes.has('css')             ? extractKeyframes(cssContent) : [];
const animatedRules = enabledTypes.has('css')             ? extractAnimatedRules(cssContent) : [];
const appears       = enabledTypes.has('framer')          ? extractFramerAppearAnimations(html) : [];
const scripts       = (enabledTypes.has('gsap') || enabledTypes.has('js'))
                      ? extractScriptBlocks(html) : [];

log(`  @keyframes found: ${keyframes.length}`);
log(`  Animated CSS rules found: ${animatedRules.length}`);
log(`  data-framer-appear-id elements: ${appears.length}`);
log(`  Animation scripts found: ${scripts.length}`);

// ── Baue Snippets aus gecachten Ergebnissen ────────────────────────────────

if (keyframes.length > 0) {
  snippets.push(...buildKeyframeSnippets(keyframes, isPostSpecific));
}
if (animatedRules.length > 0) {
  snippets.push(...buildAnimationRulesSnippet(animatedRules, isPostSpecific));
}
if (appears.length > 0) {
  snippets.push(...buildFramerAppearSnippet(appears, isPostSpecific));
}
if (scripts.length > 0) {
  snippets.push(...buildScriptSnippets(scripts, isPostSpecific));
}

// ─── OUTPUT ───────────────────────────────────────────────────────────────────

const result = {
  meta: {
    source: args.html,
    extracted_at: new Date().toISOString(),
    post_id: postId || null,
    stats: {
      total_snippets: snippets.length,
      css_snippets: snippets.filter(s => s.type === 'css').length,
      gsap_snippets: snippets.filter(s => s.type === 'gsap').length,
      js_snippets: snippets.filter(s => s.type === 'js').length,
      keyframes: keyframes.length,
      framer_appears: appears.length,
      animated_rules: animatedRules.length,
      scripts: scripts.length,
    },
  },
  snippets,
};

const output = JSON.stringify(result, null, 2);

if (args.output) {
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
  fs.writeFileSync(args.output, output, 'utf8');
  process.stderr.write(`[anim-extract] Saved to ${args.output}\n`);
} else {
  process.stdout.write(output + '\n');
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

const stats = result.meta.stats;
console.log(`\n╔══════════════════════════════════════════════════════╗`);
console.log(`║  framer-animation-extractor.js                       ║`);
console.log(`╚══════════════════════════════════════════════════════╝`);
console.log(`\n  📄 Source:  ${path.basename(args.html)}`);
console.log(`  🎬 Snippets: ${snippets.length} total`);
console.log(`     CSS:    ${stats.css_snippets}  (${stats.keyframes} @keyframes, ${stats.animated_rules} rules)`);
console.log(`     GSAP:   ${stats.gsap_snippets}  (${stats.framer_appears} appear-IDs)`);
console.log(`     JS:     ${stats.js_snippets}  (${stats.scripts} scripts)`);

if (snippets.length === 0) {
  console.log(`\n  ⚠️  Keine Animationen gefunden.`);
  console.log(`  → Erstelle animation-plan.json manuell oder nutze andere Flags.`);
} else {
  console.log(`\n  ─── Nächster Schritt ───────────────────────────────`);
  console.log(`  node scripts/inject-animation-code.js --plan ${args.output || 'animation-plan.json'}`);
  if (postId) {
    console.log(`  → Injektion auf Post #${postId}`);
  }
  console.log(`  → MCP-Plan wird als animation-mcp-plan.json gespeichert`);
}

console.log('');

process.exit(snippets.length === 0 ? 1 : 0);

// ─── HELP ─────────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
framer-animation-extractor.js — Framer HTML → animation-plan.json

Extrahiert Animationen aus Framer HTML-Exports:
  • CSS @keyframes Definitionen
  • CSS animation/transition Regeln
  • data-framer-appear-id → GSAP ScrollTrigger Plan
  • Inline <script> Blöcke mit GSAP/Animations-Code

Usage:
  node scripts/framer-animation-extractor.js \\
    --html exports/framer-page/index.html \\
    --output exports/framer-page/tokens/animation-plan.json

  # Mit Post-ID (post-spezifische Snippets):
  node scripts/framer-animation-extractor.js \\
    --html exports/framer-page/index.html \\
    --post-id 123 \\
    --output animation-plan.json

  # Nur bestimmte Typen:
  node scripts/framer-animation-extractor.js \\
    --html exports/framer-page/index.html \\
    --types css,gsap \\
    --output animation-plan.json

  # Stdout (kein --output):
  node scripts/framer-animation-extractor.js \\
    --html exports/framer-page/index.html

Typen: css | gsap | js | framer

Output: animation-plan.json — direkt nutzbar mit:
  node scripts/inject-animation-code.js --plan animation-plan.json
`);
}
