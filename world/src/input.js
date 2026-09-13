// Input: keyboard (WASD / arrows, space, shift), mouse drag to orbit, wheel to
// zoom, and touch: a virtual joystick on the left, drag-to-orbit elsewhere, a
// jump button. poll() returns a snapshot and clears the per-frame deltas.

export class Input {
  constructor(canvas, { joystick, knob, jumpButton, digButton, buildButton, eatButton }) {
    this.keys = new Set();
    this.orbit = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.actions = [];      // 'dig' | 'build' | 'eat' | { select: n }, consumed each frame
    this.press = null;      // pointer press being judged as a tap/click
    this.joy = { active: false, id: null, x: 0, y: 0 };
    this.jumpHeld = false;
    this.jumpButtonHeld = false;
    this.pointers = new Map();
    this.pinchDistance = null;

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyF') this.actions.push('eat');
      if (e.code === 'KeyE') this.actions.push('dig');
      if (e.code === 'KeyR') this.actions.push('build');
      if (/^Digit[1-9]$/.test(e.code)) this.actions.push({ select: Number(e.code[5]) - 1 });
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now(), button: e.button, touch: e.pointerType === 'touch', moved: false };
    });
    canvas.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 2 && e.pointerType === 'touch') {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDistance !== null) this.zoom += (this.pinchDistance - d) * 4;
        this.pinchDistance = d;
      } else {
        this.orbit.dx += e.clientX - p.x;
        this.orbit.dy += e.clientY - p.y;
      }
      p.x = e.clientX; p.y = e.clientY;
      if (this.press && e.pointerId === this.press.id && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 8) this.press.moved = true;
    });
    // A press that did not turn into a drag is a click: left digs, right builds;
    // on touch a quick tap digs and a long press builds.
    const release = e => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = null;
      const press = this.press;
      if (press && e.pointerId === press.id) {
        this.press = null;
        const held = performance.now() - press.time;
        if (!press.moved && e.type === 'pointerup') {
          if (press.touch) this.actions.push(held > 450 ? 'build' : 'dig');
          else this.actions.push(press.button === 2 ? 'build' : 'dig');
        }
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', e => { this.zoom += e.deltaY; e.preventDefault(); }, { passive: false });

    // Virtual joystick.
    const radius = 46;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    joystick.addEventListener('pointerdown', e => {
      joystick.setPointerCapture(e.pointerId);
      this.joy.active = true; this.joy.id = e.pointerId;
      this.joy.cx = e.clientX; this.joy.cy = e.clientY;
    });
    joystick.addEventListener('pointermove', e => {
      if (!this.joy.active || e.pointerId !== this.joy.id) return;
      let dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy;
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx *= radius / len; dy *= radius / len; }
      this.joy.x = dx / radius; this.joy.y = -dy / radius;
      setKnob(dx, dy);
    });
    const joyEnd = e => { if (e.pointerId !== this.joy.id) return; this.joy.active = false; this.joy.x = 0; this.joy.y = 0; setKnob(0, 0); };
    joystick.addEventListener('pointerup', joyEnd);
    joystick.addEventListener('pointercancel', joyEnd);

    const tap = (button, action) => button.addEventListener('pointerdown', e => { e.preventDefault(); this.actions.push(action); });
    tap(digButton, 'dig'); tap(buildButton, 'build'); tap(eatButton, 'eat');

    jumpButton.addEventListener('pointerdown', e => { e.preventDefault(); this.jumpButtonHeld = true; });
    const jumpEnd = () => { this.jumpButtonHeld = false; };
    jumpButton.addEventListener('pointerup', jumpEnd);
    jumpButton.addEventListener('pointercancel', jumpEnd);
    jumpButton.addEventListener('pointerleave', jumpEnd);
  }

  poll() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (this.joy.active) { x = this.joy.x; y = this.joy.y; }
    const snapshot = {
      move: { x, y },
      jump: k.has('Space') || this.jumpButtonHeld,
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      orbit: { dx: this.orbit.dx, dy: this.orbit.dy },
      zoom: this.zoom,
      actions: this.actions,
    };
    this.orbit.dx = 0; this.orbit.dy = 0; this.zoom = 0; this.actions = [];
    return snapshot;
  }
}
