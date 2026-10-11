// Algo invents the set. Each designer here is a recipe in the shape of code, not
// a copied instruction book: it looks at the pile you own, picks sizes and
// colours that fit, and places real bricks one by one. Every placement is
// checked by the Model (owned, room, supported), so what comes out can be built
// with the pieces in front of you.

import { Model, rng, PLATES_PER_BRICK as BRICK } from './model.js';
import { PART_BY_NUM } from './parts.generated.js';

/** Pieces you own of one kind and colour whose footprint is `depth` × span, widest first. */
function spansOf(inventory, colorId, kind = 'brick', depth = 2) {
  const out = [];
  for (const item of inventory.of(kind, colorId)) {
    const [a, b] = item.part.footprint;            // always [smaller, larger]
    // A line along x needs the footprint to read [span, depth]; rotate when it does not.
    if (b === depth) out.push({ partNum: item.partNum, span: a, rotated: false });
    else if (a === depth) out.push({ partNum: item.partNum, span: b, rotated: true });
  }
  return out.sort((x, y) => y.span - x.span);
}

/**
 * The colour you have most pieces in, among those with at least `need` of them.
 * `minSpan` asks for pieces at least that many studs long (a floor laid in 1 x 2
 * plates falls apart; one laid in 2 x 4s holds), and the seed picks among the
 * richest few, so two builds from the same pile are not the same colour.
 */
function pickColor(inventory, { kind = 'brick', need = 2, avoid = [], random, minSpan = 1 } = {}) {
  const totals = new Map();
  for (const item of inventory.list()) {
    if (kind && item.part.kind !== kind) continue;
    if (avoid.includes(item.colorId)) continue;
    const [a, b] = item.part.footprint;
    if (Math.max(a, b) < minSpan || Math.min(a, b) > 2) continue;    // usable in a 2-thick line
    totals.set(item.colorId, (totals.get(item.colorId) ?? 0) + item.count);
  }
  const good = [...totals.entries()].filter(([, n]) => n >= need).sort((a, b) => b[1] - a[1]);
  if (!good.length) return inventory.mainColor();
  const top = good.slice(0, Math.min(3, good.length));       // the seed picks among the richest colours
  return top[Math.floor((random?.() ?? 0) * top.length)][0];
}

/**
 * A line of pieces `length` studs long and `depth` studs thick, starting at
 * (x, z) at height y. Takes the widest piece that fits and is in stock, then the
 * next, the way you lay real bricks. `colorId` may be a list: when the first
 * colour runs out the line carries on in the next, so a floor is never left with
 * a hole that would let the model fall apart. Returns the studs covered.
 */
function line(model, colorId, x, z, y, length, { kind = 'brick', depth = 2, horizontal = true } = {}) {
  const colors = Array.isArray(colorId) ? colorId : [colorId];
  let cursor = 0, covered = 0;
  while (cursor < length) {
    const remaining = length - cursor;
    let placed = null;
    for (const color of colors) {
      const candidates = spansOf(model.inventory, color, kind, depth).filter(c => c.span <= remaining);
      for (const candidate of candidates) {
        const px = horizontal ? x + cursor : x;
        const pz = horizontal ? z : z + cursor;
        placed = model.place(candidate.partNum, color, px, pz, y, horizontal ? candidate.rotated : !candidate.rotated);
        if (placed) break;
      }
      if (placed) break;
    }
    if (placed) { cursor += horizontal ? placed.w : placed.d; covered += horizontal ? placed.w : placed.d; }
    else cursor += 1;                                      // nothing fits here: skip a stud
  }
  return covered;
}

/**
 * Plates (or bricks) covering a w × d rectangle. This is what ties a build
 * together: the walls under it are separate pieces until a floor or roof spans
 * them. Falls back to other colours rather than leaving a gap.
 */
function slab(model, colorId, x, z, y, w, d, kind = 'plate') {
  const colors = Array.isArray(colorId) ? colorId : [colorId, ...model.inventory.colors().filter(c => c !== colorId)];
  let row = 0;
  while (row < d) {
    const canTwo = row + 1 < d && colors.some(c => spansOf(model.inventory, c, kind, 2).length);
    const depth = canTwo ? 2 : 1;
    const covered = line(model, colors, x, z + row, y, w, { kind, depth });
    if (!covered) {
      if (depth === 2) { line(model, colors, x, z + row, y, w, { kind, depth: 1 }); row += 1; continue; }
      break;                                               // out of pieces of this kind
    }
    row += depth;
  }
  return model.pieces.length;
}

/**
 * Four walls around a w × d footprint, `rows` bricks high, 2 studs thick.
 * Rows take turns owning the corners — front and back walls run the full width
 * on even rows, the side walls run the full depth on odd rows — so each row
 * straddles the joints below it and the ring holds together, the way you would
 * lay real bricks. `doorAt` leaves a doorway in the front wall on the bottom row.
 */
function box(model, colorId, x, z, y, w, d, rows, { doorAt = null } = {}) {
  for (let row = 0; row < rows; row += 1) {
    const ry = y + row * BRICK;
    const frontOwnsCorners = row % 2 === 0;
    if (frontOwnsCorners) {
      if (doorAt !== null && row === 0) {
        line(model, colorId, x, z, ry, doorAt, { depth: 2 });
        line(model, colorId, x + doorAt + 2, z, ry, Math.max(0, w - doorAt - 2), { depth: 2 });
      } else {
        line(model, colorId, x, z, ry, w, { depth: 2 });                              // front, full width
      }
      line(model, colorId, x, z + d - 2, ry, w, { depth: 2 });                         // back, full width
      line(model, colorId, x, z + 2, ry, Math.max(0, d - 4), { depth: 2, horizontal: false });
      line(model, colorId, x + w - 2, z + 2, ry, Math.max(0, d - 4), { depth: 2, horizontal: false });
    } else {
      line(model, colorId, x, z, ry, d, { depth: 2, horizontal: false });              // left, full depth
      line(model, colorId, x + w - 2, z, ry, d, { depth: 2, horizontal: false });      // right, full depth
      line(model, colorId, x + 2, z, ry, Math.max(0, w - 4), { depth: 2 });
      line(model, colorId, x + 2, z + d - 2, ry, Math.max(0, w - 4), { depth: 2 });
    }
  }
}

// ---------------------------------------------------------------- the designs
// Each design is a shape Algo knows how to make, not a copied set: it reads the
// pile, chooses sizes and colours that fit, and lays real bricks. A slab or roof
// always ties the walls together, the way a real model holds in one piece.

/** A house: brick walls with a doorway, a roof of slopes, a chimney. */
function house(inventory, seed) {
  const random = rng(seed);
  const wallColor = pickColor(inventory, { need: 8, random });
  const roofColor = pickColor(inventory, { kind: 'slope', need: 3, avoid: [wallColor], random }) ?? wallColor;
  const floorColor = pickColor(inventory, { kind: 'plate', need: 2, minSpan: 4, random }) ?? wallColor;
  const w = 6, d = 6, rows = 2;
  const model = new Model('Brick House', inventory, { seed, description: `A ${w} by ${d} house with a doorway, a sloped roof and a chimney.` });

  box(model, wallColor, 0, 0, 0, w, d, rows, { doorAt: 2 });
  model.nextStep();
  slab(model, floorColor, 0, 0, rows * BRICK, w, d, 'plate');          // the ceiling ties the walls together
  model.nextStep();
  const roofY = rows * BRICK + 1;
  for (let row = 0; row < d; row += 2) line(model, roofColor, 0, row, roofY, w, { kind: 'slope', depth: 2 });
  model.nextStep();
  model.placeAny(['3005', '3062b', '3003'], roofColor, 1, 1, roofY + BRICK);
  return model;
}

/** A car: a plate chassis, a body, a windscreen and four round wheels. */
function car(inventory, seed) {
  const random = rng(seed);
  const bodyColor = pickColor(inventory, { need: 4, random });
  const chassisColor = pickColor(inventory, { kind: 'plate', need: 2, minSpan: 4, random }) ?? bodyColor;
  const wheelColor = pickColor(inventory, { kind: 'round', need: 2, random }) ?? pickColor(inventory, { need: 2, avoid: [bodyColor], random });
  const glassColor = pickColor(inventory, { kind: 'slope', need: 2, avoid: [bodyColor], random }) ?? bodyColor;
  const length = 6 + Math.floor(random() * 2) * 2;
  const model = new Model('Speedy Car', inventory, { seed, description: `A ${length}-stud car with a windscreen and four wheels.` });

  line(model, chassisColor, 0, 0, 0, length, { kind: 'plate', depth: 2 });                  // chassis
  model.nextStep();
  for (const x of [0, length - 2]) model.placeAny(['3941', '3003'], wheelColor, x, 0, 1);   // round-brick wheels
  model.nextStep();
  line(model, bodyColor, 2, 0, 1, Math.max(2, length - 4), { depth: 2 });                   // body between the wheels
  model.nextStep();
  line(model, glassColor, 2, 0, 1 + BRICK, 2, { kind: 'slope', depth: 2 });                 // windscreen
  line(model, bodyColor, 4, 0, 1 + BRICK, Math.max(2, length - 6), { depth: 2 });           // cabin
  model.nextStep();
  line(model, glassColor, 2, 0, 1 + 2 * BRICK, Math.max(2, length - 4), { kind: 'tile', depth: 2 });   // smooth roof
  return model;
}

/** A rocket: a round stack with fins and a nose cone. */
function rocket(inventory, seed) {
  const random = rng(seed);
  const bodyColor = pickColor(inventory, { need: 5, random });
  const finColor = pickColor(inventory, { kind: 'slope', need: 4, avoid: [bodyColor], random }) ?? bodyColor;
  const padColor = pickColor(inventory, { kind: 'plate', need: 2, minSpan: 4, random }) ?? bodyColor;
  const height = 4 + Math.floor(random() * 3);
  const model = new Model('Pocket Rocket', inventory, { seed, description: `A ${height}-brick rocket with four fins and a nose cone.` });

  slab(model, padColor, 0, 0, 0, 4, 4, 'plate');                        // launch pad
  model.nextStep();
  let y = 1;
  for (let level = 0; level < height; level += 1) {
    if (!model.placeAny(['3003', '3941'], bodyColor, 1, 1, y)) break;
    y += BRICK;
    if (level % 2 === 1) model.nextStep();
  }
  model.nextStep();
  for (const [x, z, rot] of [[0, 1, false], [3, 1, false], [1, 0, true], [1, 3, true]]) {
    model.placeAny(['3040b', '3039'], finColor, x, z, 1, rot);          // fins around the base
  }
  model.nextStep();
  if (!model.placeAny(['3039'], finColor, 1, 1, y)) model.placeAny(['3005', '3062b', '3003'], finColor, 1, 1, y);
  return model;
}

/** A dog: four legs under a plate belly, a body, a head and a tail. */
function animal(inventory, seed) {
  const random = rng(seed);
  const furColor = pickColor(inventory, { need: 5, random });
  const bellyColor = pickColor(inventory, { kind: 'plate', need: 2, minSpan: 4, random }) ?? furColor;
  const noseColor = pickColor(inventory, { need: 1, avoid: [furColor], random }) ?? furColor;
  const model = new Model('Brick Dog', inventory, { seed, description: 'A little dog with four legs, a wagging tail and a nose.' });

  for (const x of [0, 4]) model.placeAny(['3003', '3004'], furColor, x, 0, 0);     // front and back legs
  model.nextStep();
  line(model, bellyColor, 0, 0, BRICK, 6, { kind: 'plate', depth: 2 });            // the belly ties the legs together
  model.nextStep();
  line(model, furColor, 0, 0, BRICK + 1, 6, { depth: 2 });                         // body
  model.nextStep();
  model.placeAny(['3003', '3002'], furColor, 4, 0, BRICK + 1 + BRICK);             // head
  model.placeAny(['3039', '3040b'], furColor, 1, 0, BRICK + 1 + BRICK);            // shoulders
  model.nextStep();
  model.placeAny(['3005', '3024'], noseColor, 5, 0, BRICK + 1 + 2 * BRICK);        // nose
  model.placeAny(['3024'], noseColor, 4, 0, BRICK + 1 + 2 * BRICK);                // ear
  model.placeAny(['3005', '3062b'], furColor, 0, 0, BRICK + 1 + BRICK);            // tail
  return model;
}

/** A tower: square walls with battlements and a flag. */
function tower(inventory, seed) {
  const random = rng(seed);
  const stoneColor = pickColor(inventory, { need: 8, random });
  const flagColor = pickColor(inventory, { kind: 'plate', need: 1, avoid: [stoneColor], random }) ?? stoneColor;
  const floorColor = pickColor(inventory, { kind: 'plate', need: 2, minSpan: 4, random }) ?? stoneColor;
  const levels = 3 + Math.floor(random() * 3);
  const model = new Model('Castle Tower', inventory, { seed, description: `A ${levels}-level tower with battlements and a flag on top.` });

  box(model, stoneColor, 0, 0, 0, 6, 6, levels);
  model.nextStep();
  const top = levels * BRICK;
  slab(model, floorColor, 0, 0, top, 6, 6, 'plate');                               // the top floor ties the walls
  model.nextStep();
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) model.placeAny(['3005', '3062b', '3003'], stoneColor, x, z, top + 1);
  model.nextStep();
  model.placeAny(['3005'], flagColor, 2, 2, top + 1);
  model.placeAny(['3023', '3024'], flagColor, 2, 2, top + 1 + BRICK);
  return model;
}

/** A plane: a fuselage with wings across it, a cockpit and a tail fin. */
function plane(inventory, seed) {
  const random = rng(seed);
  const bodyColor = pickColor(inventory, { need: 4, random });
  const wingColor = pickColor(inventory, { kind: 'plate', need: 2, minSpan: 4, random }) ?? bodyColor;
  const glassColor = pickColor(inventory, { kind: 'slope', need: 2, avoid: [bodyColor], random }) ?? bodyColor;
  const model = new Model('Sky Plane', inventory, { seed, description: 'A plane with long wings, a cockpit and a tail fin.' });

  line(model, bodyColor, 0, 2, 0, 8, { depth: 2 });                                // fuselage, nose to tail
  model.nextStep();
  // Wings run across the body so each plate grips the fuselage under it.
  for (const x of [2, 4]) line(model, wingColor, x, 0, BRICK, 6, { kind: 'plate', depth: 2, horizontal: false });
  model.nextStep();
  line(model, bodyColor, 1, 2, BRICK + 1, 5, { depth: 2 });                        // cabin on top
  model.nextStep();
  line(model, glassColor, 1, 2, BRICK + 1 + BRICK, 2, { kind: 'slope', depth: 2 });  // cockpit
  model.placeAny(['3069b', '3068b', '3022'], wingColor, 3, 2, BRICK + 1 + BRICK);  // smooth roof
  model.nextStep();
  model.placeAny(['3003', '3004'], bodyColor, 6, 2, BRICK + 1);                    // tail
  model.placeAny(['3039', '3040b', '3005'], glassColor, 6, 2, BRICK + 1 + BRICK);  // tail fin
  return model;
}

/** A bridge: two towers with a road slung between them, walk under it. */
function bridge(inventory, seed) {
  const random = rng(seed);
  const stoneColor = pickColor(inventory, { need: 6, random });
  const roadColor = pickColor(inventory, { kind: 'plate', need: 2, minSpan: 4, random }) ?? stoneColor;
  const gap = 4;
  const span = gap + 4;
  const model = new Model('Brick Bridge', inventory, { seed, description: `A bridge with two towers and a ${gap}-stud arch to walk under.` });

  for (const x of [0, gap + 2]) for (let level = 0; level < 2; level += 1) {
    line(model, stoneColor, x, 0, level * BRICK, 2, { depth: 2 });                 // towers
  }
  model.nextStep();
  slab(model, roadColor, 0, 0, 2 * BRICK, span, 2, 'plate');                       // the road ties the towers together
  model.nextStep();
  for (let x = 0; x < span; x += 3) model.placeAny(['3005', '3004', '3062b'], stoneColor, x, 0, 2 * BRICK + 1);   // railing posts
  model.nextStep();
  model.placeAny(['3069b', '3068b', '3022'], roadColor, Math.floor(span / 2) - 1, 0, 2 * BRICK + 1);
  return model;
}

/** A robot: stompy legs, a body, arms and a head with two eyes. */
function robot(inventory, seed) {
  const random = rng(seed);
  const metalColor = pickColor(inventory, { need: 6, random });
  const plateColor = pickColor(inventory, { kind: 'plate', need: 2, minSpan: 4, random }) ?? metalColor;
  const eyeColor = pickColor(inventory, { kind: 'plate', need: 2, avoid: [metalColor], random }) ?? metalColor;
  const model = new Model('Brick Robot', inventory, { seed, description: 'A robot with stompy legs, swinging arms and two bright eyes.' });

  for (const x of [0, 4]) for (let level = 0; level < 2; level += 1) model.placeAny(['3003', '3004'], metalColor, x, 0, level * BRICK);
  model.nextStep();
  slab(model, plateColor, 0, 0, 2 * BRICK, 6, 2, 'plate');                          // hips tie the legs together
  model.nextStep();
  for (let row = 0; row < 2; row += 1) line(model, metalColor, 1, 0, 2 * BRICK + 1 + row * BRICK, 4, { depth: 2 });
  model.nextStep();
  const shoulders = 2 * BRICK + 1 + 2 * BRICK;
  slab(model, plateColor, 0, 0, shoulders, 6, 2, 'plate');                          // shoulders, wider than the body
  model.nextStep();
  model.placeAny(['3003', '3002'], metalColor, 2, 0, shoulders + 1);                // head
  model.placeAny(['3024'], eyeColor, 2, 0, shoulders + 1 + BRICK);
  model.placeAny(['3024'], eyeColor, 3, 0, shoulders + 1 + BRICK);
  return model;
}

export const DESIGNS = [
  { id: 'house', name: 'Brick House', build: house, minutes: 12, level: 'CREATIVE BUILD' },
  { id: 'car', name: 'Speedy Car', build: car, minutes: 8, level: 'QUICK BUILD' },
  { id: 'rocket', name: 'Pocket Rocket', build: rocket, minutes: 6, level: 'QUICK BUILD' },
  { id: 'animal', name: 'Brick Dog', build: animal, minutes: 10, level: 'CREATIVE BUILD' },
  { id: 'tower', name: 'Castle Tower', build: tower, minutes: 14, level: 'MEGA BUILD' },
  { id: 'plane', name: 'Sky Plane', build: plane, minutes: 11, level: 'CREATIVE BUILD' },
  { id: 'bridge', name: 'Brick Bridge', build: bridge, minutes: 13, level: 'MEGA BUILD' },
  { id: 'robot', name: 'Brick Robot', build: robot, minutes: 10, level: 'CREATIVE BUILD' },
];

/** Design one model from a copy of your pile, so your pile is untouched. */
export function design(id, inventory, seed = 1) {
  const entry = DESIGNS.find(d => d.id === id);
  if (!entry) throw new Error(`no design called ${id}`);
  const model = entry.build(inventory.clone(), seed);
  model.id = entry.id;
  model.minutes = entry.minutes;
  model.level = entry.level;
  return model;
}

/** Three ideas Algo can actually build from this pile, biggest first. */
export function ideas(inventory, seed = 1, count = 3) {
  const random = rng(seed);
  const built = DESIGNS.map(entry => design(entry.id, inventory, Math.floor(random() * 1e9)))
    .filter(model => model.pieces.length >= 6 && model.isConnected() && model.isSupported());
  return built.sort((a, b) => b.pieces.length - a.pieces.length).slice(0, count);
}
