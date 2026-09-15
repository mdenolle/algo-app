// Game: survival state (vitals, inventory, stats), the hotbar and block picker,
// TNT fuses, and the actions that change the planet. Pure rules live in
// rules.js; this wires them to the world, the player and the renderer.

import { MATERIAL, MATERIALS } from './materials.js';
import { RULES, freshVitals, stepVitals, applyFallDamage, eat } from './rules.js';
import { say, hasClip } from './voice.js';

/** Everything that can sit in a hotbar slot: every block material, plus food. */
export const BLOCKS = [
  ...MATERIALS.filter(m => m.key !== 'water').map(m => ({ key: m.key, label: m.name, material: m.id, hex: `#${m.hex}`, ore: Boolean(m.ore), translucent: Boolean(m.translucent) })),
  { key: 'apple', label: 'Apple', food: true, emoji: '🍎' },
];
export const BLOCK_BY_KEY = new Map(BLOCKS.map(block => [block.key, block]));
export const HOTBAR_SIZE = 9;
export const DEFAULT_HOTBAR = ['grass', 'dirt', 'stone', 'planks', 'glass', 'bricks', 'tnt', 'wood', 'apple'];

const materialToKey = new Map(BLOCKS.filter(b => b.material !== undefined).map(b => [b.material, b.key]));

export function freshLife() {
  const inventory = Object.fromEntries(BLOCKS.map(block => [block.key, 0]));
  // Builder's chest: enough to make a house, a bridge and a little mischief before you have dug anything.
  Object.assign(inventory, { dirt: 10, wood: 6, planks: 16, log: 8, leaves: 8, glass: 12, bricks: 12, pink: 8, purple: 8, glowstone: 4, tnt: 3, apple: 2 });
  return {
    vitals: freshVitals(),
    inventory,
    hotbar: [...DEFAULT_HOTBAR],
    selected: 0,
    stats: { dug: 0, built: 0, eaten: 0, applesFound: 0, oresFound: 0, explosions: 0, startedAt: Date.now(), survived: 0 },
  };
}

/** Old saves may lack fields added later. */
export function upgradeLife(life) {
  const fresh = freshLife();
  return {
    ...fresh,
    ...life,
    inventory: { ...fresh.inventory, ...life.inventory },
    hotbar: Array.isArray(life.hotbar) && life.hotbar.length === HOTBAR_SIZE ? life.hotbar : fresh.hotbar,
    stats: { ...fresh.stats, ...life.stats },
  };
}

export class Game {
  constructor(world, player, chunks, renderer, life = null) {
    this.world = world;
    this.player = player;
    this.chunks = chunks;
    this.renderer = renderer;
    this.life = life ? upgradeLife(life) : freshLife();
    this.messages = [];     // { text, until }
    this.started = false;
    this.fuses = [];        // { column, until }
    this.shake = 0;         // seconds of camera shake left
    this.pickerOpen = false;
  }

  get vitals() { return this.life.vitals; }
  get inventory() { return this.life.inventory; }
  get selectedSlot() { return BLOCK_BY_KEY.get(this.life.hotbar[this.life.selected]); }

  say(text, seconds = 2.2) {
    this.messages.push({ text, until: performance.now() + seconds * 1000 });
    if (this.messages.length > 3) this.messages.shift();
  }

  select(index) {
    this.life.selected = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  /** Put a block type into the selected hotbar slot (from the picker). */
  assign(key) {
    if (!BLOCK_BY_KEY.has(key)) return;
    this.life.hotbar[this.life.selected] = key;
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

    // First time in the water: say how to get out.
    if (p.inWater) { this.wetSeconds = (this.wetSeconds ?? 0) + dt; if (this.wetSeconds > 1.2 && !this.life.stats.swimTipShown) { this.life.stats.swimTipShown = true; this.say('Hold JUMP to swim up. At the surface, press JUMP to hop out.', 4); } }
    else this.wetSeconds = 0;

    // Apples: walk over one to pick it up.
    const here = this.world.column(p.up);
    if (here.apple && this.world.pickApple(here)) {
      this.inventory.apple += 1;
      this.life.stats.applesFound += 1;
      this.say('🍎 Picked an apple');
      if (hasClip('world-apple')) say('Yum, an apple!', 'world-apple');
      this.chunks.rebuild(this.world.chunksTouching(here));
    }

    // TNT fuses.
    if (this.fuses.length) {
      const now = performance.now();
      const ready = this.fuses.filter(f => f.until <= now);
      this.fuses = this.fuses.filter(f => f.until > now);
      for (const fuse of ready) this.explode(fuse.column);
    }
    this.shake = Math.max(0, this.shake - dt);
  }

  dig(target) {
    if (!this.vitals.alive) return false;
    if (!target) { this.say('Aim the crosshair at a block close to you', 2); return false; }
    const column = target.dig;
    const surface = this.world.column(column.dir).resolved.surface;
    if (surface === MATERIAL.tnt) return this.light(column);
    const removed = this.world.dig(column);
    if (removed === null) { this.say('Bedrock: too deep to dig', 1.6); return false; }
    const key = materialToKey.get(removed);
    if (key) this.inventory[key] += 1;
    if (MATERIALS[removed].ore) { this.life.stats.oresFound += 1; this.say(`✨ ${MATERIALS[removed].name}!`, 1.6); }
    this.life.stats.dug += 1;
    this.chunks.rebuild(this.world.chunksTouching(column));
    return true;
  }

  build(target) {
    if (!this.vitals.alive) return false;
    const slot = this.selectedSlot;
    if (slot.food) return this.eatSelected();
    if (!target) { this.say('Aim the crosshair at the ground to build there', 2); return false; }
    if (this.inventory[slot.key] <= 0) { this.say(`No ${slot.label.toLowerCase()} left. Dig some, or pick another block (1–9)`, 2.4); return false; }
    const column = target.place;
    const me = this.world.column(this.player.up);
    const underMe = column.key === me.key && this.world.radius + column.solid + 1 > this.player.position.length() + 0.01;
    const height = this.world.place(column, slot.material);
    if (height === null) { this.say('Too high to build', 1.2); return false; }
    this.inventory[slot.key] -= 1;
    this.life.stats.built += 1;
    // Building under your own feet lifts you onto the new block: the easy way up a tower.
    if (underMe) { this.player.position.setLength(this.world.radius + height); this.player.velocityUp = 0; }
    this.chunks.rebuild(this.world.chunksTouching(column));
    if (slot.key === 'tnt') this.say('TNT placed. Hit it to light the fuse, then RUN!', 2.5);
    return true;
  }

  /** Hitting TNT lights it: 3 seconds, then a crater. */
  light(column) {
    if (this.fuses.some(f => f.column.key === column.key)) return false;
    this.fuses.push({ column, until: performance.now() + 3000 });
    this.say('💣 Fuse lit! RUN!', 2.5);
    return true;
  }

  explode(column) {
    const changed = this.world.blast(column, 2.5, 3);
    const keys = new Set();
    for (const c of changed) for (const key of this.world.chunksTouching(c)) keys.add(key);
    this.chunks.rebuild([...keys]);
    this.life.stats.explosions += 1;
    this.shake = 0.5;
    // Blast damage: up to 4 hearts within 2 blocks, nothing beyond 6.
    const distance = this.player.position.distanceTo(this.#columnPosition(column));
    const hurt = distance < 6 ? 4 * Math.max(0, 1 - Math.max(0, distance - 2) / 4) : 0;
    if (hurt > 0 && this.vitals.alive) {
      const health = Math.max(0, this.vitals.health - hurt);
      this.life.vitals = { ...this.vitals, health, alive: health > 0, causeOfDeath: health > 0 ? null : 'exploded' };
      this.say(hurt >= 3.9 ? '💥 BOOM! Too close!' : '💥 BOOM!', 2);
    } else {
      this.say('💥 BOOM!', 2);
    }
    // A chain reaction: other TNT in the crater goes off too.
    for (const c of changed) {
      if (c.key === column.key) continue;
      if (this.world.column(c.dir).resolved.surface === MATERIAL.tnt) this.light(c);
    }
  }

  #columnPosition(column) {
    const r = this.world.radius + column.solid;
    return this.player.position.clone().set(column.dir[0] * r, column.dir[1] * r, column.dir[2] * r);
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
    this.fuses = [];
  }

  toJSON() {
    const p = this.player;
    return { ...this.life, position: [p.position.x, p.position.y, p.position.z], forward: [p.forward.x, p.forward.y, p.forward.z] };
  }
}

export const RULE_SUMMARY = [
  `One life. ${RULES.maxHealth} hearts, no respawn.`,
  `Water is deep: you sink. ${RULES.maxAir} seconds of air, then you drown. Hold JUMP to swim up, press it at the surface to hop out.`,
  'You get hungry. Apples grow on the grass; walk over them, then eat (F or EAT).',
  'Falling more than about five blocks hurts. TNT hurts more.',
  'Dig: click, E or DIG (tap on a phone). Build: right-click, R or BUILD (hold your finger). Pick blocks with 1–9 or the block book (B).',
  'Ores hide deep in the stone: coal, iron, gold, redstone, lapis, emerald, diamond, obsidian. Dig down to find them.',
];

export { RULES, MATERIALS };
