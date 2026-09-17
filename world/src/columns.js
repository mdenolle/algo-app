// Columns: the one place that answers "what is at layer k of column (face, i, j)"
// once player edits are layered on the natural terrain. Shared by the worker
// (rendering), the main thread (collision, targeting) and the tests. No three.js.
//
// The natural terrain is a height map (solid from layer 0 up to height-1). Edits
// make it a real block world: { placed: {k: material}, removed: [k, ...], thawed }.
// A placed block can sit anywhere, so bridges, overhangs and building sideways
// onto a wall all work; a removed block leaves a hole (blocks above it float, as in
// Minecraft). A column whose highest solid block is below sea level is water.

import { MATERIAL } from './materials.js';
import { columnDirection, neighbourDirection } from './planet.js';
import { mulberry32 } from './noise.js';

export const BEDROCK_LAYERS = 2;     // layers 0 and 1 can never be removed
export const columnKey = (face, i, j) => `${face}:${i}:${j}`;
export const parseColumnKey = key => { const [face, i, j] = key.split(':').map(Number); return { face, i, j }; };

/**
 * Ores hide in the stone. `oreSeed` identifies the column; the layer decides what
 * can be there: coal anywhere, iron and emerald in the middle, gold, redstone,
 * lapis, diamond and obsidian near the bottom. About one stone block in nine is ore.
 * Lava pockets sit at the very bottom.
 */
export function oreAt(oreSeed, k) {
  const r = mulberry32((oreSeed ^ Math.imul(k + 1, 2654435761)) | 0)();
  if (k <= 3 && r > 0.94) return MATERIAL.lava;
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

/** Material of the natural block at layer k, or null where the natural column has no block. */
export function naturalLayerMaterial(natural, k, seaLevel = Infinity, oreSeed = null) {
  const top = natural.height - 1;
  const st = natural.structure;
  if (st && k >= st.base && k < st.base + st.layers.length) return st.layers[k - st.base];
  const stone = () => (oreSeed === null ? MATERIAL.stone : oreAt(oreSeed, k));
  if (natural.water) {
    if (natural.material === MATERIAL.ice && k > top && k < seaLevel) return MATERIAL.ice;   // frozen sea
    if (k > top || k < 0) return null;
    return k === top ? MATERIAL.sand : stone();                                               // sea floor
  }
  if (k > top || k < 0) return null;
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
 *   solid(k)     is there a block at layer k
 *   material(k)  its material (null if none)
 *   top          highest solid layer (-1 if none), h = top + 1 is the surface height
 *   water        the surface is under the sea (open water above it), frozen: ice sheet instead
 *   surface      what you see from above: the top block, water, or ice
 */
export function resolveColumn(natural, edit, seaLevel, oreSeed = null) {
  const removed = edit?.removed?.length ? new Set(edit.removed) : null;
  const placed = edit?.placed ?? null;
  const thawed = Boolean(edit?.thawed);
  const isIce = natural.water && natural.material === MATERIAL.ice;
  const naturalTop = natural.height - 1;

  const material = k => {
    if (placed && placed[k] !== undefined) return placed[k];
    if (removed && removed.has(k)) return null;
    if (isIce && thawed && k > naturalTop) return null;
    return naturalLayerMaterial(natural, k, seaLevel, oreSeed);
  };
  const solid = k => material(k) !== null;

  // Highest solid layer: start from the natural top / ice sheet / building / highest placed block.
  let top = isIce && !thawed ? seaLevel - 1 : naturalTop;
  if (natural.structure) top = Math.max(top, natural.structure.base + natural.structure.layers.length - 1);
  if (placed) for (const k of Object.keys(placed)) top = Math.max(top, Number(k));
  while (top >= 0 && !solid(top)) top -= 1;

  const h = top + 1;
  const frozen = isIce && !thawed && top === seaLevel - 1;
  // Open water: the surface is below sea level, or it is a sea column with blocks floating above it.
  const water = !frozen && (h <= seaLevel || (natural.water && !solid(seaLevel - 1)));
  const surface = frozen ? MATERIAL.ice : water && h <= seaLevel ? MATERIAL.water : material(top);
  return { h, top, water, frozen, surface, material, solid, layer: material, walk: h, natural };
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

/** Player edits to the planet, keyed by column. Serializable; sent to workers per chunk. */
export class EditStore {
  constructor(entries = []) {
    this.map = new Map(entries.map(([key, value]) => [key, EditStore.normalise(value)]));
  }

  static normalise(value) {
    const entry = { placed: { ...(value.placed ?? {}) }, removed: [...(value.removed ?? [])] };
    if (value.thawed) entry.thawed = true;
    return entry;
  }

  /** Convert a version-1 entry ({ h, placed }, height-map semantics) given the natural height. */
  static fromV1(value, naturalHeight) {
    const entry = { placed: {}, removed: [] };
    for (const [k, m] of Object.entries(value.placed ?? {})) if (Number(k) >= value.h) continue; else entry.placed[k] = m;
    for (let k = value.h; k < naturalHeight; k += 1) entry.removed.push(k);
    if (value.thawed) entry.thawed = true;
    return entry;
  }

  get(key) { return this.map.get(key); }
  get size() { return this.map.size; }

  /**
   * Remove the block at layer k. Returns its material, or null if there is nothing
   * to dig there (air, water, bedrock). Digging any ice thaws the column.
   */
  digAt(key, natural, seaLevel, k, oreSeed = null) {
    const current = resolveColumn(natural, this.map.get(key), seaLevel, oreSeed);
    if (!current.solid(k)) return null;
    if (k < BEDROCK_LAYERS) return null;
    const entry = this.map.get(key) ?? { placed: {}, removed: [] };
    const removedMaterial = current.material(k);
    if (entry.placed[k] !== undefined) {
      delete entry.placed[k];
    } else if (removedMaterial === MATERIAL.ice && natural.water && natural.material === MATERIAL.ice) {
      entry.thawed = true;
    } else {
      entry.removed.push(k);
    }
    this.#store(key, entry);
    return removedMaterial;
  }

  /** Remove the top block (what a height-map dig did). */
  dig(key, natural, seaLevel, minHeight = BEDROCK_LAYERS, oreSeed = null) {
    const current = resolveColumn(natural, this.map.get(key), seaLevel, oreSeed);
    if (current.top < minHeight) return null;
    return this.digAt(key, natural, seaLevel, current.top, oreSeed);
  }

  /** Put `material` at layer k if that cell is empty. Returns k, or null. */
  placeAt(key, natural, seaLevel, k, material, maxHeight) {
    if (k < 0 || k >= maxHeight) return null;
    const current = resolveColumn(natural, this.map.get(key), seaLevel);
    if (current.solid(k)) return null;
    const entry = this.map.get(key) ?? { placed: {}, removed: [] };
    entry.removed = entry.removed.filter(r => r !== k);
    entry.placed[k] = material;
    this.#store(key, entry);
    return k;
  }

  /** Put `material` on top of the column (on the ice if the sea is frozen). Returns the new height, or null. */
  place(key, natural, seaLevel, material, maxHeight) {
    const current = resolveColumn(natural, this.map.get(key), seaLevel);
    const k = current.top + 1;
    return this.placeAt(key, natural, seaLevel, k, material, maxHeight) === null ? null : k + 1;
  }

  /** Explosion damage: remove up to `depth` blocks from the top down. Returns blocks removed. */
  blast(key, natural, seaLevel, depth, minHeight = BEDROCK_LAYERS) {
    let removed = 0;
    for (let n = 0; n < depth; n += 1) {
      if (this.dig(key, natural, seaLevel, minHeight) === null) break;
      removed += 1;
    }
    return removed;
  }

  /** Explosion damage at a point: remove the block at layer k if there is one. */
  blastAt(key, natural, seaLevel, k) {
    return this.digAt(key, natural, seaLevel, k) !== null;
  }

  #store(key, entry) {
    // Only real differences are kept; a placed block that fills a hole cancels the removal.
    entry.placed = Object.fromEntries(Object.entries(entry.placed).filter(([, m]) => m !== undefined && m !== null));
    entry.removed = [...new Set(entry.removed)].sort((a, b) => a - b);
    if (Object.keys(entry.placed).length === 0 && entry.removed.length === 0 && !entry.thawed) this.map.delete(key);
    else this.map.set(key, entry);
  }

  toJSON() { return [...this.map.entries()]; }
  static fromJSON(entries) { return new EditStore(entries ?? []); }
}
