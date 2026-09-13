// HUD: hearts, hunger, air, hotbar with preview, messages, start and game-over
// overlays. Plain DOM; the game loop calls update() a few times a second.

import { HOTBAR, RULE_SUMMARY } from './game.js';
import { RULES } from './rules.js';
import { MATERIALS } from './materials.js';

const hexOf = material => `#${MATERIALS[material].hex}`;

export class Hud {
  constructor(root, { onPlay, onRetry, onSelect }) {
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

    this.slots = HOTBAR.map((slot, index) => {
      const button = document.createElement('button');
      button.className = 'slot';
      button.innerHTML = slot.food
        ? `<span class="item">${slot.emoji}</span><b class="count">0</b><small>${index + 1}</small>`
        : `<span class="brick" style="--c:${hexOf(slot.material)}"></span><b class="count">0</b><small>${index + 1}</small>`;
      button.title = slot.label;
      button.addEventListener('pointerdown', e => { e.preventDefault(); onSelect(index); });
      this.el.hotbar.append(button);
      return button;
    });
    this.lastSelected = -1;
    this.lastHearts = '';
  }

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
    const causes = { drowned: 'You drowned. Next time, hold JUMP to swim up.', starved: 'You starved. Apples grow on the grass.', fell: 'You fell too far. Dig stairs down, or jump into water.', hurt: 'You ran out of hearts.' };
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

    this.slots.forEach((button, index) => {
      const slot = HOTBAR[index];
      const count = game.inventory[slot.key];
      const countEl = button.querySelector('.count');
      if (countEl.textContent !== String(count)) countEl.textContent = count;
      button.classList.toggle('empty', count === 0);
    });
    if (game.life.selected !== this.lastSelected) {
      this.lastSelected = game.life.selected;
      this.slots.forEach((button, index) => button.classList.toggle('selected', index === this.lastSelected));
      const slot = game.selectedSlot;
      this.el.preview.innerHTML = slot.food
        ? `<span class="item big">${slot.emoji}</span><span class="label">${slot.label} · eat with F</span>`
        : `<span class="brick big" style="--c:${hexOf(slot.material)}"></span><span class="label">${slot.label}</span>`;
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
