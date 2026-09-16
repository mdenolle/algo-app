// PlayerController: walks and swims on the sphere. Gravity always points to the
// planet centre; "up" is the position direction; the heading frame is parallel-
// transported each frame so turning is continuous across cube-face edges.
// Collision is against the resolved column floor (terrain + edits), so it works
// before chunks arrive and never depends on what is rendered.

import * as THREE from 'three';
import { tangentBasis } from './planet.js';

export class PlayerController {
  constructor(world, startDirection) {
    this.world = world;
    this.radius = world.radius;
    this.height = 2.4;          // minifig scale; terrain blocks read as 2×2 bricks
    this.eyeHeight = 1.9;
    this.speed = 7;
    this.runMultiplier = 1.7;
    this.swimMultiplier = 0.75;
    this.jumpSpeed = 10.2;      // clears a 2-block ledge, so a 2-deep hole is not a trap
    this.gravity = 26;
    this.stepHeight = 1.05;     // can step up one block, not two
    this.climbOutHeight = 2.05; // from the water you can haul yourself up a 2-block shore

    this.position = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.facing = new THREE.Vector3();
    this.velocityUp = 0;
    this.grounded = false;
    this.inWater = false;
    this.submerged = false;
    this.moving = false;
    this.lastImpact = 0;        // blocks/s at the last landing; the game reads and clears it
    this.jumpHeld = false;
    this.speedMultiplier = 1;   // set by the game: frozen, crawling
    this.crawling = false;      // sneak: slow, and you cannot walk off an edge
    this.dir = [0, 0, 0];
    this.tmp = { move: new THREE.Vector3(), trial: new THREE.Vector3(), camF: new THREE.Vector3(), camR: new THREE.Vector3() };
    this.respawn(startDirection);
  }

  respawn(direction) {
    const column = this.world.column(direction);
    this.position.fromArray(direction).multiplyScalar(this.radius + column.resolved.h);
    this.up.fromArray(direction);
    const { north } = tangentBasis(direction);
    this.forward.fromArray(north);
    this.facing.copy(this.forward);
    this.velocityUp = 0;
    this.grounded = true;
    this.inWater = false;
    this.submerged = false;
    this.lastImpact = 0;
  }

  /** Unit direction under the player, as a plain array for the planet/terrain code. */
  direction() {
    this.dir[0] = this.up.x; this.dir[1] = this.up.y; this.dir[2] = this.up.z;
    return this.dir;
  }

  groundRadius(vector) {
    return this.world.floorAt(vector);
  }

  update(dt, input, cameraYaw) {
    const { move, trial, camF, camR } = this.tmp;
    const R = this.radius;
    const waterR = this.world.waterRadius();

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
    this.moving = move.lengthSq() > 1e-6;

    let r = this.position.length();
    let column = this.world.column(this.up);
    const inWater = column.swim && r < waterR + 0.05;
    this.crawling = Boolean(input.crawl) && !inWater;
    const speed = this.speed * (input.run && !inWater && !this.crawling ? this.runMultiplier : 1) * (inWater ? this.swimMultiplier : 1) * this.speedMultiplier;

    if (this.moving) {
      trial.copy(this.position).addScaledVector(move, speed * dt);
      const there = this.world.column(trial.clone().normalize());
      const step = this.world.walkInto(there, r, this.height, inWater ? this.climbOutHeight : this.stepHeight);
      const floorThere = this.world.floorRadius(there, this.world.layerOf(step.r));
      const edgeSafe = !this.crawling || step.r - floorThere <= 1.05 || there.swim;   // crawling: never off a ledge
      if (step.ok && edgeSafe) {
        this.position.copy(trial).setLength(step.r);
        r = step.r;
        this.facing.copy(move).normalize();
        column = there;
      }
      // else: a wall two or more blocks high, or a ledge while crawling; stay put this frame.
    }

    this.up.copy(this.position).normalize();
    const floor = this.world.floorRadius(column, this.world.layerOf(r));
    const ceiling = this.world.ceilingRadius(column, this.world.layerOf(r));
    const wasGrounded = this.grounded;

    // At the surface, the jump button jumps you out of the water (onto a shore, a boat, anything).
    const jumpOut = column.swim && r < waterR + 0.05 && r >= waterR - 0.4 && input.jump && !this.jumpHeld;
    this.jumpHeld = input.jump;
    if (jumpOut) {
      this.velocityUp = this.jumpSpeed * 0.9;
      r = waterR + 0.06;
      this.grounded = false;
      this.inWater = false;
    } else if (column.swim && r < waterR + 0.05) {
      // Swimming: slow sink, hold jump to rise, never above the surface.
      this.velocityUp += (input.jump ? 14 : -3) * dt;
      this.velocityUp = Math.max(-4, Math.min(3.5, this.velocityUp));
      r += this.velocityUp * dt;
      if (r > waterR) { r = waterR; this.velocityUp = Math.min(0, this.velocityUp); }
      if (r < floor) { r = floor; this.velocityUp = 0; }
      if (r + this.height > ceiling) r = ceiling - this.height;
      this.grounded = false;
      this.inWater = true;
    } else {
      this.velocityUp -= this.gravity * dt;
      r += this.velocityUp * dt;
      if (r + this.height > ceiling) { r = ceiling - this.height; this.velocityUp = Math.min(0, this.velocityUp); }   // bumped your head
      if (r <= floor) {
        if (!wasGrounded && !this.inWater && this.velocityUp < 0) this.lastImpact = -this.velocityUp;
        r = floor;
        this.velocityUp = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
      if (this.grounded && input.jump) {
        this.velocityUp = this.jumpSpeed;
        this.grounded = false;
      }
      this.inWater = column.swim && r < waterR + 0.05 && !jumpOut;
    }

    this.position.setLength(r);
    this.facing.addScaledVector(this.up, -this.facing.dot(this.up)).normalize();
    this.submerged = column.swim && r + this.eyeHeight < waterR;
  }

  /** Blocks above the planet radius (for the HUD). */
  get altitude() {
    return this.position.length() - this.radius;
  }

  headPosition(out = new THREE.Vector3()) {
    return out.copy(this.position).addScaledVector(this.up, this.crawling ? this.eyeHeight * 0.6 : this.eyeHeight);
  }
}
