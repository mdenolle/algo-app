// Game: survival state (vitals, inventory, stats), the hotbar, and the actions
// that change the planet. Pure rules live in rules.js; this wires them to the
// world, the player and the renderer.

import { MATERIAL, MATERIALS } from './materials.js';
import { RULES, freshVitals, stepVitals, applyFallDamage, eat } from './rules.js';

export const HOTBAR = [
  { key: 'grass', label: 'Grass', material: MATERIAL.grass },
  { key: 'dirt', label: 'Dirt', material: MATERIAL.dirt },
  { key: 'stone', label: 'Stone', material: MATERIAL.stone },
  { key: 'sand', label: 'Sand', material: MATERIAL.sand },
  { key: 'snow', label: 'Snow', material: MATERIAL.snow },
  { key: 'ice', label: 'Ice', material: MATERIAL.ice },
  { key: 'wood', label: 'Wood', material: MATERIAL.wood },
  { key: 'apple', label: 'Apple', food: true, emoji: '🍎' },
];

const materialToKey = new Map(HOTBAR.filter(s => s.material !== undefined).map(s => [s.material, s.key]));
materialToKey.set(MATERIAL.darkstone, 'stone');

export function freshLife() {
  const inventory = Object.fromEntries(HOTBAR.map(slot => [slot.key, 0]));
  // Camp kit: enough to build a shelter or a bridge before you have dug anything.
  inventory.dirt = 10;
  inventory.wood = 6;
  inventory.apple = 2;
  return {
    vitals: freshVitals(),
    inventory,
    selected: 0,
    stats: { dug: 0, built: 0, eaten: 0, applesFound: 0, startedAt: Date.now(), survived: 0 },
  };
}

export class Game {
  constructor(world, player, chunks, renderer, life = null) {
    this.world = world;
    this.player = player;
    this.chunks = chunks;
    this.renderer = renderer;
    this.life = life ?? freshLife();
    this.messages = [];     // { text, until }
    this.started = false;
  }

  get vitals() { return this.life.vitals; }
  get inventory() { return this.life.inventory; }
  get selectedSlot() { return HOTBAR[this.life.selected]; }

  say(text, seconds = 2.2) {
    this.messages.push({ text, until: performance.now() + seconds * 1000 });
    if (this.messages.length > 3) this.messages.shift();
  }

  select(index) {
    this.life.selected = ((index % HOTBAR.length) + HOTBAR.length) % HOTBAR.length;
  }

  /** Per-frame survival tick. */
  tick(dt, input) {
    if (!this.started || !this.vitals.alive) return;
    const p = this.player;
    if (p.lastImpact > 0) {
      const before = this.vitals.health;
      this.life.vitals = applyFallDamage(this.vitals, p.lastImpact);
      if (this.vitals.health < before) this.say(`Ouch! That fall cost ${(before - this.vitals.health).toFixed(1)} hearts`);
      p.lastImpact = 0;
    }
    const { vitals, events } = stepVitals(this.vitals, dt, { submerged: p.submerged, running: input.run, moving: p.moving });
    this.life.vitals = vitals;
    if (events.includes('drowning') && Math.random() < dt * 0.7) this.say('Air! Swim up!', 1);
    if (events.includes('starving') && Math.random() < dt * 0.4) this.say('So hungry… find an apple', 1.5);
    this.life.stats.survived += dt;

    // Apples: walk over one to pick it up.
    const here = this.world.column(p.up);
    if (here.apple && this.world.pickApple(here)) {
      this.inventory.apple += 1;
      this.life.stats.applesFound += 1;
      this.say('🍎 Picked an apple');
      this.chunks.rebuild(this.world.chunksTouching(here));
    }
  }

  dig(target) {
    if (!this.vitals.alive) return false;
    if (!target) { this.say('Aim the crosshair at a block close to you', 2); return false; }
    const column = target.dig;
    const removed = this.world.dig(column);
    if (removed === null) { this.say('Bedrock: too deep to dig', 1.6); return false; }
    const key = materialToKey.get(removed);
    if (key) this.inventory[key] += 1;
    this.life.stats.dug += 1;
    this.chunks.rebuild(this.world.chunksTouching(column));
    return true;
  }

  build(target) {
    if (!this.vitals.alive) return false;
    const slot = this.selectedSlot;
    if (slot.food) return this.eatSelected();
    if (!target) { this.say('Aim the crosshair at the ground to build there', 2); return false; }
    if (this.inventory[slot.key] <= 0) { this.say(`No ${slot.label.toLowerCase()} left. Dig some, or pick another block (1–8)`, 2.4); return false; }
    const column = target.place;
    // Do not build inside yourself.
    const me = this.world.column(this.player.up);
    if (column.key === me.key && this.world.radius + column.solid + 1 > this.player.position.length() + 0.01) {
      this.say('You are standing there! Step aside first', 1.6); return false;
    }
    const height = this.world.place(column, slot.material);
    if (height === null) { this.say('Too high to build', 1.2); return false; }
    this.inventory[slot.key] -= 1;
    this.life.stats.built += 1;
    this.chunks.rebuild(this.world.chunksTouching(column));
    return true;
  }

  eatSelected() {
    const result = eat(this.vitals, this.inventory, 'apple');
    if (!result.ate) { this.say(this.inventory.apple > 0 ? 'Not hungry yet' : 'No apples: look for red ones on the grass', 1.5); return false; }
    this.life.vitals = result.vitals;
    this.life.inventory = result.inventory;
    this.life.stats.eaten += 1;
    this.say('Yum! 🍎');
    return true;
  }

  newLife(spawnDirection) {
    this.life = freshLife();
    this.player.respawn(spawnDirection);
    this.messages = [];
  }

  toJSON() {
    const p = this.player;
    return { ...this.life, position: [p.position.x, p.position.y, p.position.z], forward: [p.forward.x, p.forward.y, p.forward.z] };
  }
}

export const RULE_SUMMARY = [
  `One life. ${RULES.maxHealth} hearts, no respawn.`,
  `Water is deep: you sink. ${RULES.maxAir} seconds of air, then you drown. Hold JUMP to swim up.`,
  'You get hungry. Apples grow on the grass; walk over them, then eat (F or EAT).',
  'Falling more than about five blocks hurts.',
  'Dig: click, E or DIG (tap on a phone). Build: right-click, R or BUILD (hold your finger). Pick the block with 1–8.',
  'You can dig under water too. Ice on the frozen sea gives ice bricks.',
];

export { RULES, MATERIALS };
