/* =========================================================
   entities/devil.js — Devil (Player 2) entity
   ========================================================= */

import { isHeld, DevilKeys } from '../systems/input.js';
import { applyPhysics, applyGroundDrag, MOVE_SPEED, JUMP_IMPULSE } from '../systems/physics.js';

// Visual constants
const W  = 28;
const H  = 44;

export class Devil {
  /**
   * @param {number} groundY   — world-space floor Y
   * @param {number} leftWall  — left boundary (world x)
   * @param {number} rightWall — right boundary (world x)
   */
  constructor(groundY, leftWall, rightWall) {
    this.width     = W;
    this.height    = H;
    this.x         = leftWall + (rightWall - leftWall) * 0.65 - W / 2;
    this.y         = groundY - H;
    this.vx        = 0;
    this.vy        = 0;
    this.onGround  = true;
    this.facingRight = false;

    this.groundY   = groundY;
    this.leftWall  = leftWall;
    this.rightWall = rightWall - W;

    this._jumpPressed = false;
    this.shootCooldown = 0;
  }

  update(dt) {
    const left  = isHeld(DevilKeys.left);
    const right = isHeld(DevilKeys.right);
    const jump  = isHeld(DevilKeys.jump);

    if (left  && !right) { this.vx = -MOVE_SPEED; this.facingRight = false; }
    if (right && !left)  { this.vx =  MOVE_SPEED; this.facingRight = true;  }
    if (!left && !right) applyGroundDrag(this);

    if (jump && !this._jumpPressed && this.onGround) {
      this.vy           = JUMP_IMPULSE;
      this.onGround     = false;
      this._jumpPressed = true;
    }
    if (!jump) this._jumpPressed = false;

    applyPhysics(this, this.groundY, this.leftWall, this.rightWall, dt);

    if (this.shootCooldown > 0) this.shootCooldown -= dt;
  }

  tryShoot() {
    if (!isHeld(DevilKeys.shoot) || this.shootCooldown > 0) return null;
    this.shootCooldown = 0.35;
    return {
      owner:  'devil',
      x:      this.x + (this.facingRight ? this.width + 4 : -4),
      y:      this.y + this.height * 0.4,
      vx:     this.facingRight ? 520 : -520,
      vy:     0,
      radius: 5,
      life:   1.2,
    };
  }

  draw(ctx) {
    const cx = this.x + this.width  / 2;
    const _cy = this.y + this.height / 2;
    const fx = this.facingRight ? 1 : -1;

    ctx.save();

    // ── Cloak / body ──
    ctx.fillStyle   = '#1a0020';
    ctx.strokeStyle = '#e040fb';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = '#e040fb';
    ctx.shadowBlur  = 10;

    ctx.beginPath();
    // Slightly wider, flowing shape to suggest a cloak
    ctx.moveTo(this.x + 2,              this.y + 14);
    ctx.lineTo(this.x + this.width - 2, this.y + 14);
    ctx.lineTo(this.x + this.width + 2, this.y + this.height);
    ctx.lineTo(this.x - 2,             this.y + this.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ── Corruption core (chest) ──
    ctx.fillStyle = '#e040fb';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    // Diamond / corrupt gem shape
    ctx.moveTo(cx,     this.y + 18);
    ctx.lineTo(cx + 5, this.y + 23);
    ctx.lineTo(cx,     this.y + 28);
    ctx.lineTo(cx - 5, this.y + 23);
    ctx.closePath();
    ctx.fill();

    // ── Head / skull-like ──
    ctx.fillStyle   = '#220033';
    ctx.strokeStyle = '#e040fb';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.ellipse(cx, this.y + 8, 10, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing eye sockets
    const eyeOffX = 3 * fx;
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.ellipse(cx + eyeOffX, this.y + 7, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - eyeOffX * 0.4, this.y + 7, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.strokeStyle = '#e040fb';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#e040fb';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 7, this.y + 2);
    ctx.quadraticCurveTo(cx - 10, this.y - 8, cx - 5, this.y - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 7, this.y + 2);
    ctx.quadraticCurveTo(cx + 10, this.y - 8, cx + 5, this.y - 12);
    ctx.stroke();

    // ── Legs (dark, wispy) ──
    ctx.fillStyle   = '#120018';
    ctx.strokeStyle = '#ad1457';
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    ctx.rect(this.x + 4,  this.y + this.height - 14, 8, 14);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.rect(this.x + 16, this.y + this.height - 14, 8, 14);
    ctx.fill(); ctx.stroke();

    // ── Corruption arm / claw ──
    ctx.strokeStyle = '#e040fb';
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 8;
    const armX = this.facingRight ? this.x + this.width : this.x - 2;
    ctx.beginPath();
    ctx.moveTo(armX, this.y + 18);
    ctx.lineTo(armX + fx * 12, this.y + 16);
    ctx.lineTo(armX + fx * 14, this.y + 14);
    ctx.moveTo(armX + fx * 12, this.y + 16);
    ctx.lineTo(armX + fx * 14, this.y + 18);
    ctx.moveTo(armX + fx * 12, this.y + 16);
    ctx.lineTo(armX + fx * 14, this.y + 21);
    ctx.stroke();

    ctx.restore();
  }
}

