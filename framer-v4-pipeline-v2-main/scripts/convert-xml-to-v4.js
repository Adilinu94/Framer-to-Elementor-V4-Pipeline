#!/usr/bin/env node
/**
 * convert-xml-to-v4.js  —  Phase 2: Framer XML → Elementor V4 Widget-Tree
 * Konvertiert Framer getNodeXml() Output direkt in V4 JSON.
 *
 * Usage:
 *   node scripts/convert-xml-to-v4.js \
 *     --xml      FramerExport/hero-section.xml \
 *     --tokens   FramerExport/tokens/token-mapping.json \
 *     --fonts    FramerExport/tokens/font-resolution.json \
 *     --image-map FramerExport/assets/image-map.json \
 *     --output   FramerExport/v4-tree/hero-section.json
 */

import fs   from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  normalizeHex, resolveCssVar, generateStyleId,
  wrapSize, wrapUnitless, wrapDimensions, wrapBorderRadius, wrapGvColor, wrapGvFont,
  wrapColor, wrapType, wrapImageSrc,
} from './lib/framer-utils.js';

// ─────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    xml:          { type: 'string' },
    'xml-string': { type: 'string' },
    tokens:       { type: 'string' },
    fonts:        { type: 'string' },
    'image-map':  { type: 'string' },
    output:       { type: 'string' },
    verbose:      { type: 'boolean', default: false },
  },
  strict: false,
});

// Help
if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log('Usage: node scripts/convert-xml-to-v4.js [--help for options]'); console.log('Run with --help for full usage.'); process.exit(0); }

const log  = (...m) => { if (args.verbose) process.stderr.write('[verbose] ' + m.join(' ') + '\n'); };
const warn = (m)    => process.stderr.write(`⚠ ${m}\n`);

if (!args.xml && !args['xml-string']) {
  process.stderr.write('Error: --xml oder --xml-string erforderlich\n'); process.exit(2);
}

// ─────────────────────────────────────────────
// XML TOKENIZER  (character-by-character, handles quoted values)
// ─────────────────────────────────────────────

function tokenizeXml(xml) {
  const tokens = [];
  let i = 0;

  while (i < xml.length) {
    // Collect text content between tags
    if (xml[i] !== '<') {
      const textStart = i;
      while (i < xml.length && xml[i] !== '<') i++;
      const text = xml.slice(textStart, i).replace(/\s+/g, ' ').trim();
      if (text) tokens.push({ type: 'text', value: text });
      continue;
    }

    // XML declaration
    if (xml.startsWith('<?', i)) {
      const end = xml.indexOf('?>', i); i = end >= 0 ? end + 2 : xml.length; continue;
    }
    // Comment
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i); i = end >= 0 ? end + 3 : xml.length; continue;
    }
    // CDATA — treat as text
    if (xml.startsWith('<![CDATA[', i)) {
      const end = xml.indexOf(']]>', i);
      const cdata = end >= 0 ? xml.slice(i + 9, end) : '';
      if (cdata.trim()) tokens.push({ type: 'text', value: cdata.trim() });
      i = end >= 0 ? end + 3 : xml.length; continue;
    }

    i++; // skip <

    // Closing tag?
    const isClose = i < xml.length && xml[i] === '/';
    if (isClose) i++;

    // Read tag name
    const nameStart = i;
    while (i < xml.length && /[A-Za-z0-9_:-]/.test(xml[i])) i++;
    const tagName = xml.slice(nameStart, i);
    if (!tagName) { i++; continue; }

    if (isClose) {
      while (i < xml.length && xml[i] !== '>') i++;
      i++; // skip >
      tokens.push({ type: 'close', tagName });
      continue;
    }

    // Read attributes
    const attrs = {};
    while (i < xml.length) {
      // Skip whitespace
      while (i < xml.length && /[\s\r\n]/.test(xml[i])) i++;
      if (i >= xml.length || xml[i] === '>' || (xml[i] === '/' && xml[i+1] === '>')) break;

      // Attr name
      const attrStart = i;
      while (i < xml.length && xml[i] !== '=' && xml[i] !== '>' && !/[\s\r\n]/.test(xml[i])) i++;
      const attrName = xml.slice(attrStart, i).trim();

      if (xml[i] === '=') {
        i++; // skip =
        if (i < xml.length && (xml[i] === '"' || xml[i] === "'")) {
          const q = xml[i]; i++;
          const valStart = i;
          while (i < xml.length && xml[i] !== q) i++;
          if (attrName) attrs[attrName] = xml.slice(valStart, i);
          i++; // skip closing quote
        }
      } else if (attrName) {
        attrs[attrName] = 'true';
      }
    }

    const isSelfClose = i < xml.length && xml[i] === '/';
    if (isSelfClose) i++;             // skip /
    if (i < xml.length && xml[i] === '>') i++; // skip >

    tokens.push({ type: isSelfClose ? 'selfclose' : 'open', tagName, attrs });
  }

  return tokens;
}

function buildTree(tokens) {
  const root = { tagName: '_root', attrs: {}, children: [] };
  const stack = [root];
  let pendingText = '';
  for (const tok of tokens) {
    if (tok.type === 'text') {
      // Accumulate text content between tags
      pendingText += tok.value;
    } else if (tok.type === 'close') {
      // Attach accumulated text to the element being closed
      if (pendingText.trim() && stack.length > 1) {
        stack[stack.length - 1]._textContent = (stack[stack.length - 1]._textContent || '') + pendingText.trim();
      }
      pendingText = '';
      if (stack.length > 1) stack.pop();
    } else {
      pendingText = '';
      const node = { tagName: tok.tagName, attrs: tok.attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (tok.type === 'open') stack.push(node);
    }
  }
  return root.children;
}

// ─────────────────────────────────────────────
// WIDGET TYPE DETERMINATION
// ─────────────────────────────────────────────

// Native SVG tag names — these map directly to e-svg regardless of parent
const SVG_NATIVE_TAGS = new Set([
  'svg', 'circle', 'ellipse', 'rect', 'path', 'polygon', 'polyline',
  'line', 'g', 'defs', 'use', 'symbol', 'text', 'tspan', 'mask',
  'clippath', 'lineargradient', 'radialgradient', 'stop', 'pattern',
]);

function determineWidgetType(attrs, xmlNode) {
  const name    = (attrs.name || '').toLowerCase();
  const tagName = (xmlNode?.tagName || '').toLowerCase();

  // ── SVG: ONLY when the tag itself is a native SVG element ──
  // Framer uses PascalCase tags (Frame, Text, Image, Stack) — SVG uses lowercase.
  // We check the ORIGINAL (non-lowercased) tagName to avoid matching Framer's
  // <Text> element against SVG's <text> element.
  const rawTagName = (xmlNode?.tagName || '');
  if (SVG_NATIVE_TAGS.has(rawTagName.toLowerCase()) && rawTagName === rawTagName.toLowerCase()) {
    return 'e-svg';
  }

  if (attrs.href || name.includes('button') || name.includes('cta')) return 'e-button';

  // Text detection: attribute OR child-text (Bug 1 Fix)
  const hasText = attrs.text !== undefined || xmlNode?._textContent;
  if (hasText) {
    if (/\bh[1-6]\b|heading/.test(name)) return 'e-heading';
    if (/\bbody|paragraph|text|description|content/.test(name)) return 'e-paragraph';
    return 'e-heading'; // default for text nodes
  }
  if (attrs.backgroundImage || attrs.src) return 'e-image';
  return 'e-flexbox'; // default container
}

function determineHtmlTag(attrs) {
  const name = (attrs.name || '').toLowerCase();
  if (/\bh1\b|heading.?1|title/.test(name))   return 'h1';
  if (/\bh2\b|heading.?2/.test(name))          return 'h2';
  if (/\bh3\b|heading.?3/.test(name))          return 'h3';
  if (/\bh4\b|heading.?4/.test(name))          return 'h4';
  if (/\bh5\b|heading.?5/.test(name))          return 'h5';
  if (/\bh6\b|heading.?6/.test(name))          return 'h6';
  if (/paragraph|body|text/.test(name))         return 'p';
  return 'h2'; // default heading
}

function wrapHtmlContent(content) {
  return {
    '$$type': 'html-v3',
    value: { content: { '$$type': 'string', value: content || '' } },
  };
}

function wrapLink(href, targetBlank = false) {
  // Elementor V4 nativer Link-Prop: 'destination' + 'tag', NICHT 'href'
  // EMCP class-atomic-props.php link() Methode bestaetigt dieses Format
  const value = {
    destination: { '$$type': 'url', value: href || '' },
    tag:         { '$$type': 'string', value: 'a' },
  };
  if (targetBlank) value.isTargetBlank = { '$$type': 'boolean', value: true };
  return { '$$type': 'link', value };
}

// Bug 6 Fix: serialize an XML node back to SVG markup for e-svg content
function serializeSvgNode(xmlNode) {
  const { tagName, attrs, children } = xmlNode;
  if (!tagName || tagName === '_root') return '';
  const attrStr = Object.entries(attrs || {})
    .filter(([k]) => k !== 'name' && k !== 'nodeId')
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ');
  const childContent = (children || []).map(serializeSvgNode).join('');
  if (childContent || tagName.toLowerCase() !== 'circle') {
    return `<${tagName}${attrStr ? ' ' + attrStr : ''}>${childContent}</${tagName}>`;
  }
  return `<${tagName}${attrStr ? ' ' + attrStr : ''}/>`;
}

// ─────────────────────────────────────────────
// COLOR RESOLUTION
// ─────────────────────────────────────────────

const warnings = [];

function resolveColor(value, tokenMapping) {
  if (!value) return null;
  const resolved = resolveCssVar(value, tokenMapping);
  if (!resolved) {
    const hex = normalizeHex(value);
    if (hex) { warn(`Hardcoded hex used: ${hex} (no token match)`); return wrapColor(hex); }
    return null;
  }
  if (resolved.gvId) return wrapGvColor(resolved.gvId);
  if (resolved.hex)  {
    warn(`Token found but no gv_id for value: ${value} → ${resolved.hex}`);
    return wrapColor(resolved.hex);
  }
  return null;
}

// ─────────────────────────────────────────────
// FONT RESOLUTION
// ─────────────────────────────────────────────

function resolveFont(family, tokenMapping, fontResolution) {
  if (!family) return null;
  // Try token mapping first
  if (tokenMapping?.fonts?.[family]?.gv_id) return wrapGvFont(tokenMapping.fonts[family].gv_id);
  if (typeof tokenMapping?.fonts?.[family] === 'string') return wrapGvFont(tokenMapping.fonts[family]);
  if (typeof tokenMapping?.[family] === 'string' && tokenMapping[family].startsWith('e-gv-')) return wrapGvFont(tokenMapping[family]);
  if (typeof tokenMapping?.[family.toLowerCase?.()] === 'string' && tokenMapping[family.toLowerCase()].startsWith('e-gv-')) {
    return wrapGvFont(tokenMapping[family.toLowerCase()]);
  }
  // Try font resolution
  const fontEntry = (fontResolution?.fonts || []).find(f => f.family === family);
  if (fontEntry?.gv_id) return wrapGvFont(fontEntry.gv_id);
  warn(`Font '${family}' not found in token-mapping or font-resolution. Using string fallback.`);
  return wrapType('string', family);
}

// ─────────────────────────────────────────────
// IMAGE URL RESOLUTION
// ─────────────────────────────────────────────

function extractImageUrl(imageAttr) {
  if (!imageAttr) return null;
  const raw = String(imageAttr).trim();
  const urlMatch = raw.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
  return urlMatch ? urlMatch[1] : raw;
}

function findImageMapEntry(url, imageMap) {
  if (!url || !imageMap) return null;
  const filename = url.split('/').pop().split('?')[0];
  if (imageMap[url]) return imageMap[url];
  if (imageMap.images?.[filename]) return imageMap.images[filename];
  if (imageMap.videos?.[filename]) return imageMap.videos[filename];
  if (Array.isArray(imageMap.assets)) {
    return imageMap.assets.find(a => a.url === url || a.filename === filename) || null;
  }
  if (Array.isArray(imageMap.images)) {
    return imageMap.images.find(a => a.url === url || a.filename === filename) || null;
  }
  return null;
}

function resolveImageSrc(bgImageAttr, imageMap) {
  if (!bgImageAttr) return null;
  const url = extractImageUrl(bgImageAttr);
  if (!url) return null;

  // Try to find in image-map
  const entry = findImageMapEntry(url, imageMap);
  if (entry?.wp_media_id) return wrapImageSrc({ id: entry.wp_media_id });
  if (entry?.id) return wrapImageSrc({ id: entry.id });

  return wrapImageSrc({ url });
}

function resolveLineHeight(lineHeight) {
  if (!lineHeight) return null;
  const raw = String(lineHeight).trim();
  if (/^-?[\d.]+$/.test(raw)) return wrapUnitless(raw);
  if (/^-?[\d.]+%$/.test(raw)) return wrapUnitless(parseFloat(raw) / 100);
  return wrapSize(raw);
}

// ─────────────────────────────────────────────
// PROPERTY MAPPER
// ─────────────────────────────────────────────

function buildStyleProps(attrs, widgetType, tokenMapping, fontResolution, imageMap) {
  const props  = {};
  const { stackDirection, stackGap, padding, maxWidth, width, height,
          backgroundColor, 'background-color': bgColor,
          borderRadius, 'border-radius': borderRadiusAlt,
          position, top, right, bottom, left,
          color, 'font-family': fontFamily, 'font-size': fontSize,
          'font-weight': fontWeight, 'line-height': lineHeight,
          'letter-spacing': letterSpacing, opacity } = attrs;

  // ── Layout (flexbox) ──
  if (widgetType === 'e-flexbox' || widgetType === 'e-button') {
    if (stackDirection) {
      props['flex-direction'] = stackDirection === 'vertical' ? 'column' : 'row';
    }
    if (stackGap) props['gap'] = wrapSize(stackGap);
    if (padding)  props['padding'] = wrapDimensions(padding);
    if (maxWidth) props['max-width'] = wrapSize(maxWidth);
    if (width)    props['width']    = wrapSize(width);
    if (height)   props['height']   = wrapSize(height);

    const bgVal = backgroundColor || bgColor;
    if (bgVal) {
      // Bug 3: background.color NUR in Global Classes, nie in lokalen Styles
      const resolved = resolveColor(bgVal, tokenMapping);
      if (resolved) {
        warn(`background.color '${bgVal}' muss als Global Class gesetzt werden (Bug 3). Übersprungen.`);
      }
    }
  }

  // ── Typography (heading / text) ──
  if (widgetType === 'e-heading' || widgetType === 'e-paragraph') {
    if (fontSize)      props['font-size']    = wrapSize(fontSize);
    if (fontWeight)    props['font-weight']  = wrapType('string', fontWeight);
    if (lineHeight)    props['line-height']  = resolveLineHeight(lineHeight);
    if (letterSpacing) props['letter-spacing'] = wrapSize(letterSpacing);
    if (fontFamily) {
      const resolved = resolveFont(fontFamily.split(',')[0].trim().replace(/['"]/g,''), tokenMapping, fontResolution);
      if (resolved) props['font-family'] = resolved;
    }
    if (color) {
      const resolved = resolveColor(color, tokenMapping);
      if (resolved) props['color'] = resolved;
    }
  }

  // ── Image ──
  if (widgetType === 'e-image') {
    if (width)  props['width']  = wrapSize(width);
    if (height) props['height'] = wrapSize(height);
  }

  // ── Border radius (all widget types) ──
  const br = borderRadius || borderRadiusAlt;
  if (br) props['border-radius'] = wrapBorderRadius(br);

  // ── Positioning ──
  if (position) {
    props['position'] = wrapType('string', position);
    if (top)    props['top']    = wrapSize(top);
    if (right)  props['right']  = wrapSize(right);
    if (bottom) props['bottom'] = wrapSize(bottom);
    if (left)   props['left']   = wrapSize(left);
  }

  // ── Opacity ──
  if (opacity !== undefined) props['opacity'] = wrapUnitless(opacity);

  return props;
}

// ─────────────────────────────────────────────
// NODE → V4 CONVERTER  (recursive)
// ─────────────────────────────────────────────

const usedStyleIds  = new Map(); // base-id → count
const usedWidgetIds = new Map(); // base-id → count  (Bug 5 Fix)

function uniqueStyleId(name) {
  const base = generateStyleId(name);
  const n    = (usedStyleIds.get(base) || 0) + 1;
  usedStyleIds.set(base, n);
  return n === 1 ? base : `${base}${n}`;
}

// Bug 5 Fix: unique widget IDs with counter
function uniqueWidgetId(raw) {
  const base = raw.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'node';
  const n    = (usedWidgetIds.get(base) || 0) + 1;
  usedWidgetIds.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

// Bug 3 Fix: detect pass-through containers (single child, no layout props set)
function isPassThroughContainer(xmlNode, widgetType) {
  if (widgetType !== 'e-flexbox') return false;
  const { attrs } = xmlNode;
  const hasLayoutProps = attrs.stackGap || attrs.padding || attrs.maxWidth
    || attrs.width || attrs.height || attrs.backgroundColor || attrs['background-color']
    || attrs.borderRadius || attrs['border-radius'] || attrs.position;
  if (hasLayoutProps) return false;
  const meaningfulChildren = (xmlNode.children || []).filter(c => c.tagName && c.tagName !== '_root');
  // Only flatten if exactly one child (pure wrapper)
  return meaningfulChildren.length === 1;
}

// Bug 3 Fix (improved): recursively unwrap a chain of pass-through containers.
// Returns an array of { node, depth } — either the original node or its
// eventually-meaningful descendant(s), skipping every pure wrapper in between.
function resolvePassThrough(xmlNode, depth) {
  const widgetType = determineWidgetType(xmlNode.attrs, xmlNode);
  if (!isPassThroughContainer(xmlNode, widgetType)) {
    return [{ node: xmlNode, depth }];
  }
  log(`[${'  '.repeat(depth)}] FLATTENED pass-through: ${xmlNode.attrs.name || 'unnamed'}`);
  const meaningful = (xmlNode.children || []).filter(c => c.tagName && c.tagName !== '_root');
  // Single child guaranteed by isPassThroughContainer — recurse into it
  return resolvePassThrough(meaningful[0], depth);
}

function convertNode(xmlNode, tokenMapping, fontResolution, imageMap, depth = 0) {
  const { attrs } = xmlNode;
  // Bug 1 Fix: resolve text from attribute first, then child text content
  const textContent = attrs.text !== undefined ? attrs.text : (xmlNode._textContent || undefined);
  // Build enriched attrs with resolved text for type detection
  const enrichedAttrs = textContent !== undefined ? { ...attrs, text: textContent } : attrs;

  const name       = attrs.name || `node-${depth}`;
  const nodeId     = attrs.nodeId || attrs.id;
  const widgetType = determineWidgetType(enrichedAttrs, xmlNode);
  const styleId    = uniqueStyleId(name);

  // Bug 5 Fix: unique widget ID
  const rawId  = nodeId || name;
  const widgetId = uniqueWidgetId(rawId);

  log(`[${'  '.repeat(depth)}] ${name} → ${widgetType} (${styleId})`);

  // Build base props
  const props = buildStyleProps(enrichedAttrs, widgetType, tokenMapping, fontResolution, imageMap);

  // Determine style $$type
  const styleTypeMap = {
    'e-flexbox': 'flexbox', 'e-heading': 'heading',
    'e-paragraph': 'text-editor', 'e-image': 'image', 'e-button': 'button',
    'e-svg': 'svg',
  };
  const styleType = styleTypeMap[widgetType] || 'flexbox';

  // ── Settings ──
  const settings = {
    classes: { '$$type': 'classes', value: [styleId] },
  };

  if (widgetType === 'e-flexbox') {
    settings.tag = attrs.tag || (depth === 0 ? 'section' : 'div');
  }

  if (widgetType === 'e-button') {
    settings.tag = attrs.tag || (attrs.href ? 'a' : 'button');
    settings.text = wrapHtmlContent(textContent || name || '');
    if (attrs.href) settings.link = wrapLink(attrs.href, attrs.target === '_blank');
  }

  if (widgetType === 'e-heading') {
    settings.tag   = determineHtmlTag(enrichedAttrs);
    settings.title = wrapHtmlContent(textContent || '');
  }

  if (widgetType === 'e-paragraph') {
    // Prop-Name ist 'paragraph' (nicht 'editor') — EMCP Bug-Fix #56 bestaetigt
    settings.paragraph = wrapHtmlContent(textContent || '');
  }

  if (widgetType === 'e-image') {
    const imgSrc = resolveImageSrc(attrs.backgroundImage || attrs.src, imageMap);
    if (imgSrc) settings['image-src'] = imgSrc;
    else        settings['image-src'] = wrapImageSrc({ id: 0 });
  }

  if (widgetType === 'e-svg') {
    // Serialize the SVG sub-tree back to markup for e-svg content
    settings['svg-icon'] = { '$$type': 'string', value: serializeSvgNode(xmlNode) };
    if (attrs.width)  settings.width  = wrapSize(attrs.width);
    if (attrs.height) settings.height = wrapSize(attrs.height);
  }

  // ── Style variants ──
  const baseVariant = {
    meta:  { breakpoint: null, state: null },
    props: Object.keys(props).length > 0 ? props : {},
  };

  const styles = {
    [styleId]: {
      '$$type':   styleType,
      variants: [baseVariant],
    },
  };

  // ── Recurse into children ──
  // e-svg: SVG sub-tree already serialized to markup — no V4 children
  const rawChildren = widgetType === 'e-svg'
    ? []
    : (xmlNode.children || []).filter(c => c.tagName && c.tagName !== '_root');

  const v4Children = [];
  for (const child of rawChildren) {
    // Bug 3 Fix: recursively unwrap any chain of pass-through containers
    const resolved = resolvePassThrough(child, depth + 1);
    for (const r of resolved) {
      const converted = convertNode(r.node, tokenMapping, fontResolution, imageMap, r.depth);
      if (converted) v4Children.push(converted);
    }
  }

  const node = { widgetType, id: widgetId, settings, styles };
  if (v4Children.length > 0) node.children = v4Children;

  return node;
}

// ─────────────────────────────────────────────
// LOAD INPUTS
// ─────────────────────────────────────────────

// XML
let xmlContent;
if (args['xml-string']) {
  xmlContent = args['xml-string'];
} else {
  if (!fs.existsSync(args.xml)) {
    process.stderr.write(`Error: XML nicht gefunden: ${args.xml}\n`); process.exit(2);
  }
  xmlContent = fs.readFileSync(args.xml, 'utf8');
}

// Token mapping
let tokenMapping = null;
if (args.tokens) {
  if (!fs.existsSync(args.tokens)) {
    warn(`token-mapping.json nicht gefunden: ${args.tokens}. Tokens werden nicht aufgelöst.`);
  } else {
    tokenMapping = JSON.parse(fs.readFileSync(args.tokens, 'utf8'));
    log(`Token mapping loaded: ${Object.keys(tokenMapping.colors || {}).length} colors, ${Object.keys(tokenMapping.fonts || {}).length} fonts`);
  }
}

// Font resolution
let fontResolution = null;
if (args.fonts) {
  if (!fs.existsSync(args.fonts)) {
    warn(`font-resolution.json nicht gefunden: ${args.fonts}.`);
  } else {
    fontResolution = JSON.parse(fs.readFileSync(args.fonts, 'utf8'));
    log(`Font resolution loaded: ${(fontResolution.fonts || []).length} fonts`);
  }
}

// Image map (optional)
let imageMap = null;
if (args['image-map']) {
  if (fs.existsSync(args['image-map'])) {
    imageMap = JSON.parse(fs.readFileSync(args['image-map'], 'utf8'));
    log(`Image map loaded: ${Object.keys(imageMap.images || {}).length} images`);
  }
}

// ─────────────────────────────────────────────
// CONVERT
// ─────────────────────────────────────────────

let xmlRoots;
try {
  const tokens = tokenizeXml(xmlContent);
  xmlRoots     = buildTree(tokens);
} catch (e) {
  process.stderr.write(`Error: XML parse fehlgeschlagen: ${e.message}\n`); process.exit(2);
}

if (xmlRoots.length === 0) {
  process.stderr.write('Error: Keine Nodes im XML gefunden.\n'); process.exit(2);
}

log(`XML nodes parsed: ${xmlRoots.length} root node(s)`);

// Convert each root node
const v4Tree = xmlRoots
  .filter(n => n.tagName && n.tagName !== '_root')
  .map(n => convertNode(n, tokenMapping, fontResolution, imageMap, 0));

// ─────────────────────────────────────────────
// OUTPUT
// ─────────────────────────────────────────────

// Single root or array
const result = v4Tree.length === 1 ? v4Tree[0] : v4Tree;
const output = JSON.stringify(result, null, 2);

if (args.output) {
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
  fs.writeFileSync(args.output, output, 'utf8');
  process.stderr.write(`Saved to ${args.output}\n`);
} else {
  process.stdout.write(output + '\n');
}

process.stderr.write(`✓ ${usedStyleIds.size} V4 nodes converted, ${warnings.length} warnings\n`);
if (warnings.length > 0 && args.verbose) {
  warnings.forEach(w => process.stderr.write(`  ⚠ ${w}\n`));
}

process.exit(warnings.length > 0 ? 1 : 0);
