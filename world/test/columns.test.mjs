import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, planetRadius } from '../src/config.js';
import { createTerrain } from '../src/terrain.js';
import { EditStore, resolveColumn, naturalLayerMaterial, blockMatrix, hasApple, columnKey } from '../src/columns.js';
import { MATERIAL } from '../src/materials.js';
import { columnOf, normalize } from '../src/planet.js';
import { mulberry32 } from '../src/noise.js';

const cfg = DEFAULT_CONFIG;
const terrain = createTerrain(cfg);
const rand = mulberry32(5);
const randomDirection = () => normalize([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]);

function grassColumn() {
  for (;;) {
    const d = randomDirection();
    const n = terrain.sample(d);
    if (!n.water && n.material === MATERIAL.grass && n.height > cfg.seaLevel + 5) return { d, n, key: (() => { const c = columnOf(d, cfg.faceResolution); return columnKey(c.face, c.i, c.j); })() };
  }
}

test('natural layers: grass, then dirt, then stone; sea floor is sand over stone', () => {
  const { n } = grassColumn();
  const top = n.height - 1;
  assert.equal(naturalLayerMaterial(n, top), MATERIAL.grass);
  assert.equal(naturalLayerMaterial(n, top - 1), MATERIAL.dirt);
  assert.equal(naturalLayerMaterial(n, top - 3), MATERIAL.dirt);
  assert.equal(naturalLayerMaterial(n, top - 4), MATERIAL.stone);
  assert.equal(naturalLayerMaterial(n, top + 1), null);
  const sea = { height: 8, material: MATERIAL.water, water: true };
  assert.equal(naturalLayerMaterial(sea, 7), MATERIAL.sand);
  assert.equal(naturalLayerMaterial(sea, 3), MATERIAL.stone);
});

test('dig removes the top block, exposes dirt, and returns what was dug', () => {
  const { n, key } = grassColumn();
  const edits = new EditStore();
  assert.equal(edits.dig(key, n, cfg.seaLevel), MATERIAL.grass);
  const col = resolveColumn(n, edits.get(key), cfg.seaLevel);
  assert.equal(col.h, n.height - 1);
  assert.equal(col.top, MATERIAL.dirt);
  assert.equal(edits.dig(key, n, cfg.seaLevel), MATERIAL.dirt);
});

test('place stacks a block and digging it back leaves the store empty', () => {
  const { n, key } = grassColumn();
  const edits = new EditStore();
  assert.equal(edits.place(key, n, cfg.seaLevel, MATERIAL.stone, cfg.maxHeight), n.height + 1);
  let col = resolveColumn(n, edits.get(key), cfg.seaLevel);
  assert.equal(col.top, MATERIAL.stone);
  assert.equal(col.layer(n.height - 1), MATERIAL.grass, 'the grass is still under the stone');
  assert.equal(edits.dig(key, n, cfg.seaLevel), MATERIAL.stone);
  assert.equal(edits.size, 0, 'back to natural, no entry kept');
  col = resolveColumn(n, undefined, cfg.seaLevel);
  assert.equal(col.top, MATERIAL.grass);
});

test('digging a beach column to sea level floods it; water cannot be dug; ice is walkable', () => {
  const beach = { height: cfg.seaLevel + 1, material: MATERIAL.sand, water: false };
  const edits = new EditStore();
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.sand);
  const col = resolveColumn(beach, edits.get('k'), cfg.seaLevel);
  assert.equal(col.water, true);
  assert.equal(col.surface, MATERIAL.water);
  assert.equal(col.top, MATERIAL.sand, 'the sand floor of the flooded hole');
  assert.equal(edits.dig('k', beach, cfg.seaLevel), null);
  const ice = { height: cfg.seaLevel - 3, material: MATERIAL.ice, water: true };
  const frozen = resolveColumn(ice, undefined, cfg.seaLevel);
  assert.equal(frozen.frozen, true);
  assert.equal(frozen.walk, cfg.seaLevel);
  assert.equal(frozen.surface, MATERIAL.ice);
});

test('placing on water makes a block standing at the surface', () => {
  const sea = { height: 6, material: MATERIAL.water, water: true };
  const edits = new EditStore();
  const h = edits.place('w', sea, cfg.seaLevel, MATERIAL.wood, cfg.maxHeight);
  assert.equal(h, 7, 'first block goes on the sea floor');
  for (let n = 0; n < cfg.seaLevel - 6; n += 1) edits.place('w', sea, cfg.seaLevel, MATERIAL.wood, cfg.maxHeight);
  const col = resolveColumn(sea, edits.get('w'), cfg.seaLevel);
  assert.equal(col.h, cfg.seaLevel + 1);
  assert.equal(col.water, false);
  assert.equal(col.surface, MATERIAL.wood);
});

test('edits survive a JSON round trip', () => {
  const { n, key } = grassColumn();
  const edits = new EditStore();
  edits.place(key, n, cfg.seaLevel, MATERIAL.snow, cfg.maxHeight);
  const copy = EditStore.fromJSON(JSON.parse(JSON.stringify(edits)));
  assert.deepEqual(copy.get(key), edits.get(key));
});

test('blockMatrix puts the block centre at radius R + k + 0.5 with unit height', () => {
  const R = planetRadius(cfg);
  const m = blockMatrix(2, 100, 200, 15, cfg, R);
  const centre = Math.hypot(m[12], m[13], m[14]);
  assert.ok(Math.abs(centre - (R + 15.5)) < 1e-3, `centre ${centre}`);   // Float32 output
  assert.ok(Math.abs(Math.hypot(m[4], m[5], m[6]) - 1) < 1e-6);
  const width = Math.hypot(m[0], m[1], m[2]);
  assert.ok(width > 0.8 && width < 1.3, `cell width ${width}`);
});

test('apples grow on about 1 in 220 grass columns and never on water', () => {
  let grass = 0, apples = 0;
  for (let n = 0; n < 40000; n += 1) {
    const d = randomDirection();
    const nat = terrain.sample(d);
    const c = columnOf(d, cfg.faceResolution);
    const apple = hasApple(cfg.seed, c.face, c.i, c.j, nat);
    if (nat.water) assert.equal(apple, false);
    if (!nat.water && nat.material === MATERIAL.grass) { grass += 1; if (apple) apples += 1; }
  }
  const rate = grass / Math.max(1, apples);
  assert.ok(rate > 120 && rate < 400, `one apple per ${rate.toFixed(0)} grass columns`);
});
