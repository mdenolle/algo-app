// Mobs: animals (sheep, pig, cow, chicken) and zombies (ice, fire, water, electric,
// and the Everything Zombie). They walk on the sphere with the same rules as the
// player, wander or chase, attack on contact, take hits, and drop things.
// The decision functions at the top are pure so they can be tested.

import * as THREE from 'three';
import { MATERIAL } from './materials.js';
import { tangentBasis } from './planet.js';

export const MOB_TYPES = {
  sheep: { kind: 'animal', name: 'Sheep', hp: 2, speed: 1.6, size: 0.95, drop: 'meat', colors: { body: 'F4F4F4', head: '05131D', legs: '6C6E68' } },
  pig: { kind: 'animal', name: 'Pig', hp: 2, speed: 1.8, size: 0.9, drop: 'meat', colors: { body: 'E4ADC8', head: 'E4ADC8', legs: 'E4ADC8' } },
  cow: { kind: 'animal', name: 'Cow', hp: 3, speed: 1.5, size: 1.15, drop: 'meat', colors: { body: '582A12', head: 'F4F4F4', legs: '352100' } },
  chicken: { kind: 'animal', name: 'Chicken', hp: 1, speed: 2.2, size: 0.55, drop: 'meat', colors: { body: 'F4F4F4', head: 'F2CD37', legs: 'FE8A18' } },
  iceZombie: { kind: 'zombie', name: 'Ice zombie', hp: 4, speed: 2.4, damage: 1, effect: 'frozen', habitat: 'cold', drop: 'ice', colors: { body: '9FC3E9', head: '9FC3E9', legs: '0055BF' } },
  fireZombie: { kind: 'zombie', name: 'Fire zombie', hp: 4, speed: 3.6, damage: 1, effect: 'burning', habitat: 'land', drop: 'redstone', colors: { body: 'FE8A18', head: 'F2CD37', legs: 'C91A09' } },
  waterZombie: { kind: 'zombie', name: 'Water zombie', hp: 4, speed: 3.4, damage: 1, habitat: 'water', drop: 'lapis', colors: { body: '078BC9', head: '237841', legs: '0055BF' } },
  electricZombie: { kind: 'zombie', name: 'Electric zombie', hp: 3, speed: 3.0, damage: 0.5, ranged: 4, habitat: 'land', drop: 'gold', colors: { body: 'FFF03A', head: 'F2CD37', legs: '3F3691' } },
  chaosZombie: { kind: 'zombie', name: 'Everything zombie', hp: 6, speed: 3.6, damage: 1.5, chaos: true, habitat: 'land', drop: 'diamond', colors: { body: 'AC78BA', head: 'BBE90B', legs: '923978' } },
};
export const ANIMALS = ['sheep', 'pig', 'cow', 'chicken'];
export const CHAOS_MODES = ['chase', 'sprint', 'flee', 'hop', 'spin', 'nap', 'teleport'];
const CHAOS_COLORS = ['C91A09', '0055BF', 'F2CD37', '237841', 'FE8A18', 'E4ADC8', 'AC78BA', 'BBE90B', '36AEBF', 'FFF03A'];

/** How many of each should be around: zombies mostly at night. */
export function spawnTargets(daylight) {
  const night = daylight < 0.45;
  return { animals: 8, zombies: night ? 5 : 1 };
}

/** Which zombie fits a column: water in the sea, ice where it is cold, otherwise fire/electric/chaos. */
export function zombieTypeFor(column, roll) {
  if (column.swim) return 'waterZombie';
  const surface = column.resolved.surface;
  if (surface === MATERIAL.snow || surface === MATERIAL.ice || column.natural.cold > 0.64) return 'iceZombie';
  if (roll < 0.5) return 'fireZombie';
  if (roll < 0.82) return 'electricZombie';
  return 'chaosZombie';
}

/** Zombie behaviour from the distance to the player. */
export function zombieMode(distance, type) {
  if (distance <= 1.5) return 'attack';
  if (type.ranged && distance <= type.ranged) return 'zap';
  if (distance <= 22) return 'chase';
  return 'wander';
}

export function nextChaosMode(roll) {
  return CHAOS_MODES[Math.floor(roll * CHAOS_MODES.length) % CHAOS_MODES.length];
}

const hex = h => new THREE.Color(parseInt(h, 16));

function box(w, h, d, color, x, y, z, group) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: hex(color), roughness: 0.45 }));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

/** LEGO-style mob body, origin at the feet, facing +z. */
export function createMobMesh(typeKey) {
  const type = MOB_TYPES[typeKey];
  const c = type.colors;
  const group = new THREE.Group();
  const s = type.size;
  if (type.kind === 'animal') {
    // Four legs, a long body, a head at the front.
    for (const [x, z] of [[-0.3, 0.35], [0.3, 0.35], [-0.3, -0.35], [0.3, -0.35]]) box(0.22 * s, 0.5 * s, 0.22 * s, c.legs, x * s, 0.25 * s, z * s, group);
    box(0.8 * s, 0.6 * s, 1.2 * s, c.body, 0, 0.75 * s, 0, group);
    const head = box(0.5 * s, 0.5 * s, 0.5 * s, c.head, 0, 1.05 * s, 0.75 * s, group);
    const eye = () => new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 6, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    const l = eye(), r = eye();
    l.position.set(-0.14 * s, 0.08 * s, 0.26 * s); r.position.set(0.14 * s, 0.08 * s, 0.26 * s);
    head.add(l, r);
  } else {
    // Minifig shape, arms out in front like a proper zombie.
    box(0.42, 0.9, 0.5, c.legs, -0.24, 0.45, 0, group);
    box(0.42, 0.9, 0.5, c.legs, 0.24, 0.45, 0, group);
    box(1.0, 0.95, 0.55, c.body, 0, 1.4, 0, group);
    box(0.28, 0.3, 0.85, c.body, -0.66, 1.7, 0.3, group);
    box(0.28, 0.3, 0.85, c.body, 0.66, 1.7, 0.3, group);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.62, 14), new THREE.MeshStandardMaterial({ color: hex(c.head), roughness: 0.4 }));
    head.position.set(0, 2.2, 0);
    group.add(head);
    const eye = () => new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0x550000 }));
    const l = eye(), r = eye();
    l.position.set(-0.13, 2.28, 0.36); r.position.set(0.13, 2.28, 0.36);
    group.add(l, r);
  }
  group.userData.materials = [];
  group.traverse(o => { if (o.isMesh) group.userData.materials.push(o.material); });
  return group;
}

export class MobManager {
  constructor(world, player, game, scene, random = Math.random) {
    this.world = world;
    this.player = player;
    this.game = game;
    this.scene = scene;
    this.random = random;
    this.mobs = [];
    this.nextId = 1;
    this.spawnTimer = 0;
    this.tmp = { v: new THREE.Vector3(), w: new THREE.Vector3(), basis: new THREE.Matrix4(), x: new THREE.Vector3() };
    this.despawnDistance = 70;
  }

  get zombies() { return this.mobs.filter(m => m.type.kind === 'zombie'); }
  get animals() { return this.mobs.filter(m => m.type.kind === 'animal'); }

  /** Place a mob at a unit direction, standing on the ground. */
  spawn(typeKey, direction) {
    const type = MOB_TYPES[typeKey];
    const column = this.world.column(direction);
    const r = this.world.radius + Math.max(column.resolved.h, column.swim ? this.world.config.seaLevel : column.resolved.h);
    const mesh = createMobMesh(typeKey);
    this.scene.add(mesh);
    const { north } = tangentBasis(direction);
    const mob = {
      id: this.nextId++, key: typeKey, type, hp: type.hp,
      position: new THREE.Vector3().fromArray(direction).multiplyScalar(r),
      up: new THREE.Vector3().fromArray(direction),
      facing: new THREE.Vector3().fromArray(north),
      velocityUp: 0, grounded: false, inWater: false,
      mode: 'idle', timer: 1 + this.random() * 3, cooldown: 0, speedFactor: 1, flee: 0, hitFlash: 0, chaosMode: 'chase',
      mesh,
    };
    this.mobs.push(mob);
    return mob;
  }

  /** A random spot 18–40 blocks from the player in the tangent plane, or null if it does not suit the kind. */
  findSpawnSpot(kind) {
    const d0 = this.player.direction();
    const { east, north } = tangentBasis(d0);
    const R = this.world.radius;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = this.random() * Math.PI * 2, dist = 18 + this.random() * 22;
      const v = this.tmp.v.set(d0[0] * R, d0[1] * R, d0[2] * R)
        .addScaledVector(this.tmp.w.fromArray(east), Math.cos(angle) * dist)
        .addScaledVector(this.tmp.x.fromArray(north), Math.sin(angle) * dist)
        .normalize();
      const dir = [v.x, v.y, v.z];
      const column = this.world.column(dir);
      if (kind === 'animal') {
        if (!column.swim && column.resolved.surface === MATERIAL.grass) return { dir, column, typeKey: ANIMALS[Math.floor(this.random() * ANIMALS.length)] };
      } else {
        return { dir, column, typeKey: zombieTypeFor(column, this.random()) };
      }
    }
    return null;
  }

  update(dt, daylight) {
    const p = this.player;
    // Spawning and despawning, every couple of seconds.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2;
      const want = spawnTargets(daylight);
      if (this.animals.length < want.animals) { const spot = this.findSpawnSpot('animal'); if (spot) this.spawn(spot.typeKey, spot.dir); }
      if (this.zombies.length < want.zombies) { const spot = this.findSpawnSpot('zombie'); if (spot) { const mob = this.spawn(spot.typeKey, spot.dir); if (this.zombies.length === 1 && daylight < 0.45) this.game.say(`${mob.type.name} nearby…`, 2); } }
      for (const mob of [...this.mobs]) {
        const far = mob.position.distanceTo(p.position) > this.despawnDistance;
        const daylightKill = mob.type.kind === 'zombie' && daylight > 0.7 && this.zombies.length > 1 && this.random() < 0.3;
        if (far || daylightKill) this.remove(mob);
      }
    }
    for (const mob of this.mobs) this.#step(mob, dt);
  }

  #step(mob, dt) {
    const type = mob.type;
    const p = this.player;
    const R = this.world.radius;
    const waterR = this.world.waterRadius();
    mob.timer -= dt;
    mob.cooldown = Math.max(0, mob.cooldown - dt);
    mob.flee = Math.max(0, mob.flee - dt);
    mob.hitFlash = Math.max(0, mob.hitFlash - dt);
    mob.up.copy(mob.position).normalize();
    mob.facing.addScaledVector(mob.up, -mob.facing.dot(mob.up)).normalize();

    const toPlayer = this.tmp.v.copy(p.position).sub(mob.position);
    const distance = toPlayer.length();
    toPlayer.addScaledVector(mob.up, -toPlayer.dot(mob.up));    // tangent-plane direction to the player
    if (toPlayer.lengthSq() > 1e-6) toPlayer.normalize();

    // Decide.
    let speed = type.speed * mob.speedFactor;
    let wantsJump = false;
    if (type.kind === 'animal') {
      if (mob.flee > 0) { mob.facing.copy(toPlayer).negate(); speed *= 1.9; mob.mode = 'flee'; }
      else if (mob.timer <= 0) {
        mob.mode = mob.mode === 'wander' ? 'idle' : 'wander';
        mob.timer = mob.mode === 'wander' ? 2 + this.random() * 4 : 1 + this.random() * 4;
        if (mob.mode === 'wander') this.#turn(mob, this.random() * Math.PI * 2);
      }
      if (mob.mode === 'idle') speed = 0;
    } else if (type.chaos) {
      if (mob.timer <= 0) {
        mob.timer = 1.5 + this.random() * 2;
        mob.chaosMode = nextChaosMode(this.random());
        this.#recolor(mob);
        if (mob.chaosMode === 'teleport' && distance < 40) {
          const angle = this.random() * Math.PI * 2;
          const { east, north } = tangentBasis(p.direction());
          const spot = this.tmp.w.copy(p.position).addScaledVector(this.tmp.x.fromArray(east), Math.cos(angle) * 6).addScaledVector(this.tmp.x.fromArray(north), Math.sin(angle) * 6).normalize();
          const col = this.world.column([spot.x, spot.y, spot.z]);
          mob.position.copy(spot).multiplyScalar(R + Math.max(col.resolved.h, this.world.config.seaLevel) + 0.1);
          this.game.say('The Everything Zombie is behind you!', 1.5);
        }
      }
      const m = mob.chaosMode;
      if (distance <= 1.6 && mob.cooldown <= 0) { this.#attack(mob); }
      if (m === 'chase') mob.facing.copy(toPlayer);
      else if (m === 'sprint') { mob.facing.copy(toPlayer); speed *= 1.7; }
      else if (m === 'flee') mob.facing.copy(toPlayer).negate();
      else if (m === 'hop') { mob.facing.copy(toPlayer); wantsJump = true; }
      else if (m === 'spin') { this.#turn(mob, dt * 6); speed *= 0.5; }
      else if (m === 'nap') speed = 0;
      else speed *= 0.6;
    } else {
      mob.mode = zombieMode(distance, type);
      if (mob.mode === 'attack') { speed = 0; if (mob.cooldown <= 0) this.#attack(mob); mob.facing.copy(toPlayer); }
      else if (mob.mode === 'zap') { speed *= 0.5; mob.facing.copy(toPlayer); if (mob.cooldown <= 0) { mob.cooldown = 2; this.game.takeHit(type.damage, 'zapped'); this.game.say('⚡ Zap!', 0.8); } }
      else if (mob.mode === 'chase') { mob.facing.copy(toPlayer); if (mob.blocked > 0.6) wantsJump = true; }
      else if (mob.timer <= 0) { mob.timer = 2 + this.random() * 4; this.#turn(mob, this.random() * Math.PI * 2); mob.wanderIdle = this.random() < 0.4; }
      if (mob.mode === 'wander') speed = mob.wanderIdle ? 0 : speed * 0.6;
    }
    mob.facing.addScaledVector(mob.up, -mob.facing.dot(mob.up)).normalize();

    // Move in the tangent plane; walls block, animals refuse cliffs and water.
    let r = mob.position.length();
    let column = this.world.column([mob.up.x, mob.up.y, mob.up.z]);
    const inWater = column.swim && r < waterR + 0.05;
    if (inWater && type.habitat !== 'water') speed *= 0.6;
    const height = type.kind === 'animal' ? 1.2 * type.size : 2.4;
    if (speed > 0) {
      const trial = this.tmp.w.copy(mob.position).addScaledVector(mob.facing, speed * dt);
      const there = this.world.column(trial.clone().normalize());
      const step = this.world.walkInto(there, r, height);
      const floorThere = this.world.floorRadius(there, this.world.layerOf(step.r));
      const drop = step.r - floorThere;
      const ok = step.ok
        && !(type.kind === 'animal' && (there.swim || drop > 3))
        && !(type.habitat === 'water' && !there.swim)
        && !(type.habitat !== 'water' && there.swim && there.resolved.h < this.world.config.seaLevel - 3 && type.kind === 'zombie' && !inWater);
      if (ok) { mob.position.copy(trial).setLength(step.r); r = step.r; column = there; mob.blocked = 0; }
      else { mob.blocked = (mob.blocked ?? 0) + dt; if (mob.blocked > 1 && !(type.kind === 'zombie' && mob.mode === 'chase')) { this.#turn(mob, Math.PI / 2 + this.random() * Math.PI); mob.blocked = 0; } }
    }
    mob.up.copy(mob.position).normalize();

    // Gravity, or floating in water.
    const floor = this.world.floorRadius(column, this.world.layerOf(r));
    if (column.swim && r < waterR + 0.05) {
      r = Math.min(waterR, Math.max(floor, r + (waterR - r) * dt * 2));
      mob.velocityUp = 0; mob.grounded = false; mob.inWater = true;
    } else {
      mob.velocityUp -= 26 * dt;
      r += mob.velocityUp * dt;
      if (r <= floor) { r = floor; mob.velocityUp = 0; mob.grounded = true; } else mob.grounded = false;
      if (mob.grounded && wantsJump && mob.cooldown <= 0.5) mob.velocityUp = 9;
      mob.inWater = false;
    }
    mob.position.setLength(r);

    // Pose the mesh.
    const { basis, x } = this.tmp;
    x.crossVectors(mob.up, mob.facing).normalize();
    basis.makeBasis(x, mob.up, mob.facing);
    mob.mesh.quaternion.setFromRotationMatrix(basis);
    mob.mesh.position.copy(mob.position);
    const flash = mob.hitFlash > 0 ? 1 : 0;
    for (const material of mob.mesh.userData.materials) material.emissive.setRGB(flash, flash * 0.3, flash * 0.3);
  }

  #turn(mob, angle) {
    const right = this.tmp.x.crossVectors(mob.facing, mob.up).normalize();
    const c = Math.cos(angle), s = Math.sin(angle);
    mob.facing.multiplyScalar(c).addScaledVector(right, s).normalize();
  }

  #recolor(mob) {
    for (const material of mob.mesh.userData.materials) if (material.color.getHex() !== 0xff2020) material.color.copy(hex(CHAOS_COLORS[Math.floor(this.random() * CHAOS_COLORS.length)]));
  }

  #attack(mob) {
    mob.cooldown = 1.2;
    this.game.takeHit(mob.type.damage, mob.type.name.toLowerCase(), mob.type.effect ?? null);
    this.game.say(mob.type.effect === 'frozen' ? '🥶 Frozen! So slow…' : mob.type.effect === 'burning' ? '🔥 Ouch, it burns!' : `${mob.type.name} hit you!`, 1.2);
  }

  /** The first mob whose body the ray passes through, within maxDistance along the ray. */
  pick(origin, direction, maxDistance) {
    let best = null;
    for (const mob of this.mobs) {
      const centre = this.tmp.v.copy(mob.position).addScaledVector(mob.up, mob.type.kind === 'animal' ? 0.8 * mob.type.size : 1.3);
      const rel = this.tmp.w.copy(centre).sub(origin);
      const t = rel.dot(direction);
      if (t < 0 || t > maxDistance) continue;
      const perpendicular = rel.addScaledVector(direction, -t).length();
      const radius = mob.type.kind === 'animal' ? 0.75 * mob.type.size : 0.9;
      if (perpendicular <= radius && (!best || t < best.t)) best = { mob, t };
    }
    return best?.mob ?? null;
  }

  /** The player hits a mob: damage, knockback, flee, and drops when it goes down. */
  hit(mob) {
    mob.hp -= 1;
    mob.hitFlash = 0.25;
    if (mob.type.kind === 'animal') mob.flee = 4;
    const away = this.tmp.v.copy(mob.position).sub(this.player.position);
    away.addScaledVector(mob.up, -away.dot(mob.up)).normalize();
    const trial = this.tmp.w.copy(mob.position).addScaledVector(away, 1.4);
    const there = this.world.column(trial.clone().normalize());
    const step = this.world.walkInto(there, mob.position.length(), mob.type.kind === 'animal' ? 1.2 * mob.type.size : 2.4);
    if (step.ok) mob.position.copy(trial).setLength(step.r);
    if (mob.hp <= 0) {
      this.remove(mob);
      return { defeated: true, drop: mob.type.drop, name: mob.type.name };
    }
    return { defeated: false, hp: mob.hp, name: mob.type.name };
  }

  remove(mob) {
    this.scene.remove(mob.mesh);
    mob.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.mobs = this.mobs.filter(m => m !== mob);
  }

  clear() {
    for (const mob of [...this.mobs]) this.remove(mob);
  }
}
