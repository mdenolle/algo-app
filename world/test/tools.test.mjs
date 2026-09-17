import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, RECIPES, canCraft, craft, hitBlock, hitDamage } from '../src/tools.js';
import { MATERIAL, hardnessOf } from '../src/materials.js';
import { freshLife, BLOCK_BY_KEY, DEFAULT_HOTBAR } from '../src/game.js';

test('soft blocks break in one hit by hand, stone needs a pickaxe, ores a stone one, obsidian diamond', () => {
  assert.deepEqual(hitBlock(MATERIAL.dirt, 'planks'), { allowed: true, power: 1, hardness: 1, needs: null });
  assert.equal(hitBlock(MATERIAL.stone, 'planks').allowed, false);
  assert.match(hitBlock(MATERIAL.stone, 'planks').needs, /wooden pickaxe/);
  assert.deepEqual(hitBlock(MATERIAL.stone, 'woodPickaxe'), { allowed: true, power: 2, hardness: 3, needs: null });
  assert.equal(hitBlock(MATERIAL.iron, 'woodPickaxe').allowed, false);
  assert.equal(hitBlock(MATERIAL.iron, 'stonePickaxe').allowed, true);
  assert.equal(hitBlock(MATERIAL.diamond, 'stonePickaxe').allowed, false);
  assert.equal(hitBlock(MATERIAL.diamond, 'ironPickaxe').allowed, true);
  assert.equal(hitBlock(MATERIAL.obsidian, 'ironPickaxe').allowed, false);
  assert.equal(hitBlock(MATERIAL.obsidian, 'diamondPickaxe').allowed, true);
  assert.equal(hitBlock(MATERIAL.lava, 'diamondPickaxe').allowed, false);
  assert.equal(hardnessOf(MATERIAL.obsidian).hardness, 8);
});

test('a better pickaxe hits harder; swords hit zombies harder than hands', () => {
  assert.ok(hitBlock(MATERIAL.stone, 'diamondPickaxe').power > hitBlock(MATERIAL.stone, 'woodPickaxe').power);
  assert.equal(hitDamage('planks'), 1);
  assert.equal(hitDamage('woodSword'), 2);
  assert.equal(hitDamage('diamondSword'), 6);
  assert.equal(hitDamage('woodPickaxe'), 1, 'a pickaxe is not a weapon');
});

test('recipes: planks from wood, pickaxes and swords from planks and stone or ores', () => {
  const inv = { wood: 1, planks: 0, stone: 3 };
  const planks = RECIPES.find(r => r.makes === 'planks' && r.needs.wood);
  assert.equal(canCraft(planks, inv), true);
  const after = craft(planks, inv);
  assert.equal(after.planks, 4);
  assert.equal(after.wood, 0);
  const stonePick = RECIPES.find(r => r.makes === 'stonePickaxe');
  assert.equal(canCraft(stonePick, after), true);
  const withPick = craft(stonePick, after);
  assert.equal(withPick.stonePickaxe, 1);
  assert.equal(withPick.stone, 0);
  assert.equal(withPick.planks, 2);
  assert.equal(craft(stonePick, withPick), null, 'no stone left');
  for (const r of RECIPES) assert.ok(BLOCK_BY_KEY.has(r.makes), r.makes);
  for (const r of RECIPES) for (const k of Object.keys(r.needs)) assert.ok(BLOCK_BY_KEY.has(k), k);
});

test('you start with a wooden pickaxe and sword in the hotbar', () => {
  const life = freshLife();
  assert.equal(life.inventory.woodPickaxe, 1);
  assert.equal(life.inventory.woodSword, 1);
  assert.ok(DEFAULT_HOTBAR.includes('woodPickaxe') && DEFAULT_HOTBAR.includes('woodSword'));
  assert.equal(Object.keys(TOOLS).length, 8);
});
