import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Inventory, openPile, demoInventory } from '../inventory.js';
import { Model, PLATES_PER_BRICK } from '../model.js';
import { PARTS, PART_BY_NUM } from '../parts.generated.js';
import { COLOR_BY_ID } from '../colors.generated.js';
import { DESIGNS, design, ideas } from '../designs.js';
import { instructions, partsList, steps, pieceName, pieceImage } from '../instructions.js';

const catalog = JSON.parse(readFileSync(new URL('../../catalog/catalog.json', import.meta.url), 'utf8'));
const catalogPart = new Map(catalog.parts.map(p => [p.partNum, p]));

test('every shape Algo builds with is a real catalogued LEGO part', () => {
  assert.ok(PARTS.length >= 40);
  for (const part of PARTS) {
    const real = catalogPart.get(part.partNum);
    assert.ok(real, `${part.partNum} is in the catalog`);
    assert.equal(real.name, part.name);
    assert.ok(part.footprint[0] >= 1 && part.footprint[1] >= part.footprint[0]);
    assert.ok([1, 2, 3, 6].includes(part.height), `${part.partNum} height ${part.height}`);
    for (const colorId of part.colors) assert.ok(real.elements[String(colorId)], `${part.partNum} really exists in colour ${colorId}`);
  }
  assert.equal(PLATES_PER_BRICK, 3);
});

test('the model refuses what you cannot build: pieces you do not own, no room, nothing underneath', () => {
  const inventory = new Inventory([{ partNum: '3001', colorId: 4, count: 1 }]);
  const model = new Model('test', inventory);
  assert.ok(model.place('3001', 4, 0, 0, 0), 'the brick you own goes down');
  assert.equal(model.place('3001', 4, 4, 0, 0), null);
  assert.match(model.lastError, /no 3001/);
  const two = new Model('t2', new Inventory([{ partNum: '3001', colorId: 4, count: 3 }]));
  two.place('3001', 4, 0, 0, 0);
  assert.equal(two.place('3001', 4, 1, 0, 0), null);
  assert.equal(two.lastError, 'no room there');
  assert.equal(two.place('3001', 4, 0, 0, 9), null);
  assert.equal(two.lastError, 'nothing underneath');
  assert.ok(two.place('3001', 4, 0, 0, 3), 'on top of the first is fine');
});

test('a rotated piece covers the studs it should', () => {
  const model = new Model('t', new Inventory([{ partNum: '3001', colorId: 1, count: 2 }]));
  const flat = model.place('3001', 1, 0, 0, 0, false);
  assert.deepEqual([flat.w, flat.d], [2, 4]);
  const turned = model.place('3001', 1, 2, 0, 0, true);
  assert.deepEqual([turned.w, turned.d], [4, 2]);
});

test('every design builds something real: connected, supported, several pieces, and all from stock', () => {
  for (const seed of [1, 7, 42, 101, 2024]) {
    for (const entry of DESIGNS) {
      const pile = openPile();
      const before = pile.total;
      const model = design(entry.id, pile, seed);
      assert.ok(model.pieces.length >= 4, `${entry.id}/${seed} has ${model.pieces.length} pieces`);
      assert.ok(model.isConnected(), `${entry.id}/${seed} holds together`);
      assert.ok(model.isSupported(), `${entry.id}/${seed} has nothing floating`);
      assert.equal(pile.total, before, 'designing does not touch the pile you passed in');
      for (const piece of model.pieces) {
        assert.ok(PART_BY_NUM[piece.partNum], `${piece.partNum} is a real part`);
        assert.ok(COLOR_BY_ID[piece.colorId], `colour ${piece.colorId} is real`);
        assert.ok(PART_BY_NUM[piece.partNum].colors.includes(piece.colorId), `LEGO made ${piece.partNum} in colour ${piece.colorId}`);
      }
    }
  }
});

test('no two pieces share a stud', () => {
  for (const entry of DESIGNS) {
    const model = design(entry.id, openPile(), 7);
    const seen = new Set();
    for (const piece of model.pieces) {
      for (let dx = 0; dx < piece.w; dx += 1) for (let dz = 0; dz < piece.d; dz += 1) for (let dy = 0; dy < piece.h; dy += 1) {
        const cell = `${piece.x + dx},${piece.y + dy},${piece.z + dz}`;
        assert.ok(!seen.has(cell), `${entry.id}: two pieces at ${cell}`);
        seen.add(cell);
      }
    }
  }
});

test('a design built from a real, limited pile never uses a piece that is not in it', () => {
  for (const entry of DESIGNS) {
    const pile = demoInventory();
    const stock = new Map(pile.list().map(i => [`${i.partNum}:${i.colorId}`, i.count]));
    const model = design(entry.id, pile, 11);
    const used = new Map();
    for (const piece of model.pieces) {
      const key = `${piece.partNum}:${piece.colorId}`;
      used.set(key, (used.get(key) ?? 0) + 1);
    }
    for (const [key, count] of used) assert.ok(count <= (stock.get(key) ?? 0), `${entry.id}: used ${count} of ${key}, owns ${stock.get(key) ?? 0}`);
  }
});

test('the steps rebuild the model exactly, in an order you could follow', () => {
  const model = design('house', openPile(), 7);
  const list = steps(model);
  assert.ok(list.length >= 3);
  const total = list.reduce((n, step) => n + step.pieces.length, 0);
  assert.equal(total, model.pieces.length, 'every piece belongs to a step');
  let seen = 0;
  for (const step of list) { assert.ok(step.text.length > 8 && /\d/.test(step.text)); seen += step.pieces.length; }
  assert.equal(seen, model.pieces.length);
  // Following the steps in order, a piece is never asked for before what holds it up.
  const placed = new Set();
  for (const step of list) {
    for (const piece of step.pieces) {
      const index = model.pieces.indexOf(piece);
      if (piece.y > 0) {
        let rests = false;
        for (let dx = 0; dx < piece.w && !rests; dx += 1) for (let dz = 0; dz < piece.d && !rests; dz += 1) {
          const below = model.cells.get(`${piece.x + dx},${piece.y - 1},${piece.z + dz}`);
          if (below !== undefined && (placed.has(below) || below < index)) rests = true;
        }
        assert.ok(rests, `step ${step.index}: a piece rests on something already placed`);
      }
      placed.add(index);
    }
  }
});

test('the parts list adds up and names real pieces', () => {
  const model = design('tower', openPile(), 3);
  const list = partsList(model);
  assert.equal(list.reduce((n, row) => n + row.count, 0), model.pieces.length);
  for (const row of list) {
    assert.ok(catalogPart.get(row.partNum), `${row.partNum} is catalogued`);
    assert.ok(row.color.name.length > 2);
    assert.match(row.name, /\d+ × \d+/);
  }
  assert.match(pieceName('3001', 4), /red 2 × 4 brick/);
  assert.match(pieceImage('3001', 4), /rebrickable\.com\/media\/parts\/ldraw\/4\/3001\.png/);
  assert.match(pieceImage('3001', 4, '300121'), /elements\/300121\.jpg/);
});

test('ideas() offers builds that fit a real pile', () => {
  const pile = demoInventory();
  const three = ideas(pile, 5);
  assert.equal(three.length, 3);
  for (const model of three) {
    assert.ok(model.pieces.length >= 6);
    assert.ok(model.isConnected() && model.isSupported());
  }
  assert.equal(new Set(three.map(m => m.id)).size, 3, 'three different ideas');
});

test('the same seed gives the same set, a different seed gives a different one', () => {
  const a = design('car', openPile(), 99);
  const b = design('car', openPile(), 99);
  const c = design('car', openPile(), 100);
  assert.deepEqual(a.toJSON().pieces, b.toJSON().pieces);
  const different = JSON.stringify(a.toJSON().pieces) !== JSON.stringify(c.toJSON().pieces);
  assert.ok(different, 'a new seed changes the build');
});

test('instructions() hands a screen everything it needs', () => {
  const info = instructions(design('plane', openPile(), 7));
  assert.equal(info.name, 'Sky Plane');
  assert.ok(info.description.length > 10);
  assert.ok(info.pieceCount > 4 && info.steps.length >= 3 && info.parts.length >= 2);
  assert.ok(info.size.w > 0 && info.size.h > 0);
});
