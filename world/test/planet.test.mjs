import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, planetRadius } from '../src/config.js';
import { faceUVToDirection, directionToFaceUV, columnOf, columnDirection, neighbourDirection, chunksAround, chunkOfDirection, chunkKey, normalize, tangentBasis } from '../src/planet.js';
import { mulberry32 } from '../src/noise.js';

const rand = mulberry32(7);
const randomDirection = () => normalize([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]);

test('face/uv ↔ direction round-trips on all six faces', () => {
  for (let n = 0; n < 5000; n += 1) {
    const d = randomDirection();
    const { face, u, v } = directionToFaceUV(d);
    assert.ok(face >= 0 && face < 6);
    assert.ok(u >= -1 - 1e-9 && u <= 1 + 1e-9, `u ${u}`);
    assert.ok(v >= -1 - 1e-9 && v <= 1 + 1e-9, `v ${v}`);
    const back = faceUVToDirection(face, u, v);
    for (let k = 0; k < 3; k += 1) assert.ok(Math.abs(back[k] - d[k]) < 1e-9);
  }
});

test('faceUVToDirection returns unit vectors and hits every face', () => {
  const seen = new Set();
  for (let face = 0; face < 6; face += 1) {
    const d = faceUVToDirection(face, 0.2, -0.4);
    assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-12);
    seen.add(directionToFaceUV(d).face);
  }
  assert.equal(seen.size, 6);
});

test('column of a column centre is that column', () => {
  const F = DEFAULT_CONFIG.faceResolution;
  for (let n = 0; n < 2000; n += 1) {
    const face = Math.floor(rand() * 6), i = Math.floor(rand() * F), j = Math.floor(rand() * F);
    const c = columnOf(columnDirection(face, i, j, F), F);
    assert.deepEqual(c, { face, i, j });
  }
});

test('stepping one column past a face edge lands on a neighbouring face, adjacent to the edge', () => {
  const F = DEFAULT_CONFIG.faceResolution;
  const d = neighbourDirection(4, F - 1, 100, 1, 0, F);   // east off the +Z face
  const c = columnOf(d, F);
  assert.notEqual(c.face, 4);
  assert.ok(c.i === 0 || c.i === F - 1 || c.j === 0 || c.j === F - 1, `edge column expected, got ${JSON.stringify(c)}`);
});

test('column width is about one block at the planet radius, everywhere', () => {
  const F = DEFAULT_CONFIG.faceResolution;
  const R = planetRadius(DEFAULT_CONFIG);
  let min = Infinity, max = 0;
  for (let n = 0; n < 3000; n += 1) {
    const { face, i, j } = columnOf(randomDirection(), F);
    const a = columnDirection(face, i, j, F), b = neighbourDirection(face, i, j, 1, 0, F);
    const width = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * R;
    min = Math.min(min, width); max = Math.max(max, width);
  }
  assert.ok(min > 0.7 && max < 1.3, `column width range ${min.toFixed(3)}..${max.toFixed(3)}`);
});

test('chunksAround covers the player chunk and about (2D+1)² chunks, wrapping across faces', () => {
  const cfg = DEFAULT_CONFIG;
  const here = randomDirection();
  const found = chunksAround(here, cfg);
  const mine = chunkOfDirection(here, cfg);
  assert.ok(found.has(chunkKey(mine.face, mine.cx, mine.cy)));
  const expected = (2 * cfg.renderDistance + 1) ** 2;
  assert.ok(found.size >= expected * 0.8 && found.size <= expected * 1.6, `found ${found.size} chunks, expected about ${expected}`);
  // At a cube corner three faces meet; the set must span more than one face.
  const corner = chunksAround(normalize([1, 1, 1]), cfg);
  const faces = new Set([...corner.values()].map(c => c.face));
  assert.equal(faces.size, 3);
});

test('tangentBasis is orthonormal', () => {
  for (let n = 0; n < 200; n += 1) {
    const up = randomDirection();
    const { east, north } = tangentBasis(up);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    assert.ok(Math.abs(dot(east, up)) < 1e-9 && Math.abs(dot(north, up)) < 1e-9 && Math.abs(dot(east, north)) < 1e-9);
    assert.ok(Math.abs(Math.hypot(...east) - 1) < 1e-9 && Math.abs(Math.hypot(...north) - 1) < 1e-9);
  }
});
