# Algo World

A round LEGO planet you can walk on, dig, build on, and survive on, in the
browser. Open `http://localhost:8000/world/` after `npm run web` from the repo
root (`npm install` once, for three.js), or tap **Explore Algo World** in the
Android app.

## Survival rules

| Rule | How it works | Where |
|---|---|---|
| One life | 10 hearts. At zero the game-over card shows why and your stats; **Try again** starts a fresh life on the same planet, keeping everything you built. | `rules.js`, `game.js`, `hud.js` |
| Drowning | Water is deep: you sink and swim (hold JUMP / Space to rise). 12 s of air, then 1.5 hearts/s. Jumping into water from a height is safe. At the surface, press JUMP to hop out; you can also haul yourself onto a shore up to 2 blocks high. | `player.js`, `rules.js` |
| Hunger | Drains from 100 to 0 in 8 minutes at rest, twice as fast when running. At zero you starve (0.5 hearts/s). Above 60 you slowly heal. | `rules.js` |
| Food | Apples grow on about 1 in 220 grass columns (LEGO red). Walk over one to pick it up; eat with F, the EAT button, or by selecting slot 8 and building. +35 hunger. You start with two. | `columns.js` (`hasApple`), `game.js` |
| Falling | Landing faster than 16 blocks/s (about a 5-block drop) costs 0.45 hearts per extra block/s. A jump clears a 2-block ledge, so a 2-deep hole is not a trap; deeper, dig steps. | `rules.js`, `player.js` |
| Dig | Click / E / DIG / tap removes the highlighted block and puts its material in your hotbar. Grass, then dirt, then stone; sand over stone on beaches. Under water you dig the sea floor (sand, then stone), from the surface or while swimming. Ice on the frozen sea gives an ice brick and leaves an open hole. Nothing below layer 2. Digging a beach column to sea level floods it. | `columns.js` (`EditStore`), `interact.js` |
| Build | Right-click / R / BUILD / hold a finger 0.45 s places the selected block on the column you are looking at (its top, or the column in front of a wall), on the sea floor under water, or on top of the ice. If the crosshair misses, the block right in front of your feet is the target. Build on the block you stand on and you rise with it. You start with a builder's chest: dirt, wood, planks, logs, leaves, glass, bricks, pink, purple, glowstone, 3 TNT, 2 apples. | same |
| Hotbar and block book | 9 slots (1–9 or tap), each holding any block. B, Tab, the BLOCKS button or tapping the preview opens the block book: every block with its count; tap one to put it in the selected slot. | `game.js` (`BLOCKS`, `DEFAULT_HOTBAR`), `hud.js` |
| Ores | Stone deep in the ground is one part in nine ore: coal anywhere, iron and emerald in the middle layers, gold, redstone, lapis, diamond and obsidian near bedrock (layer 6 and below). Digging an ore gives that block. Cliff faces show them. | `columns.js` (`oreAt`) |
| TNT | Place it, hit it to light the fuse, run: 3 s later a crater 2.5 blocks wide and up to 3 deep, 4 hearts of damage within 2 blocks, fading to none at 6. Other TNT in the crater chain-reacts. | `game.js` (`light`, `explode`), `world.js` (`blast`) |
| Save | Every 5 s and on leaving the page: planet edits, picked apples, position, camera, vitals, inventory, stats, in the browser's localStorage under the seed. Dying deletes the life, not the planet. `?reset=1` forgets everything. | `persistence.js` |

All numbers live in `RULES` in `rules.js`.

## Blocks

Every block is a LEGO color from Rebrickable's table (`materials.js`); LEGO makes
official Minecraft sets, so the mix is deliberate.

| Terrain | Building | Ores (mined) | Special |
|---|---|---|---|
| Grass, Dirt, Stone, Cobblestone, Sand, Snow, Ice | Planks, Log, Leaves, Bricks, Glass (see-through), Wood, Pink, Purple, Glowstone | Coal, Iron, Gold, Emerald, Redstone, Lapis, Diamond, Obsidian | TNT, Apple |

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
| Inventory hotbar, dig and build | done | `game.js`, `columns.js`, `interact.js`, `hud.js` |
| Survival: one life, drowning, hunger, apples, fall damage | done | `rules.js`, `game.js`, `player.js` |
| Save/load | done (localStorage) | `persistence.js` |
| Inside the Android app (WebView) | done | `mobile/src/world`, `App.tsx` |
| LOD | not yet; chunk frustum culling is on | phase 2 |

## Controls

Keyboard and mouse: `W A S D` / arrows walk, `Shift` run, `Space` jump or swim up,
drag to orbit, wheel to zoom, left click or `E` dig, right click or `R` build,
`1`–`8` pick a block, `F` eat. Touch: left joystick walks, drag elsewhere orbits,
pinch zooms, tap digs, long-press builds, and the `DIG` / `BUILD` / `EAT` / `JUMP`
buttons.

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

**Columns and edits.** `columns.js` answers "what is in this column now": the
natural terrain plus the player's `EditStore` entry `{ h, placed }`. Digging
lowers `h`; building adds `placed[k]`; layers without an entry take the natural
material for their depth. Both the worker and the main thread use the same
function, so what you collide with is what you see.

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

**Rendering.** Up to four `InstancedMesh` per chunk (studded top blocks, plain
fill blocks, a translucent water sheet at sea level, apples) sharing two geometries and one `MeshStandardMaterial`; colors are per
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

Run `npm test` for the 29 world tests (columns/edits, survival rules, planet round-trips, face wrapping, column width uniformity, chunk coverage, noise
determinism, height bounds, ocean fraction, biome placement, spawn validity).

## Extension points (interfaces to add later, not implemented)

- `EditStore` (`columns.js`): the planet's diff. Trees, explosions and structures
  should write here too, so persistence and rendering pick them up for free.
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
