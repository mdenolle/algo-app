const screens = [...document.querySelectorAll('.screen')];
const toast = document.querySelector('#toast');
let soundOn = true;
let currentStep = 0;
let currentBuild = 'rocket';
let placedCount = 0;
let bookPage = 0;

// Verified LEGO parts: catalog/catalog.js is generated from Rebrickable's data
// dumps by catalog/build-catalog.mjs. Every piece below is a real (part, color)
// element; lookups throw if a design asks for a combination LEGO never made.
const catalog = window.ALGO_CATALOG;
const partIndex = new Map(catalog.parts.map(part => [part.partNum, part]));
const colorIndex = new Map(catalog.colors.map(color => [color.id, color]));

function getPart(partNum) {
  const part = partIndex.get(partNum);
  if (!part) throw new Error(`Part ${partNum} is not in catalog/curated.json`);
  return part;
}
function getColor(colorId) {
  const color = colorIndex.get(colorId);
  if (!color) throw new Error(`Color ${colorId} is not in the Algo palette`);
  return color;
}
// Pure white is tinted so studs stay visible on white cards.
function displayHex(colorId) {
  const { rgb } = getColor(colorId);
  return rgb === 'FFFFFF' ? '#dfe7ee' : `#${rgb}`;
}
function describePiece(partNum, colorId) {
  const part = getPart(partNum);
  const color = getColor(colorId);
  const elementId = part.elements[String(colorId)];
  if (!elementId) throw new Error(`LEGO never made ${part.name} (${partNum}) in ${color.name}`);
  return { partNum, colorId, elementId, color: color.kid, shape: part.family, hex: displayHex(colorId), name: `${color.kid} ${part.kidName}`, officialName: `${color.name} ${part.name}` };
}
// Alex's demo pieces: [partNum, Rebrickable colorId, count].
const demoInventory = [
  ['3001', 1, 6],   // Blue Brick 2 x 4
  ['3003', 4, 8],   // Red Brick 2 x 2
  ['3020', 14, 6],  // Yellow Plate 2 x 4
  ['3039', 2, 4],   // Green Brick Sloped 45° 2 x 2
  ['6091', 15, 3],  // White Brick Curved 1 x 2 x 1 1/3
  ['6014b', 0, 4],  // Black Wheel 11 x 12
  ['3705', 0, 3],   // Black Technic Axle 4
].map(([partNum, colorId, count]) => ({ ...describePiece(partNum, colorId), count }));
// Step pieces: { part, color, qty } resolved to a drawable, nameable piece.
const need = (part, color, qty = 1) => ({ ...describePiece(part, color), qty });

const builds = {
  rocket: {
    title: 'Pocket Rocket',
    icon: '🚀',
    pieces: 12,
    steps: [
      { text: 'Start with two blue bricks for the engine base.', hint: 'Leave a little space between the two engine blocks.', pieces: [need('3001', 1, 2)], model: [['blue', 43, 34, 14, 'brick', 41, 0], ['blue', 43, 34, 14, 'brick', 59, 0]] },
      { text: 'Build the tall red rocket body in the center.', hint: 'Keep the red body centered so the rocket balances.', pieces: [need('3003', 4, 4)], model: [['blue', 43, 34, 14, 'brick', 41, 0], ['blue', 43, 34, 14, 'brick', 59, 0], ['red', 57, 82, 47, 'short', 50, 0]] },
      { text: 'Add two thin yellow wing plates.', hint: 'Angle one wing to the left and one to the right.', pieces: [need('3020', 14, 2)], model: [['blue', 43, 34, 14, 'brick', 41, 0], ['blue', 43, 34, 14, 'brick', 59, 0], ['red', 57, 82, 47, 'short', 50, 0], ['yellow', 78, 18, 48, 'plate', 31, -12], ['yellow', 78, 18, 48, 'plate', 69, 12]] },
      { text: 'Click the white sloped nose on top. Ready for launch!', hint: 'The point should face straight up.', pieces: [need('3039', 15, 1)], model: [['blue', 43, 34, 14, 'brick', 41, 0], ['blue', 43, 34, 14, 'brick', 59, 0], ['red', 57, 82, 47, 'short', 50, 0], ['yellow', 78, 18, 48, 'plate', 31, -12], ['yellow', 78, 18, 48, 'plate', 69, 12], ['white', 55, 52, 129, 'slope', 50, 0]] }
    ]
  },
  creature: {
    title: 'Tiny Brick Dragon', icon: '🐉', pieces: 23,
    steps: [
      { text: 'Build the dragon’s long green body and two feet.', hint: 'The feet go under the body so it can stand.', pieces: [need('3298', 2, 1), need('3003', 2, 2)], model: [['green',112, 40, 45, 'curve', 51, 0], ['green',35,22,23,'short',42,0], ['green',35,22,23,'short',60,0]] },
      { text: 'Add the blue neck and friendly head.', hint: 'Put the head forward so the dragon looks curious.', pieces: [need('3004', 1, 1), need('3003', 1, 1)], model: [['green',112,40,45,'curve',51,0], ['green',35,22,23,'short',42,0], ['green',35,22,23,'short',60,0], ['blue',35,55,80,'brick',34,-8], ['blue',58,40,125,'short',27,0]] },
      { text: 'Give your dragon two yellow sloped wings.', hint: 'Raise the wings so the dragon looks ready to fly.', pieces: [need('3039', 14, 2)], model: [['green',112,40,45,'curve',51,0], ['green',35,22,23,'short',42,0], ['green',35,22,23,'short',60,0], ['blue',35,55,80,'brick',34,-8], ['blue',58,40,125,'short',27,0], ['yellow',90,32,82,'slope',55,-24], ['yellow',80,30,96,'slope',68,18]] },
      { text: 'Finish with a curved red tail and tiny horns.', hint: 'Sweep the tail upward behind the body.', pieces: [need('6091', 4, 1), need('3040b', 4, 2)], model: [['green',112,40,45,'curve',51,0], ['green',35,22,23,'short',42,0], ['green',35,22,23,'short',60,0], ['blue',35,55,80,'brick',34,-8], ['blue',58,40,125,'short',27,0], ['yellow',90,32,82,'slope',55,-24], ['yellow',80,30,96,'slope',68,18], ['red',88,24,58,'curve',78,-22], ['red',17,25,164,'slope',22,-12], ['red',17,25,164,'slope',31,12]] }
    ]
  },
  city: {
    title: 'Skyline City', icon: '🏙️', pieces: 34,
    steps: [
      { text: 'Make a wide blue foundation and road.', hint: 'Keep the base flat so every building stays steady.', pieces: [need('3001', 1, 4), need('3705', 0, 1)], model: [['blue',190,30,14,'brick',50,0], ['gray',150,10,45,'axle',50,0]] },
      { text: 'Build a tall red tower on the left.', hint: 'Stack the red bricks straight up.', pieces: [need('3003', 4, 8)], model: [['blue',190,30,14,'brick',50,0], ['gray',150,10,45,'axle',50,0], ['red',58,120,44,'short',32,0]] },
      { text: 'Build a shorter green tower on the right.', hint: 'Different heights make the skyline interesting.', pieces: [need('3039', 2, 4)], model: [['blue',190,30,14,'brick',50,0], ['gray',150,10,45,'axle',50,0], ['red',58,120,44,'short',32,0], ['green',72,82,44,'slope',66,0]] },
      { text: 'Add yellow windows and white rooftops.', hint: 'Make a window pattern that repeats on each floor.', pieces: [need('3023', 14, 6), need('6091', 15, 3)], model: [['blue',190,30,14,'brick',50,0], ['gray',150,10,45,'axle',50,0], ['red',58,120,44,'short',32,0], ['green',72,82,44,'slope',66,0], ['yellow',30,12,70,'plate',32,0], ['yellow',30,12,100,'plate',32,0], ['yellow',38,12,70,'plate',66,0], ['white',66,24,164,'curve',32,0], ['white',80,24,126,'slope',66,0]] }
    ]
  }
};

function showScreen(id) {
  screens.forEach(screen => screen.classList.toggle('active', screen.id === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Algo's voice: a recording of Alex when one exists for the line (voice/clips + npm run voice),
// otherwise the browser's text-to-speech.
const voiceClips = window.ALGO_VOICE_CLIPS || {};
let clipAudio = null;
function say(text, lineId) {
  if (!soundOn) return;
  if (clipAudio) { clipAudio.pause(); clipAudio = null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (lineId && voiceClips[lineId]) {
    clipAudio = new Audio(voiceClips[lineId]);
    clipAudio.play().catch(() => {});
    return;
  }
  if (!('speechSynthesis' in window)) return;
  const voice = new SpeechSynthesisUtterance(text);
  voice.rate = 1.02;
  voice.pitch = 1.08;
  window.speechSynthesis.speak(voice);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

document.addEventListener('pointerdown', () => say('Hi! I’m Algo. Let’s build something amazing!', 'greeting'), { once: true });

document.querySelectorAll('[data-go]').forEach(button => {
  button.addEventListener('click', () => showScreen(button.dataset.go));
});

document.querySelector('#sound-toggle').addEventListener('click', event => {
  soundOn = !soundOn;
  event.currentTarget.firstElementChild.textContent = soundOn ? '🔊' : '🔇';
  event.currentTarget.title = soundOn ? 'Voice on' : 'Voice off';
  event.currentTarget.setAttribute('aria-label', soundOn ? 'Turn voice off' : 'Turn voice on');
  if (soundOn) say('Hi! I’m Algo. Let’s build something amazing!', 'greeting');
});

document.querySelector('#joke-answer').addEventListener('click', event => {
  document.querySelector('#joke-reveal').hidden = false;
  event.currentTarget.hidden = true;
  say('Parce qu’elles s’emboîtent bien! That means: because they fit together well!', 'joke-answer-fr');
});

const photoInput = document.querySelector('#piece-photo');
const preview = document.querySelector('#photo-preview');
const cameraPrompt = document.querySelector('#camera-prompt');
const scanButton = document.querySelector('#scan-button');

photoInput.addEventListener('change', () => {
  const [file] = photoInput.files;
  if (!file) return;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  cameraPrompt.hidden = true;
  scanButton.disabled = false;
  scanButton.textContent = 'Find my pieces ✨';
});

function runScan() {
  const overlay = document.querySelector('#scan-progress');
  const status = document.querySelector('#scan-status');
  overlay.hidden = false;
  const messages = ['Finding colors', 'Counting shapes', 'Dreaming up builds'];
  let index = 0;
  status.textContent = messages[index];
  const interval = setInterval(() => {
    index += 1;
    if (index < messages.length) status.textContent = messages[index];
  }, 650);
  setTimeout(() => {
    clearInterval(interval);
    overlay.hidden = true;
    showScreen('ideas');
    say(`I found ${demoInventory.reduce((sum, piece) => sum + piece.count, 0)} pieces. Here are three awesome ideas!`);
  }, 2100);
}

scanButton.addEventListener('click', runScan);
document.querySelector('#scan-demo').addEventListener('click', runScan);
document.querySelector('#demo-inventory').addEventListener('click', () => {
  showScreen('ideas');
  say('Here are three things we can build!', 'ideas-demo');
});

document.querySelector('#new-ideas').addEventListener('click', () => {
  const names = [
    ['Mini Moon Rover', 'Silly Sea Turtle', 'Rainbow Castle'],
    ['Speedy Race Car', 'Wiggly Space Alien', 'Adventure Island'],
    ['Tiny Airplane', 'Friendly Brick Bot', 'Mountain Base']
  ];
  const choice = names[Math.floor(Math.random() * names.length)];
  document.querySelectorAll('.design-card .design-copy strong').forEach((name, index) => name.textContent = choice[index]);
  showToast('Algo made three fresh ideas!');
  say('Voilà! Three new ideas!', 'new-ideas');
});

document.querySelectorAll('[data-build]').forEach(card => {
  card.addEventListener('click', () => previewBuild(card.dataset.build));
});

const hexByKid = Object.fromEntries(catalog.colors.map(c => [c.kid, displayHex(c.id)]));

function renderModel(target, model) {
  target.innerHTML = '';
  model.forEach(([color, width, height, bottom, shape = 'brick', left = 50, rotate = 0], index) => {
    const brick = document.createElement('span');
    brick.className = `model-brick model-${shape}`;
    brick.style.setProperty('--color', hexByKid[color]);
    brick.style.setProperty('--w', `${width}px`);
    brick.style.setProperty('--h', `${height}px`);
    brick.style.setProperty('--bottom', `${bottom}px`);
    brick.style.setProperty('--left', `${left}%`);
    brick.style.setProperty('--rotate', `${rotate}deg`);
    brick.style.animationDelay = `${index * 80}ms`;
    target.append(brick);
  });
}

function previewBuild(buildId) {
  currentBuild = buildId;
  const build = builds[buildId];
  const minutes = buildId === 'rocket' ? 5 : buildId === 'creature' ? 12 : 20;
  document.querySelector('#preview-title').textContent = build.title;
  document.querySelector('#preview-details').textContent = `${build.pieces} pieces · about ${minutes} minutes`;
  renderModel(document.querySelector('#final-model'), build.steps.at(-1).model);
  showScreen('preview');
  say(`Here is the finished ${build.title}. Take a good look, then we can build it together!`);
}

document.querySelector('#start-building').addEventListener('click', () => startBuild(currentBuild));

function startBuild(buildId) {
  currentBuild = buildId;
  currentStep = 0;
  const build = builds[buildId];
  document.querySelector('#builder-title').textContent = build.title;
  document.querySelector('#total-steps').textContent = build.steps.length;
  renderBuildStep();
  showScreen('builder');
  say(`Let’s build the ${build.title}!`);
}

function renderBuildStep() {
  const build = builds[currentBuild];
  const step = build.steps[currentStep];
  document.querySelector('#current-step').textContent = currentStep + 1;
  document.querySelector('#remaining-count').textContent = `${Math.max(0, build.pieces - (currentStep * Math.ceil(build.pieces / build.steps.length)))} left`;
  document.querySelector('#step-instruction').textContent = step.text;
  document.querySelector('#hint-text').hidden = true;
  document.querySelector('#hint-text').textContent = `Algo says: “${step.hint}”`;
  document.querySelector('#previous-step').disabled = currentStep === 0;
  document.querySelector('#next-step').textContent = currentStep === build.steps.length - 1 ? 'I’m finished! ✓' : 'Piece added ✓';

  const needed = document.querySelector('#needed-pieces');
  needed.innerHTML = '';
  step.pieces.forEach(piece => {
    const part = getPart(piece.partNum);
    const size = part.size && part.size.length >= 2 ? `${part.size[0]}×${part.size[1]}` : part.family;
    const element = document.createElement('span');
    element.className = `needed-piece ${piece.color} shape-${piece.shape}`;
    element.style.background = piece.hex;
    element.textContent = piece.qty > 1 ? `${size} ×${piece.qty}` : size;
    element.title = `${piece.officialName} · part ${piece.partNum} · element ${piece.elementId}`;
    needed.append(element);
  });
  // Full names and part numbers under the chips, so the real LEGO part is always visible.
  let caption = document.querySelector('#needed-caption');
  if (!caption) {
    caption = document.createElement('p');
    caption.id = 'needed-caption';
    caption.className = 'needed-caption';
    needed.after(caption);
  }
  caption.textContent = step.pieces.map(piece => `${piece.qty} × ${piece.name} (${piece.partNum})`).join(' · ');

  renderModel(document.querySelector('#model-display'), step.model);
}

document.querySelector('#hint-button').addEventListener('click', () => {
  const hint = document.querySelector('#hint-text');
  hint.hidden = !hint.hidden;
  if (!hint.hidden) say(hint.textContent.replace('Algo says:', ''));
});
document.querySelector('#previous-step').addEventListener('click', () => { if (currentStep > 0) { currentStep -= 1; renderBuildStep(); } });
document.querySelector('#next-step').addEventListener('click', () => {
  const build = builds[currentBuild];
  if (currentStep < build.steps.length - 1) {
    currentStep += 1;
    renderBuildStep();
    say(build.steps[currentStep].text);
  } else {
    document.querySelector('#creation-name').value = `Alex’s ${build.title}`;
    document.querySelector('#book-title').textContent = `Alex’s ${build.title}`;
    document.querySelector('.cover-art').textContent = build.icon;
    showScreen('complete');
    say('Bravo! Magnifique! You built it!', 'complete');
  }
});

const board = document.querySelector('#build-board');
for (let i = 0; i < 42; i += 1) {
  const cell = document.createElement('button');
  cell.className = 'board-cell';
  cell.setAttribute('aria-label', `Building spot ${i + 1}`);
  cell.addEventListener('click', () => placePiece(cell));
  board.append(cell);
}

let selectedPiece = demoInventory[0];

function pieceButton(piece, className) {
  const button = document.createElement('button');
  button.className = `${className} ${piece.color}`;
  button.dataset.part = piece.partNum;
  button.dataset.color = piece.colorId;
  button.title = `${piece.count} × ${piece.officialName} · part ${piece.partNum}`;
  button.setAttribute('aria-label', `${piece.count} ${piece.name}, part ${piece.partNum}`);
  const mini = document.createElement('span');
  mini.className = `mini-brick shape-${piece.shape}`;
  mini.style.color = piece.hex;
  const count = document.createElement('b');
  count.textContent = piece.count;
  button.append(mini, count);
  return button;
}

function renderInventory() {
  const strip = document.querySelector('.inventory-strip');
  strip.innerHTML = '';
  demoInventory.forEach(piece => strip.append(pieceButton(piece, 'inventory-pill')));

  const palette = document.querySelector('#creator-palette');
  palette.innerHTML = '';
  demoInventory.forEach(piece => {
    const button = pieceButton(piece, 'palette-piece');
    button.classList.toggle('selected', piece === selectedPiece);
    button.addEventListener('click', () => {
      selectedPiece = piece;
      palette.querySelectorAll('.palette-piece').forEach(item => item.classList.toggle('selected', item === button));
    });
    palette.append(button);
  });
}
renderInventory();

function placePiece(cell) {
  if (cell.firstElementChild) {
    cell.innerHTML = '';
    placedCount = Math.max(0, placedCount - 1);
  } else {
    const piece = document.createElement('span');
    piece.className = `placed-brick ${selectedPiece.color} shape-${selectedPiece.shape}`;
    piece.style.background = selectedPiece.hex;
    piece.title = `${selectedPiece.officialName} · part ${selectedPiece.partNum}`;
    cell.append(piece);
    placedCount += 1;
  }
  document.querySelector('#creator-left').textContent = 34 - placedCount;
  document.querySelector('#finish-creation').disabled = placedCount < 3;
}

document.querySelector('#clear-creation').addEventListener('click', () => {
  board.querySelectorAll('.board-cell').forEach(cell => cell.innerHTML = '');
  placedCount = 0;
  document.querySelector('#creator-left').textContent = '34';
  document.querySelector('#finish-creation').disabled = true;
});

const creatorHints = [
  'Try making both sides match!',
  'What happens if you add a tall piece in the middle?',
  'Every great invention needs a surprising detail!',
  'Could your creation have a secret door?'
];
document.querySelector('#algo-hint').addEventListener('click', () => {
  const hint = creatorHints[Math.floor(Math.random() * creatorHints.length)];
  document.querySelector('#creator-message').textContent = `Algo says: “${hint}”`;
  say(hint);
});
document.querySelector('#finish-creation').addEventListener('click', () => {
  document.querySelector('#creation-name').value = 'Alex’s Amazing Invention';
  document.querySelector('#book-title').textContent = 'Alex’s Amazing Invention';
  document.querySelector('.cover-art').textContent = '✨';
  showScreen('complete');
  say('Bravo! Your invention is one of a kind!', 'invention-complete');
});

document.querySelector('#creation-name').addEventListener('input', event => {
  document.querySelector('#book-title').textContent = event.target.value || 'My Amazing Creation';
});
function escapeHTML(value) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function modelHTML(model) {
  return `<div class="final-model">${model.map(([color, width, height, bottom, shape = 'brick', left = 50, rotate = 0]) =>
    `<span class="model-brick model-${shape}" style="--color:${hexByKid[color]};--w:${width}px;--h:${height}px;--bottom:${bottom}px;--left:${left}%;--rotate:${rotate}deg"></span>`
  ).join('')}</div>`;
}

function bookPages() {
  const build = builds[currentBuild];
  const name = escapeHTML(document.querySelector('#creation-name').value || 'My Amazing Creation');
  const finalModel = build.steps.at(-1).model;
  const pages = [
    `<div class="page-overline">MY BUILD BOOK</div><h3>${name}</h3><div class="page-art">${modelHTML(finalModel)}</div><p class="page-copy">Designed and built with Algo</p>`,
    `<div class="page-overline">BEFORE YOU BUILD</div><h3>Shapes and colors you’ll need</h3><div class="book-inventory">${demoInventory.map(piece => `<span class="inventory-pill ${piece.color}" title="${escapeHTML(piece.officialName)} · part ${piece.partNum}"><span class="mini-brick shape-${piece.shape}" style="color:${piece.hex}"></span><b>${piece.count}</b></span>`).join('')}</div><p class="page-copy">Match the exact shape, size, and color before each step.</p><p class="page-copy part-list">${demoInventory.map(piece => `${piece.count} × ${piece.partNum}`).join(' · ')}</p>`,
    ...build.steps.map((step, index) => `<span class="book-step-number">${index + 1}</span><div class="page-overline">BUILD STEP ${index + 1}</div><h3>${escapeHTML(step.text)}</h3><div class="page-art">${modelHTML(step.model)}</div><p class="page-copy">Algo’s hint: ${escapeHTML(step.hint)}</p>`),
    `<div class="page-overline">MAGNIFIQUE!</div><h3>You did it!</h3><div class="page-art">${modelHTML(finalModel)}</div><p class="page-copy">This creation was built by ${name}. Keep imagining, building, and having fun!</p>`
  ];
  return pages;
}

function renderBookPage() {
  const pages = bookPages();
  const page = document.querySelector('#book-page');
  page.className = `book-page${bookPage === 0 ? ' cover' : ''}`;
  page.innerHTML = pages[bookPage];
  document.querySelector('#book-page-count').textContent = `Page ${bookPage + 1} of ${pages.length}`;
  document.querySelector('#previous-book-page').disabled = bookPage === 0;
  document.querySelector('#next-book-page').textContent = bookPage === pages.length - 1 ? 'Back to cover ↻' : 'Next page →';
}

document.querySelector('#make-book').addEventListener('click', () => {
  bookPage = 0;
  renderBookPage();
  showScreen('book');
  say('Your real instruction book is ready. Let’s turn the pages!', 'book-ready');
});
document.querySelector('#previous-book-page').addEventListener('click', () => { if (bookPage > 0) { bookPage -= 1; renderBookPage(); } });
document.querySelector('#next-book-page').addEventListener('click', () => {
  const pages = bookPages();
  bookPage = bookPage === pages.length - 1 ? 0 : bookPage + 1;
  renderBookPage();
});
document.querySelector('#print-book').addEventListener('click', () => window.print());
