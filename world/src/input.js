// Input: keyboard (WASD / arrows, space, shift), mouse drag to orbit, wheel to
// zoom, and touch: a virtual joystick on the left, drag-to-orbit elsewhere, a
// jump button. poll() returns a snapshot and clears the per-frame deltas.

export class Input {
  constructor(canvas, { joystick, knob, jumpButton, digButton, buildButton, eatButton, blocksButton, preview, crawlButton }) {
    this.crawlToggle = false;
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
      if (e.code === 'KeyR') this.actions.push('build');
      if (/^Digit[1-9]$/.test(e.code)) this.actions.push({ select: Number(e.code[5]) - 1 });
      if (e.code === 'KeyB' || e.code === 'Tab') { this.actions.push('blocks'); e.preventDefault(); }
      if (e.code === 'Escape') this.actions.push('menu');
      if (e.code === 'KeyC') this.crawlToggle = !this.crawlToggle;
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    // Click or tap = build there. Hold (any button, any finger) = break there, and keep
    // breaking while held: mining. Right-click breaks at once. A drag is never an action.
    // Holds run on timers because Android cancels the pointer for its own long-press.
    const HOLD_MS = 380, REPEAT_MS = 320;
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size !== 1) { this.press = null; return; }
      const press = { id: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now(), button: e.button, touch: e.pointerType === 'touch', moved: false, mined: false, timer: null };
      this.press = press;
      const mine = () => { if (this.press !== press || press.moved) return; press.mined = true; this.actions.push({ type: 'dig', x: press.x, y: press.y }); press.timer = setTimeout(mine, REPEAT_MS); };
      if (e.button === 2) mine();
      else press.timer = setTimeout(mine, HOLD_MS);
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
      // A finger wobbles; only a real drag cancels a tap or a hold.
      const press = this.press;
      if (press && e.pointerId === press.id && !press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > (press.touch ? 22 : 8)) { press.moved = true; clearTimeout(press.timer); }
    });
    const release = e => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = null;
      const press = this.press;
      if (press && e.pointerId === press.id) {
        this.press = null;
        clearTimeout(press.timer);
        if (!press.moved && !press.mined && e.type === 'pointerup' && press.button !== 2) this.actions.push({ type: 'build', x: press.x, y: press.y });
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
    tap(buildButton, 'build'); tap(eatButton, 'eat');
    // DIG keeps digging while held (mining).
    let digTimer = null;
    const digStart = e => { e.preventDefault(); clearInterval(digTimer); this.actions.push('dig'); digTimer = setInterval(() => this.actions.push('dig'), 320); };
    const digStop = () => { clearInterval(digTimer); digTimer = null; };
    digButton.addEventListener('pointerdown', digStart);
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) digButton.addEventListener(type, digStop);
    this.digKeyTimer = 0;
    // The block book opens on click (not pointerdown), so the tap's own click cannot land inside the book.
    blocksButton.addEventListener('click', () => this.actions.push('blocks'));
    crawlButton.addEventListener('pointerdown', e => { e.preventDefault(); this.crawlToggle = !this.crawlToggle; crawlButton.classList.toggle('on', this.crawlToggle); });
    preview.addEventListener('click', () => this.actions.push('blocks'));

    jumpButton.addEventListener('pointerdown', e => { e.preventDefault(); this.jumpButtonHeld = true; });
    const jumpEnd = () => { this.jumpButtonHeld = false; };
    jumpButton.addEventListener('pointerup', jumpEnd);
    jumpButton.addEventListener('pointercancel', jumpEnd);
    jumpButton.addEventListener('pointerleave', jumpEnd);
  }

  poll() {
    const k = this.keys;
    // E held = keep mining.
    if (k.has('KeyE')) { const now = performance.now(); if (now - this.digKeyTimer > 320) { this.digKeyTimer = now; this.actions.push('dig'); } } else this.digKeyTimer = 0;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (this.joy.active) { x = this.joy.x; y = this.joy.y; }
    const snapshot = {
      move: { x, y },
      jump: k.has('Space') || this.jumpButtonHeld,
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      crawl: this.crawlToggle || k.has('ControlLeft') || k.has('ControlRight'),
      orbit: { dx: this.orbit.dx, dy: this.orbit.dy },
      zoom: this.zoom,
      actions: this.actions.map(a => (typeof a === 'string' ? { type: a } : a)),
    };
    this.orbit.dx = 0; this.orbit.dy = 0; this.zoom = 0; this.actions = [];
    return snapshot;
  }
}
