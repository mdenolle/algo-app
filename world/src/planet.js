// PlanetGenerator geometry: a cube-sphere. Six cube faces, each a grid of
// faceResolution × faceResolution columns, projected onto the unit sphere with a
// tangent warp so columns are close to the same size everywhere. Every column is
// addressed by (face, i, j); every chunk by (face, cx, cy). No face-neighbour
// tables: to find what lies "east of here" we step in the tangent plane and
// re-project, which wraps across face edges for free.

const QUARTER_PI = Math.PI / 4;

export const FACE_COUNT = 6;

export const warp = t => Math.tan(t * QUARTER_PI);
export const unwarp = w => Math.atan(w) / QUARTER_PI;

/** Point on the cube surface for face and *warped* coordinates (u, v) ∈ [-1, 1]. */
export function cubePoint(face, u, v, out = [0, 0, 0]) {
  switch (face) {
    case 0: out[0] = 1; out[1] = v; out[2] = -u; break;   // +X
    case 1: out[0] = -1; out[1] = v; out[2] = u; break;   // -X
    case 2: out[0] = u; out[1] = 1; out[2] = -v; break;   // +Y (north pole)
    case 3: out[0] = u; out[1] = -1; out[2] = v; break;   // -Y (south pole)
    case 4: out[0] = u; out[1] = v; out[2] = 1; break;    // +Z
    default: out[0] = -u; out[1] = v; out[2] = -1;        // -Z
  }
  return out;
}

export function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= len; v[1] /= len; v[2] /= len;
  return v;
}

/** Unit direction for face and *unwarped* (u, v). Works slightly outside [-1, 1] too. */
export function faceUVToDirection(face, u, v, out = [0, 0, 0]) {
  cubePoint(face, warp(u), warp(v), out);
  return normalize(out);
}

/** Inverse of faceUVToDirection: which face owns this direction, and where on it. */
export function directionToFaceUV(d) {
  const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]);
  let face, u, v;
  if (ax >= ay && ax >= az) {
    const inv = 1 / ax;
    if (d[0] > 0) { face = 0; v = d[1] * inv; u = -d[2] * inv; }
    else { face = 1; v = d[1] * inv; u = d[2] * inv; }
  } else if (ay >= az) {
    const inv = 1 / ay;
    if (d[1] > 0) { face = 2; u = d[0] * inv; v = -d[2] * inv; }
    else { face = 3; u = d[0] * inv; v = d[2] * inv; }
  } else {
    const inv = 1 / az;
    if (d[2] > 0) { face = 4; u = d[0] * inv; v = d[1] * inv; }
    else { face = 5; u = -d[0] * inv; v = d[1] * inv; }
  }
  return { face, u: unwarp(u), v: unwarp(v) };
}

// ---- columns -------------------------------------------------------------

export function columnIndex(t, faceResolution) {
  const i = Math.floor(((t + 1) / 2) * faceResolution);
  return Math.min(faceResolution - 1, Math.max(0, i));
}

export function columnCenter(i, faceResolution) {
  return ((i + 0.5) / faceResolution) * 2 - 1;
}

export function columnOf(direction, faceResolution) {
  const { face, u, v } = directionToFaceUV(direction);
  return { face, i: columnIndex(u, faceResolution), j: columnIndex(v, faceResolution) };
}

export function columnDirection(face, i, j, faceResolution, out = [0, 0, 0]) {
  return faceUVToDirection(face, columnCenter(i, faceResolution), columnCenter(j, faceResolution), out);
}

/** Direction of the column `di, dj` steps away, wrapping across face edges. */
export function neighbourDirection(face, i, j, di, dj, faceResolution, out = [0, 0, 0]) {
  const step = 2 / faceResolution;
  return faceUVToDirection(face, columnCenter(i, faceResolution) + di * step, columnCenter(j, faceResolution) + dj * step, out);
}

// ---- chunks --------------------------------------------------------------

export function chunkKey(face, cx, cy) {
  return `${face}:${cx}:${cy}`;
}

export function parseChunkKey(key) {
  const [face, cx, cy] = key.split(':').map(Number);
  return { face, cx, cy };
}

export function chunkOfColumn(face, i, j, chunkSize) {
  return { face, cx: Math.floor(i / chunkSize), cy: Math.floor(j / chunkSize) };
}

export function chunkOfDirection(direction, config) {
  const column = columnOf(direction, config.faceResolution);
  return chunkOfColumn(column.face, column.i, column.j, config.chunkSize);
}

/** Any orthonormal (east, north) pair perpendicular to `up`. */
export function tangentBasis(up) {
  const helper = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const east = normalize([
    helper[1] * up[2] - helper[2] * up[1],
    helper[2] * up[0] - helper[0] * up[2],
    helper[0] * up[1] - helper[1] * up[0],
  ]);
  const north = [
    up[1] * east[2] - up[2] * east[1],
    up[2] * east[0] - up[0] * east[2],
    up[0] * east[1] - up[1] * east[0],
  ];
  return { east, north };
}

/**
 * Chunks that should be loaded around a direction: sample the tangent plane at
 * half-chunk steps out to renderDistance chunks and collect the chunk under each
 * sample. Returns Map<key, { face, cx, cy, distance }> with distance in chunks.
 */
export function chunksAround(direction, config, radius = planetRadiusFor(config)) {
  const { east, north } = tangentBasis(direction);
  const step = config.chunkSize / 2;
  const reach = config.renderDistance * config.chunkSize;
  const found = new Map();
  const point = [0, 0, 0];
  for (let a = -reach; a <= reach; a += step) {
    for (let b = -reach; b <= reach; b += step) {
      point[0] = direction[0] * radius + east[0] * a + north[0] * b;
      point[1] = direction[1] * radius + east[1] * a + north[1] * b;
      point[2] = direction[2] * radius + east[2] * a + north[2] * b;
      normalize(point);
      const chunk = chunkOfDirection(point, config);
      const key = chunkKey(chunk.face, chunk.cx, chunk.cy);
      const distance = Math.hypot(a, b) / config.chunkSize;
      const existing = found.get(key);
      if (!existing || distance < existing.distance) found.set(key, { ...chunk, distance });
    }
  }
  return found;
}

function planetRadiusFor(config) {
  return (2 * config.faceResolution) / Math.PI;
}

/** Latitude/longitude in degrees for the HUD. Poles are ±Y. */
export function latLon(direction) {
  const lat = (Math.asin(Math.max(-1, Math.min(1, direction[1]))) * 180) / Math.PI;
  const lon = (Math.atan2(direction[0], direction[2]) * 180) / Math.PI;
  return { lat, lon };
}
