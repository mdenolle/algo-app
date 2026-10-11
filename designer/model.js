// A model: real bricks placed on a stud grid, checked as you build.
//
// Coordinates are studs in x (east) and z (south), and plates in y (up), so a
// brick is 3 tall and a plate 1. A placement is { partNum, colorId, x, z, y,
// rotated }: rotated swaps the footprint. Every placement is checked: the piece
// must be one you own, the space must be free, and it must rest on something.

import { PART_BY_NUM, PLATES_PER_BRICK } from './parts.generated.js';

export { PLATES_PER_BRICK };

export class Model {
  constructor(name, inventory, { description = '', seed = 0 } = {}) {
    this.name = name;
    this.description = description;
    this.seed = seed;
    this.inventory = inventory;       // taken from as the model is built
    this.pieces = [];                 // { partNum, colorId, x, z, y, rotated, w, d, h, step }
    this.cells = new Map();           // "x,y,z" → piece index, every cell a piece fills
    this.step = 1;
  }

  static footprintOf(partNum, rotated) {
    const part = PART_BY_NUM[partNum];
    if (!part) throw new Error(`unknown part ${partNum}`);
    const [a, b] = part.footprint;
    return rotated ? [b, a] : [a, b];
  }

  cellKey(x, y, z) { return `${x},${y},${z}`; }

  /** Is the box free, and inside the build area? */
  fits(partNum, colorId, x, z, y, rotated = false) {
    const part = PART_BY_NUM[partNum];
    if (!part) return false;
    if (y < 0) return false;
    const [w, d] = Model.footprintOf(partNum, rotated);
    for (let dx = 0; dx < w; dx += 1) for (let dz = 0; dz < d; dz += 1) for (let dy = 0; dy < part.height; dy += 1) {
      if (this.cells.has(this.cellKey(x + dx, y + dy, z + dz))) return false;
    }
    return true;
  }

  /** Does it rest on the baseplate or on at least one stud of a piece below? */
  supported(partNum, x, z, y, rotated = false) {
    if (y === 0) return true;
    const [w, d] = Model.footprintOf(partNum, rotated);
    for (let dx = 0; dx < w; dx += 1) for (let dz = 0; dz < d; dz += 1) {
      if (this.cells.has(this.cellKey(x + dx, y - 1, z + dz))) return true;
    }
    return false;
  }

  /**
   * Place a piece. Returns the placement, or null with the reason on `lastError`
   * (not owned, no room, unsupported).
   */
  place(partNum, colorId, x, z, y, rotated = false) {
    const part = PART_BY_NUM[partNum];
    if (!part) { this.lastError = `unknown part ${partNum}`; return null; }
    if (!this.inventory.has(partNum, colorId)) { this.lastError = `no ${partNum} in colour ${colorId} left`; return null; }
    if (!this.fits(partNum, colorId, x, z, y, rotated)) { this.lastError = 'no room there'; return null; }
    if (!this.supported(partNum, x, z, y, rotated)) { this.lastError = 'nothing underneath'; return null; }
    this.inventory.take(partNum, colorId);
    const [w, d] = Model.footprintOf(partNum, rotated);
    const piece = { partNum, colorId, x, z, y, rotated, w, d, h: part.height, kind: part.kind, step: this.step };
    const index = this.pieces.push(piece) - 1;
    for (let dx = 0; dx < w; dx += 1) for (let dz = 0; dz < d; dz += 1) for (let dy = 0; dy < part.height; dy += 1) {
      this.cells.set(this.cellKey(x + dx, y + dy, z + dz), index);
    }
    return piece;
  }

  /** Place the first of these parts that is in stock and fits. */
  placeAny(candidates, colorId, x, z, y, rotated = false) {
    for (const partNum of candidates) {
      const piece = this.place(partNum, colorId, x, z, y, rotated);
      if (piece) return piece;
    }
    return null;
  }

  /** Fill a w × d rectangle at height y with the biggest bricks in stock, left to right. */
  fillRow(partsBySize, colorId, x, z, y, length, horizontal = true) {
    let placed = 0, cursor = 0;
    while (cursor < length) {
      const remaining = length - cursor;
      const candidate = partsBySize.find(({ span }) => span <= remaining);
      if (!candidate) break;
      const px = horizontal ? x + cursor : x;
      const pz = horizontal ? z : z + cursor;
      const piece = this.place(candidate.partNum, colorId, px, pz, y, horizontal ? candidate.rotated : !candidate.rotated);
      if (!piece) { cursor += 1; continue; }     // out of that part: try a smaller one next loop
      cursor += candidate.span;
      placed += 1;
    }
    return placed;
  }

  nextStep() { this.step += 1; return this.step; }

  get size() {
    if (!this.pieces.length) return { w: 0, d: 0, h: 0 };
    const xs = this.pieces.flatMap(p => [p.x, p.x + p.w]);
    const zs = this.pieces.flatMap(p => [p.z, p.z + p.d]);
    const ys = this.pieces.flatMap(p => [p.y, p.y + p.h]);
    return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), h: Math.max(...ys) - Math.min(...ys) };
  }

  /** Every piece touches the rest: nothing floats off on its own. */
  isConnected() {
    if (this.pieces.length <= 1) return true;
    const neighbours = this.pieces.map(() => new Set());
    for (let i = 0; i < this.pieces.length; i += 1) {
      const p = this.pieces[i];
      for (let dx = 0; dx < p.w; dx += 1) for (let dz = 0; dz < p.d; dz += 1) {
        for (const y of [p.y - 1, p.y + p.h]) {
          const other = this.cells.get(this.cellKey(p.x + dx, y, p.z + dz));
          if (other !== undefined && other !== i) { neighbours[i].add(other); neighbours[other].add(i); }
        }
      }
    }
    const seen = new Set([0]); const queue = [0];
    while (queue.length) for (const n of neighbours[queue.pop()]) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    return seen.size === this.pieces.length;
  }

  /** Every piece rests on something (checked again on the finished model). */
  isSupported() {
    return this.pieces.every(p => {
      if (p.y === 0) return true;
      for (let dx = 0; dx < p.w; dx += 1) for (let dz = 0; dz < p.d; dz += 1) if (this.cells.has(this.cellKey(p.x + dx, p.y - 1, p.z + dz))) return true;
      return false;
    });
  }

  toJSON() {
    return { name: this.name, description: this.description, seed: this.seed, size: this.size, steps: this.step, pieces: this.pieces };
  }
}

/** Small seeded random so a design is the same every time for the same seed. */
export function rng(seed) {
  let a = (seed | 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
