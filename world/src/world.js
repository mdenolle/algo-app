// World facade for the main thread: terrain + edits + picked apples, and the
// column queries everything else needs (collision, targeting, digging).

import { planetRadius } from './config.js';
import { createTerrain } from './terrain.js';
import { columnOf, columnDirection, chunkKey } from './planet.js';
import { EditStore, columnKey, resolveColumn, hasApple, parseColumnKey, columnSeed } from './columns.js';

export class World {
  constructor(config, saved = null) {
    this.config = config;
    this.radius = planetRadius(config);
    this.terrain = createTerrain(config);
    this.edits = EditStore.fromJSON(saved?.edits);
    this.picked = new Set(saved?.picked ?? []);
    this.dir = [0, 0, 0];
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
    const solid = resolved.frozen ? this.config.seaLevel : resolved.h;
    const swim = resolved.water && !resolved.frozen;
    const apple = !resolved.water && !this.edits.get(key) && !this.picked.has(key) && hasApple(this.config.seed, face, i, j, natural);
    return { face, i, j, key, dir, natural, resolved, solid, swim, apple, oreSeed };
  }

  /** Radial distance of the solid floor under a world-space point. */
  floorRadius(point) {
    const len = Math.hypot(point.x, point.y, point.z);
    this.dir[0] = point.x / len; this.dir[1] = point.y / len; this.dir[2] = point.z / len;
    return this.radius + this.column(this.dir).solid;
  }

  waterRadius() { return this.radius + this.config.seaLevel; }

  dig(column) {
    return this.edits.dig(column.key, column.natural, this.config.seaLevel, 2, column.oreSeed);
  }

  /** Crater around a column: depth falls off with distance. Returns the columns changed. */
  blast(centre, radius = 2.5, depth = 3) {
    const changed = [];
    const N = this.config.faceResolution;
    const reach = Math.ceil(radius);
    for (let di = -reach; di <= reach; di += 1) {
      for (let dj = -reach; dj <= reach; dj += 1) {
        const distance = Math.hypot(di, dj);
        if (distance > radius) continue;
        const i = centre.i + di, j = centre.j + dj;
        if (i < 0 || j < 0 || i >= N || j >= N) continue;     // no cross-face craters for now
        const column = this.columnAt(centre.face, i, j);
        const layers = Math.max(1, Math.round(depth - distance));
        if (this.edits.blast(column.key, column.natural, this.config.seaLevel, layers) > 0) changed.push(column);
      }
    }
    return changed;
  }

  place(column, material) {
    return this.edits.place(column.key, column.natural, this.config.seaLevel, material, this.config.maxHeight);
  }

  pickApple(column) {
    if (!column.apple) return false;
    this.picked.add(column.key);
    return true;
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
    return { edits: this.edits.toJSON(), picked: [...this.picked] };
  }
}
