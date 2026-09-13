// Web Worker: turns one chunk address into instance data for the renderer.
// No three.js here; we emit raw column-major 4×4 matrices and linear RGB colors.
// Each block is an affine image of the unit cube onto its exact cell on the
// sphere (edge vectors to the +u / +v neighbour centres), so blocks tile with no
// gaps even across cube-face edges.

import { createTerrain } from './terrain.js';
import { columnDirection, neighbourDirection } from './planet.js';
import { MATERIAL, MATERIAL_RGB } from './materials.js';
import { planetRadius } from './config.js';

let terrain = null;
let terrainSeed = null;

self.onmessage = ({ data }) => {
  if (data.type !== 'build') return;
  const { key, face, cx, cy, config } = data;
  if (!terrain || terrainSeed !== config.seed) {
    terrain = createTerrain(config);
    terrainSeed = config.seed;
  }
  const t0 = performance.now();
  const result = buildChunk(face, cx, cy, config, terrain, data.edits);
  self.postMessage(
    { type: 'chunk', key, face, cx, cy, buildMs: performance.now() - t0, ...result },
    [result.top.buffer, result.topColor.buffer, result.fill.buffer, result.fillColor.buffer, result.heights.buffer],
  );
};

function fillMaterial(surface, layersBelowTop) {
  if (surface === MATERIAL.sand) return MATERIAL.sand;
  if (surface === MATERIAL.snow) return layersBelowTop <= 2 ? MATERIAL.snow : MATERIAL.stone;
  if (surface === MATERIAL.stone || surface === MATERIAL.darkstone) return MATERIAL.stone;
  return layersBelowTop <= 3 ? MATERIAL.dirt : MATERIAL.stone;
}

export function buildChunk(face, cx, cy, config, terrain, edits = null) {
  const N = config.chunkSize;
  const F = config.faceResolution;
  const R = planetRadius(config);
  const i0 = cx * N, j0 = cy * N;
  const heights = new Float32Array(N * N);
  const top = [], fill = [];
  const dir = [0, 0, 0], dirU = [0, 0, 0], dirV = [0, 0, 0], nd = [0, 0, 0];

  const pushBlock = (list, k, material) => {
    const r = R + k + 0.5;
    list.push(
      (dirU[0] - dir[0]) * r, (dirU[1] - dir[1]) * r, (dirU[2] - dir[2]) * r, 0,   // x: east cell edge
      dir[0], dir[1], dir[2], 0,                                                     // y: up, one block tall
      (dir[0] - dirV[0]) * r, (dir[1] - dirV[1]) * r, (dir[2] - dirV[2]) * r, 0,   // z: south cell edge
      dir[0] * r, dir[1] * r, dir[2] * r, 1,                                         // translation: block centre
      material,
    );
  };

  for (let j = 0; j < N; j += 1) {
    for (let i = 0; i < N; i += 1) {
      const ci = i0 + i, cj = j0 + j;
      columnDirection(face, ci, cj, F, dir);
      neighbourDirection(face, ci, cj, 1, 0, F, dirU);
      neighbourDirection(face, ci, cj, 0, 1, F, dirV);
      const column = terrain.sample(dir);
      // Future: apply `edits` (player-placed/removed blocks) for this column here.
      const surface = column.water ? config.seaLevel : column.height;
      heights[j * N + i] = surface;

      let lowest = surface;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        neighbourDirection(face, ci, cj, di, dj, F, nd);
        lowest = Math.min(lowest, terrain.surfaceHeight(nd));
      }

      pushBlock(top, surface - 1, column.material);
      if (!column.water) {
        for (let k = surface - 2; k >= lowest; k -= 1) pushBlock(fill, k, fillMaterial(column.material, surface - 1 - k));
      }
    }
  }

  return { ...pack(top), ...packAs(fill, 'fill'), heights };
}

function pack(list) {
  const { matrices, colors } = split(list);
  return { top: matrices, topColor: colors };
}
function packAs(list, name) {
  const { matrices, colors } = split(list);
  return { [name]: matrices, [`${name}Color`]: colors };
}
function split(list) {
  const count = list.length / 17;
  const matrices = new Float32Array(count * 16);
  const colors = new Float32Array(count * 3);
  for (let n = 0; n < count; n += 1) {
    for (let e = 0; e < 16; e += 1) matrices[n * 16 + e] = list[n * 17 + e];
    const rgb = MATERIAL_RGB[list[n * 17 + 16]];
    colors[n * 3] = rgb[0]; colors[n * 3 + 1] = rgb[1]; colors[n * 3 + 2] = rgb[2];
  }
  return { matrices, colors };
}
