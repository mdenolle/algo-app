// Entry point: wires World (planet + terrain + edits), ChunkManager, Renderer,
// PlayerController, CameraController, Input, Game (survival rules), Hud and
// persistence into one game loop.
// URL params: ?seed=123  ?distance=5 (chunks)  ?size=768 (columns per face edge)  ?reset=1 (forget the save)

import * as THREE from 'three';
import { DEFAULT_CONFIG, withOverrides } from './config.js';
import { World } from './world.js';
import { ChunkManager } from './chunks.js';
import { Renderer, createMinifig } from './renderer.js';
import { PlayerController } from './player.js';
import { CameraController } from './camera.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { RULES } from './rules.js';
import { findTarget, findTargetOnScreen, highlightMatrix, targetInFront, screenRay } from './interact.js';
import { MobManager } from './mobs.js';
import * as persistence from './persistence.js';
import { say } from './voice.js';
import { chunkOfDirection, chunkKey, latLon, normalize } from './planet.js';
import { MATERIALS } from './materials.js';

const params = new URLSearchParams(location.search);
// The planet you last chose ("New planet") is remembered; ?seed= in the address wins.
const SEED_KEY = 'algo-world:seed';
const rememberedSeed = (() => { try { return localStorage.getItem(SEED_KEY); } catch { return null; } })();
const config = withOverrides(DEFAULT_CONFIG, {
  seed: params.get('seed') ?? rememberedSeed,
  renderDistance: params.get('distance'),
  faceResolution: params.get('size'),
});
if (params.has('reset')) persistence.clear(config.seed);
const saved = persistence.load(config.seed);

/** Reload this page keeping the display options (embedded, distance, size) but not seed/reset. */
function reloadWorld(extra = {}) {
  const next = new URLSearchParams();
  for (const key of ['embedded', 'distance', 'size']) if (params.has(key)) next.set(key, params.get(key));
  for (const [k, v] of Object.entries(extra)) next.set(k, v);
  const query = next.toString();
  location.href = location.pathname + (query ? `?${query}` : '');
}

const canvas = document.querySelector('#world');
const hudEl = document.querySelector('#hud');
const loading = document.querySelector('#loading');
if (params.has('embedded')) document.querySelector('#title').hidden = true;

const world = new World(config, saved?.world);
const spawn = world.terrain.findSpawn();
const renderer = new Renderer(canvas, config);
const chunks = new ChunkManager(config, {
  onChunkReady: (key, data) => renderer.addChunk(key, data),
  onChunkRemove: key => renderer.removeChunk(key),
  getEdits: (face, cx, cy) => world.editsFor(face, cx, cy),
});
const player = new PlayerController(world, spawn);
const minifig = createMinifig();
renderer.scene.add(minifig);
const cameraController = new CameraController(renderer.camera, player);
const input = new Input(canvas, {
  joystick: document.querySelector('#joystick'),
  knob: document.querySelector('#knob'),
  jumpButton: document.querySelector('#jump'),
  digButton: document.querySelector('#dig'),
  buildButton: document.querySelector('#build'),
  eatButton: document.querySelector('#eat'),
  blocksButton: document.querySelector('#blocks'),
  preview: document.querySelector('#preview'),
  crawlButton: document.querySelector('#crawl'),
});
const game = new Game(world, player, chunks, renderer, saved?.life ? restoreLife(saved.life) : null);
const mobs = new MobManager(world, player, game, renderer.scene);
const hud = new Hud(document, {
  onPlay: () => { game.started = true; hud.hideOverlays(); say('Welcome to Algo World! Let’s explore!', 'world-welcome'); },
  onRetry: () => { game.newLife(world.terrain.findSpawn()); mobs.clear(); game.started = true; cameraController.initialised = false; hud.hideOverlays(); persistence.save(config.seed, world, game, cameraController); },
  onSelect: index => game.select(index),
  onAssign: key => game.assign(key),
  onMake: recipe => game.make(recipe),
  onRestart: () => { persistence.clear(config.seed); reloadWorld({ reset: 1 }); },
  onNewPlanet: () => {
    const seed = Math.floor(1000 + Math.random() * 9_000_000);
    try { localStorage.setItem(SEED_KEY, String(seed)); } catch { /* private mode: the seed lasts for this visit */ }
    reloadWorld({ seed });
  },
  seed: config.seed,
});

function restoreLife(life) {
  player.position.fromArray(life.position);
  player.up.copy(player.position).normalize();
  if (life.forward) player.forward.fromArray(life.forward);
  player.facing.copy(player.forward);
  if (life.camera) { cameraController.yaw = life.camera.yaw; cameraController.pitch = life.camera.pitch; cameraController.distance = life.camera.distance; }
  return { vitals: life.vitals, inventory: life.inventory, selected: life.selected ?? 0, stats: life.stats };
}

hud.showStart(Boolean(saved?.life));

// Expose for debugging from the console.
window.algoWorld = { config, world, terrain: world.terrain, chunks, renderer, player, camera: cameraController, game, input, hud, mobs, radius: world.radius };

const basis = new THREE.Matrix4();
const xAxis = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const head = new THREE.Vector3();
const highlight = new Float32Array(16);
let last = performance.now();
let fps = 60;
let chunkTimer = 0;
let saveTimer = 0;
let lastChunkKey = '';
let started = false;
let target = null;

function updateStats() {
  const d = player.direction();
  const { lat, lon } = latLon(d);
  const column = world.column(d);
  const c = chunkOfDirection(d, config);
  const r = renderer.stats, s = chunks.stats;
  hudEl.textContent = [
    `${fps.toFixed(0)} fps · ${r.drawCalls} draw calls · ${(r.triangles / 1e6).toFixed(2)} M tris`,
    `chunks ${r.chunks} loaded · ${s.pending} pending · ${s.workers} workers · build ${s.avgBuildMs.toFixed(1)} ms avg / ${s.maxBuildMs.toFixed(0)} max`,
    `blocks ${r.blocks.toLocaleString()} · edits ${world.edits.size} · seed ${config.seed}`,
    `face ${c.face} chunk ${c.cx},${c.cy} · lat ${lat.toFixed(1)}° lon ${lon.toFixed(1)}° · ${MATERIALS[column.resolved.surface].name.toLowerCase()} · ${(player.altitude - config.seaLevel).toFixed(1)} above sea${player.inWater ? ' · swimming' : ''}`,
  ].join('\n');
}

// Taps and clicks act on the block under the finger or mouse; keys and the DIG/BUILD
// buttons act on the crosshair (with the block in front of you as a fallback).
function targetFor(action) {
  if (action.x === undefined) return target;
  const hit = findTargetOnScreen(world, renderer.camera, player, action.x, action.y, RULES.reach);
  if (hit?.tooFar) { game.say('Too far away. Walk closer to that block', 1.6); return null; }
  return hit ?? target;
}

// A mob in the way of a dig gets hit instead of the block behind it.
function mobFor(action) {
  const reach = renderer.camera.position.distanceTo(player.headPosition(head)) + RULES.reach;
  if (action.x === undefined) { renderer.camera.getWorldDirection(cameraForward); return mobs.pick(renderer.camera.position, cameraForward, reach); }
  const ray = screenRay(renderer.camera, action.x, action.y);
  return mobs.pick(ray.origin, ray.direction, reach);
}

function handleActions(actions) {
  for (const raw of actions) {
    const action = typeof raw === 'string' ? { type: raw } : raw;
    if (action.type === 'menu') { if (hud.pickerOpen) hud.closePicker(); else hud.toggleMenu(); }
    else if (action.type === 'blocks') hud.togglePicker();
    else if (action.type === 'close') hud.closePicker();
    else if (hud.pickerOpen || hud.menuOpen) continue;   // a card is open: taps go to it, not the planet
    else if (action.type === 'dig') { const mob = mobFor(action); if (mob) game.hitMob(mobs, mob); else { const t = targetFor(action); if (t) game.dig(t); } }
    else if (action.type === 'build') { const mob = mobFor(action); if (mob) game.hitMob(mobs, mob); else { const t = targetFor(action); if (t) game.build(t); } }
    else if (action.type === 'eat') game.eatSelected();
    else if (action.select !== undefined) game.select(action.select);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps = fps * 0.95 + (dt > 0 ? 1 / dt : fps) * 0.05;

  const snapshot = input.poll();
  const paused = hud.pickerOpen || hud.menuOpen;
  const playing = game.started && game.vitals.alive && !paused;
  if (playing) player.update(dt, snapshot, cameraController.yaw);
  cameraController.update(dt, snapshot);
  renderer.shake(game.shake > 0 ? 0.35 : 0);

  // What are we looking at? Ray from the camera through the crosshair, starting at the player's head.
  if (playing) {
    renderer.camera.getWorldDirection(cameraForward);
    player.headPosition(head);
    target = findTarget(world, renderer.camera.position, cameraForward, renderer.camera.position.distanceTo(head), RULES.reach) ?? targetInFront(world, player);
    renderer.setHighlight(target && target.k >= 0 ? highlightMatrix(world, target, highlight) : null, game.breakProgress);
    handleActions(snapshot.actions);
  } else {
    target = null;
    renderer.setHighlight(null);
  }

  const { day } = renderer.setTime(game.dayPhase, player.up);
  const wasAlive = game.vitals.alive;
  if (!paused) game.tick(dt, snapshot);
  if (playing) mobs.update(dt, day);
  if (wasAlive && !game.vitals.alive) {
    hud.showGameOver(game.vitals, game.life.stats);
    say('Oh no! Let’s try again!', 'world-gameover');
    persistence.save(config.seed, world, game, cameraController);   // life is null now, planet kept
  }

  // Minifig follows the player: +z faces the walking direction, y is local up.
  xAxis.crossVectors(player.up, player.facing).normalize();
  basis.makeBasis(xAxis, player.up, player.facing);
  minifig.quaternion.setFromRotationMatrix(basis);
  minifig.position.copy(player.position);

  const camDir = normalize([renderer.camera.position.x, renderer.camera.position.y, renderer.camera.position.z]);
  renderer.setUnderwater(renderer.camera.position.length() < world.waterRadius() && world.column(camDir).swim);

  chunkTimer += dt;
  const here = chunkOfDirection(player.direction(), config);
  const hereKey = chunkKey(here.face, here.cx, here.cy);
  if (chunkTimer > 0.25 || hereKey !== lastChunkKey) {
    chunkTimer = 0;
    lastChunkKey = hereKey;
    chunks.update(player.direction());
  }
  if (!started && chunks.loaded.has(hereKey)) {
    started = true;
    loading.hidden = true;
  }

  saveTimer += dt;
  if (saveTimer > 5 && game.started) { saveTimer = 0; persistence.save(config.seed, world, game, cameraController); }

  renderer.render();
  hud.update(game, player, day);
  if ((now | 0) % 4 === 0) updateStats();
  requestAnimationFrame(frame);
}

window.addEventListener('pagehide', () => { if (game.started) persistence.save(config.seed, world, game, cameraController); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.started) persistence.save(config.seed, world, game, cameraController); });

chunks.update(player.direction());
requestAnimationFrame(frame);
