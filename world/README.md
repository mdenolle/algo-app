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
| Falling | Landing faster than 15 blocks/s (about a 4-block drop) costs 0.9 hearts per extra block/s: a 12-block fall is fatal. CRAWL (C, or the button) halves your speed and stops you walking off an edge. A jump clears a 2-block ledge. | `rules.js`, `player.js` |
| Lava | Pockets at the very bottom of the world (layer 3 and below) and a placeable block. Standing on it: 2.5 hearts/s, and you keep burning 3 s after. Glows in the dark. | `rules.js`, `columns.js` (`oreAt`) |
| Day and night | A day is 6 minutes (`DAY_LENGTH`): about 3½ of light, 2½ of night. The sun circles the planet; glowstone and lava shine at night. | `renderer.js` (`setTime`), `game.js` |
| Animals | Sheep, pig, cow, chicken wander the grass (up to 8 nearby). Hit one (dig) 1–3 times and it drops meat (+30 hunger). | `mobs.js` |
| Zombies | Mostly at night (5 nearby; 1 by day). Ice zombie (cold places; its hit freezes you to half speed for 3 s), fire zombie (sets you burning), water zombie (in the sea), electric zombie (zaps ½ heart from 4 blocks), and the Everything Zombie (changes colour and mind every 2 s: chases, sprints, flees, hops, spins, naps, teleports behind you). 4 hits to beat one (6 for the Everything Zombie); they drop ice, redstone, lapis, gold, diamond. They are slower than you. | `mobs.js` |
| Break | Hold the mouse button or your finger on the block (keep holding to mine), or right-click, or E / DIG at the crosshair. The block goes into your hotbar. Any block, at any height: dig a tunnel, a cave, a hole in a wall; the blocks above stay where they are. Grass, then dirt, then stone; sand over stone on beaches. Under water you dig the sea floor. Ice on the frozen sea gives an ice brick and opens the water. Nothing below layer 2. Digging a beach column to sea level floods it. | `columns.js` (`EditStore.digAt`), `interact.js` |
| Build | Click or tap a spot (or R / BUILD for the crosshair). The selected block appears in the empty cell you pointed at: on top of a block, sideways against a wall, under an overhang, in the air on the end of a bridge. Not inside yourself. Build under your own feet and you rise with it. You start with a builder's chest: dirt, wood, planks, logs, leaves, glass, bricks, pink, purple, cyan, magenta, terracotta, cactus, pumpkin, glowstone, 2 lava, 3 TNT, 2 apples. | `columns.js` (`EditStore.placeAt`), `interact.js` |
| Hardness and tools | Every block has hit points: dirt, sand, leaves, glass 1; planks, ice, wood 2; bricks, terracotta 3; stone and coal 3 and need a pickaxe; iron, gold, lapis, redstone, emerald 4 and need a stone pickaxe; diamond 5 needs iron; obsidian 8 needs diamond. Hands do 1 point per hit, pickaxes 2/3/4/6 by tier. The outline turns orange then red as a block cracks. Swords hit zombies for 2/3/4/6 instead of 1. Made in the block book: planks from wood or logs, pickaxes and swords from planks plus stone, iron or diamond. You start with a wooden pickaxe and a wooden sword. | `materials.js` (`HARDNESS`), `tools.js` |
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
| Grass, Dirt, Stone, Cobblestone, Sand, Snow, Ice | Planks, Log, Leaves, Bricks, Glass (see-through), Wood, Pink, Purple, Cyan, Magenta, Terracotta, Cactus, Pumpkin, Glowstone (glows) | Coal, Iron, Gold, Emerald, Redstone, Lapis, Diamond, Obsidian | TNT, Lava (glows, burns), Apple, Meat |

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

Same on laptop and phone: **click or tap builds** the selected block in the cell under
the pointer (on a zombie: hits it); **hold breaks** the block under the pointer and keeps
mining while held; right-click breaks too. Keyboard: `W A S D` / arrows walk, `Shift` run,
`C` crawl, `Space` jump or swim up, drag to orbit, wheel to zoom, `E` (hold to mine) / `R`
break / build at the crosshair, `1`–`9` pick, `B` block book and tools, `F` eat, Escape menu.
Touch: left joystick walks, drag elsewhere orbits, pinch zooms, and the `DIG` (hold to
mine) / `BUILD` / `EAT` / `CRAWL` / `JUMP` (`SWIM` in water) / `BLOCKS` buttons act on
the crosshair.

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

**Columns and edits.** `columns.js` answers "what is at layer k of this column
now": the natural terrain (a height map: solid from layer 0 to height−1, with
ores in the stone) plus the player's `EditStore` entry `{ placed: {k: material},
removed: [k…], thawed }`. A placed block can sit anywhere and a removed one leaves
a hole, so the world is a real block world with tunnels, bridges and overhangs.
`resolveColumn` gives `solid(k)`, `material(k)` and the top; the player, the mobs
and the worker all use it, so what you collide with is what you see. Collision is
`World.walkInto` (headroom for the body, one-block steps), `floorRadius` and
`ceilingRadius`. Old height-map saves convert on load.

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

**Rendering.** Up to six `InstancedMesh` per chunk (studded blocks with open sky
above, plain blocks, glass, glowing blocks, a translucent water sheet at sea level,
apples). Untouched ground draws the top block and the sides exposed by lower
neighbours; where someone dug or built, every layer is checked for an exposed face sharing two geometries and one `MeshStandardMaterial`; colors are per
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
