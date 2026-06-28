#!/usr/bin/env node
/**
 * generate-color-token-mapping.js — Phase 11: Color Token Mapping
 *
 * Mappt unmapped CSS-Color-Tokens zu Framer-Style-Pfaden und weist
 * deterministische e-gv-* GV-IDs zu. Ohne Unframer MCP werden die
 * Hex-Werte aus den CSS-Variablen der live Framer-Seite verwendet.
 *
 * Strategy:
 *   1. Liest die 22 unmapped tokens (haben bereits hex-Werte)
 *   2. Mappt Framer-Style-Pfade (z.B. /Theme Color/Very Dark Green)
 *      auf die passenden Hex-Werte mittels Name→Hex Heuristik
 *   3. Weist jedem Hex-Wert eine deterministische e-gv-* ID zu
 *   4. Generiert ein enriched token-mapping.json
 *
 * Usage:
 *   # Project-agnostic (no color map):
 *   node scripts/generate-color-token-mapping.js \
 *     --token-map tokens/token-mapping.json \
 *     --output tokens/token-mapping.json
 *
 *   # With project-specific color map:
 *   node scripts/generate-color-token-mapping.js \
 *     --token-map tokens/token-mapping.json \
 *     --color-map exports/my-project/color-map.json \
 *     --output tokens/token-mapping.json
 *
 *   # color-map.json format:
 *   {
 *     "#061d13": "/Theme Color/Very Dark Green",
 *     "#ffffff": "/Theme Color/White",
 *     ...
 *   }
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';

const { values: args } = parseArgs({
  options: {
    'token-map': { type: 'string' },
    'color-map': { type: 'string' },  // optional: project-specific hex→framer-path JSON
    output:      { type: 'string' },
    verbose:     { type: 'boolean', default: false },
    'dry-run':   { type: 'boolean', default: false },
  },
  strict: false,
});

if (!args['token-map']) {
  console.error('Error: --token-map required');
  process.exit(2);
}

const log = (...m) => { if (args.verbose) process.stderr.write('[color-map] ' + m.join(' ') + '\n'); };
const warn = (...m) => process.stderr.write('\u26a0 ' + m.join(' ') + '\n');

const tokenMap = JSON.parse(fs.readFileSync(args['token-map'], 'utf8'));

// ── Step 1: Load project-specific color map (optional) ─────────────

// For project-agnostic operation, provide a --color-map JSON file:
//   {"#hexcolor": "/Framer Path/Color Name", ...}
// Without --color-map, all unmapped colors get generic /Custom Color/ paths.
//
// Example (MasterCare):
//   {
//     "#061d13": "/Theme Color/Very Dark Green",
//     "#ffffff": "/Theme Color/White",
//     "#0b0b0b": "/Theme Color/Black"
//   }

let HEX_TO_FRAMER_PATH = {};
if (args['color-map']) {
  if (fs.existsSync(args['color-map'])) {
    HEX_TO_FRAMER_PATH = JSON.parse(fs.readFileSync(args['color-map'], 'utf8'));
    log(`Loaded ${Object.keys(HEX_TO_FRAMER_PATH).length} color mappings from ${args['color-map']}`);
  } else {
    warn(`Color map not found: ${args['color-map']}. Using generic paths.`);
  }
} else {
  log('No --color-map provided. Using generic /Custom Color/ paths for all unmapped colors.');
}

// ── Step 2: Process unmapped tokens → Framer paths + GV-IDs ─────────

const colors = {};
const gvMap = new Map(); // hex → gvId

function generateGvId(hex, label) {
  // Deterministic: hash the label to get a stable 8-char ID
  const hash = createHash('sha256').update(label + hex).digest('hex').slice(0, 8);
  return `e-gv-${hash}`;
}

const unmappedColors = [];
const unmappedOthers = [];

// Process unmapped tokens
for (const token of tokenMap.unmapped_tokens || []) {
  const hex = token.hex || '';
  if (!hex || !hex.startsWith('#') || hex === '#550000' || hex === '#660000' || hex === '#770000') {
    // Skip non-color tokens (font-weight numericals got mis-identified as hex)
    unmappedOthers.push(token);
    continue;
  }
  
  unmappedColors.push(token);
}

log(`${unmappedColors.length} color tokens to map, ${unmappedOthers.length} non-color tokens to skip`);

// Map each color token
for (const token of unmappedColors) {
  const hex = (token.hex || '').toLowerCase();
  const normalizedHex = normalizeHex(hex);
  const framerPath = HEX_TO_FRAMER_PATH[normalizedHex] || HEX_TO_FRAMER_PATH[hex] || null;
  
  // Generate GV-ID from the hex value (deterministic)
  const gvId = generateGvId(normalizedHex, framerPath || token.token || 'color');
  gvMap.set(normalizedHex, gvId);
  
  if (framerPath) {
    colors[framerPath] = {
      hex: normalizedHex,
      gv_id: gvId,
      source: 'css-variable',
      token: token.token,
      token_hex: hex,
    };
    log(`  ${framerPath} → ${normalizedHex} → ${gvId}`);
  } else {
    // Unmapped color with no known Framer path → assign a generic path
    const genericPath = `/Custom Color/${token.token?.replace(/^--token-/, '').slice(0, 12) || 'unknown'}`;
    colors[genericPath] = {
      hex: normalizedHex,
      gv_id: gvId,
      source: 'css-variable-unnamed',
      token: token.token,
    };
    log(`  ${genericPath} → ${normalizedHex} → ${gvId} (no Framer path match)`);
  }
}

// ── Step 3: Auto-detect critical unmapped Framer paths from token-mapping ──

// Scan existing colors + converter warnings for paths referenced but not yet mapped.
// This is project-agnostic: it reads what's already in the token-map, not hardcoded names.
const criticalPaths = [];
if (tokenMap.critical_paths) {
  criticalPaths.push(...tokenMap.critical_paths);
}

// Ensure critical paths are mapped (even if not from CSS vars)
for (const criticalPath of criticalPaths) {
  if (!colors[criticalPath]) {
    // Skip textStyle paths (not colors)
    if (criticalPath.startsWith('/Heading/') || criticalPath.startsWith('/Body/')) continue;
    if (criticalPath.startsWith('/White/')) {
      // White color reference — map to #ffffff
      const whiteHex = '#ffffff';
      if (!gvMap.has(whiteHex)) {
        gvMap.set(whiteHex, 'e-gv-' + createHash('sha256').update('white').digest('hex').slice(0, 8));
      }
      colors[criticalPath] = {
        hex: whiteHex,
        gv_id: gvMap.get(whiteHex),
        source: 'heuristic-match',
      };
      log(`  ${criticalPath} → ${whiteHex} (heuristic: White path)`);
    }
  }
}

// ── Step 4: Build enriched token-mapping ────────────────────────────

const enriched = {
  ...tokenMap,
  colors,
  gv_color_map: Object.fromEntries(gvMap),
  meta: {
    ...tokenMap.meta,
    generated_at: new Date().toISOString(),
    color_mapping: {
      total: Object.keys(colors).length,
      mapped_from_css: unmappedColors.length,
      mapped_from_heuristic: Object.values(colors).filter(c => c.source === 'heuristic-match').length,
      unmapped_remaining: unmappedOthers.length,
    },
  },
  // Remove the unmapped_tokens that were color tokens (keep non-color ones)
  unmapped_tokens: unmappedOthers.length > 0 ? unmappedOthers : undefined,
};

// ── Step 5: Write output ────────────────────────────────────────────

const outputPath = args.output || args['token-map'];
if (args['dry-run']) {
  console.log(JSON.stringify(enriched, null, 2));
} else {
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2), 'utf8');
  log(`Enriched token-mapping written: ${outputPath}`);
}

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\nColor Token Mapping Summary:`);
console.log(`  Colors mapped:          ${Object.keys(colors).length}`);
console.log(`  GV-IDs assigned:        ${gvMap.size}`);
console.log(`  Source: CSS variables   ${enriched.meta.color_mapping.mapped_from_css}`);
console.log(`  Source: heuristic       ${enriched.meta.color_mapping.mapped_from_heuristic}`);
console.log(`  Skipped (non-color):    ${enriched.meta.color_mapping.unmapped_remaining}`);
console.log(`\nGV Color IDs:`);
for (const [hex, gvId] of gvMap) {
  const path = Object.entries(colors).find(([, v]) => v.gv_id === gvId)?.[0] || '(no path)';
  console.log(`  ${gvId.padEnd(18)} ${hex.padEnd(10)} ${path}`);
}

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return '#000000';
  if (!hex.startsWith('#')) hex = '#' + hex;
  hex = hex.toLowerCase();
  // Expand 3-digit hex to 6-digit
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex;
}
