// The pile of LEGO you actually own: how many of each real part, in each real
// colour. This is what a photo scan produces and what every design must fit in.

import { PART_BY_NUM } from './parts.generated.js';

export const key = (partNum, colorId) => `${partNum}:${colorId}`;

export class Inventory {
  /** entries: [{ partNum, colorId, count }] */
  constructor(entries = []) {
    this.counts = new Map();
    for (const entry of entries) this.add(entry.partNum, entry.colorId, entry.count ?? 1);
  }

  add(partNum, colorId, count = 1) {
    if (!PART_BY_NUM[partNum]) throw new Error(`${partNum} is not a buildable part`);
    const k = key(partNum, colorId);
    this.counts.set(k, (this.counts.get(k) ?? 0) + count);
    return this;
  }

  has(partNum, colorId, count = 1) { return (this.counts.get(key(partNum, colorId)) ?? 0) >= count; }
  countOf(partNum, colorId) { return this.counts.get(key(partNum, colorId)) ?? 0; }
  get total() { return [...this.counts.values()].reduce((a, b) => a + b, 0); }

  take(partNum, colorId, count = 1) {
    if (!this.has(partNum, colorId, count)) return false;
    this.counts.set(key(partNum, colorId), this.countOf(partNum, colorId) - count);
    return true;
  }

  give(partNum, colorId, count = 1) { return this.add(partNum, colorId, count); }

  /** Everything you own, as objects, biggest footprint first. */
  list() {
    return [...this.counts.entries()]
      .filter(([, n]) => n > 0)
      .map(([k, count]) => { const [partNum, colorId] = k.split(':'); return { partNum, colorId: Number(colorId), count, part: PART_BY_NUM[partNum] }; })
      .sort((a, b) => (b.part.footprint[0] * b.part.footprint[1]) - (a.part.footprint[0] * a.part.footprint[1]));
  }

  /** What you own of one kind ('brick', 'plate', 'slope', …), optionally in one colour. */
  of(kind, colorId = null) {
    return this.list().filter(item => item.part.kind === kind && (colorId === null || item.colorId === colorId));
  }

  colors() { return [...new Set(this.list().map(item => item.colorId))]; }

  /** The colour you have most of (ties broken by the smaller colour id, so it is stable). */
  mainColor() {
    const totals = new Map();
    for (const item of this.list()) totals.set(item.colorId, (totals.get(item.colorId) ?? 0) + item.count);
    return [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  }

  clone() { return new Inventory(this.list().map(({ partNum, colorId, count }) => ({ partNum, colorId, count }))); }
  toJSON() { return this.list().map(({ partNum, colorId, count }) => ({ partNum, colorId, count })); }
}

/**
 * Algo designing on its own, with no idea what you own: a pile with plenty of
 * every standard shape and colour. Build from this and the result comes with a
 * list of the pieces you need, instead of pretending to know your box.
 */
export function openPile(colorIds = [4, 1, 14, 2, 15, 0, 71, 19, 70, 321, 27, 25, 29, 30], perPiece = 24) {
  const inventory = new Inventory();
  for (const partNum of Object.keys(PART_BY_NUM)) {
    const part = PART_BY_NUM[partNum];
    if (part.footprint[0] > 2) continue;                 // the designer builds with 1- and 2-wide pieces
    for (const colorId of colorIds) if (part.colors.includes(colorId)) inventory.add(partNum, colorId, perPiece);
  }
  return inventory;
}

/** A mixed tub a child might own: used to check a design fits a real, limited pile. */
export function demoInventory() {
  const RED = 4, BLUE = 1, YELLOW = 14, GREEN = 2, WHITE = 15, BLACK = 0, GRAY = 71, TAN = 19, BROWN = 70, AZURE = 321;
  return new Inventory([
    { partNum: '3001', colorId: RED, count: 6 }, { partNum: '3001', colorId: BLUE, count: 6 },
    { partNum: '3001', colorId: YELLOW, count: 4 }, { partNum: '3001', colorId: WHITE, count: 4 },
    { partNum: '3002', colorId: GREEN, count: 4 }, { partNum: '3002', colorId: RED, count: 3 },
    { partNum: '3003', colorId: BLUE, count: 8 }, { partNum: '3003', colorId: YELLOW, count: 6 },
    { partNum: '3003', colorId: GRAY, count: 6 }, { partNum: '3003', colorId: BROWN, count: 4 },
    { partNum: '3004', colorId: WHITE, count: 8 }, { partNum: '3004', colorId: BLACK, count: 6 },
    { partNum: '3004', colorId: RED, count: 6 }, { partNum: '3005', colorId: YELLOW, count: 8 },
    { partNum: '3005', colorId: BLACK, count: 6 }, { partNum: '3005', colorId: AZURE, count: 4 },
    { partNum: '3010', colorId: TAN, count: 4 }, { partNum: '3010', colorId: GREEN, count: 4 },
    { partNum: '2456', colorId: GRAY, count: 2 }, { partNum: '3007', colorId: BROWN, count: 2 },
    { partNum: '3020', colorId: GREEN, count: 4 }, { partNum: '3020', colorId: GRAY, count: 4 },
    { partNum: '3022', colorId: WHITE, count: 6 }, { partNum: '3022', colorId: RED, count: 4 },
    { partNum: '3023', colorId: YELLOW, count: 8 }, { partNum: '3023', colorId: AZURE, count: 6 },
    { partNum: '3024', colorId: WHITE, count: 8 }, { partNum: '3024', colorId: BLACK, count: 6 },
    { partNum: '3710', colorId: GRAY, count: 4 }, { partNum: '3795', colorId: TAN, count: 2 },
    { partNum: '3039', colorId: RED, count: 6 }, { partNum: '3039', colorId: GRAY, count: 4 },
    { partNum: '3040b', colorId: WHITE, count: 6 }, { partNum: '3037', colorId: BLUE, count: 2 },
    { partNum: '4286', colorId: BLACK, count: 4 }, { partNum: '3298', colorId: GREEN, count: 2 },
    { partNum: '6091', colorId: WHITE, count: 4 }, { partNum: '11477', colorId: GRAY, count: 4 },
    { partNum: '15068', colorId: AZURE, count: 4 }, { partNum: '3062b', colorId: YELLOW, count: 4 },
    { partNum: '3941', colorId: BLACK, count: 4 }, { partNum: '6005', colorId: TAN, count: 2 },
    { partNum: '3069b', colorId: BLACK, count: 4 }, { partNum: '3070b', colorId: WHITE, count: 6 },
  ]);
}
