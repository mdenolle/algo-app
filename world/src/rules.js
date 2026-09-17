// Survival rules as pure functions, so they are testable and easy to tune.
// All the numbers a kid might want to change live in RULES.

export const RULES = Object.freeze({
  maxHealth: 10,             // hearts
  maxHunger: 100,
  maxAir: 12,                // seconds under water before you start drowning
  hungerPerSecond: 100 / 480,   // full to empty in 8 minutes at rest
  runHungerMultiplier: 2,
  starveDamagePerSecond: 0.5,
  drownDamagePerSecond: 1.5,
  airRefillPerSecond: 4,
  healHungerThreshold: 60,   // heal only when reasonably fed
  healPerSecond: 1 / 3,
  applePoints: 35,
  food: { apple: 35, meat: 30 },
  safeFallSpeed: 15,         // impact speed (blocks/s) with no damage: about a 4-block drop
  fallDamagePerSpeed: 0.9,   // hearts per (blocks/s) above the safe speed: a 12-block fall is fatal
  lavaDamagePerSecond: 2.5,  // standing on lava
  burnDamagePerSecond: 0.8,  // after lava or a fire zombie, for burnSeconds
  burnSeconds: 3,
  frozenSeconds: 3,          // after an ice zombie: half speed
  frozenSpeed: 0.5,
  reach: 7,                  // blocks you can dig/build from the player's head
  lives: 1,
});

/** Difficulty settings: multipliers on zombie numbers, their damage, hunger speed and healing. */
export const DIFFICULTY = Object.freeze({
  normal: { label: 'Normal', zombies: 1, damage: 1, hunger: 1, heal: 1, hearts: 10 },
  hard: { label: 'Hard', zombies: 1.6, damage: 1.5, hunger: 1.3, heal: 0.7, hearts: 10 },
  nightmare: { label: 'Nightmare', zombies: 2.5, damage: 2, hunger: 1.6, heal: 0.4, hearts: 7 },
});

export function freshVitals() {
  return { health: RULES.maxHealth, hunger: RULES.maxHunger, air: RULES.maxAir, alive: true, causeOfDeath: null };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Advance vitals by dt seconds. `context`: { submerged, running, moving }.
 * Returns { vitals, events } where events lists what happened this tick
 * ('drowning', 'starving', 'died').
 */
export function stepVitals(vitals, dt, context) {
  if (!vitals.alive) return { vitals, events: [] };
  const events = [];
  let { health, hunger, air } = vitals;
  let causeOfDeath = null;

  const drain = RULES.hungerPerSecond * (context.running && context.moving ? RULES.runHungerMultiplier : 1) * (context.hungerScale ?? 1);
  hunger = clamp(hunger - drain * dt, 0, RULES.maxHunger);

  if (context.submerged) {
    const airBefore = air;
    air = clamp(air - dt, 0, RULES.maxAir);
    const overtime = dt - (airBefore - air);            // seconds of this tick spent with no air
    if (overtime > 0) { health -= RULES.drownDamagePerSecond * overtime; events.push('drowning'); if (health <= 0) causeOfDeath = 'drowned'; }
  } else {
    air = clamp(air + RULES.airRefillPerSecond * dt, 0, RULES.maxAir);
  }

  if (context.onLava) { health -= RULES.lavaDamagePerSecond * dt; events.push('lava'); if (health <= 0 && !causeOfDeath) causeOfDeath = 'lava'; }
  if (context.burning) { health -= RULES.burnDamagePerSecond * dt; events.push('burning'); if (health <= 0 && !causeOfDeath) causeOfDeath = 'burned'; }

  if (hunger <= 0) {
    health -= RULES.starveDamagePerSecond * dt;
    events.push('starving');
    if (health <= 0 && !causeOfDeath) causeOfDeath = 'starved';
  } else if (hunger >= RULES.healHungerThreshold && health < RULES.maxHealth && !context.submerged && !context.burning && !context.onLava) {
    health = clamp(health + RULES.healPerSecond * (context.healScale ?? 1) * dt, 0, RULES.maxHealth);
  }

  health = clamp(health, 0, RULES.maxHealth);
  const alive = health > 0;
  if (!alive) events.push('died');
  return { vitals: { health, hunger, air, alive, causeOfDeath: alive ? null : causeOfDeath ?? 'hurt' }, events };
}

/** Landing at `impactSpeed` blocks/s (positive number). Returns updated vitals. */
export function applyFallDamage(vitals, impactSpeed) {
  if (!vitals.alive || impactSpeed <= RULES.safeFallSpeed) return vitals;
  const health = clamp(vitals.health - (impactSpeed - RULES.safeFallSpeed) * RULES.fallDamagePerSpeed, 0, RULES.maxHealth);
  const alive = health > 0;
  return { ...vitals, health, alive, causeOfDeath: alive ? null : 'fell' };
}

export function eat(vitals, inventory, item = 'apple') {
  const points = RULES.food[item] ?? RULES.applePoints;
  if (!vitals.alive || (inventory[item] ?? 0) <= 0 || vitals.hunger >= RULES.maxHunger - 1) return { vitals, inventory, ate: false };
  return {
    vitals: { ...vitals, hunger: clamp(vitals.hunger + points, 0, RULES.maxHunger) },
    inventory: { ...inventory, [item]: inventory[item] - 1 },
    ate: true,
  };
}

/** Damage from a monster (or anything else): returns updated vitals. */
export function hurt(vitals, hearts, cause) {
  if (!vitals.alive || hearts <= 0) return vitals;
  const health = clamp(vitals.health - hearts, 0, RULES.maxHealth);
  const alive = health > 0;
  return { ...vitals, health, alive, causeOfDeath: alive ? null : cause };
}
