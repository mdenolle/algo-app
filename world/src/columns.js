// Columns: the one place that answers "what is in column (face, i, j)" once player
// edits are layered on the natural terrain. Shared by the worker (rendering), the
// main thread (collision, targeting) and the tests. No three.js here.
//
// An edited column is { h, placed } where h is its new surface height and
// placed[k] is the material of a block the player put at layer k. Layers with no
// placed entry take the natural material for that depth, so digging through grass
// exposes dirt, then stone. A column whose surface is at or below sea level is
// water (dig a hole on the beach and it floods).

import { MATERIAL } from './materials.js';
import { columnDirection, neighbourDirection } from './planet.js';
import { mulberry32 } from './noise.js';

export const columnKey = (face, i, j) => `${face}:${i}:${j}`;
export const parseColumnKey = key => { const [face, i, j] = key.split(':').map(Number); return { face, i, j }; };

/** Material of the block at layer k in a natural (unedited) column. */
export function naturalLayerMaterial(natural, k) {
  const top = natural.height - 1;
  if (k > top) return null;
  if (natural.water) return k === top ? MATERIAL.sand : MATERIAL.stone;          // sea floor
  const below = top - k;
  const surface = natural.material;
  if (k === top) return surface;
  if (surface === MATERIAL.sand) return MATERIAL.sand;
  if (surface === MATERIAL.snow) return below <= 2 ? MATERIAL.snow : MATERIAL.stone;
  if (surface === MATERIAL.stone || surface === MATERIAL.darkstone) return MATERIAL.stone;
  return below <= 3 ? MATERIAL.dirt : MATERIAL.stone;
}

/**
 * The column as it currently is. `edit` is the EditStore entry or undefined.
 * Returns { h, water, frozen, top, layer(k), walk } where walk is the radial
 * height a walker stands on (sea floor if swimming, ice surface if frozen).
 */
export function resolveColumn(natural, edit, seaLevel) {
  const h = edit ? edit.h : natural.height;
  const water = h <= seaLevel;
  const frozen = water && natural.material === MATERIAL.ice && !edit;
  const layer = k => (edit && edit.placed[k] !== undefined ? edit.placed[k] : naturalLayerMaterial(natural, k));
  const top = layer(h - 1);                                   // highest solid block
  const surface = water ? (frozen ? MATERIAL.ice : MATERIAL.water) : top;   // what you see from above
  return { h, water, frozen, top, surface, layer, walk: frozen ? seaLevel : h, natural };
}

/**
 * Column-major 4×4 that maps the unit cube onto layer k of the column: x = east
 * cell edge, y = up (one block), z = south cell edge, translation = block centre.
 * Exact cells mean no gaps, even across cube-face edges.
 */
export function blockMatrix(face, i, j, k, config, radius, out = new Float32Array(16)) {
  const F = config.faceResolution;
  const dir = columnDirection(face, i, j, F);
  const dirU = neighbourDirection(face, i, j, 1, 0, F);
  const dirV = neighbourDirection(face, i, j, 0, 1, F);
  const r = radius + k + 0.5;
  out[0] = (dirU[0] - dir[0]) * r; out[1] = (dirU[1] - dir[1]) * r; out[2] = (dirU[2] - dir[2]) * r; out[3] = 0;
  out[4] = dir[0]; out[5] = dir[1]; out[6] = dir[2]; out[7] = 0;
  out[8] = (dir[0] - dirV[0]) * r; out[9] = (dir[1] - dirV[1]) * r; out[10] = (dir[2] - dirV[2]) * r; out[11] = 0;
  out[12] = dir[0] * r; out[13] = dir[1] * r; out[14] = dir[2] * r; out[15] = 1;
  return out;
}

/** Deterministic "does an apple grow here" test: about one grass column in APPLE_ODDS. */
export const APPLE_ODDS = 220;
export function hasApple(seed, face, i, j, natural) {
  if (natural.water || natural.material !== MATERIAL.grass) return false;
  const rand = mulberry32((seed * 73856093) ^ (face * 19349663) ^ (i * 83492791) ^ (j * 2971215073));
  return rand() * APPLE_ODDS < 1;
}

/** Player edits to the planet, keyed by column. Serializable; sent whole to workers. */
export class EditStore {
  constructor(entries = []) {
    this.map = new Map(entries.map(([key, value]) => [key, { h: value.h, placed: { ...value.placed } }]));
  }

  get(key) { return this.map.get(key); }
  get size() { return this.map.size; }

  /** Remove the top block. Returns the material removed, or null if nothing can be dug. */
  dig(key, natural, seaLevel, minHeight = 2) {
    const current = resolveColumn(natural, this.map.get(key), seaLevel);
    if (current.water) return null;                    // water and ice are not diggable
    if (current.h <= minHeight) return null;           // keep a floor under the planet
    const removed = current.top;
    const entry = this.map.get(key) ?? { h: natural.height, placed: {} };
    delete entry.placed[current.h - 1];
    entry.h = current.h - 1;
    this.#store(key, entry, natural);
    return removed;
  }

  /** Put `material` on top. Returns the new height, or null if too tall. */
  place(key, natural, seaLevel, material, maxHeight) {
    const current = resolveColumn(natural, this.map.get(key), seaLevel);
    if (current.h >= maxHeight) return null;
    const entry = this.map.get(key) ?? { h: natural.height, placed: {} };
    entry.placed[current.h] = material;
    entry.h = current.h + 1;
    this.#store(key, entry, natural);
    return entry.h;
  }

  #store(key, entry, natural) {
    // Back to natural? Drop the entry so the store only holds real differences.
    if (entry.h === natural.height && Object.keys(entry.placed).length === 0) this.map.delete(key);
    else this.map.set(key, entry);
  }

  toJSON() { return [...this.map.entries()]; }
  static fromJSON(entries) { return new EditStore(entries ?? []); }
}
