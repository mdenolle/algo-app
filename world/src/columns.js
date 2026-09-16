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

/**
 * Ores hide in the stone. `oreSeed` identifies the column; the layer decides what
 * can be there: coal anywhere, iron and emerald in the middle, gold, redstone,
 * lapis, diamond and obsidian near the bottom. About one stone block in nine is ore.
 */
export function oreAt(oreSeed, k) {
  const r = mulberry32((oreSeed ^ Math.imul(k + 1, 2654435761)) | 0)();
  if (k <= 3 && r > 0.94) return MATERIAL.lava;     // lava pockets at the bottom of the world: mind where you dig
  if (r < 0.05) return MATERIAL.coal;
  if (k <= 6) {
    if (r < 0.075) return MATERIAL.diamond;
    if (r < 0.10) return MATERIAL.gold;
    if (r < 0.13) return MATERIAL.redstone;
    if (r < 0.16) return MATERIAL.lapis;
    if (r < 0.20) return MATERIAL.obsidian;
  } else if (k <= 11) {
    if (r < 0.09) return MATERIAL.iron;
    if (r < 0.10) return MATERIAL.gold;
    if (r < 0.115) return MATERIAL.redstone;
    if (r < 0.125) return MATERIAL.emerald;
  } else if (r < 0.08) {
    return MATERIAL.iron;
  }
  return MATERIAL.stone;
}

/** Material of the block at layer k in a natural (unedited) column. */
export function naturalLayerMaterial(natural, k, seaLevel = Infinity, oreSeed = null) {
  const top = natural.height - 1;
  const stone = () => (oreSeed === null ? MATERIAL.stone : oreAt(oreSeed, k));
  if (natural.water) {
    if (natural.material === MATERIAL.ice && k > top && k < seaLevel) return MATERIAL.ice;   // frozen sea
    if (k > top) return null;
    return k === top ? MATERIAL.sand : stone();                                               // sea floor
  }
  if (k > top) return null;
  const below = top - k;
  const surface = natural.material;
  if (k === top) return surface;
  if (surface === MATERIAL.sand) return below <= 3 ? MATERIAL.sand : stone();
  if (surface === MATERIAL.snow) return below <= 2 ? MATERIAL.snow : stone();
  if (surface === MATERIAL.stone || surface === MATERIAL.darkstone) return below <= 1 ? MATERIAL.stone : stone();
  return below <= 3 ? MATERIAL.dirt : stone();
}

/** Stable per-column seed for ores, from the planet seed and the column address. */
export function columnSeed(seed, face, i, j) {
  return (Math.imul(seed, 73856093) ^ Math.imul(face + 1, 19349663) ^ Math.imul(i + 1, 83492791) ^ Math.imul(j + 1, 1442695041)) | 0;
}

/**
 * The column as it currently is. `edit` is the EditStore entry or undefined.
 * Returns { h, water, frozen, top, layer(k), walk } where walk is the radial
 * height a walker stands on (sea floor if swimming, ice surface if frozen).
 */
export function resolveColumn(natural, edit, seaLevel, oreSeed = null) {
  const h = edit ? edit.h : natural.height;
  const water = h <= seaLevel;
  const frozen = water && natural.material === MATERIAL.ice && !(edit && edit.thawed);
  const layer = k => (edit && edit.placed[k] !== undefined ? edit.placed[k] : naturalLayerMaterial(natural, k, seaLevel, oreSeed));
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
    this.map = new Map(entries.map(([key, value]) => [key, { h: value.h, placed: { ...value.placed }, ...(value.thawed ? { thawed: true } : {}) }]));
  }

  get(key) { return this.map.get(key); }
  get size() { return this.map.size; }

  /**
   * Remove the top solid block: the ice sheet on a frozen sea (leaves open water),
   * else the top of the column, which under water is the sea floor. Returns the
   * material removed, or null at bedrock.
   */
  dig(key, natural, seaLevel, minHeight = 2, oreSeed = null) {
    const current = resolveColumn(natural, this.map.get(key), seaLevel, oreSeed);
    const entry = this.map.get(key) ?? { h: natural.height, placed: {} };
    if (current.frozen) {
      entry.thawed = true;
      entry.h = natural.height;                        // open water down to the sea floor
      this.#store(key, entry, natural, seaLevel);
      return MATERIAL.ice;
    }
    if (current.h <= minHeight) return null;           // keep a floor under the planet
    const removed = current.top;
    delete entry.placed[current.h - 1];
    entry.h = current.h - 1;
    this.#store(key, entry, natural, seaLevel);
    return removed;
  }

  /** Explosion damage: lower a column by up to `depth` blocks, keeping the bedrock floor. Returns blocks removed. */
  blast(key, natural, seaLevel, depth, minHeight = 2) {
    let removed = 0;
    for (let n = 0; n < depth; n += 1) {
      const current = resolveColumn(natural, this.map.get(key), seaLevel);
      if (current.frozen) { this.dig(key, natural, seaLevel, minHeight); removed += 1; continue; }
      if (current.h <= minHeight) break;
      if (this.dig(key, natural, seaLevel, minHeight) === null) break;
      removed += 1;
    }
    return removed;
  }

  /** Put `material` on top (on the ice if the sea is frozen). Returns the new height, or null if too tall. */
  place(key, natural, seaLevel, material, maxHeight) {
    const current = resolveColumn(natural, this.map.get(key), seaLevel);
    const base = current.frozen ? seaLevel : current.h;
    if (base >= maxHeight) return null;
    const entry = this.map.get(key) ?? { h: natural.height, placed: {} };
    entry.placed[base] = material;
    entry.h = base + 1;
    this.#store(key, entry, natural, seaLevel);
    return entry.h;
  }

  #store(key, entry, natural, seaLevel) {
    const placedCount = Object.keys(entry.placed).length;
    // On a frozen sea, taking back everything you built leaves the natural ice sheet.
    if (natural.water && natural.material === MATERIAL.ice && !entry.thawed && placedCount === 0 && entry.h > natural.height && entry.h <= seaLevel) entry.h = natural.height;
    // Back to natural? Drop the entry so the store only holds real differences.
    if (entry.h === natural.height && placedCount === 0 && !entry.thawed) this.map.delete(key);
    else this.map.set(key, entry);
  }

  toJSON() { return [...this.map.entries()]; }
  static fromJSON(entries) { return new EditStore(entries ?? []); }
}
