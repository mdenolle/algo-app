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
import { findTarget, highlightMatrix } from './interact.js';
import * as persistence from './persistence.js';
import { chunkOfDirection, chunkKey, latLon, normalize } from './planet.js';
import { MATERIALS } from './materials.js';

const params = new URLSearchParams(location.search);
const config = withOverrides(DEFAULT_CONFIG, {
  seed: params.get('seed'),
  renderDistance: params.get('distance'),
  faceResolution: params.get('size'),
});
if (params.has('reset')) persistence.clear(config.seed);
const saved = persistence.load(config.seed);

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
});
const game = new Game(world, player, chunks, renderer, saved?.life ? restoreLife(saved.life) : null);
const hud = new Hud(document, {
  onPlay: () => { game.started = true; hud.hideOverlays(); },
  onRetry: () => { game.newLife(world.terrain.findSpawn()); game.started = true; cameraController.initialised = false; hud.hideOverlays(); persistence.save(config.seed, world, game, cameraController); },
  onSelect: index => game.select(index),
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
window.algoWorld = { config, world, terrain: world.terrain, chunks, renderer, player, camera: cameraController, game, input, hud, radius: world.radius };

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

function handleActions(actions) {
  for (const action of actions) {
    if (action === 'dig') game.dig(target);
    else if (action === 'build') game.build(target);
    else if (action === 'eat') game.eatSelected();
    else if (action.select !== undefined) game.select(action.select);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps = fps * 0.95 + (dt > 0 ? 1 / dt : fps) * 0.05;

  const snapshot = input.poll();
  const playing = game.started && game.vitals.alive;
  if (playing) player.update(dt, snapshot, cameraController.yaw);
  cameraController.update(dt, snapshot);

  // What are we looking at? Ray from the camera through the crosshair, starting at the player's head.
  if (playing) {
    renderer.camera.getWorldDirection(cameraForward);
    player.headPosition(head);
    target = findTarget(world, renderer.camera.position, cameraForward, renderer.camera.position.distanceTo(head), RULES.reach);
    renderer.setHighlight(target ? highlightMatrix(world, target.dig, highlight) : null);
    handleActions(snapshot.actions);
  } else {
    target = null;
    renderer.setHighlight(null);
  }

  const wasAlive = game.vitals.alive;
  game.tick(dt, snapshot);
  if (wasAlive && !game.vitals.alive) {
    hud.showGameOver(game.vitals, game.life.stats);
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
  hud.update(game, player);
  if ((now | 0) % 4 === 0) updateStats();
  requestAnimationFrame(frame);
}

window.addEventListener('pagehide', () => { if (game.started) persistence.save(config.seed, world, game, cameraController); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.started) persistence.save(config.seed, world, game, cameraController); });

chunks.update(player.direction());
requestAnimationFrame(frame);
