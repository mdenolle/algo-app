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
  safeFallSpeed: 16,         // impact speed (blocks/s) with no damage: about a 5-block drop
  fallDamagePerSpeed: 0.45,  // hearts per (blocks/s) above the safe speed
  reach: 7,                  // blocks you can dig/build from the player's head
  lives: 1,
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

  const drain = RULES.hungerPerSecond * (context.running && context.moving ? RULES.runHungerMultiplier : 1);
  hunger = clamp(hunger - drain * dt, 0, RULES.maxHunger);

  if (context.submerged) {
    const airBefore = air;
    air = clamp(air - dt, 0, RULES.maxAir);
    const overtime = dt - (airBefore - air);            // seconds of this tick spent with no air
    if (overtime > 0) { health -= RULES.drownDamagePerSecond * overtime; events.push('drowning'); if (health <= 0) causeOfDeath = 'drowned'; }
  } else {
    air = clamp(air + RULES.airRefillPerSecond * dt, 0, RULES.maxAir);
  }

  if (hunger <= 0) {
    health -= RULES.starveDamagePerSecond * dt;
    events.push('starving');
    if (health <= 0 && !causeOfDeath) causeOfDeath = 'starved';
  } else if (hunger >= RULES.healHungerThreshold && health < RULES.maxHealth && !context.submerged) {
    health = clamp(health + RULES.healPerSecond * dt, 0, RULES.maxHealth);
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
  if (!vitals.alive || (inventory[item] ?? 0) <= 0 || vitals.hunger >= RULES.maxHunger - 1) return { vitals, inventory, ate: false };
  return {
    vitals: { ...vitals, hunger: clamp(vitals.hunger + RULES.applePoints, 0, RULES.maxHunger) },
    inventory: { ...inventory, [item]: inventory[item] - 1 },
    ate: true,
  };
}
