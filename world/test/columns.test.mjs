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

test('digging a beach column to sea level floods it, then you dig the sea floor: sand, then stone', () => {
  const beach = { height: cfg.seaLevel + 1, material: MATERIAL.sand, water: false };
  const edits = new EditStore();
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.sand);
  let col = resolveColumn(beach, edits.get('k'), cfg.seaLevel);
  assert.equal(col.water, true);
  assert.equal(col.surface, MATERIAL.water);
  assert.equal(col.top, MATERIAL.sand, 'the sand floor of the flooded hole');
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.sand, 'digging under water takes the floor');
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.sand);
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.sand);
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.stone);
  col = resolveColumn(beach, edits.get('k'), cfg.seaLevel);
  assert.equal(col.h, cfg.seaLevel - 4);
  assert.equal(col.water, true);
});

test('the sea floor is diggable down to bedrock, never through it', () => {
  const sea = { height: 5, material: MATERIAL.water, water: true };
  const edits = new EditStore();
  assert.equal(edits.dig('s', sea, cfg.seaLevel), MATERIAL.sand);
  assert.equal(edits.dig('s', sea, cfg.seaLevel), MATERIAL.stone);
  assert.equal(edits.dig('s', sea, cfg.seaLevel), MATERIAL.stone);
  assert.equal(resolveColumn(sea, edits.get('s'), cfg.seaLevel).h, 2);
  assert.equal(edits.dig('s', sea, cfg.seaLevel), null, 'bedrock');
});

test('ice: walkable, frozen down to the sea floor, dig it for an ice brick and an open hole, build on top of it', () => {
  const ice = { height: cfg.seaLevel - 3, material: MATERIAL.ice, water: true };
  const frozen = resolveColumn(ice, undefined, cfg.seaLevel);
  assert.equal(frozen.frozen, true);
  assert.equal(frozen.walk, cfg.seaLevel);
  assert.equal(frozen.surface, MATERIAL.ice);
  assert.equal(frozen.layer(cfg.seaLevel - 1), MATERIAL.ice);
  assert.equal(frozen.layer(cfg.seaLevel - 3), MATERIAL.ice, 'frozen column above the floor');
  assert.equal(frozen.layer(cfg.seaLevel - 4), MATERIAL.sand, 'sea floor');
  assert.equal(frozen.layer(cfg.seaLevel), null);

  const edits = new EditStore();
  assert.equal(edits.dig('i', ice, cfg.seaLevel), MATERIAL.ice);
  const hole = resolveColumn(ice, edits.get('i'), cfg.seaLevel);
  assert.equal(hole.frozen, false);
  assert.equal(hole.water, true);
  assert.equal(hole.surface, MATERIAL.water);
  assert.equal(edits.size, 1, 'a thawed column is a real difference and stays stored');
  assert.equal(edits.dig('i', ice, cfg.seaLevel), MATERIAL.sand, 'then the sea floor');

  const edits2 = new EditStore();
  assert.equal(edits2.place('j', ice, cfg.seaLevel, MATERIAL.wood, cfg.maxHeight), cfg.seaLevel + 1);
  const cabin = resolveColumn(ice, edits2.get('j'), cfg.seaLevel);
  assert.equal(cabin.surface, MATERIAL.wood);
  assert.equal(cabin.layer(cfg.seaLevel - 1), MATERIAL.ice, 'the ice is still under the wood');
  assert.equal(edits2.dig('j', ice, cfg.seaLevel), MATERIAL.wood);
  assert.equal(edits2.size, 0, 'back to natural ice');
  assert.equal(resolveColumn(ice, edits2.get('j'), cfg.seaLevel).frozen, true);
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

test('edits survive a JSON round trip, thawed flag included', () => {
  const { n, key } = grassColumn();
  const edits = new EditStore();
  edits.place(key, n, cfg.seaLevel, MATERIAL.snow, cfg.maxHeight);
  const ice = { height: cfg.seaLevel - 3, material: MATERIAL.ice, water: true };
  edits.dig('ice', ice, cfg.seaLevel);
  const copy = EditStore.fromJSON(JSON.parse(JSON.stringify(edits)));
  assert.deepEqual(copy.get(key), edits.get(key));
  assert.equal(copy.get('ice').thawed, true);
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
