/* =========================================================
   systems/renderer.js — Canvas 2D rendering helpers
   Handles viewport splitting, background scenery, platform
   drawing, HUD labels, the divider, and projectile drawing.
   ========================================================= */

// ── Palette ──────────────────────────────────────────────
const C = {
  heroSky1:    '#020d1a',
  heroSky2:    '#041428',
  heroGround:  '#0d2a3a',
  heroGrid:    'rgba(0,229,255,0.06)',
  heroAccent:  '#00e5ff',
  heroAccent2: '#00bcd4',
  heroPlatBg:  'rgba(0,180,220,0.15)',
  heroPlatBdr: '#00e5ff',
  heroPortal:  '#00e5ff',
  heroStar:    'rgba(0,229,255,0.55)',

  devilSky1:   '#0d000f',
  devilSky2:   '#1a0020',
  devilGround: '#2a0d1a',
  devilGrid:   'rgba(224,64,251,0.06)',
  devilAccent: '#e040fb',
  devilAccent2:'#ad1457',
  devilPlatBg: 'rgba(180,0,100,0.15)',
  devilPlatBdr:'#e040fb',
  devilPortal: '#e040fb',
  devilStar:   'rgba(224,64,251,0.45)',

  divider:     '#ffffff',
  hudHero:     '#00e5ff',
  hudDevil:    '#e040fb',
};

// Pre-computed star arrays, populated once.
let _starsA = null;
let _starsB = null;

function _makeStars(count, xOffset, viewW, viewH) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: xOffset + Math.random() * viewW,
      y: Math.random() * viewH * 0.75,
      r: 0.5 + Math.random() * 1.5,
    });
  }
  return arr;
}

/** Call once when canvas dimensions change to regenerate star fields. */
export function buildStarFields(viewW, viewH) {
  _starsA = _makeStars(55, 0,     viewW, viewH);
  _starsB = _makeStars(55, viewW, viewW, viewH);
}

// ── Grid helper ─────────────────────────────────────────
function _drawGrid(ctx, x, y, w, h, color, spacing = 40) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  for (let gx = x; gx <= x + w; gx += spacing) {
    ctx.moveTo(gx, y); ctx.lineTo(gx, y + h);
  }
  for (let gy = y; gy <= y + h; gy += spacing) {
    ctx.moveTo(x, gy); ctx.lineTo(x + w, gy);
  }
  ctx.stroke();
  ctx.restore();
}

// ── Background scenery ───────────────────────────────────

function _drawHeroBackground(ctx, vx, vy, vw, vh) {
  // Sky gradient
  const grad = ctx.createLinearGradient(vx, vy, vx, vy + vh);
  grad.addColorStop(0, C.heroSky1);
  grad.addColorStop(1, C.heroSky2);
  ctx.fillStyle = grad;
  ctx.fillRect(vx, vy, vw, vh);

  // Grid
  _drawGrid(ctx, vx, vy, vw, vh, C.heroGrid, 38);

  // Stars
  if (_starsA) {
    ctx.fillStyle = C.heroStar;
    for (const s of _starsA) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ground plane
  const groundY = vy + vh * 0.78;
  const gGrad = ctx.createLinearGradient(vx, groundY, vx, vy + vh);
  gGrad.addColorStop(0, '#0d3a50');
  gGrad.addColorStop(1, '#041420');
  ctx.fillStyle = gGrad;
  ctx.fillRect(vx, groundY, vw, vy + vh - groundY);

  // Ground edge glow
  ctx.strokeStyle = C.heroAccent;
  ctx.lineWidth   = 2;
  ctx.shadowColor = C.heroAccent;
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.moveTo(vx, groundY);
  ctx.lineTo(vx + vw, groundY);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function _drawDevilBackground(ctx, vx, vy, vw, vh) {
  // Sky gradient
  const grad = ctx.createLinearGradient(vx, vy, vx, vy + vh);
  grad.addColorStop(0, C.devilSky1);
  grad.addColorStop(1, C.devilSky2);
  ctx.fillStyle = grad;
  ctx.fillRect(vx, vy, vw, vh);

  // Grid
  _drawGrid(ctx, vx, vy, vw, vh, C.devilGrid, 38);

  // Stars
  if (_starsB) {
    ctx.fillStyle = C.devilStar;
    for (const s of _starsB) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ground plane
  const groundY = vy + vh * 0.78;
  const gGrad = ctx.createLinearGradient(vx, groundY, vx, vy + vh);
  gGrad.addColorStop(0, '#3a0d20');
  gGrad.addColorStop(1, '#150010');
  ctx.fillStyle = gGrad;
  ctx.fillRect(vx, groundY, vw, vy + vh - groundY);

  // Ground edge glow
  ctx.strokeStyle = C.devilAccent;
  ctx.lineWidth   = 2;
  ctx.shadowColor = C.devilAccent;
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.moveTo(vx, groundY);
  ctx.lineTo(vx + vw, groundY);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ── Platform drawing ─────────────────────────────────────

function _drawPlatform(ctx, x, y, w, h, bgColor, borderColor) {
  ctx.save();
  ctx.fillStyle   = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = borderColor;
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Portal ring ──────────────────────────────────────────
function _drawPortal(ctx, cx, cy, rx, ry, color, t) {
  ctx.save();
  const pulse = 0.85 + 0.15 * Math.sin(t * 2.5);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3 * pulse;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 18 * pulse;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Inner dim ring
  ctx.lineWidth  = 1;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * pulse * 0.65, ry * pulse * 0.65, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ── Divider ──────────────────────────────────────────────
function _drawDivider(ctx, x, canvasH) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
  grad.addColorStop(0,   'rgba(255,255,255,0.0)');
  grad.addColorStop(0.15,'rgba(255,255,255,0.7)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.85,'rgba(255,255,255,0.7)');
  grad.addColorStop(1,   'rgba(255,255,255,0.0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0); ctx.lineTo(x, canvasH);
  ctx.stroke();
  ctx.restore();
}

// ── HUD labels ───────────────────────────────────────────
function _drawHUD(ctx, vx, vy, vw, label, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font      = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;
  ctx.fillText(label, vx + vw / 2, vy + 22);
  ctx.restore();
}

// ── Projectile drawing ───────────────────────────────────
function _drawProjectile(ctx, proj, color) {
  ctx.save();
  ctx.fillStyle   = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 10;
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Main render entry point ──────────────────────────────

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state  — { hero, devil, platforms, projectiles, t, canvasW, canvasH }
 */
export function renderFrame(ctx, state) {
  const { hero, devil, platforms, projectiles, t, canvasW, canvasH } = state;
  const midX = Math.floor(canvasW / 2);
  const viewH = canvasH;

  // ─ Universe A (Hero) ─
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, midX, viewH);
  ctx.clip();

  _drawHeroBackground(ctx, 0, 0, midX, viewH);

  for (const p of platforms) {
    if (p.universe === 'A') {
      _drawPlatform(ctx, p.x, p.y, p.w, p.h, C.heroPlatBg, C.heroPlatBdr);
    }
  }

  _drawPortal(ctx, midX * 0.5, viewH * 0.78 - 60, 22, 36, C.heroPortal, t);
  _drawHUD(ctx, 0, 0, midX, '⚡  HERO  /  PLAYER 1', C.hudHero);

  // Hero character
  hero.draw(ctx);

  // Projectiles from hero
  for (const proj of projectiles) {
    if (proj.owner === 'hero') _drawProjectile(ctx, proj, C.heroAccent);
  }

  ctx.restore();

  // ─ Universe B (Devil) ─
  ctx.save();
  ctx.beginPath();
  ctx.rect(midX, 0, midX, viewH);
  ctx.clip();

  _drawDevilBackground(ctx, midX, 0, midX, viewH);

  for (const p of platforms) {
    if (p.universe === 'B') {
      _drawPlatform(ctx, p.x, p.y, p.w, p.h, C.devilPlatBg, C.devilPlatBdr);
    }
  }

  _drawPortal(ctx, midX + midX * 0.5, viewH * 0.78 - 60, 22, 36, C.devilPortal, t);
  _drawHUD(ctx, midX, 0, midX, '💀  DEVIL  /  PLAYER 2', C.hudDevil);

  // Devil character
  devil.draw(ctx);

  // Projectiles from devil
  for (const proj of projectiles) {
    if (proj.owner === 'devil') _drawProjectile(ctx, proj, C.devilAccent);
  }

  ctx.restore();

  // ─ Divider ─
  _drawDivider(ctx, midX, canvasH);
}

export { buildStarFields, C };

