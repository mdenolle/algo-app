// Algo invents a LEGO set, shows it as real bricks you can turn around, walks
// through the steps, and lists the real pieces you need to build it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { openPile, demoInventory, Inventory } from '../../designer/inventory.js';
import { DESIGNS, design } from '../../designer/designs.js';
import { instructions, pieceImage } from '../../designer/instructions.js';
import { buildPiece, outline, PLATE } from './bricks3d.js';

const params = new URLSearchParams(location.search);
const el = id => document.querySelector(id);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef6ff);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
const renderer = new THREE.WebGLRenderer({ canvas: el('#stage'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb6cc, 1.5));
const sun = new THREE.DirectionalLight(0xfff6e8, 2);
sun.position.set(12, 20, 9);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xcfe4ff, 0.6);
fill.position.set(-10, 8, -6);
scene.add(fill);

// A green baseplate to stand the model on.
const baseplate = new THREE.Group();
scene.add(baseplate);

const model3d = new THREE.Group();
scene.add(model3d);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.9;

let current = null;      // { model, info, meshes }
let stepShown = Infinity;

function resize() {
  const box = el('#stage-wrap').getBoundingClientRect();
  renderer.setSize(box.width, box.height, false);
  camera.aspect = box.width / Math.max(1, box.height);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function makeBaseplate(w, d) {
  baseplate.clear();
  const pad = 2;
  const geometry = new THREE.BoxGeometry(w + pad * 2, PLATE, d + pad * 2);
  geometry.translate((w + pad * 2) / 2 - pad, -PLATE / 2, (d + pad * 2) / 2 - pad);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x237841, roughness: 0.5 }));
  baseplate.add(mesh);
  const studs = [];
  for (let x = -pad; x < w + pad; x += 1) for (let z = -pad; z < d + pad; z += 1) {
    const stud = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10);
    stud.translate(x + 0.5, 0.1, z + 0.5);
    studs.push(stud);
  }
  const merged = mergeGeometries(studs.map(g => (g.index ? g.toNonIndexed() : g)), false);
  studs.forEach(g => g.dispose());
  baseplate.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x237841, roughness: 0.5 })));
}

function show(model) {
  const info = instructions(model);
  current = { model, info, meshes: [] };
  model3d.clear();
  for (const piece of model.pieces) {
    const mesh = buildPiece(piece, mergeGeometries);
    mesh.position.set(piece.x, piece.y * PLATE, piece.z);
    const group = new THREE.Group();
    group.add(mesh);
    const edge = outline(mesh);
    edge.position.copy(mesh.position);
    group.add(edge);
    group.userData.step = piece.step;
    model3d.add(group);
    current.meshes.push(group);
  }
  const { w, d, h } = model.size;
  makeBaseplate(w, d);
  const radius = Math.max(w, d, h * PLATE) * 1.9 + 6;
  camera.position.set(w / 2 + radius * 0.75, h * PLATE * 0.9 + radius * 0.55, d / 2 + radius * 0.75);
  controls.target.set(w / 2, h * PLATE * 0.45, d / 2);
  controls.update();

  el('#title').textContent = info.name;
  el('#subtitle').textContent = info.description;
  el('#facts').innerHTML = `<b>${info.pieceCount}</b> pieces · <b>${info.steps.length}</b> steps · about <b>${info.minutes}</b> minutes · ${info.size.w} × ${info.size.d} studs`;

  el('#parts').innerHTML = info.parts.map(part => `
    <figure class="part">
      <img loading="lazy" src="${pieceImage(part.partNum, part.colorId, part.element)}" alt="${part.name}"
           onerror="this.src='https://cdn.rebrickable.com/media/parts/ldraw/${part.colorId}/${part.partNum}.png'; this.onerror=null;">
      <figcaption><b>${part.count} ×</b> ${part.name}<small>${part.part.name} · part ${part.partNum}</small></figcaption>
    </figure>`).join('');

  el('#steps').innerHTML = info.steps.map(step => `
    <li data-step="${step.number}">
      <span class="num">${step.index}</span>
      <span class="what">${step.text}
        <span class="thumbs">${step.parts.map(p => `<img loading="lazy" src="${pieceImage(p.partNum, p.colorId)}" alt="${p.name}" title="${p.name}">`).join('')}</span>
      </span>
    </li>`).join('');
  [...el('#steps').children].forEach(li => li.addEventListener('click', () => setStep(Number(li.dataset.step))));

  setStep(Infinity);
}

function setStep(step) {
  stepShown = step;
  for (const group of current.meshes) group.visible = group.userData.step <= step;
  const steps = current.info.steps;
  const index = steps.findIndex(s => s.number === step);
  [...el('#steps').children].forEach((li, i) => li.classList.toggle('on', i === index));
  el('#step-label').textContent = index < 0 ? 'Finished model' : `Step ${index + 1} of ${steps.length}`;
  el('#prev').disabled = index === 0;
  el('#next').textContent = index < 0 || index === steps.length - 1 ? 'Start again ↻' : 'Next step →';
}

function stepDelta(delta) {
  const steps = current.info.steps;
  let index = steps.findIndex(s => s.number === stepShown);
  if (index < 0) index = steps.length - 1;
  const next = index + delta;
  if (next < 0) return setStep(steps[0].number);
  if (next >= steps.length) return setStep(steps[0].number);
  setStep(steps[next].number);
}

/** Invent a set: a design (or a surprise) from an open pile, with a fresh seed. */
function invent(id = null, seed = Math.floor(Math.random() * 1e9)) {
  const pile = openPile();
  const choice = id ?? DESIGNS[Math.floor(Math.random() * DESIGNS.length)].id;
  const model = design(choice, pile, seed);
  history.replaceState(null, '', `?design=${choice}&seed=${seed}`);
  show(model);
}

el('#designs').innerHTML = DESIGNS.map(d => `<button data-design="${d.id}">${d.name}</button>`).join('');
[...el('#designs').children].forEach(button => button.addEventListener('click', () => invent(button.dataset.design)));
el('#again').addEventListener('click', () => invent(current?.model.id ?? null));
el('#surprise').addEventListener('click', () => invent(null));
el('#prev').addEventListener('click', () => stepDelta(-1));
el('#next').addEventListener('click', () => stepDelta(1));
el('#all').addEventListener('click', () => setStep(Infinity));
el('#spin').addEventListener('click', e => { controls.autoRotate = !controls.autoRotate; e.currentTarget.classList.toggle('off', !controls.autoRotate); });
el('#print').addEventListener('click', () => window.print());

resize();
invent(params.get('design'), params.has('seed') ? Number(params.get('seed')) : undefined);
(function frame() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(frame); })();

window.algoBuilder = { invent, show, setStep, get current() { return current; } };
