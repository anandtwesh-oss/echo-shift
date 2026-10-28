/* =====================================================================
   src/ghost.js — Remote player ghost renderer
   
   Receives position/rotation updates from the network (via Game) and
   renders the opponent as an articulated ethereal "echo" in the local world.
   Uses linear interpolation for smooth remote movement and synchronizes
   procedural locomotion animations (walking, running, jumping, breathing).
   ===================================================================== */

import * as THREE from 'three'
import { buildCharacterModel, animateCharacter } from './characters.js'

const LERP_FACTOR = 0.22  // per-frame interpolation speed (fraction of gap to close)
const BODY_HY     = 0.78  // half-height offset to match ground contact

export class RemoteGhost {
  /**
   * @param {'hero'|'devil'} role  — the REMOTE player's role (opposite of local)
   * @param {THREE.Scene}    scene
   */
  constructor(role, scene) {
    this.scene = scene
    this.role  = role

    // Root group for ghost
    this._mesh = new THREE.Group()
    this.charData = buildCharacterModel(role, true)
    this.charData.root.position.y = -BODY_HY
    this._mesh.add(this.charData.root)
    this._mesh.visible = false
    scene.add(this._mesh)

    // Target state from latest network packet
    this._target = new THREE.Vector3()
    this._targetYaw = 0
    this._targetSpeed = 0
    this._targetGrounded = true
    this._targetVy = 0
    this._hasData = false

    // Previous position to calculate speed fallback
    this._prevPos = new THREE.Vector3()
    this._elapsed = 0
  }

  /**
   * Called by game.js when a position packet arrives from the peer.
   * @param {{ x: number, y: number, z: number, ry: number, speed?: number, grounded?: number, vy?: number }} data
   */
  updateTarget(data) {
    if (!isFinite(data.x) || !isFinite(data.y) || !isFinite(data.z)) return
    this._target.set(data.x, data.y, data.z)
    this._targetYaw = data.ry ?? 0

    if (data.speed !== undefined) this._targetSpeed = data.speed
    if (data.grounded !== undefined) this._targetGrounded = data.grounded === 1
    if (data.vy !== undefined) this._targetVy = data.vy

    if (!this._hasData) {
      // First packet — snap directly to position to avoid flying in from origin
      this._mesh.position.copy(this._target)
      this._mesh.rotation.y = this._targetYaw
      this._prevPos.copy(this._target)
      this._hasData = true
      this._mesh.visible = true
      return
    }

    this._hasData = true
    this._mesh.visible = true
  }

  /**
   * Lerp mesh toward the latest received position and animate joints. Call each frame.
   * @param {number} dt  delta time seconds
   */
  update(dt) {
    if (!this._hasData) return
    this._elapsed += dt

    const currentPos = this._mesh.position.clone()

    // Smooth position interpolation
    this._mesh.position.lerp(this._target, LERP_FACTOR)

    // Calculate actual delta velocity if network speed was not provided
    const movedDist = currentPos.distanceTo(this._mesh.position)
    const calculatedSpeed = movedDist / Math.max(0.001, dt)
    const activeSpeed = this._targetSpeed > 0 ? this._targetSpeed : calculatedSpeed

    // Smooth yaw rotation
    const rawDiff = this._targetYaw - this._mesh.rotation.y
    const diff    = ((rawDiff + Math.PI) % (2 * Math.PI)) - Math.PI
    this._mesh.rotation.y += diff * LERP_FACTOR

    // Animate articulated ghost model
    animateCharacter(
      this.charData.parts,
      {
        speed: activeSpeed,
        isGrounded: this._targetGrounded,
        vy: this._targetVy,
      },
      dt,
      this._elapsed
    )
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


