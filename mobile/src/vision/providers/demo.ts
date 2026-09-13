import { describePiece } from '../../catalog';
import type { DetectedPiece, VisionProvider } from '../types';

// Alex's demo pieces, as real LEGO elements. Every (part, color) pair here is
// verified against the catalog at startup: describePiece throws if LEGO never
// made that combination.
const DEMO_PIECES: [partNum: string, colorId: number, count: number][] = [
  ['3001', 1, 6],   // Blue Brick 2 x 4
  ['3003', 4, 8],   // Red Brick 2 x 2
  ['3020', 14, 6],  // Yellow Plate 2 x 4
  ['3039', 2, 4],   // Green Brick Sloped 45° 2 x 2
  ['6091', 15, 3],  // White Brick Curved 1 x 2 x 1 1/3
  ['6014b', 0, 4],  // Black Wheel 11 x 12
  ['3705', 0, 3],   // Black Technic Axle 4
];

export function demoPieces(): DetectedPiece[] {
  return DEMO_PIECES.map(([partNum, colorId, count]) => {
    const piece = describePiece(partNum, colorId);
    return {
      partNum,
      colorId,
      elementId: piece.elementId,
      color: piece.color,
      shape: piece.shape,
      name: piece.name,
      count,
      confidence: 1,
    };
  });
}

export const demoVisionProvider: VisionProvider = {
  id: 'demo',
  displayName: 'Algo demo scanner',
  async analyze() {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const pieces = demoPieces();
    return {
      pieces,
      totalPieces: pieces.reduce((sum, piece) => sum + piece.count, 0),
      providerId: 'demo',
      modelName: 'friendly-demo-data',
      processingLocation: 'demo',
    };
  },
};
