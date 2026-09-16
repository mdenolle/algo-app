// World facade for the main thread: terrain + edits + picked apples, and the
// block queries everything else needs (collision, targeting, digging).

import { planetRadius } from './config.js';
import { createTerrain } from './terrain.js';
import { columnOf, columnDirection, chunkKey } from './planet.js';
import { EditStore, columnKey, resolveColumn, hasApple, parseColumnKey, columnSeed, BEDROCK_LAYERS } from './columns.js';

export class World {
  constructor(config, saved = null) {
    this.config = config;
    this.radius = planetRadius(config);
    this.terrain = createTerrain(config);
    this.edits = this.#loadEdits(saved);
    this.picked = new Set(saved?.picked ?? []);
    this.dir = [0, 0, 0];
  }

  /** Version-1 saves used height-map entries; convert them with the natural heights. */
  #loadEdits(saved) {
    if (!saved?.edits) return new EditStore();
    if (saved.editsVersion === 2) return EditStore.fromJSON(saved.edits);
    const entries = saved.edits.map(([key, value]) => {
      if (value.removed || !('h' in value)) return [key, value];
      const { face, i, j } = parseColumnKey(key);
      const natural = this.terrain.sample(columnDirection(face, i, j, this.config.faceResolution));
      return [key, EditStore.fromV1(value, natural.height)];
    });
    return new EditStore(entries);
  }

  /** Everything about the column under a unit direction (plain array or Vector3-like). */
  column(direction) {
    const d = direction.x === undefined ? direction : [direction.x, direction.y, direction.z];
    const { face, i, j } = columnOf(d, this.config.faceResolution);
    return this.columnAt(face, i, j);
  }

  columnAt(face, i, j) {
    const key = columnKey(face, i, j);
    const dir = columnDirection(face, i, j, this.config.faceResolution);
    const natural = this.terrain.sample(dir);
    const oreSeed = columnSeed(this.config.seed, face, i, j);
    const resolved = resolveColumn(natural, this.edits.get(key), this.config.seaLevel, oreSeed);
    const swim = resolved.water;
    const apple = !resolved.water && !this.edits.get(key) && !this.picked.has(key) && hasApple(this.config.seed, face, i, j, natural);
    return { face, i, j, key, dir, natural, resolved, solid: resolved.h, swim, apple, oreSeed };
  }

  /** Layer index of a radial distance (layer k spans [R+k, R+k+1)). */
  layerOf(r) { return Math.floor(r - this.radius + 1e-4); }

  /** Radial distance of the top of the highest block at or below layer k in a column. */
  floorRadius(column, k) {
    let layer = Math.min(k, this.config.maxHeight + 8);
    while (layer >= 0 && !column.resolved.solid(layer)) layer -= 1;
    return this.radius + layer + 1;
  }

  /** Radial distance of the bottom of the lowest block above layer k (Infinity if none). */
  ceilingRadius(column, k) {
    const top = Math.max(column.resolved.top, k);
    for (let layer = k + 1; layer <= top; layer += 1) if (column.resolved.solid(layer)) return this.radius + layer;
    return Infinity;
  }

  /** Is the body [feet layer .. head layer] free of blocks in this column? */
  headroom(column, r, height) {
    const first = this.layerOf(r), last = this.layerOf(r + height - 0.02);
    for (let k = first; k <= last; k += 1) if (column.resolved.solid(k)) return false;
    return true;
  }

  /**
   * Can a body of `height` standing at radial `r` move into `column`?
   * Returns { ok, r } where r may be raised by a one-block step, or { ok: false }.
   */
  walkInto(column, r, height, stepHeight = 1.05) {
    if (this.headroom(column, r, height)) return { ok: true, r };
    const k = this.layerOf(r);
    const stepR = this.radius + k + 1;
    if (column.resolved.solid(k) && stepR - r <= stepHeight && this.headroom(column, stepR, height)) return { ok: true, r: stepR };
    return { ok: false, r };
  }

  /** Floor under a world-space point (for the camera): the highest block below it. */
  floorAt(point) {
    const len = Math.hypot(point.x, point.y, point.z);
    this.dir[0] = point.x / len; this.dir[1] = point.y / len; this.dir[2] = point.z / len;
    return this.floorRadius(this.column(this.dir), this.layerOf(len));
  }

  waterRadius() { return this.radius + this.config.seaLevel; }

  digAt(column, k) {
    return this.edits.digAt(column.key, column.natural, this.config.seaLevel, k, column.oreSeed);
  }

  placeAt(column, k, material) {
    return this.edits.placeAt(column.key, column.natural, this.config.seaLevel, k, material, this.config.maxHeight);
  }

  pickApple(column) {
    if (!column.apple) return false;
    this.picked.add(column.key);
    return true;
  }

  /** Crater around a block: every block within `radius` of it goes, bedrock stays. Returns the columns changed. */
  blast(centre, k0, radius = 2.5) {
    const changed = [];
    const N = this.config.faceResolution;
    const reach = Math.ceil(radius);
    for (let di = -reach; di <= reach; di += 1) {
      for (let dj = -reach; dj <= reach; dj += 1) {
        const i = centre.i + di, j = centre.j + dj;
        if (i < 0 || j < 0 || i >= N || j >= N) continue;     // no cross-face craters for now
        let column = null;
        for (let dk = -reach; dk <= reach; dk += 1) {
          if (Math.hypot(di, dj, dk) > radius) continue;
          const k = k0 + dk;
          if (k < BEDROCK_LAYERS) continue;
          column = column ?? this.columnAt(centre.face, i, j);
          if (this.edits.blastAt(column.key, column.natural, this.config.seaLevel, k)) { if (!changed.includes(column)) changed.push(column); }
        }
      }
    }
    return changed;
  }

  /** Chunks whose meshes change when this column changes: its own, plus neighbours when on a chunk border. */
  chunksTouching(column) {
    const N = this.config.chunkSize;
    const cx = Math.floor(column.i / N), cy = Math.floor(column.j / N);
    const xs = [cx], ys = [cy];
    if (column.i % N === 0) xs.push(cx - 1);
    if (column.i % N === N - 1) xs.push(cx + 1);
    if (column.j % N === 0) ys.push(cy - 1);
    if (column.j % N === N - 1) ys.push(cy + 1);
    const keys = [];
    const max = this.config.faceResolution / N;
    for (const x of xs) for (const y of ys) if (x >= 0 && y >= 0 && x < max && y < max) keys.push(chunkKey(column.face, x, y));
    return keys;
  }

  /** Edits and picked apples that a chunk build (with a one-column border) needs. */
  editsFor(face, cx, cy) {
    const N = this.config.chunkSize;
    const i0 = cx * N - 1, i1 = cx * N + N, j0 = cy * N - 1, j1 = cy * N + N;
    const inside = key => { const c = parseColumnKey(key); return c.face === face && c.i >= i0 && c.i <= i1 && c.j >= j0 && c.j <= j1; };
    return {
      edits: [...this.edits.map.entries()].filter(([key]) => inside(key)),
      picked: [...this.picked].filter(inside),
    };
  }

  toJSON() {
    return { editsVersion: 2, edits: this.edits.toJSON(), picked: [...this.picked] };
  }
}
