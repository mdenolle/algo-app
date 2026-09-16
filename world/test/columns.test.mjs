import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, planetRadius } from '../src/config.js';
import { createTerrain } from '../src/terrain.js';
import { EditStore, resolveColumn, naturalLayerMaterial, blockMatrix, hasApple, columnKey, oreAt, columnSeed, BEDROCK_LAYERS } from '../src/columns.js';
import { MATERIAL, MATERIALS } from '../src/materials.js';
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

test('natural layers: grass, then dirt, then stone; sea floor is sand over stone; nothing above the top', () => {
  const { n } = grassColumn();
  const top = n.height - 1;
  assert.equal(naturalLayerMaterial(n, top), MATERIAL.grass);
  assert.equal(naturalLayerMaterial(n, top - 1), MATERIAL.dirt);
  assert.equal(naturalLayerMaterial(n, top - 4), MATERIAL.stone);
  assert.equal(naturalLayerMaterial(n, top + 1), null);
  const sea = { height: 8, material: MATERIAL.water, water: true };
  assert.equal(naturalLayerMaterial(sea, 7), MATERIAL.sand);
  assert.equal(naturalLayerMaterial(sea, 3), MATERIAL.stone);
  assert.equal(naturalLayerMaterial(sea, 8), null);
});

test('resolveColumn on natural ground: solid up to the top, air above, surface is the top block', () => {
  const { n } = grassColumn();
  const col = resolveColumn(n, undefined, cfg.seaLevel);
  assert.equal(col.top, n.height - 1);
  assert.equal(col.h, n.height);
  assert.equal(col.solid(col.top), true);
  assert.equal(col.solid(col.top + 1), false);
  assert.equal(col.surface, MATERIAL.grass);
  assert.equal(col.water, false);
});

test('dig removes the top block, exposes dirt, and returns what was dug', () => {
  const { n, key } = grassColumn();
  const edits = new EditStore();
  assert.equal(edits.dig(key, n, cfg.seaLevel), MATERIAL.grass);
  const col = resolveColumn(n, edits.get(key), cfg.seaLevel);
  assert.equal(col.h, n.height - 1);
  assert.equal(col.surface, MATERIAL.dirt);
  assert.equal(edits.dig(key, n, cfg.seaLevel), MATERIAL.dirt);
});

test('blocks anywhere: dig a hole in the middle, the blocks above float; place a block in the air', () => {
  const { n, key } = grassColumn();
  const edits = new EditStore();
  const middle = n.height - 3;
  assert.equal(edits.digAt(key, n, cfg.seaLevel, middle), MATERIAL.dirt);
  let col = resolveColumn(n, edits.get(key), cfg.seaLevel);
  assert.equal(col.solid(middle), false, 'hole');
  assert.equal(col.solid(middle + 1), true, 'block above the hole stays');
  assert.equal(col.top, n.height - 1, 'top unchanged');
  assert.equal(edits.digAt(key, n, cfg.seaLevel, middle), null, 'nothing left to dig there');
  assert.equal(edits.placeAt(key, n, cfg.seaLevel, n.height + 4, MATERIAL.glass, cfg.maxHeight), n.height + 4, 'a glass block floating 4 above the ground');
  col = resolveColumn(n, edits.get(key), cfg.seaLevel);
  assert.equal(col.top, n.height + 4);
  assert.equal(col.solid(n.height + 2), false, 'air between');
  assert.equal(col.surface, MATERIAL.glass);
  assert.equal(edits.placeAt(key, n, cfg.seaLevel, n.height + 4, MATERIAL.stone, cfg.maxHeight), null, 'occupied');
  assert.equal(edits.placeAt(key, n, cfg.seaLevel, middle, MATERIAL.stone, cfg.maxHeight), middle, 'fill the hole back');
  col = resolveColumn(n, edits.get(key), cfg.seaLevel);
  assert.equal(col.material(middle), MATERIAL.stone);
});

test('place stacks a block and digging it back leaves the store empty', () => {
  const { n, key } = grassColumn();
  const edits = new EditStore();
  assert.equal(edits.place(key, n, cfg.seaLevel, MATERIAL.stone, cfg.maxHeight), n.height + 1);
  let col = resolveColumn(n, edits.get(key), cfg.seaLevel);
  assert.equal(col.surface, MATERIAL.stone);
  assert.equal(col.material(n.height - 1), MATERIAL.grass, 'the grass is still under the stone');
  assert.equal(edits.dig(key, n, cfg.seaLevel), MATERIAL.stone);
  assert.equal(edits.size, 0, 'back to natural, no entry kept');
});

test('bedrock: the two bottom layers cannot be dug', () => {
  const low = { height: 3, material: MATERIAL.stone, water: false };
  const edits = new EditStore();
  assert.equal(edits.digAt('b', low, cfg.seaLevel, 2), MATERIAL.stone);
  assert.equal(edits.digAt('b', low, cfg.seaLevel, 1), null);
  assert.equal(edits.dig('b', low, cfg.seaLevel), null);
  assert.equal(BEDROCK_LAYERS, 2);
});

test('digging a beach column to sea level floods it, then you dig the sea floor: sand, then stone', () => {
  const beach = { height: cfg.seaLevel + 1, material: MATERIAL.sand, water: false };
  const edits = new EditStore();
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.sand);
  let col = resolveColumn(beach, edits.get('k'), cfg.seaLevel);
  assert.equal(col.water, true);
  assert.equal(col.surface, MATERIAL.water);
  assert.equal(col.material(col.top), MATERIAL.sand, 'the sand floor of the flooded hole');
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.sand, 'digging under water takes the floor');
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.sand);
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.sand);
  assert.equal(edits.dig('k', beach, cfg.seaLevel), MATERIAL.stone);
  col = resolveColumn(beach, edits.get('k'), cfg.seaLevel);
  assert.equal(col.h, cfg.seaLevel - 4);
});

test('ice: walkable, frozen down to the sea floor, dig it for an ice brick and an open hole, build on top of it', () => {
  const ice = { height: cfg.seaLevel - 3, material: MATERIAL.ice, water: true };
  const frozen = resolveColumn(ice, undefined, cfg.seaLevel);
  assert.equal(frozen.frozen, true);
  assert.equal(frozen.h, cfg.seaLevel);
  assert.equal(frozen.surface, MATERIAL.ice);
  assert.equal(frozen.material(cfg.seaLevel - 1), MATERIAL.ice);
  assert.equal(frozen.material(cfg.seaLevel - 4), MATERIAL.sand, 'sea floor');
  assert.equal(frozen.solid(cfg.seaLevel), false);

  const edits = new EditStore();
  assert.equal(edits.dig('i', ice, cfg.seaLevel), MATERIAL.ice);
  const hole = resolveColumn(ice, edits.get('i'), cfg.seaLevel);
  assert.equal(hole.frozen, false);
  assert.equal(hole.water, true);
  assert.equal(hole.h, cfg.seaLevel - 3, 'open water down to the floor');
  assert.equal(edits.dig('i', ice, cfg.seaLevel), MATERIAL.sand, 'then the sea floor');

  const edits2 = new EditStore();
  assert.equal(edits2.place('j', ice, cfg.seaLevel, MATERIAL.wood, cfg.maxHeight), cfg.seaLevel + 1);
  const cabin = resolveColumn(ice, edits2.get('j'), cfg.seaLevel);
  assert.equal(cabin.surface, MATERIAL.wood);
  assert.equal(cabin.material(cfg.seaLevel - 1), MATERIAL.ice, 'the ice is still under the wood');
  assert.equal(edits2.dig('j', ice, cfg.seaLevel), MATERIAL.wood);
  assert.equal(edits2.size, 0, 'back to natural ice');
});

test('placing on water builds up from the sea floor', () => {
  const sea = { height: 6, material: MATERIAL.water, water: true };
  const edits = new EditStore();
  assert.equal(edits.place('w', sea, cfg.seaLevel, MATERIAL.wood, cfg.maxHeight), 7);
  assert.equal(edits.placeAt('w', sea, cfg.seaLevel, cfg.seaLevel, MATERIAL.planks, cfg.maxHeight), cfg.seaLevel, 'a plank at the surface, floating over the water');
  const col = resolveColumn(sea, edits.get('w'), cfg.seaLevel);
  assert.equal(col.water, true, 'the sea is still there under the plank');
  assert.equal(col.surface, MATERIAL.planks);
  assert.equal(col.solid(cfg.seaLevel - 1), false, 'water at the surface layer');
});

test('edits survive a JSON round trip, and version-1 saves convert', () => {
  const { n, key } = grassColumn();
  const edits = new EditStore();
  edits.place(key, n, cfg.seaLevel, MATERIAL.snow, cfg.maxHeight);
  edits.digAt(key, n, cfg.seaLevel, n.height - 2);
  const copy = EditStore.fromJSON(JSON.parse(JSON.stringify(edits)));
  assert.deepEqual(copy.get(key), edits.get(key));
  const v1 = EditStore.fromV1({ h: n.height - 2, placed: {} }, n.height);
  assert.deepEqual(v1.removed, [n.height - 2, n.height - 1]);
  const v1b = EditStore.fromV1({ h: n.height + 1, placed: { [n.height]: MATERIAL.stone } }, n.height);
  assert.deepEqual(v1b, { placed: { [n.height]: MATERIAL.stone }, removed: [] });
});

test('blockMatrix puts the block centre at radius R + k + 0.5 with unit height', () => {
  const R = planetRadius(cfg);
  const m = blockMatrix(2, 100, 200, 15, cfg, R);
  assert.ok(Math.abs(Math.hypot(m[12], m[13], m[14]) - (R + 15.5)) < 1e-3);
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

test('ores: about one stone block in nine, deep ones only near the bottom, deterministic', () => {
  const counts = {};
  let stone = 0, total = 0;
  for (let column = 0; column < 2000; column += 1) {
    const seed = columnSeed(1, 3, column, 17);
    for (let k = 0; k < 20; k += 1) {
      const m = oreAt(seed, k);
      total += 1;
      if (m === MATERIAL.stone) stone += 1; else counts[m] = (counts[m] ?? 0) + 1;
      assert.equal(m, oreAt(seed, k), 'deterministic');
      if (k > 6) assert.ok(m !== MATERIAL.diamond && m !== MATERIAL.obsidian && m !== MATERIAL.lapis && m !== MATERIAL.lava);
      if (k > 11) assert.ok(m === MATERIAL.stone || m === MATERIAL.coal || m === MATERIAL.iron);
    }
  }
  const oreFraction = 1 - stone / total;
  assert.ok(oreFraction > 0.07 && oreFraction < 0.17, `ore fraction ${oreFraction.toFixed(3)}`);
  assert.ok(counts[MATERIAL.coal] > counts[MATERIAL.diamond], 'coal is common, diamond rare');
  for (const m of [MATERIAL.coal, MATERIAL.iron, MATERIAL.gold, MATERIAL.diamond, MATERIAL.emerald, MATERIAL.redstone, MATERIAL.lapis, MATERIAL.obsidian, MATERIAL.lava]) assert.ok(counts[m] > 0, `${m} appears`);
});

test('a column with an ore seed exposes ores in its stone, and digging returns them', () => {
  const { n, key } = grassColumn();
  const seed = columnSeed(cfg.seed, 4, 10, 10);
  const col = resolveColumn(n, undefined, cfg.seaLevel, seed);
  const deep = col.material(4);
  assert.ok(deep === MATERIAL.stone || MATERIALS[deep].ore || deep === MATERIAL.lava, 'deep layers are stone, ore or lava');
  assert.equal(resolveColumn(n, undefined, cfg.seaLevel).material(4), MATERIAL.stone, 'no seed, no ores');
  const edits = new EditStore();
  assert.equal(edits.digAt(key, n, cfg.seaLevel, 4, seed), deep, 'digging returns the block that was rendered there');
});

test('blast lowers a column by up to depth blocks and stops at bedrock', () => {
  const { n, key } = grassColumn();
  const edits = new EditStore();
  assert.equal(edits.blast(key, n, cfg.seaLevel, 3), 3);
  assert.equal(resolveColumn(n, edits.get(key), cfg.seaLevel).h, n.height - 3);
  const low = { height: 3, material: MATERIAL.stone, water: false };
  assert.equal(edits.blast('low', low, cfg.seaLevel, 5), 1, 'only down to bedrock');
});
