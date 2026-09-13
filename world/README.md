# Algo World

A round LEGO planet you can walk on, in the browser. Prototype V1 of the LEGO
survival world. Open `http://localhost:8000/world/` after `npm run web` from the
repo root (`npm install` once, for three.js).

## What V1 does

| Deliverable | Status | Where |
|---|---|---|
| Spherical planet, gravity to the centre, natural horizon | done | `src/planet.js`, `src/player.js` |
| Chunk streaming: async generation in workers, nearest-first, unload with hysteresis | done | `src/chunks.js`, `src/chunk-worker.js` |
| Procedural terrain: continents, rolling hills, cliffs, beaches | done | `src/terrain.js`, `src/noise.js` |
| Biomes: plains, ice (blended band with dither), ocean | done | `src/terrain.js` |
| LEGO rendering: studs, sharp edges, glossy plastic, official LEGO colors, instancing | done | `src/renderer.js`, `src/materials.js` |
| Third-person camera: orbit, zoom, smoothing, terrain collision | done | `src/camera.js` |
| Touch controls: joystick, drag to look, pinch zoom, jump button | done (in a phone browser) | `src/input.js` |
| Rivers, lakes, the two survival islands, waterfall, forest | not yet | phase 2 |
| Village | not yet | phase 2 |
| Inventory hotbar | not yet | phase 3 |
| Save/load | not yet (edit map already flows through `ChunkManager.edits`) | phase 3 |
| Inside the Android app (WebView) | not yet; works in Chrome on the phone today | phase 3 |
| LOD | not yet; chunk frustum culling is on | phase 2 |

## Controls

Keyboard: `W A S D` / arrows walk, `Shift` run, `Space` jump, drag with the mouse
to orbit, wheel to zoom. Touch: left joystick walks, drag elsewhere orbits, pinch
zooms, `JUMP` button.

URL parameters: `?seed=42` new planet, `?distance=4` fewer chunks (phones),
`?size=768` bigger planet (columns per cube-face edge; radius = 2·size/π).

## How it works

**Planet.** A cube-sphere: six faces, each `faceResolution²` columns, projected
onto the unit sphere through a tangent warp (`planet.js`). A column is
`(face, i, j)`; a chunk is `(face, cx, cy)` with `chunkSize²` columns. "What is
next to this column" is answered by stepping in the face's parameter space and
re-projecting, so face edges need no special tables. With the default 512
columns per edge the radius is 326 blocks and the horizon is about 57 blocks away
at eye height.

**Terrain.** A pure function of the unit direction (`terrain.js`): layered seeded
simplex noise for continents, hills, detail and ridged cliffs; latitude plus
noise for the plains↔ice band; anything under sea level is ocean. Because it is
a function, the worker, the main thread (player collision) and the tests see the
same planet for a seed. Only the top block and the exposed side blocks of each
column are emitted, so there are no floating blocks and no impossible overhangs.

**Chunks.** `ChunkManager` samples the tangent plane around the player at
half-chunk steps out to `renderDistance` chunks, collects the chunk under each
sample (this wraps across faces), queues missing ones nearest-first, and sends
them to a pool of module workers. Each worker returns instance matrices and
colors as transferable typed arrays. Chunks farther than `renderDistance + 1`
are dropped.

**Rendering.** Two `InstancedMesh` per chunk (studded top blocks, plain fill
blocks) sharing two geometries and one `MeshStandardMaterial`; colors are per
instance. Each block's matrix maps the unit cube onto its exact cell on the
sphere (edge vectors to the neighbouring column centres), so blocks tile with no
gaps even where the cube faces meet. Fog matches the sky so streaming happens
out of sight.

**Player and camera.** Up is the position direction. The heading frame is
parallel-transported every frame, so turning is continuous everywhere on the
sphere. Movement is camera-relative; a step of one block is walked up, two or
more is a wall. The camera orbits the player, ray-marches toward its desired
spot and stops before terrain, then eases exponentially.

## Numbers (measured 2026-09-12, headless Chrome with software WebGL, so FPS is a floor)

| Metric | Value |
|---|---|
| Chunk build time in worker | 1.7 ms average, 6 ms max |
| Chunks loaded at render distance 6 | 148–186 |
| Blocks (instances) on screen | 32k–48k |
| Draw calls | 79–109 |
| Triangles | 0.9–1.3 M |
| FPS, software renderer | 22–27 |

Run `npm test` for the 14 world tests (planet round-trips, face wrapping, column
width uniformity, chunk coverage, noise determinism, height bounds, ocean
fraction, biome placement, spawn validity).

## Extension points (interfaces to add later, not implemented)

- `ChunkManager.edits`: per-chunk block modifications; sent with every build
  request. Building/breaking writes here; persistence saves this map plus
  `player.position`, `config.seed`, camera yaw/pitch/distance and the inventory.
- `terrain.sample(direction)`: add rivers/lakes as a carve pass on the height,
  villages and structures as a placement pass keyed on the column.
- `materials.js`: add wood/leaves for trees; trees should be emitted as extra
  instances per chunk by the worker.
- `Renderer.addChunk`: swap the plain geometry for a studless low-poly one on
  far chunks to add LOD.
- `window.algoWorld` exposes config, terrain, chunks, renderer, player and
  camera for the console.

## Scale note

Terrain blocks are 1 unit cubes with one stud; the minifigure is 2.4 units tall,
so blocks read as 2×2 bricks. Real LEGO geometry (1.2 height ratio, four studs)
can come with the building system.
