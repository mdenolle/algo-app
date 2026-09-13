// HUD: hearts, hunger, air, hotbar with preview, messages, start and game-over
// overlays. Plain DOM; the game loop calls update() a few times a second.

import { BLOCKS, BLOCK_BY_KEY, HOTBAR_SIZE, RULE_SUMMARY } from './game.js';
import { RULES } from './rules.js';
import { MATERIALS } from './materials.js';

const hexOf = material => `#${MATERIALS[material].hex}`;

function blockIcon(block, big = false) {
  if (block.food) return `<span class="item${big ? ' big' : ''}">${block.emoji}</span>`;
  return `<span class="brick${big ? ' big' : ''}${block.translucent ? ' glass' : ''}" style="--c:${block.hex}"></span>`;
}

export class Hud {
  constructor(root, { onPlay, onRetry, onSelect, onAssign }) {
    this.el = {
      hearts: root.querySelector('#hearts'),
      hungerFill: root.querySelector('#hunger-fill'),
      air: root.querySelector('#air'),
      airFill: root.querySelector('#air-fill'),
      hotbar: root.querySelector('#hotbar'),
      preview: root.querySelector('#preview'),
      messages: root.querySelector('#messages'),
      start: root.querySelector('#start'),
      startRules: root.querySelector('#start-rules'),
      startTitle: root.querySelector('#start-title'),
      play: root.querySelector('#play'),
      gameover: root.querySelector('#gameover'),
      cause: root.querySelector('#cause'),
      gameStats: root.querySelector('#game-stats'),
      retry: root.querySelector('#retry'),
      clock: root.querySelector('#clock'),
      controls: root.querySelector('#controls'),
      tips: root.querySelector('#tips'),
      picker: root.querySelector('#picker'),
      pickerGrid: root.querySelector('#picker-grid'),
      pickerClose: root.querySelector('#picker-close'),
    };
    this.touch = window.matchMedia('(pointer: coarse)').matches;
    const controls = this.touch
      ? [['joystick', 'move'], ['drag', 'look around'], ['JUMP', 'jump, swim up, hop out of water'], ['tap', 'dig the outlined block'], ['hold', 'build the block you picked'], ['EAT', 'eat an apple']]
      : [['W A S D', 'move (or arrows)'], ['mouse', 'drag to look, wheel to zoom'], ['Space', 'jump, swim up, hop out of water'], ['click', 'dig the outlined block'], ['right-click', 'build the block you picked'], ['1 – 8', 'pick a block · F eats']];
    this.el.controls.innerHTML = controls.map(([k, v]) => `<div><b>${k}</b>${v}</div>`).join('');
    this.tipsUntil = 0;
    this.el.startRules.innerHTML = RULE_SUMMARY.map(line => `<li>${line}</li>`).join('');
    this.el.play.addEventListener('click', onPlay);
    this.el.retry.addEventListener('click', onRetry);

    this.slots = Array.from({ length: HOTBAR_SIZE }, (_, index) => {
      const button = document.createElement('button');
      button.className = 'slot';
      button.innerHTML = `<span class="icon"></span><b class="count">0</b><small>${index + 1}</small>`;
      button.addEventListener('pointerdown', e => { e.preventDefault(); onSelect(index); });
      this.el.hotbar.append(button);
      return button;
    });
    this.slotKeys = Array(HOTBAR_SIZE).fill(null);
    this.lastSelected = -1;
    this.lastHearts = '';

    // Block book: every block with its count; tapping one puts it in the selected slot.
    this.pickerButtons = new Map();
    for (const block of BLOCKS) {
      const button = document.createElement('button');
      button.className = 'pick';
      button.innerHTML = `${blockIcon(block)}<span class="pick-label">${block.label}</span><b class="count">0</b>`;
      button.addEventListener('click', () => { onAssign(block.key); this.closePicker(); });
      this.el.pickerGrid.append(button);
      this.pickerButtons.set(block.key, button);
    }
    this.el.pickerClose.addEventListener('click', () => this.closePicker());
    this.el.picker.addEventListener('click', e => { if (e.target === this.el.picker) this.closePicker(); });
  }

  get pickerOpen() { return !this.el.picker.hidden; }
  openPicker() { this.el.picker.hidden = false; }
  closePicker() { this.el.picker.hidden = true; }
  togglePicker() { if (this.pickerOpen) this.closePicker(); else this.openPicker(); }

  showStart(resumed) {
    this.el.startTitle.textContent = resumed ? 'Welcome back!' : 'Algo World: Survival';
    this.el.play.textContent = resumed ? 'Continue ▶' : 'Play ▶';
    this.el.start.hidden = false;
    this.el.gameover.hidden = true;
  }

  hideOverlays() {
    this.el.start.hidden = true;
    this.el.gameover.hidden = true;
    this.showTips(this.touch
      ? 'Left joystick: walk  ·  drag: look around\nTap a block: dig  ·  hold: build  ·  JUMP: jump or swim'
      : 'W A S D: walk  ·  drag the mouse: look around\nclick: dig  ·  right-click: build  ·  Space: jump or swim', 14);
  }

  showTips(text, seconds) {
    this.el.tips.textContent = text;
    this.el.tips.hidden = false;
    this.tipsUntil = performance.now() + seconds * 1000;
  }

  showGameOver(vitals, stats) {
    const causes = { drowned: 'You drowned. Next time, hold JUMP to swim up.', starved: 'You starved. Apples grow on the grass.', fell: 'You fell too far. Dig stairs down, or jump into water.', exploded: 'TNT got you. Light it, then run at least six blocks away.', hurt: 'You ran out of hearts.' };
    this.el.cause.textContent = causes[vitals.causeOfDeath] ?? causes.hurt;
    const minutes = Math.floor(stats.survived / 60), seconds = Math.floor(stats.survived % 60);
    this.el.gameStats.innerHTML = [
      ['Survived', `${minutes} min ${seconds} s`],
      ['Blocks dug', stats.dug],
      ['Blocks built', stats.built],
      ['Apples found', stats.applesFound],
      ['Apples eaten', stats.eaten],
    ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    this.el.gameover.hidden = false;
  }

  update(game, player) {
    const v = game.vitals;
    const hearts = Array.from({ length: RULES.maxHealth }, (_, i) => (v.health >= i + 1 ? '❤️' : v.health > i ? '🧡' : '🖤')).join('');
    if (hearts !== this.lastHearts) { this.el.hearts.textContent = hearts; this.lastHearts = hearts; }
    this.el.hungerFill.style.width = `${(v.hunger / RULES.maxHunger) * 100}%`;
    this.el.hungerFill.classList.toggle('low', v.hunger < 25);
    const showAir = player.submerged || v.air < RULES.maxAir - 0.01;
    this.el.air.hidden = !showAir;
    if (showAir) { this.el.airFill.style.width = `${(v.air / RULES.maxAir) * 100}%`; this.el.airFill.classList.toggle('low', v.air < 4); }

    let selectionChanged = game.life.selected !== this.lastSelected;
    this.slots.forEach((button, index) => {
      const key = game.life.hotbar[index];
      const block = BLOCK_BY_KEY.get(key);
      if (this.slotKeys[index] !== key) {
        this.slotKeys[index] = key;
        button.querySelector('.icon').innerHTML = blockIcon(block);
        button.title = block.label;
        if (index === game.life.selected) selectionChanged = true;
      }
      const count = game.inventory[key] ?? 0;
      const countEl = button.querySelector('.count');
      if (countEl.textContent !== String(count)) countEl.textContent = count;
      button.classList.toggle('empty', count === 0);
    });
    if (selectionChanged) {
      this.lastSelected = game.life.selected;
      this.slots.forEach((button, index) => button.classList.toggle('selected', index === this.lastSelected));
      const slot = game.selectedSlot;
      this.el.preview.innerHTML = `${blockIcon(slot, true)}<span class="label">${slot.label}${slot.food ? ' · eat with F' : ''}<small>tap to open the block book</small></span>`;
    }
    if (this.pickerOpen) {
      for (const [key, button] of this.pickerButtons) {
        const count = game.inventory[key] ?? 0;
        const countEl = button.querySelector('.count');
        if (countEl.textContent !== String(count)) countEl.textContent = count;
        button.classList.toggle('empty', count === 0);
        button.classList.toggle('selected', game.life.hotbar[game.life.selected] === key);
      }
    }

    const now = performance.now();
    game.messages = game.messages.filter(m => m.until > now);
    const text = game.messages.map(m => m.text).join('\n');
    if (this.el.messages.textContent !== text) this.el.messages.textContent = text;

    if (this.tipsUntil && now > this.tipsUntil) { this.el.tips.hidden = true; this.tipsUntil = 0; }

    const t = game.life.stats.survived;
    this.el.clock.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  }
}
