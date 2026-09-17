// Villages: one per planet for now, on flat grass not far from the spawn. A
// village is a flattened plateau with four plank houses and the Chief's hall in
// the middle. It is part of the natural terrain (deterministic from the seed), so
// the worker, the main thread and the tests all see the same village, and its
// blocks can be dug like any other. Pure functions; no three.js.

import { MATERIAL } from './materials.js';
import { tangentBasis, normalize } from './planet.js';

export const VILLAGE_RADIUS = 16;      // plateau radius in blocks
const HOUSE = 5, HALL = 7;             // footprints
const HOUSES = [[-8, -8], [8, -8], [-8, 8], [8, 8]];

/** Find the village site: a flat grassy spot 60–140 blocks from the spawn. */
export function findVillageSite(terrain, spawnDirection, radius) {
  const { east, north } = tangentBasis(spawnDirection);
  const R = radius;
  const point = [0, 0, 0];
  const at = (a, b) => normalize([spawnDirection[0] * R + east[0] * a + north[0] * b, spawnDirection[1] * R + east[1] * a + north[1] * b, spawnDirection[2] * R + east[2] * a + north[2] * b]);
  let best = null;
  for (let ring = 60; ring <= 140 && !best; ring += 10) {
    for (let step = 0; step < 24 && !best; step += 1) {
      const angle = (step / 24) * Math.PI * 2;
      const d = at(Math.cos(angle) * ring, Math.sin(angle) * ring);
      const centre = terrain.sampleNatural(d);
      if (centre.water || centre.material !== MATERIAL.grass) continue;
      let flat = true;
      for (const [da, db] of [[-12, 0], [12, 0], [0, -12], [0, 12], [-8, -8], [8, 8], [-8, 8], [8, -8]]) {
        const s = terrain.sampleNatural(at(Math.cos(angle) * ring + da, Math.sin(angle) * ring + db));
        if (s.water || Math.abs(s.height - centre.height) > 3) { flat = false; break; }
      }
      if (flat) best = { direction: d, height: centre.height };
    }
  }
  return best;
}

/**
 * The village's shape at a direction: null outside, else { height, material, structure }
 * where structure = { base, layers } lists the building blocks above the ground
 * (null entries are air inside a house).
 */
export function villageAt(site, direction, radius) {
  if (!site) return null;
  const dot = site.direction[0] * direction[0] + site.direction[1] * direction[1] + site.direction[2] * direction[2];
  if (dot < 0.9) return null;
  // Local coordinates in blocks on the plateau's tangent plane.
  const { east, north } = site.basis;
  const px = (direction[0] * east[0] + direction[1] * east[1] + direction[2] * east[2]) * radius;
  const py = (direction[0] * north[0] + direction[1] * north[1] + direction[2] * north[2]) * radius;
  const dist = Math.hypot(px, py);
  if (dist > VILLAGE_RADIUS) return null;
  const x = Math.round(px), y = Math.round(py);
  const ground = { height: site.height, material: dist > VILLAGE_RADIUS - 2 ? MATERIAL.grass : MATERIAL.grass, structure: null };

  // The Chief's hall: cobblestone walls 4 high, glowstone roof, a door on the south side.
  const hallHalf = (HALL - 1) / 2;
  if (Math.abs(x) <= hallHalf && Math.abs(y) <= hallHalf) {
    const wall = Math.abs(x) === hallHalf || Math.abs(y) === hallHalf;
    const door = y === -hallHalf && Math.abs(x) <= 0;
    const layers = [];
    for (let k = 0; k < 4; k += 1) layers.push(wall && !(door && k < 2) ? MATERIAL.darkstone : null);
    layers.push(MATERIAL.glowstone);
    return { ...ground, structure: { base: site.height, layers } };
  }
  // Four plank houses with brick roofs and a door.
  const half = (HOUSE - 1) / 2;
  for (const [hx, hy] of HOUSES) {
    const dx = x - hx, dy = y - hy;
    if (Math.abs(dx) > half || Math.abs(dy) > half) continue;
    const wall = Math.abs(dx) === half || Math.abs(dy) === half;
    const door = dy === -half && dx === 0;
    const window = wall && !door && ((Math.abs(dx) === half && dy === 0) || (Math.abs(dy) === half && dx === 0));
    const layers = [];
    for (let k = 0; k < 3; k += 1) layers.push(wall && !(door && k < 2) ? (window && k === 1 ? MATERIAL.glass : MATERIAL.planks) : null);
    layers.push(MATERIAL.bricks);
    return { ...ground, structure: { base: site.height, layers } };
  }
  // A cobblestone path between the houses and the hall.
  if ((Math.abs(x) <= 1 && Math.abs(y) <= 9) || (Math.abs(y) <= 1 && Math.abs(x) <= 9)) return { ...ground, material: MATERIAL.darkstone };
  return ground;
}

/** Where villagers stand: the hall for the Chief, house doors for the others. */
export function villageSpots(site, radius) {
  const { east, north } = site.basis;
  const spot = (x, y) => normalize([site.direction[0] * radius + east[0] * x + north[0] * y, site.direction[1] * radius + east[1] * x + north[1] * y, site.direction[2] * radius + east[2] * x + north[2] * y]);
  return { chief: spot(0, -5), villagers: HOUSES.map(([hx, hy]) => spot(hx, hy - 4)) };
}

export function withBasis(site) {
  if (!site) return null;
  return { ...site, basis: tangentBasis(site.direction) };
}
