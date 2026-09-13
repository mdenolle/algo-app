import { catalog } from './catalog.generated';
import type { CatalogColor, CatalogPart, KidColor, PartFamily } from './types';

export { catalog };
export * from './types';

const partIndex = new Map(catalog.parts.map(part => [part.partNum, part]));
const colorIndex = new Map(catalog.colors.map(color => [color.id, color]));
const colorByKid = new Map(catalog.colors.map(color => [color.kid, color]));

export function getPart(partNum: string): CatalogPart {
  const part = partIndex.get(partNum);
  if (!part) throw new Error(`Part ${partNum} is not in the Algo catalog. Add it to catalog/curated.json and rebuild.`);
  return part;
}

export function getColor(colorId: number): CatalogColor {
  const color = colorIndex.get(colorId);
  if (!color) throw new Error(`Color ${colorId} is not in the Algo palette.`);
  return color;
}

export function colorForKid(kid: KidColor): CatalogColor {
  const color = colorByKid.get(kid);
  if (!color) throw new Error(`Kid color "${kid}" is not in the Algo palette.`);
  return color;
}

/** LEGO element id for a part in a color, or undefined if LEGO never made that combination. */
export function elementFor(partNum: string, colorId: number): string | undefined {
  return getPart(partNum).elements[String(colorId)];
}

export function isVerified(partNum: string, colorId: number): boolean {
  return elementFor(partNum, colorId) !== undefined;
}

export function partsInFamily(family: PartFamily): CatalogPart[] {
  return catalog.parts.filter(part => part.family === family);
}

/** Hex color for drawing. Pure white is tinted so studs stay visible on the app's white cards. */
export function displayHex(colorId: number): string {
  const color = getColor(colorId);
  return color.rgb === 'FFFFFF' ? '#DDE7EF' : `#${color.rgb}`;
}

/** A piece the UI can draw and Algo can name: catalog-backed, with the kid-facing fields derived. */
export type CatalogPiece = {
  partNum: string;
  colorId: number;
  elementId?: string;
  name: string;
  officialName: string;
  color: KidColor;
  shape: PartFamily;
  hex: string;
};

export function describePiece(partNum: string, colorId: number): CatalogPiece {
  const part = getPart(partNum);
  const color = getColor(colorId);
  const elementId = part.elements[String(colorId)];
  if (!elementId) {
    throw new Error(`LEGO never made ${part.name} (${partNum}) in ${color.name}. Pick one of: ${part.colors.join(', ')}.`);
  }
  return {
    partNum,
    colorId,
    elementId,
    name: `${color.kid} ${part.kidName}`,
    officialName: `${color.name} ${part.name}`,
    color: color.kid,
    shape: part.family,
    hex: displayHex(colorId),
  };
}

/** Spoken/label form, e.g. "6 blue 2 × 4 bricks (3001)". */
export function labelPiece(piece: { partNum: string; colorId: number; count?: number }): string {
  const described = describePiece(piece.partNum, piece.colorId);
  const count = piece.count ?? 1;
  return `${count} ${described.name}${count === 1 ? '' : 's'} (${piece.partNum})`;
}
