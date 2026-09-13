// Web Worker: turns one chunk address into instance data for the renderer.
// No three.js here; we emit raw column-major 4×4 matrices and linear RGB colors.
// Per column: the top solid block (studded), exposed side blocks down to the
// lowest neighbour (plain), a translucent water surface for sea columns, and an
// apple where one grows. Player edits arrive with the request.

import { createTerrain } from './terrain.js';
import { columnDirection, neighbourDirection, columnOf } from './planet.js';
import { MATERIAL, MATERIAL_RGB } from './materials.js';
import { planetRadius } from './config.js';
import { EditStore, columnKey, resolveColumn, hasApple } from './columns.js';

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
  const result = buildChunk(face, cx, cy, config, terrain, EditStore.fromJSON(data.edits), new Set(data.picked));
  const buffers = ['top', 'topColor', 'fill', 'fillColor', 'water', 'apples'].map(name => result[name].buffer);
  self.postMessage({ type: 'chunk', key, face, cx, cy, buildMs: performance.now() - t0, ...result }, buffers);
};

export function buildChunk(face, cx, cy, config, terrain, edits, picked) {
  const N = config.chunkSize;
  const F = config.faceResolution;
  const R = planetRadius(config);
  const { seaLevel } = config;
  const i0 = cx * N, j0 = cy * N;
  const top = [], fill = [], water = [], apples = [];
  const dir = [0, 0, 0], dirU = [0, 0, 0], dirV = [0, 0, 0], nd = [0, 0, 0];
  const cache = new Map();

  // Solid height of any column (this chunk or a neighbour), with edits applied.
  const solidAt = (f, i, j, d) => {
    const key = columnKey(f, i, j);
    let solid = cache.get(key);
    if (solid === undefined) {
      const natural = terrain.sample(d);
      const resolved = resolveColumn(natural, edits.get(key), seaLevel);
      solid = resolved.frozen ? seaLevel : resolved.h;
      cache.set(key, solid);
    }
    return solid;
  };

  const push = (list, k, material) => {
    const r = R + k + 0.5;
    list.push(
      (dirU[0] - dir[0]) * r, (dirU[1] - dir[1]) * r, (dirU[2] - dir[2]) * r, 0,
      dir[0], dir[1], dir[2], 0,
      (dir[0] - dirV[0]) * r, (dir[1] - dirV[1]) * r, (dir[2] - dirV[2]) * r, 0,
      dir[0] * r, dir[1] * r, dir[2] * r, 1,
      material,
    );
  };

  for (let j = 0; j < N; j += 1) {
    for (let i = 0; i < N; i += 1) {
      const ci = i0 + i, cj = j0 + j;
      const key = columnKey(face, ci, cj);
      columnDirection(face, ci, cj, F, dir);
      neighbourDirection(face, ci, cj, 1, 0, F, dirU);
      neighbourDirection(face, ci, cj, 0, 1, F, dirV);
      const natural = terrain.sample(dir);
      const edit = edits.get(key);
      const resolved = resolveColumn(natural, edit, seaLevel);
      const solid = resolved.frozen ? seaLevel : resolved.h;
      cache.set(key, solid);

      let lowest = solid;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        neighbourDirection(face, ci, cj, di, dj, F, nd);
        const c = columnOf(nd, F);
        lowest = Math.min(lowest, solidAt(c.face, c.i, c.j, nd));
      }

      push(top, solid - 1, resolved.frozen ? MATERIAL.ice : resolved.top);
      for (let k = solid - 2; k >= lowest; k -= 1) push(fill, k, resolved.layer(k));
      if (resolved.water && !resolved.frozen) push(water, seaLevel - 1, MATERIAL.water);
      if (!resolved.water && !edit && !picked.has(key) && hasApple(config.seed, face, ci, cj, natural)) push(apples, solid - 0.2, MATERIAL.water);
    }
  }

  const t = split(top), f = split(fill);
  return { top: t.matrices, topColor: t.colors, fill: f.matrices, fillColor: f.colors, water: split(water).matrices, apples: split(apples).matrices };
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
