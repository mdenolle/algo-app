// ChunkManager: decides which chunks should exist around the player, farms their
// construction out to a pool of workers nearest-first, hands finished data to the
// renderer, and unloads chunks that drift out of range (with one chunk of
// hysteresis so walking along a boundary does not thrash).

import { chunksAround } from './planet.js';

export class ChunkManager {
  constructor(config, { onChunkReady, onChunkRemove }) {
    this.config = config;
    this.onChunkReady = onChunkReady;
    this.onChunkRemove = onChunkRemove;
    this.loaded = new Map();      // key -> { face, cx, cy, heights }
    this.pending = new Map();     // key -> entry queued or in flight
    this.queue = [];              // entries waiting for a worker
    this.inFlight = new Map();    // key -> worker
    this.keep = new Set();
    // Extension point for the building system: per-chunk block edits, kept across
    // unload/reload and sent with every build request. Persistence saves this map.
    this.edits = new Map();
    this.buildMs = { count: 0, total: 0, max: 0 };
    this.workers = Array.from({ length: config.workerCount }, () => {
      const worker = new Worker(new URL('./chunk-worker.js', import.meta.url), { type: 'module' });
      worker.busy = false;
      worker.onmessage = event => this.#onResult(worker, event.data);
      worker.onerror = event => console.error('chunk worker', event.message);
      return worker;
    });
  }

  /** Call whenever the player moves a meaningful distance. `direction` is the unit vector under the player. */
  update(direction) {
    const desired = chunksAround(direction, this.config);
    const keep = chunksAround(direction, { ...this.config, renderDistance: this.config.renderDistance + 1 });
    this.keep = new Set(keep.keys());

    for (const [key, entry] of desired) {
      if (this.loaded.has(key) || this.pending.has(key)) continue;
      const queued = { key, ...entry };
      this.pending.set(key, queued);
      this.queue.push(queued);
    }
    for (const entry of this.queue) entry.distance = desired.get(entry.key)?.distance ?? keep.get(entry.key)?.distance ?? Infinity;
    this.queue = this.queue.filter(entry => {
      if (this.keep.has(entry.key)) return true;
      this.pending.delete(entry.key);
      return false;
    });
    for (const key of [...this.loaded.keys()]) {
      if (this.keep.has(key)) continue;
      this.loaded.delete(key);
      this.onChunkRemove(key);
    }
    this.#dispatch();
  }

  #dispatch() {
    if (!this.queue.length) return;
    this.queue.sort((a, b) => a.distance - b.distance);
    for (const worker of this.workers) {
      if (worker.busy) continue;
      const entry = this.queue.shift();
      if (!entry) break;
      worker.busy = true;
      this.inFlight.set(entry.key, worker);
      worker.postMessage({ type: 'build', key: entry.key, face: entry.face, cx: entry.cx, cy: entry.cy, config: this.config, edits: this.edits.get(entry.key) ?? null });
    }
  }

  #onResult(worker, data) {
    worker.busy = false;
    this.inFlight.delete(data.key);
    this.pending.delete(data.key);
    this.buildMs.count += 1; this.buildMs.total += data.buildMs; this.buildMs.max = Math.max(this.buildMs.max, data.buildMs);
    if (this.keep.has(data.key)) {
      this.loaded.set(data.key, { face: data.face, cx: data.cx, cy: data.cy, heights: data.heights });
      this.onChunkReady(data.key, data);
    }
    this.#dispatch();
  }

  get stats() {
    return {
      loaded: this.loaded.size,
      pending: this.pending.size,
      workers: this.workers.length,
      avgBuildMs: this.buildMs.count ? this.buildMs.total / this.buildMs.count : 0,
      maxBuildMs: this.buildMs.max,
    };
  }

  dispose() {
    this.workers.forEach(worker => worker.terminate());
  }
}
