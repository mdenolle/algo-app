// Game: survival state (vitals, inventory, stats), the hotbar and block picker,
// TNT fuses, and the actions that change the planet. Pure rules live in
// rules.js; this wires them to the world, the player and the renderer.

import { MATERIAL, MATERIALS } from './materials.js';
import { RULES, freshVitals, stepVitals, applyFallDamage, eat, hurt } from './rules.js';
import { TOOLS, RECIPES, canCraft, craft, hitBlock, hitDamage } from './tools.js';
import { say, hasClip } from './voice.js';

/** Everything that can sit in a hotbar slot: every block material, plus food. */
export const BLOCKS = [
  ...MATERIALS.filter(m => m.key !== 'water').map(m => ({ key: m.key, label: m.name, material: m.id, hex: `#${m.hex}`, ore: Boolean(m.ore), translucent: Boolean(m.translucent) })),
  { key: 'apple', label: 'Apple', food: true, emoji: '🍎' },
  { key: 'meat', label: 'Meat', food: true, emoji: '🍖' },
  ...Object.entries(TOOLS).map(([key, t]) => ({ key, ...t })),
];
export { RECIPES, canCraft };
export const BLOCK_BY_KEY = new Map(BLOCKS.map(block => [block.key, block]));
export const HOTBAR_SIZE = 9;
export const DAY_LENGTH = 360;   // seconds per day: about 3½ minutes of light, 2½ of night
export const DEFAULT_HOTBAR = ['woodPickaxe', 'woodSword', 'planks', 'dirt', 'stone', 'glass', 'bricks', 'tnt', 'apple'];

const materialToKey = new Map(BLOCKS.filter(b => b.material !== undefined).map(b => [b.material, b.key]));

export function freshLife() {
  const inventory = Object.fromEntries(BLOCKS.map(block => [block.key, 0]));
  // Builder's chest: enough to make a house, a bridge and a little mischief before you have dug anything.
  Object.assign(inventory, { dirt: 10, wood: 6, planks: 16, log: 8, leaves: 8, glass: 12, bricks: 12, pink: 8, purple: 8, cyan: 8, magenta: 8, terracotta: 8, cactus: 6, pumpkin: 4, glowstone: 4, lava: 2, tnt: 3, apple: 2, woodPickaxe: 1, woodSword: 1 });
  return {
    vitals: freshVitals(),
    inventory,
    hotbar: [...DEFAULT_HOTBAR],
    selected: 2,                    // planks: something you can build with right away
    status: { burning: 0, frozen: 0 },   // seconds left
    time: 54,                             // planet clock in seconds; DAY_LENGTH per day, starts in the morning
    stats: { dug: 0, built: 0, eaten: 0, applesFound: 0, oresFound: 0, explosions: 0, zombiesBeaten: 0, startedAt: Date.now(), survived: 0 },
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
    status: { ...fresh.status, ...(life.status ?? {}) },
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
    this.breaking = null;   // { key, k, damage, hardness, until }: the block being mined
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
    // Lava under your feet burns; burning and frozen wear off.
    const status = this.life.status;
    const underfoot = this.world.column(p.up);
    const onLava = p.grounded && underfoot.resolved.material(this.world.layerOf(p.position.length()) - 1) === MATERIAL.lava;
    if (onLava) status.burning = RULES.burnSeconds;
    status.burning = Math.max(0, status.burning - dt);
    status.frozen = Math.max(0, status.frozen - dt);
    p.speedMultiplier = (status.frozen > 0 ? RULES.frozenSpeed : 1) * (p.crawling ? 0.45 : 1);

    const { vitals, events } = stepVitals(this.vitals, dt, { submerged: p.submerged, running: input.run, moving: p.moving, onLava, burning: status.burning > 0 });
    this.life.vitals = vitals;
    if (events.includes('drowning') && Math.random() < dt * 0.7) this.say('Air! Swim up!', 1);
    if (events.includes('starving') && Math.random() < dt * 0.4) this.say('So hungry… find an apple', 1.5);
    if (events.includes('lava') && Math.random() < dt * 1.5) this.say('🔥 LAVA! Get off!', 0.8);
    else if (events.includes('burning') && Math.random() < dt * 0.6) this.say('🔥 Burning!', 0.8);
    this.life.stats.survived += dt;
    this.life.time = (this.life.time ?? 54) + dt;

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
      for (const fuse of ready) this.explode(fuse.column, fuse.k);
    }
    this.shake = Math.max(0, this.shake - dt);
  }

  /** One hit on a block. Soft blocks go at once; hard ones take several hits, faster with a better pickaxe. */
  dig(target) {
    if (!this.vitals.alive) return false;
    if (!target || target.k === undefined || target.k < 0) { this.say('Aim at a block close to you', 2); return false; }
    const column = target.dig;
    const material = column.resolved.material(target.k);
    if (material === MATERIAL.tnt) return this.light(column, target.k);
    if (material === null) { this.say('Nothing to dig there', 1.2); return false; }
    if (target.k < 2) { this.say('Bedrock: too deep to dig', 1.6); return false; }
    const hit = hitBlock(material, this.life.hotbar[this.life.selected]);
    if (!hit.allowed) { this.say(hit.needs ? `Too hard! ${MATERIALS[material].name} needs ${hit.needs}` : `${MATERIALS[material].name} cannot be broken`, 1.8); this.breaking = null; return false; }
    const now = performance.now();
    if (!this.breaking || this.breaking.key !== column.key || this.breaking.k !== target.k || this.breaking.until < now) this.breaking = { key: column.key, k: target.k, damage: 0, hardness: hit.hardness };
    this.breaking.damage += hit.power;
    this.breaking.until = now + 2500;
    if (this.breaking.damage < this.breaking.hardness) {
      const left = Math.ceil((this.breaking.hardness - this.breaking.damage) / hit.power);
      this.say(`${'▮'.repeat(Math.min(8, this.breaking.damage))}${'▯'.repeat(Math.max(0, Math.min(8, this.breaking.hardness) - Math.min(8, this.breaking.damage)))}  ${left} more ${left === 1 ? 'hit' : 'hits'}`, 1.2);
      return false;
    }
    this.breaking = null;
    const removed = this.world.digAt(column, target.k);
    if (removed === null) return false;
    const key = materialToKey.get(removed);
    if (key) this.inventory[key] += 1;
    if (MATERIALS[removed].ore) { this.life.stats.oresFound += 1; this.say(`✨ ${MATERIALS[removed].name}!`, 1.6); }
    this.life.stats.dug += 1;
    this.chunks.rebuild(this.world.chunksTouching(column));
    return true;
  }

  /** How far along the current block is (0..1) for the highlight. */
  get breakProgress() {
    if (!this.breaking || this.breaking.until < performance.now()) return 0;
    return Math.min(1, this.breaking.damage / this.breaking.hardness);
  }

  /** Make something from the block book. */
  make(recipe) {
    const next = craft(recipe, this.inventory);
    if (!next) { this.say('Not enough to make that yet', 1.4); return false; }
    this.life.inventory = next;
    const made = BLOCK_BY_KEY.get(recipe.makes);
    this.say(`Made ${recipe.count > 1 ? recipe.count + ' ' : 'a '}${made.label.toLowerCase()} ${made.emoji ?? ''}`, 2);
    return true;
  }

  build(target) {
    if (!this.vitals.alive) return false;
    const slot = this.selectedSlot;
    if (slot.food) return this.eatSelected();
    if (slot.tool) { this.say(`That is a ${slot.label.toLowerCase()}. Pick a block (1–9) to build`, 1.8); return false; }
    if (!target || !target.place || target.placeK === null) { this.say('Aim at the ground, or at the side of a block, to build there', 2); return false; }
    if (this.inventory[slot.key] <= 0) { this.say(`No ${slot.label.toLowerCase()} left. Dig some, or pick another block (1–9)`, 2.4); return false; }
    const column = target.place, k = target.placeK;
    // Not inside yourself: the player's body spans a few layers of its own column.
    const p = this.player;
    const me = this.world.column(p.up);
    const feet = this.world.layerOf(p.position.length());
    const insideMe = column.key === me.key && k >= feet && k <= this.world.layerOf(p.position.length() + p.height - 0.02);
    const underMe = column.key === me.key && k === feet - 1 && !me.resolved.solid(k);
    if (insideMe) { this.say('You are standing there! Step aside first', 1.6); return false; }
    const placed = this.world.placeAt(column, k, slot.material);
    if (placed === null) { this.say(k >= this.world.config.maxHeight ? 'Too high to build' : 'That spot is taken', 1.2); return false; }
    this.inventory[slot.key] -= 1;
    this.life.stats.built += 1;
    // Building under your own feet lifts you onto the new block: the easy way up a tower.
    if (underMe) { p.position.setLength(this.world.radius + k + 1); p.velocityUp = 0; }
    this.chunks.rebuild(this.world.chunksTouching(column));
    if (slot.key === 'tnt') this.say('TNT placed. Hit it to light the fuse, then RUN!', 2.5);
    return true;
  }

  /** Hitting TNT lights it: 3 seconds, then a crater. */
  light(column, k) {
    if (this.fuses.some(f => f.column.key === column.key && f.k === k)) return false;
    this.fuses.push({ column, k, until: performance.now() + 3000 });
    this.say('💣 Fuse lit! RUN!', 2.5);
    return true;
  }

  explode(column, k) {
    const changed = this.world.blast(column, k, 2.5);
    const keys = new Set();
    for (const c of changed) for (const key of this.world.chunksTouching(c)) keys.add(key);
    this.chunks.rebuild([...keys]);
    this.life.stats.explosions += 1;
    this.shake = 0.5;
    // Blast damage: up to 4 hearts within 2 blocks, nothing beyond 6.
    const distance = this.player.position.distanceTo(this.#columnPosition(column, k));
    const hurt = distance < 6 ? 4 * Math.max(0, 1 - Math.max(0, distance - 2) / 4) : 0;
    if (hurt > 0 && this.vitals.alive) {
      const health = Math.max(0, this.vitals.health - hurt);
      this.life.vitals = { ...this.vitals, health, alive: health > 0, causeOfDeath: health > 0 ? null : 'exploded' };
      this.say(hurt >= 3.9 ? '💥 BOOM! Too close!' : '💥 BOOM!', 2);
    } else {
      this.say('💥 BOOM!', 2);
    }
    // A chain reaction: TNT around the crater goes off too.
    for (const c of changed) {
      const col = this.world.column(c.dir).resolved;
      for (let layer = Math.max(0, k - 3); layer <= k + 3; layer += 1) if (col.material(layer) === MATERIAL.tnt) this.light(c, layer);
    }
  }

  #columnPosition(column, k = column.resolved.top) {
    const r = this.world.radius + k + 0.5;
    return this.player.position.clone().set(column.dir[0] * r, column.dir[1] * r, column.dir[2] * r);
  }

  /** Eat the selected food, else an apple, else meat. */
  eatSelected() {
    const slot = this.selectedSlot;
    const item = slot.food && this.inventory[slot.key] > 0 ? slot.key : this.inventory.apple > 0 ? 'apple' : 'meat';
    const result = eat(this.vitals, this.inventory, item);
    if (!result.ate) { this.say(this.inventory[item] > 0 ? 'Not hungry yet' : 'Nothing to eat: apples grow on the grass, animals drop meat', 1.8); return false; }
    this.life.vitals = result.vitals;
    this.life.inventory = result.inventory;
    this.life.stats.eaten += 1;
    this.say(`Yum! ${BLOCK_BY_KEY.get(item).emoji}`);
    return true;
  }

  /** Time of day: phase in [0,1) and whether it is night where the player stands is decided by the renderer. */
  get dayPhase() { return ((this.life.time ?? 54) / DAY_LENGTH) % 1; }

  /** The player hits a mob: bare hands do 1, swords more. */
  hitMob(mobs, mob) {
    const result = mobs.hit(mob, hitDamage(this.life.hotbar[this.life.selected]));
    if (result.defeated) {
      if (result.drop) { this.inventory[result.drop] = (this.inventory[result.drop] ?? 0) + 1; }
      if (mob.type.kind === 'zombie') this.life.stats.zombiesBeaten += 1;
      const dropBlock = result.drop ? BLOCK_BY_KEY.get(result.drop) : null;
      this.say(`${result.name} down!${dropBlock ? ` You got ${dropBlock.label.toLowerCase()} ${dropBlock.emoji ?? ''}` : ''}`, 2);
    } else {
      this.say(`${result.name}: ${result.hp} ${result.hp === 1 ? 'hit' : 'hits'} left`, 1);
    }
    return true;
  }

  /** A monster got you. */
  takeHit(hearts, cause, effect = null) {
    if (!this.vitals.alive) return;
    this.life.vitals = hurt(this.vitals, hearts, cause);
    if (effect === 'burning') this.life.status.burning = RULES.burnSeconds;
    if (effect === 'frozen') this.life.status.frozen = RULES.frozenSeconds;
    this.shake = Math.max(this.shake, 0.25);
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
  'Falling more than four blocks hurts; a big fall is fatal. Lava burns. TNT hurts.',
  'At night the zombies come: ice, fire, water, electric, and the Everything Zombie. Hit them (dig) four times. Animals drop meat.',
  'CRAWL (C) makes you slow but you cannot fall off an edge.',
  'Click or tap a spot to BUILD there. Hold the button or your finger on a block to BREAK it (or use DIG / BUILD).',
  'Hard blocks take more hits. Stone needs a pickaxe; ores need a stone one; diamond an iron one; obsidian a diamond one. Make tools in the block book (B).',
  'Swords hit zombies harder. You start with a wooden pickaxe and a wooden sword.',
  'Ores hide deep in the stone: coal, iron, gold, redstone, lapis, emerald, diamond, obsidian. Dig down to find them.',
];

export { RULES, MATERIALS };
