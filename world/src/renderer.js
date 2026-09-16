// Renderer: three.js scene, sky/fog/lights, one InstancedMesh pair per chunk
// (studded top blocks + plain fill blocks) sharing two LEGO brick geometries.
// Chunks are frustum-culled by their own bounding sphere. LOD is a later phase.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SKY = 0x8fd0ff;

/** A 1×1×1 block that reads as a LEGO brick: sharp box, optional centred stud. */
export function createBrickGeometry({ studded }) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  if (!studded) return box;
  const stud = new THREE.CylinderGeometry(0.245, 0.245, 0.18, 14, 1, false);
  stud.translate(0, 0.5 + 0.09, 0);
  const merged = mergeGeometries([box, stud], false);
  box.dispose(); stud.dispose();
  return merged;
}

export class Renderer {
  constructor(canvas, config) {
    this.config = config;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const far = config.renderDistance * config.chunkSize;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, far * 0.6, far * 1.05);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, far * 2);

    this.hemi = new THREE.HemisphereLight(0xdff4ff, 0x6b5a44, 1.4);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.9);
    this.sun.position.set(0.6, 0.9, 0.4).multiplyScalar(1000);
    this.fill = new THREE.DirectionalLight(0xcfe8ff, 0.55);
    this.fill.position.set(-0.6, 0.3, -0.5).multiplyScalar(1000);
    this.scene.add(this.hemi, this.sun, this.fill);
    this.sunDirection = new THREE.Vector3(0.6, 0.9, 0.4).normalize();
    this.daylight = 1;

    this.chunkGroup = new THREE.Group();
    this.scene.add(this.chunkGroup);

    this.studded = createBrickGeometry({ studded: true });
    this.plain = createBrickGeometry({ studded: false });
    // Slightly glossy ABS plastic. Colors come per instance.
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.02 });
    // Glowstone and lava: unlit, so they shine at night.
    this.glowMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
    // Glass: see-through bricks, studs and all.
    this.glassMaterial = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.05, depthWrite: false });
    // Water: a translucent sheet at the top of the sea-level layer, seen from both sides.
    this.waterGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.5, 0);
    this.waterMaterial = new THREE.MeshStandardMaterial({ color: 0x078bc9, transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    // Apples: LEGO red spheres with a tiny stem.
    this.appleGeometry = mergeGeometries([new THREE.SphereGeometry(0.3, 12, 10), new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6).translate(0, 0.36, 0)], false);
    this.appleMaterial = new THREE.MeshStandardMaterial({ color: 0xc91a09, roughness: 0.3 });
    this.meshes = new Map();
    this.blockCount = 0;

    // Block highlight for digging/building.
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    this.highlight.visible = false;
    this.highlight.matrixAutoUpdate = false;
    this.scene.add(this.highlight);

    this.skyFog = this.scene.fog;
    this.underwaterFog = new THREE.Fog(0x0b5c8f, 1, 26);
    this.underwater = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const width = window.innerWidth, height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  #instanced(geometry, material, matrices, colors) {
    const count = matrices.length / 16;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.needsUpdate = true;
    if (colors) mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.computeBoundingSphere();
    mesh.frustumCulled = true;
    return mesh;
  }

  addChunk(key, data) {
    this.removeChunk(key);
    const set = [];
    if (data.top.length) set.push(this.#instanced(this.studded, this.material, data.top, data.topColor));
    if (data.fill.length) set.push(this.#instanced(this.plain, this.material, data.fill, data.fillColor));
    if (data.glass && data.glass.length) { const g = this.#instanced(this.studded, this.glassMaterial, data.glass, data.glassColor); g.renderOrder = 1; set.push(g); }
    if (data.glow && data.glow.length) set.push(this.#instanced(this.studded, this.glowMaterial, data.glow, data.glowColor));
    if (data.water.length) { const w = this.#instanced(this.waterGeometry, this.waterMaterial, data.water, null); w.renderOrder = 2; set.push(w); }
    if (data.apples.length) set.push(this.#instanced(this.appleGeometry, this.appleMaterial, data.apples, null));
    set.forEach(mesh => this.chunkGroup.add(mesh));
    this.meshes.set(key, set);
    this.blockCount += data.top.length / 16 + data.fill.length / 16 + (data.glass ? data.glass.length / 16 : 0) + (data.glow ? data.glow.length / 16 : 0);
  }

  /**
   * Day and night: the sun circles the planet once per cycle. `phase` in [0,1);
   * how bright it is where you stand depends on the sun's height above your horizon.
   */
  setTime(phase, up) {
    const angle = phase * Math.PI * 2;
    // Sun orbit tilted so the poles get some light too.
    this.sunDirection.set(Math.cos(angle), 0.35 * Math.sin(angle * 0.5 + 1), Math.sin(angle)).normalize();
    this.sun.position.copy(this.sunDirection).multiplyScalar(1000);
    const elevation = this.sunDirection.dot(up);          // 1 noon, 0 horizon, -1 midnight
    const day = Math.min(1, Math.max(0, elevation * 3 + 0.35));   // dusk is quick, night is dark but not black
    this.daylight = day;
    this.sun.intensity = 1.9 * Math.max(0, elevation) + 0.15 * day;
    this.hemi.intensity = 0.55 + 0.9 * day;                        // moonlight: you can still see where you walk
    this.fill.intensity = 0.15 + 0.4 * day;
    const sky = new THREE.Color(SKY).lerp(new THREE.Color(0x10224a), 1 - day);
    if (elevation < 0.15 && elevation > -0.1) sky.lerp(new THREE.Color(0xff9a5a), 0.35 * (1 - Math.abs(elevation - 0.02) / 0.13));   // sunrise/sunset
    if (!this.underwater) { this.scene.background.copy(sky); this.skyFog.color.copy(sky); }
    return { elevation, day };
  }

  /** Show the highlight box on one block (column-major matrix from blockMatrix), or hide it. */
  setHighlight(matrix) {
    if (!matrix) { this.highlight.visible = false; return; }
    this.highlight.matrix.fromArray(matrix);
    this.highlight.visible = true;
  }

  setUnderwater(under) {
    if (under === this.underwater) return;
    this.underwater = under;
    this.scene.fog = under ? this.underwaterFog : this.skyFog;
    this.scene.background.set(under ? 0x0b5c8f : SKY);
  }

  removeChunk(key) {
    const set = this.meshes.get(key);
    if (!set) return;
    for (const mesh of set) {
      this.chunkGroup.remove(mesh);
      if (mesh.material === this.material || mesh.material === this.glassMaterial || mesh.material === this.glowMaterial) this.blockCount -= mesh.count;
      mesh.dispose();
    }
    this.meshes.delete(key);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Brief camera shake (explosions). Call with seconds remaining; 0 stops. */
  shake(strength) {
    if (strength <= 0) return;
    this.camera.position.x += (Math.random() - 0.5) * strength;
    this.camera.position.y += (Math.random() - 0.5) * strength;
    this.camera.position.z += (Math.random() - 0.5) * strength;
  }

  get stats() {
    const info = this.renderer.info.render;
    return { chunks: this.meshes.size, blocks: Math.round(this.blockCount), drawCalls: info.calls, triangles: info.triangles };
  }
}

/** The player: a minifigure-scale stack of LEGO colors, origin at the feet, facing +z. */
export function createMinifig() {
  const group = new THREE.Group();
  const part = (w, h, d, color, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  part(0.42, 0.9, 0.5, 0x0055bf, -0.24, 0.45, 0);     // legs, LEGO Blue
  part(0.42, 0.9, 0.5, 0x0055bf, 0.24, 0.45, 0);
  part(1.0, 0.95, 0.55, 0xc91a09, 0, 1.4, 0);         // torso, LEGO Red
  part(0.28, 0.85, 0.3, 0xf2cd37, -0.66, 1.42, 0);    // arms, LEGO Yellow
  part(0.28, 0.85, 0.3, 0xf2cd37, 0.66, 1.42, 0);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.62, 18), new THREE.MeshStandardMaterial({ color: 0xf2cd37, roughness: 0.35 }));
  head.position.set(0, 2.2, 0);
  group.add(head);
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), head.material);
  stud.position.set(0, 2.57, 0);
  group.add(stud);
  const eye = () => new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  const left = eye(), right = eye();
  left.position.set(-0.13, 2.28, 0.36); right.position.set(0.13, 2.28, 0.36);
  group.add(left, right);
  return group;
}
