// Web Worker: turns one chunk address into instance data for the renderer.
// No three.js here; we emit raw column-major 4×4 matrices and linear RGB colors.
// Every block with an exposed face is drawn: for untouched ground that is the top
// block plus the side blocks down to the lowest neighbour; where the player has
// dug or built, every layer is checked. Water is a translucent sheet at sea level.

import { createTerrain } from './terrain.js';
import { columnDirection, neighbourDirection, columnOf } from './planet.js';
import { MATERIAL, MATERIAL_RGB, isTranslucent, isGlowing } from './materials.js';
import { planetRadius } from './config.js';
import { EditStore, columnKey, resolveColumn, hasApple, columnSeed } from './columns.js';

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
  const buffers = ['top', 'topColor', 'fill', 'fillColor', 'glass', 'glassColor', 'glow', 'glowColor', 'water', 'apples'].map(name => result[name].buffer);
  self.postMessage({ type: 'chunk', key, face, cx, cy, buildMs: performance.now() - t0, ...result }, buffers);
};

export function buildChunk(face, cx, cy, config, terrain, edits, picked) {
  const N = config.chunkSize;
  const F = config.faceResolution;
  const R = planetRadius(config);
  const { seaLevel } = config;
  const i0 = cx * N, j0 = cy * N;
  const top = [], fill = [], glass = [], glow = [], water = [], apples = [];
  const listFor = (m, plain) => (isTranslucent(m) ? glass : isGlowing(m) ? glow : plain);
  const dir = [0, 0, 0], dirU = [0, 0, 0], dirV = [0, 0, 0], nd = [0, 0, 0];
  const cache = new Map();

  // Resolved column (this chunk or a neighbour), with edits applied.
  const resolve = (f, i, j, d) => {
    const key = columnKey(f, i, j);
    let entry = cache.get(key);
    if (!entry) {
      const natural = terrain.sample(d);
      const edit = edits.get(key);
      // Buildings have air inside them, so village columns take the per-layer path like edited ones.
      entry = { resolved: resolveColumn(natural, edit, seaLevel, columnSeed(config.seed, f, i, j)), edited: Boolean(edit) || Boolean(natural.structure), natural, key };
      cache.set(key, entry);
    }
    return entry;
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
      columnDirection(face, ci, cj, F, dir);
      neighbourDirection(face, ci, cj, 1, 0, F, dirU);
      neighbourDirection(face, ci, cj, 0, 1, F, dirV);
      const here = resolve(face, ci, cj, dir);
      const col = here.resolved;

      const neighbours = [];
      let lowest = col.top, edited = here.edited;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        neighbourDirection(face, ci, cj, di, dj, F, nd);
        const c = columnOf(nd, F);
        const n = resolve(c.face, c.i, c.j, nd);
        neighbours.push(n.resolved);
        lowest = Math.min(lowest, n.resolved.top);
        edited = edited || n.edited;
      }

      if (!edited) {
        // Untouched ground: the top block, then the sides exposed by lower neighbours.
        if (col.top >= 0) {
          const topMaterial = col.frozen ? MATERIAL.ice : col.material(col.top);
          push(listFor(topMaterial, top), col.top, topMaterial);
          for (let k = col.top - 1; k > lowest; k -= 1) { const m = col.material(k); if (m !== null) push(listFor(m, fill), k, m); }
        }
      } else {
        // Somebody built or dug here: draw every block that has any face in the open.
        const highest = Math.max(col.top, ...neighbours.map(n => n.top));
        for (let k = 0; k <= highest; k += 1) {
          const m = col.material(k);
          if (m === null) continue;
          const exposed = !col.solid(k + 1) || (k > 0 && !col.solid(k - 1)) || neighbours.some(n => !n.solid(k));
          if (!exposed) continue;
          const studded = !col.solid(k + 1);
          push(listFor(m, studded ? top : fill), k, m);
        }
      }
      if (col.water) push(water, seaLevel - 1, MATERIAL.water);
      if (!col.water && !here.edited && !picked.has(here.key) && hasApple(config.seed, face, ci, cj, here.natural)) push(apples, col.top + 0.8, MATERIAL.water);
    }
  }

  const t = split(top), f = split(fill), g = split(glass), l = split(glow);
  return { top: t.matrices, topColor: t.colors, fill: f.matrices, fillColor: f.colors, glass: g.matrices, glassColor: g.colors, glow: l.matrices, glowColor: l.colors, water: split(water).matrices, apples: split(apples).matrices };
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
