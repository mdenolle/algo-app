// Drawing real LEGO pieces in 3D, at real LEGO measurements:
//   stud pitch 8 mm, brick height 9.6 mm, plate 3.2 mm,
//   stud diameter 4.8 mm, stud height 1.8 mm.
// One unit here is one stud pitch, so a brick is 1.2 tall and a plate 0.4.

import * as THREE from 'three';
import { COLOR_BY_ID } from '../../designer/colors.generated.js';

export const PLATE = 0.4;                 // 3.2 mm in stud pitches
export const STUD_R = 0.3, STUD_H = 0.225, WALL = 0.03;

const materials = new Map();
export function materialFor(colorId) {
  if (!materials.has(colorId)) {
    const color = COLOR_BY_ID[colorId];
    const hex = Number.parseInt(color?.rgb ?? 'C91A09', 16);
    materials.set(colorId, new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.38,
      metalness: 0.02,
      transparent: Boolean(color?.transparent),
      opacity: color?.transparent ? 0.55 : 1,
    }));
  }
  return materials.get(colorId);
}

function studs(w, d, top, geometries) {
  for (let x = 0; x < w; x += 1) for (let z = 0; z < d; z += 1) {
    const stud = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 16);
    stud.translate(x + 0.5, top + STUD_H / 2, z + 0.5);
    geometries.push(stud);
  }
}

/** A sloped brick: a box whose top falls away over the last stud, like part 3039. */
function slopeGeometry(w, d, h) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, h - PLATE);
  shape.lineTo(w - 1, h);                 // the slope: down over one stud
  shape.lineTo(0, h);
  shape.lineTo(0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geometry.rotateY(0);                     // x = width, y = height, z = depth already
  return geometry;
}

/**
 * One piece, ready to add to a scene: origin at its lower front-left stud,
 * x and z in studs, y in plates. `piece` is { partNum, colorId, w, d, h, kind }.
 */
export function buildPiece(piece, mergeGeometries) {
  const { w, d, h, kind } = piece;
  const height = h * PLATE;
  const geometries = [];
  if (kind === 'round') {
    const r = Math.min(w, d) / 2;
    const body = new THREE.CylinderGeometry(r, r, height, 20);
    body.translate(w / 2, height / 2, d / 2);
    geometries.push(body);
    const stud = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 16);
    stud.translate(w / 2, height + STUD_H / 2, d / 2);
    geometries.push(stud);
  } else if (kind === 'slope') {
    const body = slopeGeometry(w, d, height);
    geometries.push(body);
    for (let x = 0; x < w - 1; x += 1) for (let z = 0; z < d; z += 1) {
      const stud = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 16);
      stud.translate(x + 0.5, height + STUD_H / 2, z + 0.5);
      geometries.push(stud);
    }
  } else {
    const body = new THREE.BoxGeometry(w, height, d);
    body.translate(w / 2, height / 2, d / 2);
    geometries.push(body);
    if (kind !== 'tile') studs(w, d, height, geometries);
  }
  // Extruded shapes come back without an index while boxes and cylinders have one;
  // they can only be merged if they all agree, so drop the index everywhere.
  const flat = geometries.map(g => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(flat, false);
  merged.computeVertexNormals();
  geometries.forEach(g => g.dispose());
  flat.forEach(g => { if (!geometries.includes(g)) g.dispose(); });
  const mesh = new THREE.Mesh(merged, materialFor(piece.colorId));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Thin dark edges, so bricks read as separate pieces the way a photo of LEGO does. */
export function outline(mesh) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 35);
  return new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1b2430, transparent: true, opacity: 0.35 }));
}
