/* =====================================================================
   src/ghost.js — Remote player ghost renderer
   
   Receives position/rotation updates from the network (via Game) and
   renders the opponent as a semi-transparent "echo" in the local world.
   Uses linear interpolation for smooth remote movement.
   ===================================================================== */

import * as THREE from 'three'

const LERP_FACTOR = 0.2   // per-frame interpolation speed (fraction of gap to close)

export class RemoteGhost {
  /**
   * @param {'hero'|'devil'} role  — the REMOTE player's role (opposite of local)
   * @param {THREE.Scene}    scene
   */
  constructor(role, scene) {
    this.scene  = scene
    this._mesh  = _buildGhostMesh(role)
    this._mesh.visible = false
    scene.add(this._mesh)

    // Target position from latest network packet
    this._target = new THREE.Vector3()
    this._targetYaw = 0
    this._hasData = false
  }

  /**
   * Called by game.js when a position packet arrives from the peer.
   * @param {{ x, y, z, ry }} data
   */
  updateTarget(data) {
    if (!isFinite(data.x) || !isFinite(data.y) || !isFinite(data.z)) return
    this._target.set(data.x, data.y, data.z)
    this._targetYaw = data.ry ?? 0
    this._hasData = true
    this._mesh.visible = true
  }

  /**
   * Lerp mesh toward the latest received position. Call each frame.
   * @param {number} dt  delta time (unused here — lerp is frame-based)
   */
  update(_dt) {
    if (!this._hasData) return
    this._mesh.position.lerp(this._target, LERP_FACTOR)

    // Smooth yaw rotation
    const rawDiff = this._targetYaw - this._mesh.rotation.y
    const diff    = ((rawDiff + Math.PI) % (2 * Math.PI)) - Math.PI
    this._mesh.rotation.y += diff * LERP_FACTOR
  }

  /** Remove ghost from the scene. */
  dispose() {
    this.scene.remove(this._mesh)
  }

  /** Hide ghost when peer disconnects. */
  hide() {
    this._mesh.visible = false
    this._hasData = false
  }
}

// ── Ghost mesh — same shape as player but transparent ─────────────────
function _buildGhostMesh(role) {
  const isHero = role === 'hero'
  const group  = new THREE.Group()

  const color    = isHero ? 0x00e5ff : 0xe040fb
  const bodyBase = isHero ? 0x003344 : 0x1a0015

  // Ghost body
  const bodyGeo = new THREE.CapsuleGeometry(0.33, 0.9, 4, 10)
  const bodyMat = new THREE.MeshStandardMaterial({
    color:            bodyBase,
    emissive:         color,
    emissiveIntensity:1.2,
    roughness: 0.5,
    metalness: 0.5,
    transparent: true,
    opacity: 0.38,
  })
  group.add(new THREE.Mesh(bodyGeo, bodyMat))

  // Ghost core gem
  const coreGeo = new THREE.SphereGeometry(0.1, 8, 8)
  const coreMat = new THREE.MeshStandardMaterial({
    color: color, emissive: color, emissiveIntensity: 3,
    transparent: true, opacity: 0.7,
  })
  const core = new THREE.Mesh(coreGeo, coreMat)
  core.position.set(0, 0.15, 0.31)
  group.add(core)

  // Ghost eyes
  const eyeGeo = new THREE.SphereGeometry(0.055, 6, 6)
  const eyeMat = new THREE.MeshStandardMaterial({
    color: color, emissive: color, emissiveIntensity: 3,
    transparent: true, opacity: 0.8,
  })
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
  eyeL.position.set(-0.13, 0.6, 0.3)
  const eyeR = eyeL.clone()
  eyeR.position.set(0.13, 0.6, 0.3)
  group.add(eyeL, eyeR)

  return group
}

