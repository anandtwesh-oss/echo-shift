/* =========================================================
   entities/hero.js — Hero (Player 1) entity
   ========================================================= */

import { isHeld, HeroKeys } from '../systems/input.js';
import { applyPhysics, applyGroundDrag, MOVE_SPEED, JUMP_IMPULSE } from '../systems/physics.js';

// Visual constants
const W  = 28;   // character width
const H  = 42;   // character height

export class Hero {
  /**
   * @param {number} groundY   — world-space floor Y
   * @param {number} leftWall  — left boundary (world x)
   * @param {number} rightWall — right boundary (world x)
   */
  constructor(groundY, leftWall, rightWall) {
    this.width     = W;
    this.height    = H;
    this.x         = leftWall + (rightWall - leftWall) * 0.35 - W / 2;
    this.y         = groundY - H;
    this.vx        = 0;
    this.vy        = 0;
    this.onGround  = true;
    this.facingRight = true;

    // Boundaries
    this.groundY   = groundY;
    this.leftWall  = leftWall;
    this.rightWall = rightWall - W;

    // Jump guard — prevents holding W for continuous hops
    this._jumpPressed = false;

    // Simple shoot cooldown
    this.shootCooldown = 0;
  }

  update(dt) {
    const left  = isHeld(HeroKeys.left);
    const right = isHeld(HeroKeys.right);
    const jump  = isHeld(HeroKeys.jump);

    // Horizontal
    if (left  && !right) { this.vx = -MOVE_SPEED; this.facingRight = false; }
    if (right && !left)  { this.vx =  MOVE_SPEED; this.facingRight = true;  }
    if (!left && !right) applyGroundDrag(this);

    // Jump (single press only)
    if (jump && !this._jumpPressed && this.onGround) {
      this.vy           = JUMP_IMPULSE;
      this.onGround     = false;
      this._jumpPressed = true;
    }
    if (!jump) this._jumpPressed = false;

    applyPhysics(this, this.groundY, this.leftWall, this.rightWall, dt);

    // Shoot cooldown tick
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
  }

  /** Returns a new projectile object if the hero fires, else null. */
  tryShoot() {
    if (!isHeld(HeroKeys.shoot) || this.shootCooldown > 0) return null;
    this.shootCooldown = 0.35; // seconds between shots
    return {
      owner:  'hero',
      x:      this.x + (this.facingRight ? this.width + 4 : -4),
      y:      this.y + this.height * 0.4,
      vx:     this.facingRight ? 520 : -520,
      vy:     0,
      radius: 5,
      life:   1.2,  // seconds before removal
    };
  }

  draw(ctx) {
    const cx = this.x + this.width  / 2;
    const cy = this.y + this.height / 2;
    const fx = this.facingRight ? 1 : -1;

    ctx.save();

    // ── Body (armored torso) ──
    ctx.fillStyle   = '#003e52';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur  = 8;

    ctx.beginPath();
    ctx.roundRect(this.x + 3, this.y + 14, this.width - 6, this.height - 18, 3);
    ctx.fill();
    ctx.stroke();

    // ── Chest energy core ──
    ctx.fillStyle = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, this.y + 22, 4, 0, Math.PI * 2);
    ctx.fill();

    // ── Head (helmet) ──
    ctx.fillStyle   = '#004d66';
    ctx.strokeStyle = '#00e5ff';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.roundRect(this.x + 5, this.y + 1, this.width - 10, 14, 4);
    ctx.fill();
    ctx.stroke();

    // Visor
    ctx.fillStyle = '#00e5ff';
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.roundRect(this.x + 7 + (fx < 0 ? 2 : 0), this.y + 5, 8, 5, 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Legs ──
    ctx.fillStyle   = '#003040';
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 4;
    // Left leg
    ctx.beginPath();
    ctx.rect(this.x + 4,  this.y + this.height - 14, 8, 14);
    ctx.fill(); ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.rect(this.x + 16, this.y + this.height - 14, 8, 14);
    ctx.fill(); ctx.stroke();

    // ── Arm / weapon ──
    ctx.fillStyle   = '#005c7a';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 6;
    const armX = this.facingRight ? this.x + this.width - 4 : this.x - 8;
    ctx.beginPath();
    ctx.roundRect(armX, this.y + 16, 10, 6, 2);
    ctx.fill(); ctx.stroke();

    ctx.restore();
  }
}

