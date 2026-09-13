// PlayerController: walks on the sphere. Gravity always points to the planet
// centre; "up" is the position direction; the heading frame is parallel-
// transported each frame so turning is continuous across cube-face edges.
// Collision is against the analytic terrain height, so it works before chunks
// arrive and never depends on what is rendered.

import * as THREE from 'three';
import { planetRadius } from './config.js';
import { tangentBasis } from './planet.js';

export class PlayerController {
  constructor(config, terrain, startDirection) {
    this.config = config;
    this.terrain = terrain;
    this.radius = planetRadius(config);
    this.height = 2.4;          // eye-ish height in blocks; minifig scale, terrain blocks read as 2×2 bricks
    this.speed = 7;
    this.runMultiplier = 1.7;
    this.jumpSpeed = 9.5;
    this.gravity = 26;
    this.stepHeight = 1.05;     // can step up one block, not two

    this.position = new THREE.Vector3().fromArray(startDirection).multiplyScalar(this.radius + terrain.surfaceHeight(startDirection));
    this.up = new THREE.Vector3().fromArray(startDirection);
    const { north } = tangentBasis(startDirection);
    this.forward = new THREE.Vector3().fromArray(north);
    this.right = new THREE.Vector3();
    this.facing = this.forward.clone();
    this.velocityUp = 0;
    this.grounded = false;
    this.dir = [0, 0, 0];
    this.tmp = { move: new THREE.Vector3(), trial: new THREE.Vector3(), camF: new THREE.Vector3(), camR: new THREE.Vector3() };
  }

  /** Unit direction under the player, as a plain array for the planet/terrain code. */
  direction() {
    this.dir[0] = this.up.x; this.dir[1] = this.up.y; this.dir[2] = this.up.z;
    return this.dir;
  }

  groundRadius(vector) {
    const d = [vector.x, vector.y, vector.z];
    const len = Math.hypot(d[0], d[1], d[2]);
    d[0] /= len; d[1] /= len; d[2] /= len;
    return this.radius + this.terrain.surfaceHeight(d);
  }

  update(dt, input, cameraYaw) {
    const { move, trial, camF, camR } = this.tmp;
    // Local frame, transported.
    this.up.copy(this.position).normalize();
    this.forward.addScaledVector(this.up, -this.forward.dot(this.up)).normalize();
    this.right.crossVectors(this.forward, this.up).normalize();

    // Camera-relative movement: rotate the transported forward by the camera yaw.
    const c = Math.cos(cameraYaw), s = Math.sin(cameraYaw);
    camF.copy(this.forward).multiplyScalar(c).addScaledVector(this.right, s);
    camR.copy(this.right).multiplyScalar(c).addScaledVector(this.forward, -s);
    move.set(0, 0, 0).addScaledVector(camF, input.move.y).addScaledVector(camR, input.move.x);
    if (move.lengthSq() > 1) move.normalize();
    const speed = this.speed * (input.run ? this.runMultiplier : 1);

    let r = this.position.length();
    if (move.lengthSq() > 0) {
      trial.copy(this.position).addScaledVector(move, speed * dt);
      const groundThere = this.groundRadius(trial);
      if (groundThere - r <= this.stepHeight) {
        this.position.copy(trial);
        this.facing.copy(move).normalize();
      }
      // else: a wall two or more blocks high; stay put this frame.
    }

    // Radial motion.
    this.up.copy(this.position).normalize();
    const ground = this.groundRadius(this.position);
    this.velocityUp -= this.gravity * dt;
    r += this.velocityUp * dt;
    if (r <= ground) {
      r = ground;
      this.velocityUp = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    if (this.grounded && input.jump) {
      this.velocityUp = this.jumpSpeed;
      this.grounded = false;
    }
    this.position.setLength(r);
    this.facing.addScaledVector(this.up, -this.facing.dot(this.up)).normalize();
  }

  /** Blocks above the planet radius (for the HUD). */
  get altitude() {
    return this.position.length() - this.radius;
  }
}
