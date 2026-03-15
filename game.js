const GRID_SIZE  = 8;          

const CELL_PTS   = 10;         

const LINE_PTS   = 100;        

const COLORS = [
  { name: 'blue',   hex: '#4fc3f7' },
  { name: 'green',  hex: '#69f0ae' },
  { name: 'orange', hex: '#ffb74d' },
  { name: 'purple', hex: '#ce93d8' },
  { name: 'yellow', hex: '#fff176' },
  { name: 'pink',   hex: '#f48fb1' },
];

const SHAPES = {
  single:   [[0,0]],
  h2:       [[0,0],[0,1]],
  v2:       [[0,0],[1,0]],
  h3:       [[0,0],[0,1],[0,2]],
  v3:       [[0,0],[1,0],[2,0]],
  h4:       [[0,0],[0,1],[0,2],[0,3]],
  v4:       [[0,0],[1,0],[2,0],[3,0]],
  square:   [[0,0],[0,1],[1,0],[1,1]],
  lRight:   [[0,0],[1,0],[2,0],[2,1]],
  lLeft:    [[0,1],[1,1],[2,0],[2,1]],
  tShape:   [[0,0],[0,1],[0,2],[1,1]],
  tDown:    [[0,0],[1,0],[1,1],[2,0]],
  zShape:   [[0,0],[0,1],[1,1],[1,2]],
  sShape:   [[0,1],[0,2],[1,0],[1,1]],
  corner:   [[0,0],[1,0],[1,1]],
  cornerTR: [[0,0],[0,1],[1,1]],
};

const EASY_SHAPES   = ['single','h2','v2','h3','v3','square','corner','cornerTR'];
const MEDIUM_SHAPES = [...EASY_SHAPES,'lRight','lLeft','tShape','tDown'];
const HARD_SHAPES   = [...MEDIUM_SHAPES,'h4','v4','zShape','sShape'];

let grid        = [];   

let pieces      = [];   

let score       = 0;
let bestScore   = parseInt(localStorage.getItem('blockblast_best') || '0');
let dragging    = null; 

let previewCells = [];  

const boardEl       = document.getElementById('board');
const slot0         = document.getElementById('slot0');
const slot1         = document.getElementById('slot1');
const slot2         = document.getElementById('slot2');
const scoreDisplay  = document.getElementById('scoreDisplay');
const bestDisplay   = document.getElementById('bestDisplay');
const overlay       = document.getElementById('overlay');
const finalScoreEl  = document.getElementById('finalScore');
const finalBestEl   = document.getElementById('finalBest');
const restartBtn    = document.getElementById('restartBtn');
const comboTextEl   = document.getElementById('comboText');
const particleCanvas= document.getElementById('particleCanvas');
const ctx           = particleCanvas.getContext('2d');

const slotEls = [slot0, slot1, slot2];

let ghostEl = null;

let particles = [];

function resizeCanvas() {
  particleCanvas.width  = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function spawnParticles(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      alpha: 1,
      size: 4 + Math.random() * 6,
      color,
      decay: 0.02 + Math.random() * 0.025,
    });
  }
}

function tickParticles() {
  ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particles = particles.filter(p => p.alpha > 0.02);
  for (const p of particles) {
    p.x   += p.vx;
    p.y   += p.vy;
    p.vy  += 0.18; 

    p.vx  *= 0.97;
    p.alpha -= p.decay;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(tickParticles);
}
tickParticles();

let audioCtx = null;

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function unlockAudio() {
  getAudio();
  document.removeEventListener('pointerdown', unlockAudio);
  document.removeEventListener('touchstart',  unlockAudio);
}
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('touchstart',  unlockAudio);

function playTone(freq, type, duration, vol = 0.2, delay = 0) {
  try {
    const ac   = getAudio();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
    gain.gain.setValueAtTime(vol, ac.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.05);
  } catch(e) {  }
}

function soundPlace() {

  playTone(180, 'sine',     0.08, 0.35, 0.0);

  playTone(320, 'triangle', 0.06, 0.25, 0.0);

  playTone(900, 'sine',     0.04, 0.12, 0.01);
}

function soundClear()  {
  playTone(523, 'square', 0.12, 0.18, 0.0);
  playTone(659, 'square', 0.12, 0.18, 0.1);
  playTone(784, 'square', 0.18, 0.18, 0.2);
}
function soundCombo()  {
  playTone(880,  'sawtooth', 0.08, 0.15, 0.0);
  playTone(1100, 'sawtooth', 0.08, 0.15, 0.08);
  playTone(1320, 'sawtooth', 0.10, 0.15, 0.16);
}
function soundGameOver(){
  playTone(300, 'triangle', 0.3, 0.25, 0.0);
  playTone(200, 'triangle', 0.5, 0.25, 0.3);
}

function makeGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

function cellIndex(r, c) { return r * GRID_SIZE + c; }

function getCellEl(r, c) { return boardEl.children[cellIndex(r, c)]; }

function absoluteCells(shape, anchorR, anchorC) {
  return shape.map(([dr, dc]) => [anchorR + dr, anchorC + dc]);
}

function inBounds(r, c) { return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE; }

function canPlace(shape, anchorR, anchorC) {
  return absoluteCells(shape, anchorR, anchorC).every(([r, c]) =>
    inBounds(r, c) && grid[r][c] === null
  );
}

function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      boardEl.appendChild(cell);
    }
  }
}

function renderGrid() {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const el = getCellEl(r, c);
      const color = grid[r][c];
      if (color) {
        el.classList.add('filled');
        el.style.setProperty('--block-color', color);
      } else {
        el.classList.remove('filled','clearing');
        el.style.removeProperty('--block-color');
      }
    }
  }
}

function getDifficultyPool() {
  if (score < 200)  return EASY_SHAPES;
  if (score < 800)  return MEDIUM_SHAPES;
  return HARD_SHAPES;
}

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomColor()    { return randomFrom(COLORS); }

function randomPiece() {
  const pool      = getDifficultyPool();
  const shapeName = randomFrom(pool);
  const shape     = SHAPES[shapeName];
  const color     = randomColor();
  return { shapeName, shape, color, used: false };
}

function generatePieces() {
  pieces = [randomPiece(), randomPiece(), randomPiece()];
  renderTray();
}

const MINI_CELL_SIZE = 18; 

const MINI_GAP       = 3;

function renderTray() {
  slotEls.forEach((slot, i) => {
    slot.innerHTML = '';
    const piece = pieces[i];
    if (!piece) return;
    slot.appendChild(buildMiniPiece(piece, i));
  });
}

function buildMiniPiece(piece, index) {
  const { shape, color, used } = piece;

  const rows = shape.map(([r]) => r);
  const cols = shape.map(([, c]) => c);
  const maxR = Math.max(...rows);
  const maxC = Math.max(...cols);
  const numR = maxR + 1;
  const numC = maxC + 1;

  const el = document.createElement('div');
  el.className = 'mini-piece' + (used ? ' used' : '');
  el.style.gridTemplateColumns = `repeat(${numC}, ${MINI_CELL_SIZE}px)`;
  el.style.gridTemplateRows    = `repeat(${numR}, ${MINI_CELL_SIZE}px)`;
  el.style.gap                 = MINI_GAP + 'px';

  const filled = new Set(shape.map(([r, c]) => `${r},${c}`));

  for (let r = 0; r < numR; r++) {
    for (let c = 0; c < numC; c++) {
      const cell = document.createElement('div');
      cell.className = 'mini-cell';
      if (filled.has(`${r},${c}`)) {
        cell.style.background = color.hex;
        cell.style.width  = MINI_CELL_SIZE + 'px';
        cell.style.height = MINI_CELL_SIZE + 'px';
      } else {
        cell.style.background = 'transparent';
        cell.style.boxShadow  = 'none';
        cell.style.width  = MINI_CELL_SIZE + 'px';
        cell.style.height = MINI_CELL_SIZE + 'px';
      }
      el.appendChild(cell);
    }
  }

  if (!used) attachDragListeners(el, index);
  return el;
}

function buildGhostEl(piece) {
  const { shape, color } = piece;
  const rows = shape.map(([r]) => r);
  const cols = shape.map(([, c]) => c);
  const numR = Math.max(...rows) + 1;
  const numC = Math.max(...cols) + 1;

  const ghost = document.createElement('div');
  ghost.id = 'ghostPiece';

  const cellSize = getCellSize();
  const liveGap  = parseFloat(getComputedStyle(boardEl).gap) || 4;
  ghost.style.gridTemplateColumns = `repeat(${numC}, ${cellSize}px)`;
  ghost.style.gridTemplateRows    = `repeat(${numR}, ${cellSize}px)`;
  ghost.style.gap = liveGap + 'px';

  const filled = new Set(shape.map(([r, c]) => `${r},${c}`));
  for (let r = 0; r < numR; r++) {
    for (let c = 0; c < numC; c++) {
      const cell = document.createElement('div');
      cell.className = 'mini-cell';
      cell.style.width  = cellSize + 'px';
      cell.style.height = cellSize + 'px';
      cell.style.borderRadius = '7px';
      if (filled.has(`${r},${c}`)) {
        cell.style.background = color.hex;
      } else {
        cell.style.background = 'transparent';
        cell.style.boxShadow  = 'none';
      }
      ghost.appendChild(cell);
    }
  }
  document.body.appendChild(ghost);
  return ghost;
}

function getCellSize() {

  const firstCell = boardEl.firstElementChild;
  if (firstCell) return firstCell.getBoundingClientRect().width;
  return 44;
}

function removeGhost() {
  const existing = document.getElementById('ghostPiece');
  if (existing) existing.remove();
  ghostEl = null;
}

function attachDragListeners(el, index) {

  el.addEventListener('mousedown', e => startDrag(e, index, e.clientX, e.clientY));

  el.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startDrag(e, index, t.clientX, t.clientY);
  }, { passive: false });
}

function startDrag(e, index, clientX, clientY) {
  e.preventDefault();
  if (pieces[index].used) return;

  dragging = { pieceIndex: index, ...pieces[index] };

  ghostEl = buildGhostEl(dragging);
  moveGhost(clientX, clientY);

  const initAnchor = getAnchorFromCursor(clientX, clientY, dragging.shape);
  if (initAnchor) showPreview(dragging.shape, initAnchor.r, initAnchor.c);

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onEnd);
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend',  onTouchEnd);
}

function onMove(e)       { handleMove(e.clientX, e.clientY); }
function onTouchMove(e)  { e.preventDefault(); const t = e.touches[0]; handleMove(t.clientX, t.clientY); }
function onTouchEnd(e)   { const t = e.changedTouches[0]; handleEnd(t.clientX, t.clientY); }
function onEnd(e)        { handleEnd(e.clientX, e.clientY); }

function handleMove(cx, cy) {
  if (!dragging) return;

  moveGhost(cx, cy);

  clearPreview();
  const anchor = getAnchorFromCursor(cx, cy, dragging.shape);
  if (anchor) {
    showPreview(dragging.shape, anchor.r, anchor.c);
  }
}

function handleEnd(cx, cy) {
  cleanupDragListeners();
  clearPreview();
  removeGhost();

  if (!dragging) return;

  const anchor = getAnchorFromCursor(cx, cy, dragging.shape);
  if (anchor && canPlace(dragging.shape, anchor.r, anchor.c)) {
    placePiece(dragging.pieceIndex, anchor.r, anchor.c);
  }

  dragging = null;
}

function cleanupDragListeners() {
  window.removeEventListener('mousemove', onMove);
  window.removeEventListener('mouseup',   onEnd);
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend',  onTouchEnd);
}

function moveGhost(cx, cy) {
  if (!ghostEl) return;
  ghostEl.style.left      = cx + 'px';
  ghostEl.style.top       = cy + 'px';
  ghostEl.style.transform = 'translate(-50%, -50%)';
}

function getAnchorFromCursor(cx, cy, shape) {
  const boardRect = boardEl.getBoundingClientRect();

  const cellSize = getCellSize();
  const buffer   = cellSize * 1.5;
  if (
    cx < boardRect.left - buffer || cx > boardRect.right  + buffer ||
    cy < boardRect.top  - buffer || cy > boardRect.bottom + buffer
  ) return null;

  const cell00  = getCellEl(0, 0);
  const cell01  = getCellEl(0, 1);
  const r0      = cell00.getBoundingClientRect();
  const r1      = cell01.getBoundingClientRect();
  const step    = r1.left - r0.left;          

  const relX = cx - r0.left;
  const relY = cy - r0.top;

  const hoverC = Math.floor(relX / step);
  const hoverR = Math.floor(relY / step);

  const rows = shape.map(([r]) => r);
  const cols = shape.map(([, c]) => c);
  const spanR = Math.max(...rows);
  const spanC = Math.max(...cols);

  const anchorR = Math.round(hoverR - spanR / 2);
  const anchorC = Math.round(hoverC - spanC / 2);

  return { r: anchorR, c: anchorC };
}

function showPreview(shape, anchorR, anchorC) {
  const cells = absoluteCells(shape, anchorR, anchorC);

  if (!cells.every(([r, c]) => inBounds(r, c))) return;

  const valid = cells.every(([r, c]) => grid[r][c] === null);

  previewCells = cells;
  for (const [r, c] of previewCells) {
    getCellEl(r, c).classList.add(valid ? 'preview-valid' : 'preview-invalid');
  }
}

function clearPreview() {
  for (const [r, c] of previewCells) {
    if (inBounds(r, c)) {
      const el = getCellEl(r, c);
      el.classList.remove('preview-valid', 'preview-invalid');
    }
  }
  previewCells = [];
}

function placePiece(pieceIndex, anchorR, anchorC) {
  const piece = pieces[pieceIndex];
  const cells = absoluteCells(piece.shape, anchorR, anchorC);

  for (const [r, c] of cells) {
    grid[r][c] = piece.color.hex;
  }

  addScore(cells.length * CELL_PTS, anchorR, anchorC, piece.color.hex);

  for (const [r, c] of cells) {
    const el = getCellEl(r, c);
    el.classList.add('filled');
    el.style.setProperty('--block-color', piece.color.hex);
    el.classList.remove('place-pop');
    void el.offsetWidth; 

    el.classList.add('place-pop');
  }

  soundPlace();

  pieces[pieceIndex].used = true;
  const miniEl = slotEls[pieceIndex].querySelector('.mini-piece');
  if (miniEl) miniEl.classList.add('used');

  setTimeout(() => {
    checkAndClear(cells);

    if (pieces.every(p => p.used)) {
      setTimeout(() => {
        generatePieces();
        checkGameOver();
      }, 350);
    } else {
      checkGameOver();
    }
  }, 180);
}

function checkAndClear(lastPlacedCells) {

  const affectedRows = [...new Set(lastPlacedCells.map(([r]) => r))];
  const affectedCols = [...new Set(lastPlacedCells.map(([, c]) => c))];

  const fullRows = affectedRows.filter(r => grid[r].every(c => c !== null));
  const fullCols = affectedCols.filter(c => {
    for (let r = 0; r < GRID_SIZE; r++) if (grid[r][c] === null) return false;
    return true;
  });

  const totalLines = fullRows.length + fullCols.length;
  if (totalLines === 0) return;

  const toClear = new Set();
  for (const r of fullRows) for (let c = 0; c < GRID_SIZE; c++) toClear.add(`${r},${c}`);
  for (const fc of fullCols) for (let r = 0; r < GRID_SIZE; r++) toClear.add(`${r},${fc}`);

  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number);
    const el   = getCellEl(r, c);
    const rect = el.getBoundingClientRect();
    const cx   = rect.left + rect.width / 2;
    const cy   = rect.top  + rect.height / 2;
    spawnParticles(cx, cy, grid[r][c] || '#fff', 12);
  }

  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number);
    const el = getCellEl(r, c);
    el.classList.add('clearing');
  }

  soundClear();

  let comboMult = totalLines;
  if (comboMult >= 2) {
    showCombo(comboMult);
    soundCombo();
  }
  if (comboMult >= 3) screenShake();

  const lineScore = totalLines * LINE_PTS * comboMult;

  const sampleKey   = [...toClear][Math.floor(toClear.size / 2)];
  const [sr, sc]    = sampleKey.split(',').map(Number);
  const sampleRect  = getCellEl(sr, sc).getBoundingClientRect();
  addScore(lineScore, sr, sc, '#fff176');

  setTimeout(() => {
    for (const key of toClear) {
      const [r, c] = key.split(',').map(Number);
      grid[r][c] = null;
    }
    renderGrid();
  }, 460);
}

function addScore(pts, gridR, gridC, color = '#fff') {
  score += pts;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('blockblast_best', bestScore);
  }
  updateScoreDisplay();
  floatScore('+' + pts, gridR, gridC, color);
}

function updateScoreDisplay() {
  scoreDisplay.textContent = score;
  bestDisplay.textContent  = bestScore;
  scoreDisplay.classList.remove('bump');
  void scoreDisplay.offsetWidth;
  scoreDisplay.classList.add('bump');
}

function floatScore(text, gridR, gridC, color) {
  const el   = getCellEl(Math.min(gridR, GRID_SIZE - 1), Math.min(gridC, GRID_SIZE - 1));
  const rect = el.getBoundingClientRect();
  const span = document.createElement('div');
  span.className   = 'float-score';
  span.textContent = text;
  span.style.left  = (rect.left + rect.width / 2) + 'px';
  span.style.top   = (rect.top) + 'px';
  span.style.color = color;
  span.style.transform = 'translate(-50%,0)';
  document.body.appendChild(span);
  span.addEventListener('animationend', () => span.remove());
}

function showCombo(mult) {
  const labels = ['','','DOUBLE!','TRIPLE!','MEGA!','ULTRA!'];
  comboTextEl.textContent = labels[Math.min(mult, 5)] || `×${mult}!`;
  comboTextEl.classList.remove('show');
  void comboTextEl.offsetWidth;
  comboTextEl.classList.add('show');
}

function screenShake() {
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');
  document.body.addEventListener('animationend', () => document.body.classList.remove('shake'), { once: true });
}

function canPlaceAnywhere(shape) {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (canPlace(shape, r, c)) return true;
    }
  }
  return false;
}

function checkGameOver() {
  const activePieces = pieces.filter(p => !p.used);
  const anyFits = activePieces.some(p => canPlaceAnywhere(p.shape));
  if (!anyFits) {
    setTimeout(showGameOver, 400);
  }
}

function showGameOver() {
  soundGameOver();
  finalScoreEl.textContent = score;
  finalBestEl.textContent  = bestScore;
  overlay.classList.remove('hidden');
}

function restartGame() {
  overlay.classList.add('hidden');
  score = 0;
  grid  = makeGrid();
  updateScoreDisplay();
  renderGrid();
  generatePieces();
}

restartBtn.addEventListener('click', restartGame);

function init() {
  grid = makeGrid();
  buildBoard();
  updateScoreDisplay();
  generatePieces();
}

init();
