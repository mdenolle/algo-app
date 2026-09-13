// Persistence: the planet's edits, picked apples and the current life go to
// localStorage under the seed. Dying deletes the life, not the planet.

const VERSION = 1;
const key = seed => `algo-world:v${VERSION}:${seed}`;

export function load(seed) {
  try {
    const raw = localStorage.getItem(key(seed));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.version === VERSION ? data : null;
  } catch {
    return null;
  }
}

export function save(seed, world, game, camera) {
  try {
    const data = {
      version: VERSION,
      seed,
      savedAt: Date.now(),
      world: world.toJSON(),
      life: game.vitals.alive ? { ...game.toJSON(), camera: { yaw: camera.yaw, pitch: camera.pitch, distance: camera.distance } } : null,
    };
    localStorage.setItem(key(seed), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clear(seed) {
  try { localStorage.removeItem(key(seed)); } catch { /* ignore */ }
}
