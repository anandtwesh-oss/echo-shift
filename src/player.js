/* =====================================================================
   src/player.js — Local player controller
   
   Owns:
     - A cannon-es physics body (box, fixedRotation)
     - A Three.js visual mesh group
     - Keyboard input state
     - Mouse pointer-lock camera orbit
   
   Movement: WASD relative to camera yaw, Space to jump.
   Camera: third-person orbit (mouse X → yaw, mouse Y → pitch).
   Physics: velocity set directly for horizontal; cannon-es gravity for Y.
   ===================================================================== */

import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { buildCharacterModel, animateCharacter } from './characters.js'

// ── Constants ─────────────────────────────────────────────────────────
const MAX_MOVE_SPEED = 8.0    // units/sec max horizontal speed
const ACCEL_GROUND   = 55.0   // units/sec^2 acceleration on ground (responsive start)
const DECEL_GROUND   = 42.0   // units/sec^2 deceleration on ground (crisp stop)
const ACCEL_AIR      = 22.0   // units/sec^2 acceleration in air (smooth steering)
const DECEL_AIR      = 6.0    // units/sec^2 deceleration in air (preserves momentum)
const JUMP_VELOCITY  = 11.0   // units/sec upward impulse
const CAM_DIST       = 5.8    // camera orbit radius
const CAM_HEIGHT     = 1.7    // extra height above player pivot
const CAM_PITCH_MIN  = -0.2   // radians (look slightly down minimum)
const CAM_PITCH_MAX  =  0.75  // radians (look up maximum)
const CAM_SENSITIVITY = 0.0022

// Physics body half-extents
const BODY_HX = 0.32
const BODY_HY = 0.78  // total height = 1.56 — matches character model height
const BODY_HZ = 0.32

// Void boundary: fall below this Y to trigger respawn
const VOID_RESPAWN_Y = -12.0

// ── Player class ──────────────────────────────────────────────────────
export class LocalPlayer {
  /**
   * @param {'hero'|'devil'} role
   * @param {CANNON.World}   physicsWorld
   * @param {THREE.Camera}   camera
   * @param {THREE.Scene}    scene
   * @param {THREE.Vector3}  startPos
   */
  constructor(role, physicsWorld, camera, scene, startPos) {
    this.role         = role
    this.physicsWorld = physicsWorld
    this.camera       = camera
    this.scene        = scene
    this.startPos     = startPos.clone()

    // Camera orbit angles
    this.yaw   = 0    // horizontal (Y axis)
    this.pitch = 0.22 // vertical (X axis, clamped)
    this._camPosCurrent = new THREE.Vector3()
    this._camLookCurrent = new THREE.Vector3()

    // Movement direction this frame (computed in update)
    this._moveX = 0
    this._moveZ = 0
    this._speed = 0

    // Jump state
    this.isGrounded   = false
    this._jumpPressed = false

    // Time tracker for animations
    this._elapsed = 0

    // ── Physics body ──────────────────────────────────────────────
    this.body = new CANNON.Body({
      mass:             5,
      linearDamping:    0,   // we handle drag manually so Y gravity isn't damped
      angularDamping:   1,
    })
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(BODY_HX, BODY_HY, BODY_HZ)))
    this.body.fixedRotation = true
    this.body.updateMassProperties()
    this.body.position.set(startPos.x, startPos.y, startPos.z)
    physicsWorld.addBody(this.body)

    // ── Visual mesh & articulated humanoid character ───────────────
    this.mesh = new THREE.Group()
    this.charData = buildCharacterModel(role, false)
    // Offset the model so its feet align with bottom of physics box (-BODY_HY)
    this.charData.root.position.y = -BODY_HY
    this.mesh.add(this.charData.root)
    scene.add(this.mesh)

    // Track mesh facing direction (smooth rotation toward movement dir)
    this._meshYaw   = 0
    this._targetYaw = 0

    // Initialize camera position immediately behind startPos
    this._initCameraPosition(startPos)

    // ── Input state ───────────────────────────────────────────────
    this._keys = {}
    this._boundKeyDown   = this._onKeyDown.bind(this)
    this._boundKeyUp     = this._onKeyUp.bind(this)
    this._boundBlur      = this._onBlur.bind(this)
    this._boundMouseMove = this._onMouseMove.bind(this)
    this._boundClick     = this._requestPointerLock.bind(this)

    window.addEventListener('keydown', this._boundKeyDown)
    window.addEventListener('keyup',   this._boundKeyUp)
    window.addEventListener('blur',    this._boundBlur)
    document.addEventListener('mousemove', this._boundMouseMove)
    const canvas = document.getElementById('canvas')
    if (canvas) canvas.addEventListener('click', this._boundClick)
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Main update — called every frame after physics step.
   * @param {number} dt  delta time seconds
   */
  update(dt) {
    this._elapsed += dt
    const k = this._keys

    // ── Horizontal movement input ───────────────────────────────
    let dirX = 0, dirZ = 0
    if (k['KeyW'] || k['ArrowUp'])    dirZ -= 1
    if (k['KeyS'] || k['ArrowDown'])  dirZ += 1
    if (k['KeyA'] || k['ArrowLeft'])  dirX -= 1
    if (k['KeyD'] || k['ArrowRight']) dirX += 1

    const moving = dirX !== 0 || dirZ !== 0
    let targetVx = 0
    let targetVz = 0

    if (moving) {
      // Normalize diagonal
      const len = Math.sqrt(dirX * dirX + dirZ * dirZ)
      dirX /= len; dirZ /= len

      // Rotate input by camera yaw so W always = "forward" relative to view
      const cos = Math.cos(this.yaw)
      const sin = Math.sin(this.yaw)
      this._moveX = dirX * cos + dirZ * sin
      this._moveZ = -dirX * sin + dirZ * cos

      targetVx = this._moveX * MAX_MOVE_SPEED
      targetVz = this._moveZ * MAX_MOVE_SPEED

      // Smooth mesh rotation toward movement direction
      this._targetYaw = Math.atan2(this._moveX, this._moveZ)
    } else {
      this._moveX = 0
      this._moveZ = 0
    }

    // ── Smooth acceleration / deceleration damping ───────────────
    const accelRate = moving
      ? (this.isGrounded ? ACCEL_GROUND : ACCEL_AIR)
      : (this.isGrounded ? DECEL_GROUND : DECEL_AIR)
    const blend = 1 - Math.exp(-accelRate * dt)

    this.body.velocity.x += (targetVx - this.body.velocity.x) * blend
    this.body.velocity.z += (targetVz - this.body.velocity.z) * blend

    // Current horizontal ground speed
    this._speed = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.z ** 2)

    // ── Ground detection (raycast downward) ─────────────────────
    this._updateGrounded()

    // ── Jump ───────────────────────────────────────────────────
    if (k['Space'] && !this._jumpPressed && this.isGrounded) {
      this.body.velocity.y = JUMP_VELOCITY
      this._jumpPressed    = true
      this.isGrounded      = false
    }
    if (!k['Space']) this._jumpPressed = false

    // ── Void fall check (respawn if player falls into space) ────
    if (this.body.position.y < VOID_RESPAWN_Y) {
      this.resetToStart(this.startPos)
    }

    // ── Sync mesh to physics body ────────────────────────────────
    this.mesh.position.copy(this.body.position)

    // Smooth mesh yaw rotation toward target
    const rawDiff = this._targetYaw - this._meshYaw
    const diff    = ((rawDiff + Math.PI) % (2 * Math.PI)) - Math.PI
    this._meshYaw += diff * Math.min(1.0, 16.0 * dt)
    this.mesh.rotation.y = this._meshYaw

    // ── Articulated procedural animation ─────────────────────────
    animateCharacter(
      this.charData.parts,
      {
        speed: this._speed,
        isGrounded: this.isGrounded,
        vy: this.body.velocity.y,
      },
      dt,
      this._elapsed
    )

    // ── Camera orbit & smooth damping ────────────────────────────
    this._updateCamera(dt)
  }

  /** Teleport player to a new position (used on portal capture or respawn). */
  resetToStart(startPos) {
    this.body.position.set(startPos.x, startPos.y, startPos.z)
    this.body.velocity.set(0, 0, 0)
    this.isGrounded   = false
    this._jumpPressed = false
    this._initCameraPosition(startPos)
  }

  /** Returns current state as plain object for network broadcasting. */
  getNetworkData() {
    const p = this.body.position
    return {
      x: p.x,
      y: p.y,
      z: p.z,
      ry: this._meshYaw,
      speed: Math.round(this._speed * 100) / 100,
      grounded: this.isGrounded ? 1 : 0,
      vy: Math.round(this.body.velocity.y * 10) / 10,
    }
  }

  /** Returns current position as THREE.Vector3 (portal collision check). */
  getPosition() {
    return new THREE.Vector3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    )
  }

  /** Remove all event listeners and scene objects. */
  dispose() {
    window.removeEventListener('keydown',  this._boundKeyDown)
    window.removeEventListener('keyup',    this._boundKeyUp)
    window.removeEventListener('blur',     this._boundBlur)
    document.removeEventListener('mousemove', this._boundMouseMove)
    const canvas = document.getElementById('canvas')
    if (canvas) canvas.removeEventListener('click', this._boundClick)
    this.scene.remove(this.mesh)
    this.physicsWorld.removeBody(this.body)
    if (document.pointerLockElement) document.exitPointerLock()
  }

  // ── Private helpers ──────────────────────────────────────────────────

  _updateGrounded() {
    const bp   = this.body.position
    const from = new CANNON.Vec3(bp.x, bp.y, bp.z)
    const to   = new CANNON.Vec3(bp.x, bp.y - (BODY_HY + 0.22), bp.z)
    const res  = new CANNON.RaycastResult()
    this.physicsWorld.raycastClosest(from, to, { skipBackfaces: true }, res)
    this.isGrounded = res.hasHit && res.body !== this.body
  }

  _initCameraPosition(pos) {
    const cosP = Math.cos(this.pitch)
    const sinP = Math.sin(this.pitch)
    const cosY = Math.cos(this.yaw)
    const sinY = Math.sin(this.yaw)

    this._camPosCurrent.set(
      pos.x + CAM_DIST * sinY * cosP,
      pos.y + CAM_HEIGHT + CAM_DIST * sinP,
      pos.z + CAM_DIST * cosY * cosP
    )
    this._camLookCurrent.set(pos.x, pos.y + 0.9, pos.z)
    this.camera.position.copy(this._camPosCurrent)
    this.camera.lookAt(this._camLookCurrent)
  }

  _updateCamera(dt) {
    const px = this.body.position.x
    const py = this.body.position.y
    const pz = this.body.position.z

    const cosP = Math.cos(this.pitch)
    const sinP = Math.sin(this.pitch)
    const cosY = Math.cos(this.yaw)
    const sinY = Math.sin(this.yaw)

    const targetCx = px + CAM_DIST * sinY * cosP
    const targetCy = py + CAM_HEIGHT + CAM_DIST * sinP
    const targetCz = pz + CAM_DIST * cosY * cosP

    // Smooth position damping for fluid, cinematic camera motion
    const camLerp = 1 - Math.exp(-22 * dt)
    this._camPosCurrent.x += (targetCx - this._camPosCurrent.x) * camLerp
    this._camPosCurrent.y += (targetCy - this._camPosCurrent.y) * camLerp
    this._camPosCurrent.z += (targetCz - this._camPosCurrent.z) * camLerp

    // Smooth look-at target
    const targetLook = new THREE.Vector3(px, py + 0.85, pz)
    this._camLookCurrent.lerp(targetLook, camLerp)

    this.camera.position.copy(this._camPosCurrent)
    this.camera.lookAt(this._camLookCurrent)
  }

  _requestPointerLock() {
    const canvas = document.getElementById('canvas')
    if (canvas && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock()
    }
  }

  _onMouseMove(e) {
    if (document.pointerLockElement !== document.getElementById('canvas')) return
    this.yaw   -= e.movementX * CAM_SENSITIVITY
    this.pitch  = Math.max(CAM_PITCH_MIN,
                    Math.min(CAM_PITCH_MAX, this.pitch + e.movementY * CAM_SENSITIVITY))
  }

  _onKeyDown(e) {
    this._keys[e.code] = true
    // Prevent page scroll for game keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault()
    }
  }

  _onKeyUp(e)  { this._keys[e.code] = false }
  _onBlur()    { this._keys = {} }
}


