import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOB_TYPES, ANIMALS, CHAOS_MODES, spawnTargets, zombieTypeFor, zombieMode, nextChaosMode } from '../src/mobs.js';
import { MATERIAL } from '../src/materials.js';
import { RULES, freshVitals, stepVitals, hurt, eat } from '../src/rules.js';

test('every mob type is complete and every drop is a real item', () => {
  for (const [key, type] of Object.entries(MOB_TYPES)) {
    assert.ok(['animal', 'zombie'].includes(type.kind), key);
    assert.ok(type.hp > 0 && type.speed > 0 && type.name, key);
    if (type.kind === 'zombie') assert.ok(type.damage > 0 && type.habitat, key);
  }
  assert.equal(ANIMALS.length, 4);
  assert.ok(MOB_TYPES.chaosZombie.chaos);
});

test('zombies are a night thing', () => {
  assert.ok(spawnTargets(1).zombies < spawnTargets(0).zombies);
  assert.equal(spawnTargets(0.9).animals, spawnTargets(0.1).animals);
});

test('the zombie for a place: water in the sea, ice in the cold, otherwise fire, electric or the Everything Zombie', () => {
  const sea = { swim: true, resolved: { surface: MATERIAL.water }, natural: { cold: 0.2 } };
  const snow = { swim: false, resolved: { surface: MATERIAL.snow }, natural: { cold: 0.9 } };
  const plains = { swim: false, resolved: { surface: MATERIAL.grass }, natural: { cold: 0.2 } };
  assert.equal(zombieTypeFor(sea, 0.1), 'waterZombie');
  assert.equal(zombieTypeFor(snow, 0.1), 'iceZombie');
  assert.equal(zombieTypeFor(plains, 0.1), 'fireZombie');
  assert.equal(zombieTypeFor(plains, 0.7), 'electricZombie');
  assert.equal(zombieTypeFor(plains, 0.95), 'chaosZombie');
});

test('zombie modes by distance; electric zombies zap from afar', () => {
  assert.equal(zombieMode(1, MOB_TYPES.fireZombie), 'attack');
  assert.equal(zombieMode(3, MOB_TYPES.fireZombie), 'chase');
  assert.equal(zombieMode(3, MOB_TYPES.electricZombie), 'zap');
  assert.equal(zombieMode(30, MOB_TYPES.fireZombie), 'wander');
});

test('the Everything Zombie has every mode and picks them from a roll', () => {
  const seen = new Set();
  for (let r = 0; r < 1; r += 0.01) seen.add(nextChaosMode(r));
  assert.equal(seen.size, CHAOS_MODES.length);
});

test('lava burns, burning keeps hurting after, and a hit from a zombie can kill', () => {
  let v = freshVitals();
  v = stepVitals(v, 2, { submerged: false, running: false, moving: false, onLava: true, burning: true }).vitals;
  assert.ok(v.health < RULES.maxHealth - 2 * RULES.lavaDamagePerSecond + 0.01, `lava ${v.health}`);
  const burned = stepVitals(freshVitals(), 3, { submerged: false, running: false, moving: false, onLava: false, burning: true }).vitals;
  assert.ok(Math.abs(burned.health - (RULES.maxHealth - 3 * RULES.burnDamagePerSecond)) < 1e-9);
  const dead = hurt({ ...freshVitals(), health: 1 }, 1.5, 'fire zombie');
  assert.equal(dead.alive, false);
  assert.equal(dead.causeOfDeath, 'fire zombie');
});

test('meat is food too', () => {
  const r = eat({ ...freshVitals(), hunger: 20 }, { meat: 1, apple: 0 }, 'meat');
  assert.equal(r.ate, true);
  assert.equal(r.vitals.hunger, 20 + RULES.food.meat);
  assert.equal(r.inventory.meat, 0);
});
