// TerrainGenerator + (first-cut) BiomeGenerator. Pure function of a unit
// direction, so the worker, the main thread (player collision) and the tests all
// see exactly the same planet for a seed. Layers:
//   continent  low-frequency fbm      → where land is (most of the sphere is ocean)
//   hills      mid-frequency fbm      → rolling hills
//   detail     high-frequency fbm     → small bumps, beach dither
//   ridge      ridged multifractal    → cliffs inland
//   cold       latitude + noise       → plains ↔ ice biome, blended over a band
// Rivers, lakes, islands-by-design and villages are later phases (see README).

import { createNoise } from './noise.js';
import { MATERIAL } from './materials.js';
import { tangentBasis, normalize } from './planet.js';

const LAND_THRESHOLD = 0.06;
const COLD_START = 0.64;
const COLD_FULL = 0.78;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function createTerrain(config) {
  const noise = createNoise(config.seed);
  const { seaLevel, maxHeight } = config;
  const maxLand = maxHeight - seaLevel;

  /** Everything about one column: height in blocks above the planet radius, surface material, water flag. */
  function sample(d) {
    const x = d[0], y = d[1], z = d[2];
    const continent = noise.fbm(x * 1.6 + 11.3, y * 1.6 - 4.2, z * 1.6 + 7.7, 5);
    const hills = noise.fbm(x * 7 + 3.1, y * 7 + 9.4, z * 7 - 2.5, 4, 2.1);
    const detail = noise.fbm(x * 22 - 5, y * 22 + 1, z * 22 + 13, 3);
    const ridge = noise.ridged(x * 3.4 + 21, y * 3.4 - 8, z * 3.4 + 2, 3);
    const cold = clamp(Math.abs(y) + 0.16 * noise.fbm(x * 2.5 - 7, y * 2.5 + 3, z * 2.5 + 5, 3), 0, 1.2);
    const landness = continent + 0.22 * hills;

    if (landness <= LAND_THRESHOLD) {
      const depth = clamp(Math.round((LAND_THRESHOLD - landness) * 40), 1, seaLevel - 2);
      const frozen = cold > COLD_FULL + 0.04;
      return { height: seaLevel - depth, material: frozen ? MATERIAL.ice : MATERIAL.water, water: true, cold, landness };
    }

    const inland = smoothstep(LAND_THRESHOLD, LAND_THRESHOLD + 0.35, landness);
    let elevation = 1 + inland * 16 + hills * 5 * inland + detail * 1.5;
    if (ridge > 0.72) elevation += ((ridge - 0.72) / 0.28) * 12 * inland;   // cliffs
    const above = clamp(Math.round(elevation), 1, maxLand);
    const height = seaLevel + above;

    let material = MATERIAL.grass;
    if (above <= 2) material = MATERIAL.sand;                                  // beaches
    if (ridge > 0.82 && inland > 0.3) material = MATERIAL.stone;              // cliff tops
    if (above >= 18) material = MATERIAL.stone;
    if (above >= 24) material = MATERIAL.snow;                                // snow caps
    // Ice biome, blended over a band with a noise dither so the edge is ragged, not a line.
    const snowy = cold >= COLD_FULL || (cold > COLD_START && cold + 0.08 * detail > (COLD_START + COLD_FULL) / 2);
    if (snowy && material !== MATERIAL.stone) material = MATERIAL.snow;
    if (snowy && material === MATERIAL.stone && above < 18) material = MATERIAL.darkstone;

    return { height, material, water: false, cold, landness };
  }

  /** Radial height (blocks above planet radius) a walker stands on. Water is walkable for now; boats later. */
  function surfaceHeight(d) {
    const column = sample(d);
    return column.water ? seaLevel : column.height;
  }

  /** Nearest grassy land to a preferred direction, searched on an outward square spiral. */
  function findSpawn(preferred = [0.3, 0.2, 1], maxSteps = 400) {
    const start = normalize([...preferred]);
    const { east, north } = tangentBasis(start);
    const radius = (2 * config.faceResolution) / Math.PI;
    const point = [0, 0, 0];
    const at = (a, b, out) => {
      out[0] = start[0] * radius + east[0] * a + north[0] * b;
      out[1] = start[1] * radius + east[1] * a + north[1] * b;
      out[2] = start[2] * radius + east[2] * a + north[2] * b;
      return normalize(out);
    };
    const probe = [0, 0, 0];
    // Grass, above the beach, and flat for ~5 blocks around so the camera has room.
    const tryPoint = (a, b) => {
      at(a, b, point);
      const column = sample(point);
      if (column.water || column.material !== MATERIAL.grass || column.height < seaLevel + 3) return null;
      for (let da = -5; da <= 5; da += 5) {
        for (let db = -5; db <= 5; db += 5) {
          const near = sample(at(a + da, b + db, probe));
          if (near.water || Math.abs(near.height - column.height) > 1) return null;
        }
      }
      return [...point];
    };
    let hit = tryPoint(0, 0);
    if (hit) return hit;
    for (let ring = 1; ring < maxSteps; ring += 1) {
      const r = ring * 3;
      for (let k = -r; k <= r; k += 3) {
        hit = tryPoint(k, -r) || tryPoint(k, r) || tryPoint(-r, k) || tryPoint(r, k);
        if (hit) return hit;
      }
    }
    return start;
  }

  return { sample, surfaceHeight, findSpawn, seaLevel };
}
