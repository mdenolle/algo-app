// World configuration. Everything that shapes the planet lives here so the
// worker, the main thread and the tests agree. Override via URL params in main.js.

const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;

export const DEFAULT_CONFIG = Object.freeze({
  seed: 20260912,
  // Columns along one cube-face edge. Circumference ≈ 4 × faceResolution blocks.
  faceResolution: 512,
  // Columns along one chunk edge. 16 → 256 columns per chunk.
  chunkSize: 16,
  // Chunks kept loaded in each tangent direction around the player (Chebyshev).
  renderDistance: 6,
  // Block layers. Columns at or below this are ocean; the water surface sits here.
  seaLevel: 12,
  maxHeight: 44,
  workerCount: Math.max(1, Math.min(4, cores - 1)),
});

/** Radius (in blocks) at which one column is one block wide: R = 2F/π. */
export function planetRadius(config) {
  return (2 * config.faceResolution) / Math.PI;
}

export function withOverrides(config, overrides) {
  const next = { ...config };
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in config) || value === undefined || value === null || value === '') continue;
    next[key] = typeof config[key] === 'number' ? Number(value) : value;
  }
  return Object.freeze(next);
}
