// Targeting: march a ray from the camera through the crosshair, starting at the
// player's head, until it enters a solid block. The column hit is the dig target;
// the column the ray was in just before is where a new block goes.

import * as THREE from 'three';
import { blockMatrix } from './columns.js';

const point = new THREE.Vector3();
const dir = [0, 0, 0];

/** The column one step in front of the player's feet: what you dig or build on when the crosshair misses. */
export function targetInFront(world, player) {
  point.copy(player.position).addScaledVector(player.facing, 1.1).addScaledVector(player.up, 0.3);
  const r = point.length();
  dir[0] = point.x / r; dir[1] = point.y / r; dir[2] = point.z / r;
  const column = world.column(dir);
  return { dig: column, place: column, distance: 1.1, fallback: true };
}

export function findTarget(world, origin, direction, startDistance, reach, step = 0.15) {
  let previous = null;
  for (let t = startDistance; t <= startDistance + reach; t += step) {
    point.copy(origin).addScaledVector(direction, t);
    const r = point.length();
    dir[0] = point.x / r; dir[1] = point.y / r; dir[2] = point.z / r;
    const column = world.column(dir);
    if (r < world.radius + column.solid) {
      return { dig: column, place: previous ?? column, distance: t };
    }
    previous = column;
  }
  return null;
}

/** Matrix for the highlight box: the top solid block of the dig target. */
export function highlightMatrix(world, column, out) {
  return blockMatrix(column.face, column.i, column.j, column.solid - 1, world.config, world.radius, out);
}
