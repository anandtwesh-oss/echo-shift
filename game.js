/* =========================================================
   game.js — Main entry point for ECHO SHIFT: HERO vs DEVIL
   Phase 1: Playable foundation
   =========================================================
   Architecture:
     - Reads/mutates a single `state` object each frame.
     - Rendering delegated to systems/renderer.js
     - Physics delegated to systems/physics.js
     - Input  delegated to systems/input.js
     - Entity logic lives in entities/hero.js & entities/devil.js
   ========================================================= */

import { initInput }         from './systems/input.js';
import { renderFrame, buildStarFields } from './systems/renderer.js';
import { Hero }              from './entities/hero.js';
import { Devil }             from './entities/devil.js';

// ── DOM refs ──────────────────────────────────────────────
const titleScreen    = document.getElementById('title-screen');
const gameScreen     = document.getElementById('game-screen');
const startBtn       = document.getElementById('start-btn');
const canvas         = document.getElementById('game-canvas');
const ctx            = canvas.getContext('2d');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownText    = document.getElementById('countdown-text');

// ── Game state ────────────────────────────────────────────
const state = {
  running: false,

  // Canvas / layout (updated on resize)
  canvasW:  0,
  canvasH:  0,
  halfW:    0,
  groundY:  0,   // world-space Y of the floor

  // Platforms — defined relative to each viewport, populated on resize
  platforms: [],

  // Live entities (created at game start)
  hero:  null,
  devil: null,

  // Projectiles
  projectiles: [],

  // Frame timing
  lastTime: 0,
  t:        0,   // total elapsed seconds (for animations)
};

// ── Canvas sizing ─────────────────────────────────────────
function resizeCanvas() {
  // Use the full window, but keep a max aspect ratio to stay sane.
  const W = window.innerWidth;
  const H = window.innerHeight;

  canvas.width  = W;
  canvas.height = H;

  state.canvasW = W;
  state.canvasH = H;
  state.halfW   = Math.floor(W / 2);
  state.groundY = Math.floor(H * 0.78);

  buildStarFields(state.halfW, H);
  buildPlatforms();

  // Update entity boundaries if entities already exist
  if (state.hero) {
    state.hero.groundY   = state.groundY;
    state.hero.leftWall  = 0;
    state.hero.rightWall = state.halfW - state.hero.width;
    // Clamp position
    state.hero.y = Math.min(state.hero.y, state.groundY - state.hero.height);
    state.hero.x = Math.max(0, Math.min(state.hero.x, state.halfW - state.hero.width));
  }
  if (state.devil) {
    state.devil.groundY   = state.groundY;
    state.devil.leftWall  = state.halfW;
    state.devil.rightWall = W - state.devil.width;
    state.devil.y = Math.min(state.devil.y, state.groundY - state.devil.height);
    state.devil.x = Math.max(state.halfW, Math.min(state.devil.x, W - state.devil.width));
  }
}

function buildPlatforms() {
  const { halfW, groundY, canvasH } = state;
  const ph = 10; // platform height
  state.platforms = [
    // Universe A platforms (Hero)
    { universe: 'A', x: halfW * 0.12, y: groundY - canvasH * 0.18, w: halfW * 0.22, h: ph },
    { universe: 'A', x: halfW * 0.42, y: groundY - canvasH * 0.26, w: halfW * 0.20, h: ph },
    { universe: 'A', x: halfW * 0.68, y: groundY - canvasH * 0.15, w: halfW * 0.22, h: ph },

    // Universe B platforms (Devil) — mirror-ish layout using half-canvas offset
    { universe: 'B', x: halfW + halfW * 0.10, y: groundY - canvasH * 0.18, w: halfW * 0.22, h: ph },
    { universe: 'B', x: halfW + halfW * 0.40, y: groundY - canvasH * 0.26, w: halfW * 0.20, h: ph },
    { universe: 'B', x: halfW + halfW * 0.66, y: groundY - canvasH * 0.15, w: halfW * 0.22, h: ph },
  ];
}

// ── Countdown ────────────────────────────────────────────
function runCountdown(callback) {
  countdownOverlay.classList.remove('hidden');
  const steps = ['3', '2', '1', 'GO!'];
  let i = 0;

  function tick() {
    if (i >= steps.length) {
      countdownOverlay.classList.add('hidden');
      callback();
      return;
    }
    countdownText.textContent = steps[i];
    // Re-trigger CSS animation by cloning the text node
    countdownText.style.animation = 'none';
    void countdownText.offsetWidth; // reflow
    countdownText.style.animation = '';
    i++;
    setTimeout(tick, i === steps.length ? 600 : 900);
  }

  tick();
}

// ── Game loop ─────────────────────────────────────────────
function gameLoop(timestamp) {
  if (!state.running) return;

  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.05);
  state.lastTime = timestamp;
  state.t += dt;

  // Update entities
  state.hero.update(dt);
  state.devil.update(dt);

  // Shooting
  const heroProj  = state.hero.tryShoot();
  const devilProj = state.devil.tryShoot();
  if (heroProj)  state.projectiles.push(heroProj);
  if (devilProj) state.projectiles.push(devilProj);

  // Update projectiles
  for (const proj of state.projectiles) {
    proj.x    += proj.vx * dt;
    proj.y    += proj.vy * dt;
    proj.life -= dt;
  }
  // Remove expired or off-screen projectiles
  state.projectiles = state.projectiles.filter(p =>
    p.life > 0 &&
    p.x > -20 && p.x < state.canvasW + 20 &&
    p.y > -20 && p.y < state.canvasH + 20
  );

  // Render
  renderFrame(ctx, state);

  requestAnimationFrame(gameLoop);
}

// ── Start flow ────────────────────────────────────────────
function startGame() {
  // Build entities with current layout
  state.hero = new Hero(
    state.groundY,
    0,
    state.halfW
  );
  state.devil = new Devil(
    state.groundY,
    state.halfW,
    state.canvasW
  );
  state.projectiles = [];

  runCountdown(() => {
    state.running  = true;
    state.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  });
}

// ── Init ─────────────────────────────────────────────────
function init() {
  initInput();

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  startBtn.addEventListener('click', () => {
    titleScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    startGame();
  });
}

init();

