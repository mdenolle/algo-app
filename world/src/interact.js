// Targeting: march a ray until it enters a solid block. The block hit is the dig
// target; the empty cell the ray was in just before (top, side or underneath)
// is where a new block goes, so you can build sideways and overhead.

import * as THREE from 'three';
import { blockMatrix } from './columns.js';

const point = new THREE.Vector3();
const dir = [0, 0, 0];
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function cellAt(world, p) {
  const r = p.length();
  dir[0] = p.x / r; dir[1] = p.y / r; dir[2] = p.z / r;
  const column = world.column(dir);
  return { column, k: world.layerOf(r), r };
}

export function findTarget(world, origin, direction, startDistance, reach, step = 0.12) {
  let previous = null;
  for (let t = startDistance; t <= startDistance + reach; t += step) {
    point.copy(origin).addScaledVector(direction, t);
    const cell = cellAt(world, point);
    if (cell.k >= 0 && cell.column.resolved.solid(cell.k)) {
      const place = previous && (previous.column.key !== cell.column.key || previous.k !== cell.k) ? previous : null;
      return { dig: cell.column, k: cell.k, place: place?.column ?? null, placeK: place?.k ?? null, distance: t };
    }
    previous = cell;
  }
  return null;
}

/** Ray from the camera through a screen position. */
export function screenRay(camera, x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return { origin: raycaster.ray.origin.clone(), direction: raycaster.ray.direction.clone() };
}

/**
 * Target under a screen position (a tap or a click): ray from the camera through
 * that pixel. Blocks farther than `reach` from the player's head are out of reach.
 */
export function findTargetOnScreen(world, camera, player, x, y, reach) {
  const ray = screenRay(camera, x, y);
  const head = player.headPosition();
  const maxDistance = camera.position.distanceTo(head) + reach;
  const hit = findTarget(world, ray.origin, ray.direction, 0.5, maxDistance);
  if (!hit) return null;
  const hitPoint = ray.origin.clone().addScaledVector(ray.direction, hit.distance);
  if (hitPoint.distanceTo(head) > reach + 1) return { ...hit, tooFar: true };
  return hit;
}

/** The cell one step in front of the player's feet: what you dig or build on when the crosshair misses. */
export function targetInFront(world, player) {
  point.copy(player.position).addScaledVector(player.facing, 1.1).addScaledVector(player.up, 0.3);
  const cell = cellAt(world, point);
  const col = cell.column;
  // Dig the block at foot level ahead if there is one, else the ground ahead; build in the free cell ahead.
  const digK = col.resolved.solid(cell.k) ? cell.k : col.resolved.top;
  const placeK = col.resolved.solid(cell.k) ? null : cell.k;
  return { dig: col, k: digK, place: placeK === null ? null : col, placeK, distance: 1.1, fallback: true };
}

/** Matrix for the highlight box on the targeted block. */
export function highlightMatrix(world, target, out) {
  return blockMatrix(target.dig.face, target.dig.i, target.dig.j, target.k, world.config, world.radius, out);
}
