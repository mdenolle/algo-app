#!/usr/bin/env node
// Builds the verified LEGO part catalog that both Algo apps read.
//
//   node catalog/build-catalog.mjs            download fresh dumps, then build
//   node catalog/build-catalog.mjs --offline  reuse catalog/cache/*.csv.gz
//
// Input:  catalog/curated.json (hand-edited list of kid-relevant parts + colors)
//         Rebrickable CSV dumps (parts, colors, part_categories, elements)
// Output: catalog/catalog.json                    canonical
//         catalog/catalog.js                      window.ALGO_CATALOG for the web prototype
//         mobile/src/catalog/catalog.generated.ts typed export for the Expo app
//
// "Verified" means: every part number exists in Rebrickable's parts table, and a
// part is only offered in a color for which Rebrickable lists a real element id
// (a part+color combination LEGO actually produced).

import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cacheDir = join(here, 'cache');
const offline = process.argv.includes('--offline');

const SOURCE = {
  name: 'Rebrickable',
  url: 'https://rebrickable.com/downloads/',
  base: 'https://cdn.rebrickable.com/media/downloads/',
  files: ['colors', 'parts', 'part_categories', 'elements'],
};

async function loadTable(name) {
  mkdirSync(cacheDir, { recursive: true });
  const path = join(cacheDir, `${name}.csv.gz`);
  if (!offline || !existsSync(path)) {
    const response = await fetch(`${SOURCE.base}${name}.csv.gz`);
    if (!response.ok) throw new Error(`${name}.csv.gz: HTTP ${response.status}`);
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  }
  return parseCsv(gunzipSync(readFileSync(path)).toString('utf8'));
}

function sizeFromName(name) {
  const match = name.match(/(\d+) x (\d+)(?: x ([\d/ ]+))?/);
  return match ? match.slice(1).filter(Boolean).map(s => s.trim()) : null;
}

async function main() {
  const curated = JSON.parse(readFileSync(join(here, 'curated.json'), 'utf8'));
  const [colors, parts, categories, elements] = await Promise.all(SOURCE.files.map(loadTable));

  const colorById = new Map(colors.map(c => [Number(c.id), c]));
  const partByNum = new Map(parts.map(p => [p.part_num, p]));
  const categoryById = new Map(categories.map(c => [Number(c.id), c.name]));
  const familyIds = new Set(curated.families.map(f => f.id));
  const errors = [];

  // Colors: verify each curated id, carry the official name and RGB.
  const kidColors = curated.colors.map(({ id, kid }) => {
    const row = colorById.get(id);
    if (!row) { errors.push(`color ${id} (${kid}) not in colors.csv`); return null; }
    return { id, kid, name: row.name, rgb: row.rgb, transparent: row.is_trans === 'True', years: [Number(row.y1) || null, Number(row.y2) || null] };
  }).filter(Boolean);
  const paletteIds = new Set(kidColors.map(c => c.id));

  // Elements: part -> color -> element id. Keep the largest id per (part, color),
  // which is the most recently issued element for that combination.
  const elementIndex = new Map();
  for (const e of elements) {
    if (!partByNum.has(e.part_num)) continue;
    const colorId = Number(e.color_id);
    if (!paletteIds.has(colorId)) continue;
    const perPart = elementIndex.get(e.part_num) ?? new Map();
    const current = perPart.get(colorId);
    if (!current || BigInt(e.element_id) > BigInt(current)) perPart.set(colorId, e.element_id);
    elementIndex.set(e.part_num, perPart);
  }

  // Parts: verify, enrich, attach verified colors.
  const seen = new Set();
  const outParts = curated.parts.map(({ partNum, family, kidName }) => {
    if (seen.has(partNum)) errors.push(`duplicate part ${partNum}`);
    seen.add(partNum);
    if (!familyIds.has(family)) errors.push(`part ${partNum}: unknown family "${family}"`);
    const row = partByNum.get(partNum);
    if (!row) { errors.push(`part ${partNum} not in parts.csv`); return null; }
    const perPart = elementIndex.get(partNum) ?? new Map();
    if (perPart.size === 0) errors.push(`part ${partNum} has no element in any palette color`);
    const elementsOut = Object.fromEntries([...perPart.entries()].sort((a, b) => a[0] - b[0]).map(([c, el]) => [String(c), el]));
    return {
      partNum,
      name: row.name,
      category: categoryById.get(Number(row.part_cat_id)) ?? null,
      material: row.part_material,
      family,
      kidName,
      size: sizeFromName(row.name),
      colors: Object.keys(elementsOut).map(Number),
      elements: elementsOut,
    };
  }).filter(Boolean);

  if (errors.length) {
    console.error('Catalog build failed:\n  ' + errors.join('\n  '));
    process.exit(1);
  }

  const catalog = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    source: {
      name: SOURCE.name,
      url: SOURCE.url,
      attribution: 'Part and color data from Rebrickable (rebrickable.com). LEGO is a trademark of the LEGO Group, which does not sponsor, authorize, or endorse this project.',
      tables: SOURCE.files,
      rows: { colors: colors.length, parts: parts.length, part_categories: categories.length, elements: elements.length },
    },
    families: curated.families,
    colors: kidColors,
    parts: outParts,
  };

  const json = JSON.stringify(catalog, null, 2);
  writeFileSync(join(here, 'catalog.json'), json + '\n');
  writeFileSync(join(here, 'catalog.js'), `// Generated by catalog/build-catalog.mjs. Do not edit.\nwindow.ALGO_CATALOG = ${json};\n`);
  const tsDir = join(root, 'mobile', 'src', 'catalog');
  mkdirSync(tsDir, { recursive: true });
  writeFileSync(join(tsDir, 'catalog.generated.ts'), `// Generated by catalog/build-catalog.mjs. Do not edit.\nimport type { Catalog } from './types';\n\nexport const catalog: Catalog = ${json};\n`);

  const elementCount = outParts.reduce((n, p) => n + p.colors.length, 0);
  console.log(`catalog.json: ${outParts.length} parts, ${kidColors.length} colors, ${elementCount} verified part+color elements`);
  console.log(`source rows: parts=${parts.length} colors=${colors.length} elements=${elements.length}`);
  const byFamily = {};
  for (const p of outParts) byFamily[p.family] = (byFamily[p.family] ?? 0) + 1;
  console.table(byFamily);
}

main().catch(error => { console.error(error); process.exit(1); });
