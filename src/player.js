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

// ── Constants ─────────────────────────────────────────────────────────
const MOVE_SPEED    = 7.5   // units/sec horizontal
const JUMP_VELOCITY = 11    // units/sec upward impulse
const GROUND_DRAG   = 0.80  // multiplier per frame when no key held (fast stop)
const CAM_DIST      = 6.5   // camera orbit radius
const CAM_HEIGHT    = 1.8   // extra height above player pivot
const CAM_PITCH_MIN = -0.15 // radians (look slightly down minimum)
const CAM_PITCH_MAX =  0.65 // radians (look up maximum)
const CAM_SENSITIVITY = 0.0025

// Physics body half-extents
const BODY_HX = 0.32
const BODY_HY = 0.78  // total height = 1.56 — matches mesh
const BODY_HZ = 0.32

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

    // Camera orbit angles
    this.yaw   = 0    // horizontal (Y axis)
    this.pitch = 0.22 // vertical (X axis, clamped)

    // Movement direction this frame (computed in update)
    this._moveX = 0
    this._moveZ = 0

    // Jump state
    this.isGrounded   = false
    this._jumpPressed = false

    // ── Physics body ──────────────────────────────────────────────
    this.body = new CANNON.Body({
      mass:             5,
      linearDamping:    0,   // we handle drag manually so Y isn't damped
      angularDamping:   1,
    })
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(BODY_HX, BODY_HY, BODY_HZ)))
    this.body.fixedRotation = true
    this.body.updateMassProperties()
    this.body.position.set(startPos.x, startPos.y, startPos.z)
    physicsWorld.addBody(this.body)

    // ── Visual mesh ───────────────────────────────────────────────
    this.mesh = _buildCharMesh(role)
    scene.add(this.mesh)

    // Track mesh facing direction (smooth rotation toward movement dir)
    this._meshYaw    = 0
    this._targetYaw  = 0

    // ── Input state ───────────────────────────────────────────────
    this._keys = {}
    this._boundKeyDown = this._onKeyDown.bind(this)
    this._boundKeyUp   = this._onKeyUp.bind(this)
    this._boundBlur    = this._onBlur.bind(this)
    this._boundMouseMove = this._onMouseMove.bind(this)
    this._boundClick     = this._requestPointerLock.bind(this)

    window.addEventListener('keydown', this._boundKeyDown)
    window.addEventListener('keyup',   this._boundKeyUp)
    window.addEventListener('blur',    this._boundBlur)
    document.addEventListener('mousemove', this._boundMouseMove)
    document.getElementById('canvas').addEventListener('click', this._boundClick)
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Main update — called every frame after physics step.
   * @param {number} dt  delta time seconds
   */
  update(dt) {
    const k = this._keys

    // ── Horizontal movement ─────────────────────────────────────
    let dirX = 0, dirZ = 0
    if (k['KeyW'] || k['ArrowUp'])    dirZ -= 1
    if (k['KeyS'] || k['ArrowDown'])  dirZ += 1
    if (k['KeyA'] || k['ArrowLeft'])  dirX -= 1
    if (k['KeyD'] || k['ArrowRight']) dirX += 1

    const moving = dirX !== 0 || dirZ !== 0

    if (moving) {
      // Normalize diagonal
      const len = Math.sqrt(dirX * dirX + dirZ * dirZ)
      dirX /= len; dirZ /= len

      // Rotate input by camera yaw so W always = "forward" on screen
      const cos = Math.cos(this.yaw)
      const sin = Math.sin(this.yaw)
      this._moveX = dirX * cos + dirZ * sin
      this._moveZ = -dirX * sin + dirZ * cos

      this.body.velocity.x = this._moveX * MOVE_SPEED
      this.body.velocity.z = this._moveZ * MOVE_SPEED

      // Face movement direction (smooth)
      this._targetYaw = Math.atan2(this._moveX, this._moveZ)
    } else {
      // Apply drag when no key held
      this.body.velocity.x *= GROUND_DRAG
      this.body.velocity.z *= GROUND_DRAG
      this._moveX = 0
      this._moveZ = 0
    }

    // ── Ground detection (raycast downward) ─────────────────────
    this._updateGrounded()

    // ── Jump ───────────────────────────────────────────────────
    if (k['Space'] && !this._jumpPressed && this.isGrounded) {
      this.body.velocity.y = JUMP_VELOCITY
      this._jumpPressed    = true
      this.isGrounded      = false
    }
    if (!k['Space']) this._jumpPressed = false

    // ── Sync mesh to physics body ────────────────────────────────
    this.mesh.position.copy(this.body.position)

    // Smooth mesh yaw rotation toward target
    const rawDiff = this._targetYaw - this._meshYaw
    const diff    = ((rawDiff + Math.PI) % (2 * Math.PI)) - Math.PI
    this._meshYaw += diff * 0.18
    this.mesh.rotation.y = this._meshYaw

    // ── Camera orbit ────────────────────────────────────────────
    this._updateCamera()
  }

  /** Teleport player to a new position (used on portal capture). */
  resetToStart(startPos) {
    this.body.position.set(startPos.x, startPos.y, startPos.z)
    this.body.velocity.set(0, 0, 0)
    this.isGrounded   = false
    this._jumpPressed = false
  }

  /** Returns current position as plain object for network broadcasting. */
  getNetworkData() {
    const p = this.body.position
    return { x: p.x, y: p.y, z: p.z, ry: this._meshYaw }
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
    const to   = new CANNON.Vec3(bp.x, bp.y - (BODY_HY + 0.18), bp.z)
    const res  = new CANNON.RaycastResult()
    this.physicsWorld.raycastClosest(from, to, { skipBackfaces: true }, res)
    this.isGrounded = res.hasHit && res.body !== this.body
  }

  _updateCamera() {
    const px = this.body.position.x
    const py = this.body.position.y
    const pz = this.body.position.z

    const cosP = Math.cos(this.pitch)
    const sinP = Math.sin(this.pitch)
    const cosY = Math.cos(this.yaw)
    const sinY = Math.sin(this.yaw)

    const cx = px + CAM_DIST * sinY * cosP
    const cy = py + CAM_HEIGHT + CAM_DIST * sinP
    const cz = pz + CAM_DIST * cosY * cosP

    this.camera.position.set(cx, cy, cz)
    this.camera.lookAt(px, py + 0.9, pz)
  }

  _requestPointerLock() {
    document.getElementById('canvas').requestPointerLock()
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

// ── Character mesh builder ────────────────────────────────────────────
function _buildCharMesh(role) {
  const isHero = role === 'hero'
  const group  = new THREE.Group()

  // ── Body (capsule) ────────────────────────────────────────────────
  // CapsuleGeometry(radius, length, capSegs, radSegs)
  // Total height = length + 2*radius = 0.9 + 2*0.33 = 1.56
  const bodyGeo = new THREE.CapsuleGeometry(0.33, 0.9, 4, 10)
  const bodyMat = new THREE.MeshStandardMaterial({
    color:            isHero ? 0x003344 : 0x1a0015,
    emissive:         isHero ? 0x004d6e : 0x5a0030,
    emissiveIntensity:0.4,
    roughness: 0.35,
    metalness: 0.7,
  })
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat)
  bodyMesh.castShadow = true
  group.add(bodyMesh)

  // ── Energy core / corruption gem (chest glow) ─────────────────────
  const coreGeo = new THREE.SphereGeometry(0.1, 8, 8)
  const coreMat = new THREE.MeshStandardMaterial({
    color:            isHero ? 0x00e5ff : 0xe040fb,
    emissive:         isHero ? 0x00e5ff : 0xe040fb,
    emissiveIntensity:3,
    roughness: 0,
    metalness: 0,
  })
  const coreMesh = new THREE.Mesh(coreGeo, coreMat)
  coreMesh.position.set(0, 0.15, 0.31)
  group.add(coreMesh)

  // ── Eyes ──────────────────────────────────────────────────────────
  const eyeColor = isHero ? 0x00e5ff : 0xff1744
  const eyeGeo   = new THREE.SphereGeometry(0.055, 6, 6)
  const eyeMat   = new THREE.MeshStandardMaterial({
    color: eyeColor, emissive: eyeColor, emissiveIntensity: 3, roughness: 0,
  })
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
  eyeL.position.set(-0.13, 0.6, 0.3)
  const eyeR = eyeL.clone()
  eyeR.position.set(0.13, 0.6, 0.3)
  group.add(eyeL, eyeR)

  if (!isHero) {
    // Devil horns: two thin cones
    const hornGeo = new THREE.ConeGeometry(0.07, 0.38, 5)
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0x330015, emissive: 0xe040fb, emissiveIntensity: 0.6,
    })
    const hornL = new THREE.Mesh(hornGeo, hornMat)
    hornL.position.set(-0.2, 0.88, 0)
    hornL.rotation.z = 0.25
    const hornR = hornL.clone()
    hornR.position.set(0.2, 0.88, 0)
    hornR.rotation.z = -0.25
    group.add(hornL, hornR)
  } else {
    // Hero visor bar
    const visorGeo = new THREE.BoxGeometry(0.35, 0.055, 0.08)
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 2.5,
      transparent: true, opacity: 0.85,
    })
    const visor = new THREE.Mesh(visorGeo, visorMat)
    visor.position.set(0, 0.58, 0.31)
    group.add(visor)
  }

  return group
}

