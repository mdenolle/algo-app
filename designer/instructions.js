// Turning a model into something a child can follow: numbered steps, and the
// list of real LEGO pieces the whole build needs (with the element id, so the
// piece can be looked up or bought by number).

import { PART_BY_NUM } from './parts.generated.js';
import { COLOR_BY_ID } from './colors.generated.js';

/** "red 2 × 4 brick" */
export function pieceName(partNum, colorId) {
  const part = PART_BY_NUM[partNum];
  const color = COLOR_BY_ID[colorId];
  const kid = (color?.kid ?? 'brick').replace(/([a-z])([A-Z])/g, '$1 $2');
  const size = part.footprint.join(' × ');
  const what = { brick: 'brick', plate: 'plate', tile: 'tile', slope: 'slope', curve: 'curved brick', round: 'round brick', arch: 'arch' }[part.kind] ?? 'piece';
  return `${kid} ${size} ${what}`;
}

/** Everything the build needs: one row per piece type and colour, most used first. */
export function partsList(model) {
  const rows = new Map();
  for (const piece of model.pieces) {
    const key = `${piece.partNum}:${piece.colorId}`;
    const part = PART_BY_NUM[piece.partNum];
    const row = rows.get(key) ?? { partNum: piece.partNum, colorId: piece.colorId, count: 0, part, color: COLOR_BY_ID[piece.colorId], elementId: part.elements?.[String(piece.colorId)] ?? null, name: pieceName(piece.partNum, piece.colorId) };
    row.count += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.partNum.localeCompare(b.partNum));
}

const PLACE_WORDS = ['Put', 'Add', 'Place', 'Snap on', 'Press on'];

/**
 * The build in numbered steps, the way an instruction book does it: a few pieces
 * at a time, in the order they go on, and a new step whenever the model gets a
 * layer taller. `maxPieces` is how many pieces one step may ask for.
 */
export function steps(model, { maxPieces = 2 } = {}) {
  const groups = [];
  let current = null;
  for (const piece of model.pieces) {
    const sameLayer = current && current.y === piece.y && current.section === piece.step;
    if (!current || !sameLayer || current.pieces.length >= maxPieces) {
      current = { y: piece.y, section: piece.step, pieces: [] };
      groups.push(current);
    }
    current.pieces.push(piece);
  }
  return groups.map((group, index) => {
    const counts = new Map();
    for (const piece of group.pieces) {
      const key = `${piece.partNum}:${piece.colorId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const parts = [...counts.entries()].map(([key, count]) => {
      const [partNum, colorId] = key.split(':');
      return { partNum, colorId: Number(colorId), count, elementId: PART_BY_NUM[partNum].elements?.[colorId] ?? null, name: pieceName(partNum, Number(colorId)) };
    });
    const words = parts.map(p => `${p.count} ${p.name}${p.count > 1 ? 's' : ''}`).join(' and ');
    const verb = PLACE_WORDS[index % PLACE_WORDS.length];
    const where = group.y === 0 ? ' on the baseplate' : '';
    return { number: index + 1, index: index + 1, pieces: group.pieces, parts, text: `${verb} ${words}${where}.` };
  });
}

/** A photo of the real piece where there is one, else a rendered picture of it. */
export function pieceImage(partNum, colorId, elementId = null) {
  return elementId
    ? `https://cdn.rebrickable.com/media/parts/elements/${elementId}.jpg`
    : `https://cdn.rebrickable.com/media/parts/ldraw/${colorId}/${partNum}.png`;
}

/** Everything a build screen needs, in one object. */
export function instructions(model) {
  const list = partsList(model);
  return {
    name: model.name,
    description: model.description,
    id: model.id,
    level: model.level,
    minutes: model.minutes,
    seed: model.seed,
    size: model.size,
    pieceCount: model.pieces.length,
    parts: list,
    steps: steps(model),
  };
}
