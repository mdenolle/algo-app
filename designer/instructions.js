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
    const row = rows.get(key) ?? { partNum: piece.partNum, colorId: piece.colorId, count: 0, part: PART_BY_NUM[piece.partNum], color: COLOR_BY_ID[piece.colorId], name: pieceName(piece.partNum, piece.colorId) };
    row.count += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.partNum.localeCompare(b.partNum));
}

const PLACE_WORDS = ['Put', 'Add', 'Place', 'Snap on', 'Press on'];

/** The build in numbered steps: which pieces go on, and a sentence to read out. */
export function steps(model) {
  const byStep = new Map();
  for (const piece of model.pieces) {
    const list = byStep.get(piece.step) ?? [];
    list.push(piece);
    byStep.set(piece.step, list);
  }
  return [...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([number, pieces], index) => {
    const counts = new Map();
    for (const piece of pieces) {
      const key = `${piece.partNum}:${piece.colorId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const parts = [...counts.entries()].map(([key, count]) => {
      const [partNum, colorId] = key.split(':');
      return { partNum, colorId: Number(colorId), count, name: pieceName(partNum, Number(colorId)) };
    });
    const words = parts.map(p => `${p.count} ${p.name}${p.count > 1 ? 's' : ''}`).join(' and ');
    const verb = PLACE_WORDS[index % PLACE_WORDS.length];
    return { number, index: index + 1, pieces, parts, text: `${verb} ${words}.` };
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
