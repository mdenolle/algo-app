import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(here, 'catalog.json'), 'utf8'));
const curated = JSON.parse(readFileSync(join(here, 'curated.json'), 'utf8'));

test('csv parser handles quoted commas, escaped quotes and CRLF', () => {
  const rows = parseCsv('id,name\r\n1,"Brick, 2 x 2 [Pin, Hole]"\r\n2,"Say ""hi"""\n3,plain\n');
  assert.deepEqual(rows, [
    { id: '1', name: 'Brick, 2 x 2 [Pin, Hole]' },
    { id: '2', name: 'Say "hi"' },
    { id: '3', name: 'plain' },
  ]);
});

test('every curated part and color made it into the catalog', () => {
  assert.equal(catalog.parts.length, curated.parts.length);
  assert.equal(catalog.colors.length, curated.colors.length);
  assert.deepEqual(catalog.parts.map(p => p.partNum), curated.parts.map(p => p.partNum));
});

test('part numbers are unique and families are known', () => {
  const families = new Set(catalog.families.map(f => f.id));
  const nums = catalog.parts.map(p => p.partNum);
  assert.equal(new Set(nums).size, nums.length);
  for (const part of catalog.parts) assert.ok(families.has(part.family), `${part.partNum} family ${part.family}`);
});

test('every part is offered in at least one verified color, with one element id per color', () => {
  const palette = new Set(catalog.colors.map(c => c.id));
  for (const part of catalog.parts) {
    assert.ok(part.colors.length >= 1, `${part.partNum} has no colors`);
    assert.deepEqual(part.colors, Object.keys(part.elements).map(Number), `${part.partNum} colors/elements mismatch`);
    for (const colorId of part.colors) {
      assert.ok(palette.has(colorId), `${part.partNum} color ${colorId} not in palette`);
      assert.match(part.elements[String(colorId)], /^\d+$/, `${part.partNum} element for color ${colorId}`);
    }
  }
});

test('colors carry official names, 6-digit RGB and a unique kid word', () => {
  const kids = catalog.colors.map(c => c.kid);
  assert.equal(new Set(kids).size, kids.length);
  for (const color of catalog.colors) {
    assert.ok(color.name.length > 0);
    assert.match(color.rgb, /^[0-9A-F]{6}$/);
  }
});

test('the seven original kid colors and families still exist (the UI draws them)', () => {
  const kids = new Set(catalog.colors.map(c => c.kid));
  for (const kid of ['blue', 'red', 'yellow', 'green', 'white', 'black', 'gray']) assert.ok(kids.has(kid), kid);
  const families = new Set(catalog.families.map(f => f.id));
  for (const family of ['brick', 'short', 'plate', 'slope', 'curve', 'wheel', 'axle']) assert.ok(families.has(family), family);
});

test('generated copies match catalog.json', () => {
  const js = readFileSync(join(here, 'catalog.js'), 'utf8');
  const ts = readFileSync(join(here, '..', 'mobile', 'src', 'catalog', 'catalog.generated.ts'), 'utf8');
  const body = JSON.stringify(catalog, null, 2);
  assert.ok(js.includes(body), 'catalog.js is stale; run node catalog/build-catalog.mjs --offline');
  assert.ok(ts.includes(body), 'catalog.generated.ts is stale; run node catalog/build-catalog.mjs --offline');
});

test('source attribution is present', () => {
  assert.equal(catalog.source.name, 'Rebrickable');
  assert.match(catalog.source.attribution, /Rebrickable/);
  assert.match(catalog.source.attribution, /LEGO Group/);
});
