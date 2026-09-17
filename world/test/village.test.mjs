import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/config.js';
import { World } from '../src/world.js';
import { villageSpots, VILLAGE_RADIUS } from '../src/village.js';
import { MATERIAL } from '../src/materials.js';
import { isTrapped, MOB_TYPES } from '../src/mobs.js';
import { normalize } from '../src/planet.js';

const world = new World(DEFAULT_CONFIG);
const site = world.terrain.villageSite();

test('the planet has a village on flat grass, 40–110 blocks from the spawn', () => {
  assert.ok(site, 'a village site');
  const spawn = world.terrain.findSpawn();
  const dot = spawn[0] * site.direction[0] + spawn[1] * site.direction[1] + spawn[2] * site.direction[2];
  const distance = Math.acos(dot) * world.radius;
  assert.ok(distance >= 35 && distance <= 120, `distance ${distance}`);
  const centre = world.column(site.direction);
  assert.equal(centre.natural.height, site.height, 'flattened');
  assert.equal(centre.natural.water, false);
});

test("the Chief's hall: cobblestone walls four high with a glowstone roof, air inside; houses have plank walls and brick roofs", () => {
  const { east, north } = site.basis;
  const R = world.radius;
  const at = (x, y) => world.column(normalize([site.direction[0] * R + east[0] * x + north[0] * y, site.direction[1] * R + east[1] * x + north[1] * y, site.direction[2] * R + east[2] * x + north[2] * y]));
  const h = site.height;
  const wall = at(3, 0).resolved, inside = at(0, 0).resolved, door = at(0, -3).resolved;
  assert.equal(wall.material(h), MATERIAL.darkstone);
  assert.equal(wall.material(h + 3), MATERIAL.darkstone);
  assert.equal(wall.material(h + 4), MATERIAL.glowstone);
  assert.equal(inside.material(h), null, 'air inside the hall');
  assert.equal(inside.material(h + 4), MATERIAL.glowstone, 'roof over the inside');
  assert.equal(inside.top, h + 4);
  assert.equal(door.material(h), null, 'a door');
  assert.equal(door.material(h + 2), MATERIAL.darkstone, 'wall above the door');
  const houseWall = at(8 - 2, 8).resolved, houseInside = at(8, 8).resolved;
  assert.equal(houseWall.material(h), MATERIAL.planks);
  assert.equal(houseWall.material(h + 1), MATERIAL.glass, 'a window');
  assert.equal(houseInside.material(h + 3), MATERIAL.bricks, 'brick roof');
  assert.equal(houseInside.material(h), null);
  assert.equal(at(VILLAGE_RADIUS + 3, 0).natural.structure ?? null, null, 'nothing built outside the plateau');
});

test('villager spots are on the ground inside the village; the Chief type is a villager with a hat', () => {
  const spots = villageSpots(site, world.radius);
  assert.equal(spots.villagers.length, 4);
  for (const d of [spots.chief, ...spots.villagers]) {
    const col = world.column(d);
    assert.equal(col.resolved.h, site.height, 'standing on the plateau, not in a wall');
  }
  assert.equal(MOB_TYPES.chief.kind, 'villager');
  assert.ok(MOB_TYPES.chief.chief && MOB_TYPES.chief.colors.hat);
  assert.ok(MOB_TYPES.skyZombie.flying);
});

test('a villager walled in on four sides, two blocks high, is trapped; one block high or one side open is not', () => {
  const spots = villageSpots(site, world.radius);
  const d = spots.villagers[1];
  const col = world.column(d);
  const k = site.height;
  const mob = { position: { length: () => world.radius + k + 0.01 }, up: { x: d[0], y: d[1], z: d[2] } };
  assert.equal(isTrapped(world, mob), false);
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => world.columnAt(col.face, col.i + di, col.j + dj));
  for (const c of around) { world.placeAt(c, k, MATERIAL.stone); world.placeAt(c, k + 1, MATERIAL.stone); }
  assert.equal(isTrapped(world, mob), true);
  world.digAt(around[0], k + 1);
  assert.equal(isTrapped(world, mob), false, 'a wall one block high can be stepped over: walls must be two high');
  world.placeAt(around[0], k + 1, MATERIAL.stone);
  assert.equal(isTrapped(world, mob), true);
  world.digAt(around[0], k); world.digAt(around[0], k + 1);
  assert.equal(isTrapped(world, mob), false, 'a way out');
});
