// Entry point: wires PlanetGenerator/TerrainGenerator, ChunkManager, Renderer,
// PlayerController, CameraController and Input into one game loop.
// URL params: ?seed=123  ?distance=5 (chunks)  ?size=768 (columns per face edge)

import * as THREE from 'three';
import { DEFAULT_CONFIG, withOverrides, planetRadius } from './config.js';
import { createTerrain } from './terrain.js';
import { ChunkManager } from './chunks.js';
import { Renderer, createMinifig } from './renderer.js';
import { PlayerController } from './player.js';
import { CameraController } from './camera.js';
import { Input } from './input.js';
import { chunkOfDirection, chunkKey, latLon } from './planet.js';
import { MATERIALS } from './materials.js';

const params = new URLSearchParams(location.search);
const config = withOverrides(DEFAULT_CONFIG, {
  seed: params.get('seed'),
  renderDistance: params.get('distance'),
  faceResolution: params.get('size'),
});

const canvas = document.querySelector('#world');
// Inside the Algo app the native bar has its own Back button.
if (params.has('embedded')) document.querySelector('#title').hidden = true;
const hud = document.querySelector('#hud');
const loading = document.querySelector('#loading');
const terrain = createTerrain(config);
const spawn = terrain.findSpawn();

const renderer = new Renderer(canvas, config);
const chunks = new ChunkManager(config, {
  onChunkReady: (key, data) => renderer.addChunk(key, data),
  onChunkRemove: key => renderer.removeChunk(key),
});
const player = new PlayerController(config, terrain, spawn);
const minifig = createMinifig();
renderer.scene.add(minifig);
const cameraController = new CameraController(renderer.camera, player);
const input = new Input(canvas, {
  joystick: document.querySelector('#joystick'),
  knob: document.querySelector('#knob'),
  jumpButton: document.querySelector('#jump'),
});

// Expose for debugging from the console and for future systems (inventory, persistence).
window.algoWorld = { config, terrain, chunks, renderer, player, camera: cameraController, radius: planetRadius(config) };

const basis = new THREE.Matrix4();
const xAxis = new THREE.Vector3();
let last = performance.now();
let fps = 60;
let chunkTimer = 0;
let lastChunkKey = '';
let started = false;

function updateHud() {
  const d = player.direction();
  const { lat, lon } = latLon(d);
  const column = terrain.sample(d);
  const c = chunkOfDirection(d, config);
  const r = renderer.stats, s = chunks.stats;
  hud.textContent = [
    `${fps.toFixed(0)} fps · ${r.drawCalls} draw calls · ${(r.triangles / 1e6).toFixed(2)} M tris`,
    `chunks ${r.chunks} loaded · ${s.pending} pending · ${s.workers} workers · build ${s.avgBuildMs.toFixed(1)} ms avg / ${s.maxBuildMs.toFixed(0)} max`,
    `blocks ${r.blocks.toLocaleString()} · planet radius ${planetRadius(config).toFixed(0)} · seed ${config.seed}`,
    `face ${c.face} chunk ${c.cx},${c.cy} · lat ${lat.toFixed(1)}° lon ${lon.toFixed(1)}° · ${MATERIALS[column.material].name.toLowerCase()} · ${(player.altitude - config.seaLevel).toFixed(1)} above sea`,
  ].join('\n');
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps = fps * 0.95 + (dt > 0 ? 1 / dt : fps) * 0.05;

  const snapshot = input.poll();
  player.update(dt, snapshot, cameraController.yaw);
  cameraController.update(dt, snapshot);

  // Minifig follows the player: +z faces the walking direction, y is local up.
  xAxis.crossVectors(player.up, player.facing).normalize();
  basis.makeBasis(xAxis, player.up, player.facing);
  minifig.quaternion.setFromRotationMatrix(basis);
  minifig.position.copy(player.position);

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

  renderer.render();
  if ((now | 0) % 4 === 0) updateHud();
  requestAnimationFrame(frame);
}

chunks.update(player.direction());
requestAnimationFrame(frame);
