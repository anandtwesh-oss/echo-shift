/* =====================================================================
   src/game.js — Main 3D game orchestrator
   
   Creates and owns:
     - Three.js WebGL renderer + perspective camera
     - cannon-es physics world
     - The universe scene (via world.js)
     - LocalPlayer (own character, physics, camera, input)
     - RemoteGhost (peer's echo)
     - Network (Trystero P2P)
   
   Runs the game loop, checks portal captures, manages score & HUD.
   ===================================================================== */

import * as THREE from 'three'
import * as CANNON from 'cannon-es'

import { buildWorld, animateWorld, PORTAL_CAPTURE_RADIUS, PORTAL_COOLDOWN_SEC } from './world.js'
import { LocalPlayer } from './player.js'
import { RemoteGhost  } from './ghost.js'
import { Network      } from './network.js'

export class Game {
  /**
   * @param {'hero'|'devil'} role        — this player's role
   * @param {string}          roomId      — shared room code
   * @param {Function}        onGameEnd   — called with (won: boolean)
   */
  constructor(role, roomId, onGameEnd) {
    this.role      = role
    this.onGameEnd = onGameEnd

    // ── Renderer ──────────────────────────────────────────────────
    const canvas = document.getElementById('canvas')
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // ── Camera ────────────────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(
      68, window.innerWidth / window.innerHeight, 0.1, 200
    )

    // ── Physics world ─────────────────────────────────────────────
    this.physics = new CANNON.World()
    this.physics.gravity.set(0, -22, 0)
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics)
    this.physics.allowSleep = false

    // ── Build scene ───────────────────────────────────────────────
    const ghostRole = role === 'hero' ? 'devil' : 'hero'
    const worldData = buildWorld(role, this.physics)
    this.worldData     = worldData

    this.scene         = worldData.scene
    this.portalMesh    = worldData.portalMesh
    this.outerRing     = worldData.outerRing
    this.discMesh      = worldData.discMesh
    this.portalPos     = worldData.portalPosition   // { x, y, z }
    this.playerStart   = worldData.playerStart       // THREE.Vector3

    // ── Camera shake fx ───────────────────────────────────────────
    this._camShake     = 0

    // ── Player & Ghost ────────────────────────────────────────────
    this.player = new LocalPlayer(role, this.physics, this.camera, this.scene, this.playerStart)
    this.ghost  = new RemoteGhost(ghostRole, this.scene)

    // ── Score ─────────────────────────────────────────────────────
    this.myScore    = 0
    this.theirScore = 0
    this._portalCooldown = 0
    this._gameOver       = false
    this._paused         = false

    // ── Network ───────────────────────────────────────────────────
    this.network = new Network(roomId)

    this.network.onPosition  = (data) => this.ghost.updateTarget(data)
    this.network.onCapture   = ()     => this._onPeerCapture()
    this.network.onPeerJoin  = ()     => {
      this._setStatus('Opponent connected.')
      this._updateConnectionIndicator(true)
    }
    this.network.onPeerLeave = ()     => {
      this._setStatus('Opponent disconnected.')
      this.ghost.hide()
      this._updateConnectionIndicator(false)
    }

    // ── HUD setup ─────────────────────────────────────────────────
    this._initHUD(roomId)

    // ── Loop state ────────────────────────────────────────────────
    this._elapsed  = 0
    this._lastTime = null
    this._posTimer = 0
    this._raf      = null

    // ── Resize ────────────────────────────────────────────────────
    this._boundResize = this._onResize.bind(this)
    window.addEventListener('resize', this._boundResize)
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  start() {
    console.log('[ECHO-GAME] 3D render & physics loop starting...')
    this._lastTime = performance.now()
    this._loop(this._lastTime)
  }

  stop() {
    console.log('[ECHO-GAME] Stopping game instance...')
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
    this.player.dispose()
    this.ghost.dispose()
    this.network.leave()
    window.removeEventListener('resize', this._boundResize)
    // Note: Do not call renderer.dispose() here as it permanently invalidates
    // the WebGL context on the shared <canvas id="canvas"> element.
  }

  // ── Main loop ─────────────────────────────────────────────────────────

  _loop(timestamp) {
    this._raf = requestAnimationFrame(t => this._loop(t))

    if (this._lastTime === null) { this._lastTime = timestamp; return }
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05)
    this._lastTime = timestamp
    this._elapsed += dt

    if (this._paused || this._gameOver) {
      // Still render so the scene doesn't freeze
      this.renderer.render(this.scene, this.camera)
      return
    }

    // ── Physics step ────────────────────────────────────────────
    this.physics.fixedStep(1 / 60, dt)

    // ── Player update (input + camera) ───────────────────────────
    this.player.update(dt)

    // ── Ghost interpolation ──────────────────────────────────────
    this.ghost.update(dt)

    // ── Animate dynamic world systems (portal, particles, obelisks, clouds) ─
    animateWorld(this.worldData, dt, this._elapsed)

    // ── Portal capture check ─────────────────────────────────────
    this._portalCooldown = Math.max(0, this._portalCooldown - dt)
    this._checkPortalCapture()

    // ── Broadcast position at ~20 Hz ────────────────────────────
    this._posTimer += dt
    if (this._posTimer >= 0.05) {
      this._posTimer = 0
      this.network.sendPosition(this.player.getNetworkData())
    }

    // ── Camera shake impulse (e.g. portal capture) ───────────────
    if (this._camShake > 0) {
      this._camShake -= dt
      const mag = this._camShake * 0.16
      this.camera.position.x += (Math.random() - 0.5) * mag
      this.camera.position.y += (Math.random() - 0.5) * mag
    }

    // ── Render ───────────────────────────────────────────────────
    this.renderer.render(this.scene, this.camera)
  }

  // ── Portal logic ──────────────────────────────────────────────────────

  _checkPortalCapture() {
    if (this._portalCooldown > 0) return

    const pp   = this.player.getPosition()
    const dist = Math.sqrt(
      (pp.x - this.portalPos.x) ** 2 +
      (pp.y - this.portalPos.y) ** 2 +
      (pp.z - this.portalPos.z) ** 2
    )

    if (dist <= PORTAL_CAPTURE_RADIUS) {
      this._portalCooldown = PORTAL_COOLDOWN_SEC
      this.myScore++
      this.network.sendCapture()
      this._doCaptureFX(true)
      this._updateHUD()

      if (this.myScore >= 3) {
        this._endGame(true)
      } else {
        // Reset both players' positions on every capture (the Echo Shift)
        this._resetPlayerPositions()
        this._setStatus(`Portal captured! (${this.myScore}/3) — positions reset`)
      }
    }
  }

  /** Called when network reports the peer captured their portal. */
  _onPeerCapture() {
    this.theirScore++
    this._doCaptureFX(false)
    this._updateHUD()

    if (this.theirScore >= 3) {
      this._endGame(false)
    } else {
      // Peer's capture also resets my position (cross-universe ripple)
      this._resetPlayerPositions()
      this._setStatus(`Opponent captured their portal! (${this.theirScore}/3)`)
    }
  }

  _resetPlayerPositions() {
    this.player.resetToStart(this.playerStart)
  }

  _doCaptureFX(isOwnCapture) {
    const flash = document.getElementById('flash')
    const color = isOwnCapture
      ? (this.role === 'hero' ? '#00e5ff' : '#e040fb')
      : (this.role === 'hero' ? '#e040fb' : '#00e5ff')
    flash.style.background = color
    flash.classList.remove('active')
    void flash.offsetWidth  // reflow to restart animation
    flash.classList.add('active')

    // Camera shake impulse
    this._camShake = 0.38

    // Pulse portal emissive intensity & point light
    if (this.portalMesh) this.portalMesh.material.emissiveIntensity = 8
    if (this.worldData && this.worldData.portalLight) {
      this.worldData.portalLight.intensity = 10
    }
    setTimeout(() => {
      if (this.portalMesh) this.portalMesh.material.emissiveIntensity = 3.0
      if (this.worldData && this.worldData.portalLight) {
        this.worldData.portalLight.intensity = 2.5
      }
    }, 380)
  }

  // ── Win / Lose ────────────────────────────────────────────────────────

  _endGame(won) {
    this._gameOver = true
    this._paused   = true
    if (this.onGameEnd) this.onGameEnd(won)
  }

  // ── HUD management ────────────────────────────────────────────────────

  _initHUD(roomId) {
    document.getElementById('hud-room-code').textContent = roomId.toUpperCase()
    this._updateConnectionIndicator(this.network.hasPeer)
    this._updateHUD()
  }

  _updateConnectionIndicator(connected) {
    const el = document.getElementById('hud-peer-status')
    if (!el) return
    if (connected) {
      el.textContent = '● LIVE'
      el.className = 'hud-status-badge badge-connected'
    } else {
      el.textContent = '● WAITING'
      el.className = 'hud-status-badge badge-disconnected'
    }
  }

  _updateHUD() {
    const heroScore  = this.role === 'hero' ? this.myScore    : this.theirScore
    const devilScore = this.role === 'devil' ? this.myScore   : this.theirScore

    const toPips = (n) => '◆'.repeat(n) + '◇'.repeat(Math.max(0, 3 - n))
    document.getElementById('score-pips-hero').textContent  = toPips(heroScore)
    document.getElementById('score-pips-devil').textContent = toPips(devilScore)
  }

  _setStatus(msg) {
    const el = document.getElementById('hud-status')
    if (el) el.textContent = msg
  }

  // ── Resize ────────────────────────────────────────────────────────────

  _onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }
}

