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

    const hemi = new THREE.HemisphereLight(0xdff4ff, 0x6b5a44, 1.4);
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.9);
    sun.position.set(0.6, 0.9, 0.4).multiplyScalar(1000);
    const fill = new THREE.DirectionalLight(0xcfe8ff, 0.55);
    fill.position.set(-0.6, 0.3, -0.5).multiplyScalar(1000);
    this.scene.add(hemi, sun, fill);

    this.chunkGroup = new THREE.Group();
    this.scene.add(this.chunkGroup);

    this.studded = createBrickGeometry({ studded: true });
    this.plain = createBrickGeometry({ studded: false });
    // Slightly glossy ABS plastic. Colors come per instance.
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.02 });
    this.meshes = new Map();
    this.blockCount = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const width = window.innerWidth, height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  #instanced(geometry, matrices, colors) {
    const count = matrices.length / 16;
    const mesh = new THREE.InstancedMesh(geometry, this.material, count);
    mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.computeBoundingSphere();
    mesh.frustumCulled = true;
    return mesh;
  }

  addChunk(key, data) {
    this.removeChunk(key);
    const pair = [];
    if (data.top.length) pair.push(this.#instanced(this.studded, data.top, data.topColor));
    if (data.fill.length) pair.push(this.#instanced(this.plain, data.fill, data.fillColor));
    pair.forEach(mesh => this.chunkGroup.add(mesh));
    this.meshes.set(key, pair);
    this.blockCount += data.top.length / 16 + data.fill.length / 16;
  }

  removeChunk(key) {
    const pair = this.meshes.get(key);
    if (!pair) return;
    for (const mesh of pair) {
      this.chunkGroup.remove(mesh);
      this.blockCount -= mesh.count;
      mesh.dispose();
    }
    this.meshes.delete(key);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
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
