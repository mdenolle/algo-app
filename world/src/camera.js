// CameraController: third-person orbit around the player, yaw/pitch from mouse or
// touch, wheel/pinch zoom, exponential smoothing, and terrain collision (the
// camera is pushed up if it would go under the ground).

import * as THREE from 'three';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class CameraController {
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;
    this.yaw = 0;
    this.pitch = 0.5;
    this.distance = 12;
    this.minDistance = 3;
    this.maxDistance = 20;
    this.smoothing = 11;
    this.initialised = false;
    this.target = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.camF = new THREE.Vector3();
    this.probe = new THREE.Vector3();
  }

  update(dt, input) {
    this.yaw -= input.orbit.dx * 0.0045;
    this.pitch = clamp(this.pitch + input.orbit.dy * 0.0045, -0.15, 1.25);
    this.distance = clamp(this.distance * Math.exp(input.zoom * 0.0012), this.minDistance, this.maxDistance);

    const p = this.player;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.camF.copy(p.forward).multiplyScalar(c).addScaledVector(p.right, s);
    this.target.copy(p.position).addScaledVector(p.up, p.height * 0.8);
    this.desired.copy(this.target)
      .addScaledVector(this.camF, -Math.cos(this.pitch) * this.distance)
      .addScaledVector(p.up, Math.sin(this.pitch) * this.distance);

    // Terrain collision: march from the player's head toward the desired spot and
    // stop before the first sample that is under the ground, so hills and cliffs
    // between camera and player never hide the player.
    const steps = Math.ceil(this.distance / 0.5);
    let safe = 1;
    for (let n = 1; n <= steps; n += 1) {
      const t = n / steps;
      this.probe.lerpVectors(this.target, this.desired, t);
      if (this.probe.length() < p.groundRadius(this.probe) + 0.5) { safe = Math.max(0.15, (n - 1) / steps); break; }
    }
    if (safe < 1) this.desired.lerpVectors(this.target, this.desired, safe);
    const minRadius = p.groundRadius(this.desired) + 0.7;
    if (this.desired.length() < minRadius) this.desired.setLength(minRadius);

    if (!this.initialised) {
      this.camera.position.copy(this.desired);
      this.initialised = true;
    } else {
      this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * this.smoothing));
    }
    this.camera.up.copy(p.up);
    this.camera.lookAt(this.target);
  }
}
