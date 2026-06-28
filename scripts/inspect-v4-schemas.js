#!/usr/bin/env node
/**
 * scripts/inspect-v4-schemas.js
 *
 * Aggregates observed V4-Atomic element-tree shapes from a directory of
 * working-page JSON fixtures (extracted via novamira/elementor-get-content)
 * into a single schemas/v4-atomic-schema.json file.
 *
 * Usage:
 *   node scripts/inspect-v4-schemas.js
 *     [--fixtures tests/fixtures/v4-atomic/working-pages]
 *     [--output schemas/v4-atomic-schema.json]
 *     [--strict]   (exit 1 if any hard invariant fails)
 *
 * The script is intentionally read-only: it never calls Elementor itself.
 * Re-run after fetching new fixtures (manually or via the MCP) to refresh
 * the schema snapshot.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const DEFAULT_FIXTURES = 'tests/fixtures/v4-atomic/working-pages';
const DEFAULT_OUTPUT = 'schemas/v4-atomic-schema.json';

const ATOMIC_WIDGET_TYPES = new Set([
  'e-heading', 'e-paragraph', 'e-button', 'e-image', 'e-svg', 'e-divider',
  'e-youtube', 'e-video', 'e-field-label', 'e-field-input', 'e-field-submit', 'e-component',
]);
const ATOMIC_CONTAINER_TYPES = new Set(['e-flexbox', 'e-div-block']);

const INVARIANTS = [
  {
    id: 'I',
    name: 'local-class-id-resolved',
    severity: 'warn',
    check: (el) => {
      const classes = el?.settings?.classes?.value;
      if (!Array.isArray(classes)) return null;
      const styles = el.styles || {};
      const local = classes.filter((c) => c.startsWith('e-') || c.startsWith('s-') || c.startsWith('f'));
      const missing = local.filter((c) => !(c in styles));
      return missing.length ? { missing, classes } : null;
    },
  },
  {
    id: 'III',
    name: 'class-id-format',
    severity: 'error',
    check: (el) => {
      const classes = el?.settings?.classes?.value || [];
      const styleIds = Object.keys(el.styles || {});
      const all = [...classes, ...styleIds];
      const bad = all.filter((id) => !/^[a-z][a-z0-9_-]*$/.test(id));
      return bad.length ? { bad } : null;
    },
  },
  {
    id: 'IV',
    name: 'image-src-id-vs-url',
    severity: 'error',
    check: (el) => {
      if (el?.widgetType !== 'e-image') return null;
      const src = el?.settings?.image?.value?.src?.value;
      if (!src) return null;
      const hasId = src.id && src.id.value != null;
      const hasUrl = src.url && src.url.value != null;
      if (hasId && hasUrl) return { msg: 'image-src has both id and non-null url (forbidden by Invariant IV)' };
      return null;
    },
  },
  {
    id: 'fix-3-4',
    name: 'html-v3-wrapper',
    severity: 'error',
    check: (el) => {
      const wt = el?.widgetType;
      if (wt === 'e-heading' && el?.settings?.title && el.settings.title.$$type !== 'html-v3') {
        return { msg: 'e-heading.title is not $$type:html-v3' };
      }
      if (wt === 'e-paragraph' && el?.settings?.paragraph && el.settings.paragraph.$$type !== 'html-v3') {
        return { msg: 'e-paragraph.paragraph is not $$type:html-v3' };
      }
      if (wt === 'e-button' && el?.settings?.text && el.settings.text.$$type !== 'html-v3') {
        return { msg: 'e-button.text is not $$type:html-v3' };
      }
      return null;
    },
  },
  {
    id: 'fix-5',
    name: 'classes-object',
    severity: 'error',
    check: (el) => {
      const c = el?.settings?.classes;
      if (c && c.$$type !== 'classes') {
        return { msg: 'settings.classes is not { $$type: "classes", value: [...] }' };
      }
      return null;
    },
  },
  {
    id: 'fix-2',
    name: 'elType-vs-widgetType',
    severity: 'error',
    check: (el) => {
      const wt = el?.widgetType;
      const et = el?.elType;
      if (!wt) return null;
      if (ATOMIC_WIDGET_TYPES.has(wt) && et !== 'widget') {
        return { msg: `atomic widget ${wt} has elType='${et}' (must be 'widget')` };
      }
      if (ATOMIC_CONTAINER_TYPES.has(wt) && !ATOMIC_CONTAINER_TYPES.has(et)) {
        return { msg: `atomic container ${wt} has elType='${et}' (must be 'e-flexbox' or 'e-div-block')` };
      }
      return null;
    },
  },
];

function walkElements(node, fn, depth = 0) {
  fn(node, depth);
  if (Array.isArray(node?.elements)) {
    for (const child of node.elements) walkElements(child, fn, depth + 1);
  }
}

function parseArgs(argv) {
  const args = { fixtures: DEFAULT_FIXTURES, output: DEFAULT_OUTPUT, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fixtures') args.fixtures = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--strict') args.strict = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/inspect-v4-schemas.js [--fixtures DIR] [--output FILE] [--strict]');
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixturesDir = resolve(ROOT, args.fixtures);
  const outputFile = resolve(ROOT, args.output);

  let entries;
  try {
    entries = await readdir(fixturesDir);
  } catch (e) {
    console.error(`[inspect-v4-schemas] fixtures directory not found: ${fixturesDir}`);
    process.exit(2);
  }

  const jsonFiles = entries.filter((f) => f.endsWith('.json')).sort();
  if (!jsonFiles.length) {
    console.error(`[inspect-v4-schemas] no .json fixtures in ${fixturesDir}`);
    process.exit(2);
  }

  const stats = {
    fixtures: jsonFiles.length,
    elements: 0,
    widgets: {},
    containers: {},
    violations: [],
    hardViolations: 0,
    softViolations: 0,
  };
  const widgetTypeCounts = new Map();
  const elTypeCounts = new Map();
  const classIdSamples = new Set();
  const propSamples = new Map();
  const responsiveBreakpoints = new Set();
  const responsiveStates = new Set();

  for (const file of jsonFiles) {
    const path = join(fixturesDir, file);
    const raw = await readFile(path, 'utf8');
    const fixture = JSON.parse(raw);
    // Accept multiple shapes: {element:{...}} | {...} | [{...}, ...]
    let roots;
    if (fixture && typeof fixture === 'object' && fixture.element) {
      roots = [fixture.element];
    } else if (Array.isArray(fixture)) {
      roots = fixture;
    } else if (fixture && typeof fixture === 'object' && (fixture.elType || fixture.widgetType || fixture.type)) {
      roots = [fixture];
    } else {
      continue;
    }

    for (const root of roots) walkElements(root, (node) => {
      stats.elements++;
      const wt = node.widgetType;
      const et = node.elType;
      if (wt) widgetTypeCounts.set(wt, (widgetTypeCounts.get(wt) || 0) + 1);
      elTypeCounts.set(et, (elTypeCounts.get(et) || 0) + 1);

      const classes = node?.settings?.classes?.value;
      if (Array.isArray(classes)) classes.forEach((c) => classIdSamples.add(c));

      for (const variant of Object.values(node.styles || {})) {
        if (!variant || !Array.isArray(variant.variants)) continue;
        for (const v of variant.variants) {
          if (v?.meta?.breakpoint) responsiveBreakpoints.add(v.meta.breakpoint);
          if (v?.meta?.state) responsiveStates.add(v.meta.state);
          for (const prop of Object.keys(v?.props || {})) {
            if (!propSamples.has(prop)) propSamples.set(prop, new Set());
            const t = v.props[prop]?.$$type || 'unknown';
            propSamples.get(prop).add(t);
          }
        }
      }

      for (const inv of INVARIANTS) {
        const v = inv.check(node, { file });
        if (v) {
          const entry = {
            file,
            invariant: inv.id,
            name: inv.name,
            severity: inv.severity || 'error',
            ...v,
          };
          stats.violations.push(entry);
          if (entry.severity === 'error') stats.hardViolations++;
          else stats.softViolations++;
        }
      }
    });
  }

  const aggregated = {
    generated_at: new Date().toISOString(),
    source_fixtures: jsonFiles,
    element_counts: {
      total: stats.elements,
      per_widget_type: Object.fromEntries(widgetTypeCounts),
      per_elType: Object.fromEntries(elTypeCounts),
    },
    responsive: {
      breakpoints_observed: [...responsiveBreakpoints].sort(),
      states_observed: [...responsiveStates].sort(),
    },
    property_samples: Object.fromEntries(
      [...propSamples.entries()].sort().map(([k, v]) => [k, [...v].sort()])
    ),
    class_id_samples: [...classIdSamples].sort(),
    invariant_violations: stats.violations,
    invariant_definitions: INVARIANTS.map((i) => ({ id: i.id, name: i.name, severity: i.severity || 'error' })),
  };

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(aggregated, null, 2) + '\n', 'utf8');

  console.log(`[inspect-v4-schemas] aggregated ${stats.elements} elements from ${jsonFiles.length} fixtures`);
  console.log(`[inspect-v4-schemas] widget types: ${JSON.stringify(aggregated.element_counts.per_widget_type)}`);
  console.log(`[inspect-v4-schemas] breakpoints: ${aggregated.responsive.breakpoints_observed.join(', ') || '(none)'}`);
  console.log(`[inspect-v4-schemas] wrote ${outputFile}`);

  if (stats.hardViolations) {
    console.error(`[inspect-v4-schemas] ${stats.hardViolations} hard invariant violation(s):`);
    for (const v of stats.violations.filter((x) => x.severity === 'error')) {
      console.error(`  - ${v.file} [${v.invariant}/${v.name}] ${v.msg || JSON.stringify(v)}`);
    }
    if (args.strict) process.exit(1);
  } else if (stats.softViolations) {
    console.warn(`[inspect-v4-schemas] ${stats.softViolations} soft warning(s) (not blocking):`);
    for (const v of stats.violations.filter((x) => x.severity === 'warn')) {
      console.warn(`  - ${v.file} [${v.invariant}/${v.name}] ${v.msg || JSON.stringify(v)}`);
    }
  } else {
    console.log('[inspect-v4-schemas] all fixtures pass the defined invariants');
  }
}

main().catch((e) => {
  console.error('[inspect-v4-schemas] fatal:', e);
  process.exit(1);
});
