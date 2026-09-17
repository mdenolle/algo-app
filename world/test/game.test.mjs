import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKS, BLOCK_BY_KEY, DEFAULT_HOTBAR, HOTBAR_SIZE, freshLife, upgradeLife } from '../src/game.js';
import { MATERIALS } from '../src/materials.js';

test('every material except water is a block you can hold, plus apple, meat and the eight tools', () => {
  assert.equal(BLOCKS.length, MATERIALS.length - 1 + 2 + 8);
  assert.ok(BLOCK_BY_KEY.has('apple') && BLOCK_BY_KEY.has('meat') && BLOCK_BY_KEY.has('diamond') && BLOCK_BY_KEY.has('tnt') && BLOCK_BY_KEY.has('lava') && !BLOCK_BY_KEY.has('water'));
});

test('the default hotbar has nine known blocks and the chest has something to build with', () => {
  assert.equal(DEFAULT_HOTBAR.length, HOTBAR_SIZE);
  for (const key of DEFAULT_HOTBAR) assert.ok(BLOCK_BY_KEY.has(key), key);
  const life = freshLife();
  assert.ok(life.inventory.planks > 0 && life.inventory.glass > 0 && life.inventory.tnt > 0 && life.inventory.apple === 2);
  assert.equal(life.inventory.diamond, 0, 'ores must be mined');
});

test('an old save without a hotbar or the new blocks upgrades cleanly', () => {
  const old = { vitals: { health: 3, hunger: 50, air: 12, alive: true, causeOfDeath: null }, inventory: { grass: 4, apple: 1 }, selected: 2, stats: { dug: 9 } };
  const life = upgradeLife(old);
  assert.equal(life.vitals.health, 3);
  assert.equal(life.inventory.grass, 4);
  assert.equal(life.inventory.apple, 1, 'saved counts win over the chest');
  assert.equal(life.inventory.glass, 12, 'missing blocks get the chest amount');
  assert.deepEqual(life.hotbar, DEFAULT_HOTBAR);
  assert.equal(life.stats.dug, 9);
  assert.equal(life.stats.explosions, 0);
});
