import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/config.js';
import { createTerrain } from '../src/terrain.js';
import { createNoise, mulberry32 } from '../src/noise.js';
import { normalize } from '../src/planet.js';
import { MATERIAL, MATERIALS, MATERIAL_RGB } from '../src/materials.js';

const rand = mulberry32(99);
const randomDirection = () => normalize([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]);

test('noise is deterministic per seed, bounded, and differs between seeds', () => {
  const a = createNoise(1), b = createNoise(1), c = createNoise(2);
  let differs = false;
  for (let n = 0; n < 2000; n += 1) {
    const x = rand() * 40 - 20, y = rand() * 40 - 20, z = rand() * 40 - 20;
    const va = a.noise3(x, y, z);
    assert.equal(va, b.noise3(x, y, z));
    assert.ok(va >= -1.05 && va <= 1.05, `noise ${va}`);
    const f = a.fbm(x, y, z, 5);
    assert.ok(f >= -1.05 && f <= 1.05);
    const r = a.ridged(x, y, z);
    assert.ok(r >= 0 && r <= 1.0001);
    if (va !== c.noise3(x, y, z)) differs = true;
  }
  assert.ok(differs);
});

test('terrain heights stay within [1, maxHeight] and water columns sit below sea level', () => {
  const terrain = createTerrain(DEFAULT_CONFIG);
  for (let n = 0; n < 4000; n += 1) {
    const col = terrain.sample(randomDirection());
    assert.ok(Number.isInteger(col.height));
    assert.ok(col.height >= 1 && col.height <= DEFAULT_CONFIG.maxHeight, `height ${col.height}`);
    if (col.water) assert.ok(col.height < DEFAULT_CONFIG.seaLevel);
    else assert.ok(col.height > DEFAULT_CONFIG.seaLevel);
    assert.ok(MATERIALS.some(m => m.id === col.material));
  }
});

test('the planet is mostly ocean but has real continents (40–75% water)', () => {
  const terrain = createTerrain(DEFAULT_CONFIG);
  let water = 0;
  const N = 6000;
  for (let n = 0; n < N; n += 1) if (terrain.sample(randomDirection()).water) water += 1;
  const fraction = water / N;
  assert.ok(fraction > 0.4 && fraction < 0.75, `water fraction ${fraction.toFixed(2)}`);
});

test('ice biome exists near the poles and plains near the equator', () => {
  const terrain = createTerrain(DEFAULT_CONFIG);
  const count = (lat, material) => {
    let hits = 0, land = 0;
    for (let n = 0; n < 3000; n += 1) {
      const angle = rand() * Math.PI * 2;
      const d = normalize([Math.cos(lat) * Math.cos(angle), Math.sin(lat), Math.cos(lat) * Math.sin(angle)]);
      const col = terrain.sample(d);
      if (col.water) continue;
      land += 1;
      if (col.material === material) hits += 1;
    }
    return land ? hits / land : 0;
  };
  assert.ok(count(1.35, MATERIAL.snow) > 0.8, 'polar land should be snow');
  assert.ok(count(0.1, MATERIAL.grass) > 0.4, 'equatorial land should be mostly grass');
  assert.ok(count(0.1, MATERIAL.snow) < 0.15, 'no snow biome at the equator (only caps)');
});

test('surfaceHeight is walkable: sea level over water, column height on land', () => {
  const terrain = createTerrain(DEFAULT_CONFIG);
  for (let n = 0; n < 500; n += 1) {
    const d = randomDirection();
    const col = terrain.sample(d);
    assert.equal(terrain.surfaceHeight(d), col.water ? DEFAULT_CONFIG.seaLevel : col.height);
  }
});

test('findSpawn returns grassy land above the beach', () => {
  const terrain = createTerrain(DEFAULT_CONFIG);
  const spawn = terrain.findSpawn();
  const col = terrain.sample(spawn);
  assert.equal(col.water, false);
  assert.equal(col.material, MATERIAL.grass);
  assert.ok(col.height >= DEFAULT_CONFIG.seaLevel + 3);
});

test('materials have linear RGB in [0,1] and unique ids/keys', () => {
  assert.equal(new Set(MATERIALS.map(m => m.id)).size, MATERIALS.length);
  assert.equal(new Set(MATERIALS.map(m => m.key)).size, MATERIALS.length);
  MATERIALS.forEach((m, index) => assert.equal(m.id, index));
  for (const rgb of MATERIAL_RGB) for (const c of rgb) assert.ok(c >= 0 && c <= 1);
});
