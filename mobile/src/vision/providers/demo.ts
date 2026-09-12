import type { VisionProvider } from '../types';

export const demoVisionProvider: VisionProvider = {
  id: 'demo',
  displayName: 'Algo demo scanner',
  async analyze() {
    await new Promise(resolve => setTimeout(resolve, 1200));

    const pieces = [
      { color: 'blue', shape: 'brick', count: 6, name: '2 × 4 brick', confidence: 1 },
      { color: 'red', shape: 'short', count: 8, name: '2 × 2 brick', confidence: 1 },
      { color: 'yellow', shape: 'plate', count: 6, name: 'thin plate', confidence: 1 },
      { color: 'green', shape: 'slope', count: 4, name: 'slope', confidence: 1 },
      { color: 'white', shape: 'curve', count: 3, name: 'curved piece', confidence: 1 },
      { color: 'black', shape: 'wheel', count: 4, name: 'wheel', confidence: 1 },
      { color: 'gray', shape: 'axle', count: 3, name: 'axle', confidence: 1 },
    ] as const;

    return {
      pieces: pieces.map(piece => ({ ...piece })),
      totalPieces: pieces.reduce((sum, piece) => sum + piece.count, 0),
      providerId: 'demo',
      modelName: 'friendly-demo-data',
      processingLocation: 'demo',
    };
  },
};
