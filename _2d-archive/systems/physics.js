/* =========================================================
   systems/physics.js — Shared physics constants and helpers
   ========================================================= */

export const GRAVITY      = 1800;   // px/s²  — downward acceleration
export const MAX_FALL_SPD = 1400;   // px/s   — terminal velocity
export const MOVE_SPEED   = 280;    // px/s   — horizontal run speed
export const JUMP_IMPULSE = -640;   // px/s   — initial vertical velocity on jump
export const GROUND_DRAG  = 0.18;   // fraction of hSpeed bled per frame when grounded

/**
 * Apply gravity + ground collision to a generic entity.
 * Mutates entity.x, entity.y, entity.vx, entity.vy, entity.onGround.
 *
 * @param {object} entity  — must have: x, y, vx, vy, width, height, onGround
 * @param {number} groundY — world-space Y of the floor surface
 * @param {number} leftWall  — minimum x (left boundary)
 * @param {number} rightWall — maximum x (right boundary, exclusive of entity width)
 * @param {number} dt      — delta time in seconds
 */
export function applyPhysics(entity, groundY, leftWall, rightWall, dt) {
  // Clamp dt to avoid huge leaps after tab regain focus.
  const safeDt = Math.min(dt, 0.05);

  // --- Gravity ---
  entity.vy += GRAVITY * safeDt;
  if (entity.vy > MAX_FALL_SPD) entity.vy = MAX_FALL_SPD;

  // --- Integrate position ---
  entity.x += entity.vx * safeDt;
  entity.y += entity.vy * safeDt;

  // --- Ground collision ---
  const bottom = groundY - entity.height;
  if (entity.y >= bottom) {
    entity.y       = bottom;
    entity.vy      = 0;
    entity.onGround = true;
  } else {
    entity.onGround = false;
  }

  // --- Horizontal boundaries ---
  if (entity.x < leftWall)  entity.x = leftWall;
  if (entity.x > rightWall) entity.x = rightWall;

  // --- NaN / Infinity guard ---
  if (!isFinite(entity.x))  entity.x  = leftWall;
  if (!isFinite(entity.y))  entity.y  = bottom;
  if (!isFinite(entity.vx)) entity.vx = 0;
  if (!isFinite(entity.vy)) entity.vy = 0;
}

/**
 * Apply drag when the player is on the ground and not pressing horizontal keys.
 */
export function applyGroundDrag(entity) {
  if (entity.onGround) {
    entity.vx *= (1 - GROUND_DRAG);
    if (Math.abs(entity.vx) < 1) entity.vx = 0;
  }
}

