#!/usr/bin/env node
/**
 * Intelligent Responsive Auto-Scaling (Anti-Slop)
 * 
 * Injiziert automatisch Mobile/Tablet-Varianten für Typography und Spacing,
 * wenn Desktop-Werte bestimmte Schwellenwerte überschreiten.
 * Verhindert, dass mobile Ansichten standardmäßig zerbrechen (Browser skaliert px nicht automatisch).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWrappedSizeNumber, scaleWrappedSize } from './lib/framer-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Schwellenwerte für Auto-Skalierung
const THRESHOLDS = {
  fontSize: 28, // px
  padding: 20,  // px
  margin: 20    // px
};

// Skalierungsfaktoren
const SCALE_FACTORS = {
  tablet: 0.75,
  mobile: 0.6
};

function walkTree(obj, callback) {
  if (typeof obj !== 'object' || obj === null) return;
  callback(obj);
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      walkTree(obj[key], callback);
    }
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function scaleDimensions(dimensions, factor) {
  if (!dimensions || dimensions['$$type'] !== 'dimensions') return dimensions;
  const value = {};
  for (const [side, wrapped] of Object.entries(dimensions.value || {})) {
    value[side] = scaleWrappedSize(wrapped, factor);
  }
  return { ...dimensions, value };
}

function scaleProp(prop, value, factor) {
  if (prop === 'font-size') return scaleWrappedSize(value, factor);
  if (prop === 'padding' || prop === 'margin') return scaleDimensions(value, factor);
  if (prop.includes('padding') || prop.includes('margin') || prop === 'gap') return scaleWrappedSize(value, factor);
  return cloneJson(value);
}

function propNeedsScaling(prop, value) {
  if (prop === 'font-size') {
    const size = getWrappedSizeNumber(value);
    return size !== null && size > THRESHOLDS.fontSize;
  }
  if (prop === 'padding' || prop === 'margin') {
    const sides = Object.values(value?.value || {});
    return sides.some(side => {
      const size = getWrappedSizeNumber(side);
      return size !== null && size > THRESHOLDS.padding;
    });
  }
  if (prop.includes('padding') || prop.includes('margin') || prop === 'gap') {
    const size = getWrappedSizeNumber(value);
    return size !== null && size > THRESHOLDS.padding;
  }
  return false;
}

function findBaseVariant(style) {
  if (Array.isArray(style.variants)) {
    return style.variants.find(v => v?.meta?.breakpoint === null) || style.variants[0];
  }
  if (style.props) {
    return { meta: { breakpoint: null, state: null }, props: style.props };
  }
  return null;
}

function hasBreakpoint(style, breakpoint) {
  return (style.variants || []).some(v => v?.meta?.breakpoint === breakpoint);
}

function buildScaledVariant(baseVariant, breakpoint, factor) {
  const props = {};
  for (const [prop, value] of Object.entries(baseVariant.props || {})) {
    if (propNeedsScaling(prop, value)) props[prop] = scaleProp(prop, value, factor);
  }
  if (Object.keys(props).length === 0) return null;
  return { meta: { breakpoint, state: baseVariant.meta?.state ?? null }, props };
}

function autoScaleResponsive(tree) {
  let modifiedCount = 0;

  walkTree(tree, (node) => {
    if (node && node.styles && typeof node.styles === 'object') {
      for (const styleId in node.styles) {
        const style = node.styles[styleId];
        const baseVariant = findBaseVariant(style);
        if (!baseVariant?.props) continue;

        const newVariants = [];

        if (!hasBreakpoint(style, 'tablet')) {
          const tablet = buildScaledVariant(baseVariant, 'tablet', SCALE_FACTORS.tablet);
          if (tablet) newVariants.push(tablet);
        }
        if (!hasBreakpoint(style, 'mobile')) {
          const mobile = buildScaledVariant(baseVariant, 'mobile', SCALE_FACTORS.mobile);
          if (mobile) newVariants.push(mobile);
        }

        if (newVariants.length > 0) {
          style.variants = [...(style.variants || []), ...newVariants];
          modifiedCount++;
        }
      }
    }
  });

  return { tree, modifiedCount };
}

async function main() {
  const cliArgs = (() => {
    const a = { tree: null, output: null };
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--tree'   && argv[i+1]) { a.tree   = argv[++i]; }
      else if (argv[i] === '--output' && argv[i+1]) { a.output = argv[++i]; }
      else if (!argv[i].startsWith('--') && !a.tree)   { a.tree   = argv[i]; }
      else if (!argv[i].startsWith('--') && !a.output) { a.output = argv[i]; }
    }
    return a;
  })();
  const treePath   = cliArgs.tree   || path.join(rootDir, 'v4-tree.json');
  const outputPath = cliArgs.output || treePath;

  if (!fs.existsSync(treePath)) {
    console.error(`Datei nicht gefunden: ${treePath}`);
    process.exit(1);
  }

  console.log(`▶️  Lade Tree von: ${treePath}`);
  const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));

  console.log('▶️  Führe intelligente Responsive Auto-Skalierung durch...');
  const result = autoScaleResponsive(tree);

  console.log(`✅ ${result.modifiedCount} Style-Blöcke mit automatischen Mobile/Tablet-Varianten erweitert.`);
  
  fs.writeFileSync(outputPath, JSON.stringify(result.tree, null, 2), 'utf8');
  console.log(`💾 Gespeichert unter: ${outputPath}`);
}

main();
