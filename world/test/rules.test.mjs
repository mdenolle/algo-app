import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, freshVitals, stepVitals, applyFallDamage, eat } from '../src/rules.js';

const calm = { submerged: false, running: false, moving: false };

test('hunger drains to zero in about eight minutes at rest, then you starve', () => {
  let v = freshVitals();
  for (let t = 0; t < 480; t += 1) v = stepVitals(v, 1, calm).vitals;
  assert.ok(v.hunger < 1, `hunger ${v.hunger}`);
  assert.equal(v.alive, true);
  let died = null;
  for (let t = 0; t < 60 && !died; t += 1) { const r = stepVitals(v, 1, calm); v = r.vitals; if (r.events.includes('died')) died = v.causeOfDeath; }
  assert.equal(died, 'starved');
});

test('running while moving drains hunger twice as fast', () => {
  const a = stepVitals(freshVitals(), 10, calm).vitals.hunger;
  const b = stepVitals(freshVitals(), 10, { submerged: false, running: true, moving: true }).vitals.hunger;
  assert.ok(Math.abs((RULES.maxHunger - b) - 2 * (RULES.maxHunger - a)) < 1e-9);
});

test('under water you have maxAir seconds, then drown; surfacing refills air', () => {
  let v = freshVitals();
  const wet = { submerged: true, running: false, moving: false };
  for (let t = 0; t < RULES.maxAir; t += 1) v = stepVitals(v, 1, wet).vitals;
  assert.equal(v.health, RULES.maxHealth, 'no damage while air lasts');
  let cause = null;
  for (let t = 0; t < 30 && !cause; t += 1) { const r = stepVitals(v, 1, wet); v = r.vitals; if (r.events.includes('died')) cause = v.causeOfDeath; }
  assert.equal(cause, 'drowned');
  let fresh = stepVitals({ ...freshVitals(), air: 0 }, 1, calm).vitals;
  assert.ok(fresh.air >= RULES.airRefillPerSecond - 1e-9);
});

test('a full belly heals slowly; an empty one does not', () => {
  const hurt = { ...freshVitals(), health: 5 };
  assert.ok(stepVitals(hurt, 3, calm).vitals.health > 5.9);
  const hungryHurt = { ...hurt, hunger: 20 };
  assert.equal(stepVitals(hungryHurt, 3, calm).vitals.health, 5);
});

test('fall damage starts above the safe speed and can be fatal', () => {
  assert.equal(applyFallDamage(freshVitals(), RULES.safeFallSpeed).health, RULES.maxHealth);
  const bruised = applyFallDamage(freshVitals(), RULES.safeFallSpeed + 4);
  assert.ok(bruised.health < RULES.maxHealth && bruised.alive);
  const splat = applyFallDamage(freshVitals(), 60);
  assert.equal(splat.alive, false);
  assert.equal(splat.causeOfDeath, 'fell');
});

test('eating an apple restores hunger and consumes the apple; nothing happens when full or empty-handed', () => {
  const hungry = { ...freshVitals(), hunger: 30 };
  const r = eat(hungry, { apple: 2 });
  assert.equal(r.ate, true);
  assert.equal(r.vitals.hunger, 30 + RULES.applePoints);
  assert.equal(r.inventory.apple, 1);
  assert.equal(eat(hungry, { apple: 0 }).ate, false);
  assert.equal(eat(freshVitals(), { apple: 3 }).ate, false);
});

test('the dead stay dead', () => {
  const dead = { ...freshVitals(), health: 0, alive: false, causeOfDeath: 'drowned' };
  assert.equal(stepVitals(dead, 100, calm).vitals.alive, false);
  assert.equal(eat(dead, { apple: 1 }).ate, false);
});
