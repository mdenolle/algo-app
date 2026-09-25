import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PIECES, PIECE_BY_MATERIAL } from '../src/pieces.generated.js';
import { MATERIALS } from '../src/materials.js';
import { pieceLabel, BLOCKS } from '../src/game.js';
import { STUD_PITCH, STUD_DIAMETER, STUD_HEIGHT } from '../src/renderer.js';

const catalog = JSON.parse(readFileSync(new URL('../../catalog/catalog.json', import.meta.url), 'utf8'));
const partByNum = new Map(catalog.parts.map(p => [p.partNum, p]));
const colorById = new Map(catalog.colors.map(c => [c.id, c]));

test('every block in the world is a real LEGO piece: the part, the colour and the element all exist', () => {
  assert.equal(PIECES.length, MATERIALS.length, 'one piece per block type');
  for (const piece of PIECES) {
    const part = partByNum.get(piece.partNum);
    assert.ok(part, `${piece.key}: part ${piece.partNum} is in the catalog`);
    assert.equal(part.name, piece.partName);
    const color = colorById.get(piece.colorId);
    assert.ok(color, `${piece.key}: colour ${piece.colorId}`);
    assert.equal(color.name, piece.colorName);
    assert.equal(part.elements[String(piece.colorId)], piece.elementId, `${piece.key}: LEGO made ${piece.partName} in ${piece.colorName} as element ${piece.elementId}`);
    assert.match(piece.elementId, /^\d+$/);
  }
});

test("each block's colour is the colour its material declares, and the hex is the official one", () => {
  for (const material of MATERIALS) {
    const piece = PIECE_BY_MATERIAL[material.id];
    assert.ok(piece, `${material.key} has a piece`);
    assert.equal(piece.colorId, material.lego.id, `${material.key} uses its own LEGO colour`);
    assert.equal(colorById.get(piece.colorId).rgb, material.hex, `${material.key} hex is the official ${piece.colorName}`);
  }
});

test('blocks are 2 x 2 bricks wherever LEGO made one in that colour', () => {
  const odd = PIECES.filter(p => p.partNum !== '3003');
  assert.ok(odd.length <= 2, `at most a couple of exceptions, got ${odd.map(p => p.key).join(', ')}`);
  for (const piece of odd) {
    const brick = partByNum.get('3003');
    assert.equal(brick.elements[String(piece.colorId)], undefined, `${piece.key}: 3003 really does not exist in ${piece.colorName}`);
  }
});

test('the game can name the piece, and the block book carries it', () => {
  assert.match(pieceLabel(0), /^Green Brick 2 x 2 · part 3003 · element \d+$/);
  const glass = BLOCKS.find(b => b.key === 'glass');
  assert.equal(glass.piece.colorName, 'Trans-Clear');
  assert.equal(BLOCKS.find(b => b.key === 'apple').piece, undefined, 'food is not a brick');
});

test('a block is drawn as a 2 x 2 brick: four studs at LEGO proportions', () => {
  // Real LEGO: stud pitch 8 mm, diameter 4.8 mm, height 1.8 mm; a 2 x 2 brick is 16 mm wide.
  assert.equal(STUD_PITCH, 8 / 16);
  assert.ok(Math.abs(STUD_DIAMETER - 4.8 / 16) < 1e-9);
  assert.ok(Math.abs(STUD_HEIGHT - 1.8 / 16) < 1e-9);
});
