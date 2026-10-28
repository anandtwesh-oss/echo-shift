/* =====================================================================
   src/main.js — Entry point and UI flow manager
   
   Manages screen transitions:
     title → waiting (connecting to opponent) → countdown → gameplay → result
   
   Ensures:
     - Enter key navigates and starts connection cleanly without ghost clicks
     - Event listeners are registered only once at boot
     - "Connecting to opponent…" is shown only while connection is pending
     - Robust timeout handling with clear error and retry options
     - Inactive screens are hidden so keyboard events do not trigger hidden buttons
   ===================================================================== */

import { Game, getSharedRenderer } from './game.js'

// ── Application State ─────────────────────────────────────────────────
let activeGame       = null
let isFlowActive     = false
let currentRole      = 'hero'
let currentRoom      = 'ECHO'
let cancelConnection = null

// ── DOM References ────────────────────────────────────────────────────
const roomInput      = document.getElementById('room-input')
const btnHero        = document.getElementById('btn-hero')
const btnDevil       = document.getElementById('btn-devil')
const waitingSpinner = document.getElementById('waiting-spinner')
const waitingTitle   = document.getElementById('waiting-title')
const waitingCode    = document.getElementById('waiting-code')
const waitingHint    = document.getElementById('waiting-hint')
const btnRetry       = document.getElementById('btn-retry')
const btnCancel      = document.getElementById('btn-cancel')
const btnAgain       = document.getElementById('btn-again')
const hudRoomCode    = document.getElementById('hud-room-code')

// ── UI Helper: Show Screen ────────────────────────────────────────────
function showScreen(id) {
  // Always blur any currently focused element to prevent stray Enter clicks
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur()
  }

  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'))
  const el = document.getElementById(id)
  if (el) el.classList.add('active')
}

// ── Score Pip Helper ──────────────────────────────────────────────────
function resetHUD() {
  document.getElementById('score-pips-hero').textContent  = '◇◇◇'
  document.getElementById('score-pips-devil').textContent = '◇◇◇'
  document.getElementById('hud-status').textContent = 'Walk into the portal to capture it!'
}

// ── Countdown Overlay ─────────────────────────────────────────────────
function runCountdown(steps, intervalMs) {
  return new Promise(resolve => {
    const overlay = document.getElementById('countdown')
    const text    = document.getElementById('countdown-text')
    overlay.classList.add('active')
    let i = 0

    function tick() {
      if (i >= steps.length) {
        overlay.classList.remove('active')
        resolve()
        return
      }
      text.textContent = steps[i]
      // Re-trigger CSS animation each step
      text.style.animation = 'none'
      void text.offsetWidth
      text.style.animation = ''
      i++
      setTimeout(tick, intervalMs)
    }

    tick()
  })
}

// ── Room & Role Helpers ───────────────────────────────────────────────
function getRoom() {
  return roomInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ECHO'
}

function selectRole(role) {
  currentRole = role
  if (role === 'hero') {
    btnHero.classList.add('role-selected')
    btnDevil.classList.remove('role-selected')
  } else {
    btnDevil.classList.add('role-selected')
    btnHero.classList.remove('role-selected')
  }
}

function showTitleScreen() {
  isFlowActive = false
  if (cancelConnection) {
    cancelConnection()
    cancelConnection = null
  }
  if (activeGame) {
    activeGame.stop()
    activeGame = null
  }
  selectRole(currentRole)
  showScreen('screen-title')
}

// ── Game Start Flow ───────────────────────────────────────────────────
async function startFlow(role, roomId) {
  if (isFlowActive) return
  isFlowActive = true
  currentRole = role
  currentRoom = roomId

  const oppositeRole = role === 'hero' ? 'DEVIL' : 'HERO'
  console.log(`[ECHO-FLOW] Starting game flow for role="${role}", room="${roomId}"`)

  // Setup waiting screen UI
  waitingCode.textContent  = roomId
  waitingTitle.textContent = 'Waiting for opponent…'
  const badgeEl = document.getElementById('waiting-status-badge')
  if (badgeEl) {
    badgeEl.textContent = `● LOBBY READY · AWAITING ${oppositeRole}`
    badgeEl.className = 'hud-status-badge badge-connected'
  }

  const diagEl = document.getElementById('waiting-diag')
  if (diagEl) diagEl.textContent = 'Signaling: Connecting to trackers…'

  waitingHint.innerHTML =
    `Room: <strong>${roomId}</strong> · Playing as <strong>${role.toUpperCase()}</strong>.<br/>` +
    `Waiting for the other player to join as <strong>${oppositeRole}</strong>.`

  waitingSpinner.classList.remove('hidden')
  btnRetry.classList.add('hidden')
  btnCancel.classList.remove('hidden')

  const timerEl = document.getElementById('waiting-timer')
  if (timerEl) timerEl.textContent = 'Waiting for 0s…'

  showScreen('screen-waiting')

  // Clean up any stale game
  if (activeGame) {
    console.log('[ECHO-FLOW] Cleaning up previous active game instance')
    activeGame.stop()
    activeGame = null
  }

  resetHUD()

  // Track cancellation and waiting timer
  let isCancelled = false
  let waitSeconds = 0
  let timerInterval = setInterval(() => {
    waitSeconds++
    if (timerEl) timerEl.textContent = `Waiting for ${waitSeconds}s…`

    // Update live tracker diagnostics
    if (activeGame && activeGame.network && diagEl) {
      const stats = activeGame.network.getTrackerStats()
      if (stats.openCount > 0) {
        diagEl.textContent = `Signaling: ${stats.openCount}/${stats.totalCount} Trackers Connected · Awaiting ${oppositeRole}`
        if (badgeEl && !activeGame.network.hasPeer) {
          badgeEl.textContent = `● LOBBY READY · AWAITING ${oppositeRole}`
          badgeEl.className = 'hud-status-badge badge-connected'
        }
      } else {
        diagEl.textContent = `Signaling: Connecting to trackers (0/${stats.totalCount})…`
        if (badgeEl && !activeGame.network.hasPeer) {
          badgeEl.textContent = '● CONNECTING TO MULTIVERSE TRACKERS…'
          badgeEl.className = 'hud-status-badge badge-disconnected'
        }
      }
    }

    if (waitSeconds === 40) {
      waitingHint.innerHTML =
        `Room: <strong>${roomId}</strong> · Playing as <strong>${role.toUpperCase()}</strong>.<br/>` +
        `Still waiting? Ensure Player 2 opens the game, enters room <strong>${roomId}</strong>, and picks <strong>${oppositeRole}</strong>.<br/>` +
        `<span style="color: #00e5ff;">Tip:</span> You can use "Copy Link" to send them a direct link!`
    }
  }, 1000)

  const clearWaitTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  cancelConnection = () => {
    console.log('[ECHO-FLOW] Connection cancelled by user')
    isCancelled = true
    clearWaitTimer()
    if (activeGame) {
      activeGame.stop()
      activeGame = null
    }
    isFlowActive = false
  }

  // Set up new game instance (joins Trystero WebTorrent room)
  try {
    console.log(`[ECHO-FLOW] Creating Game instance for role="${role}", room="${roomId}"...`)
    activeGame = new Game(role, roomId, onGameEnd)
    console.log('[ECHO-FLOW] Game instance created successfully.')
  } catch (err) {
    console.error('[ECHO-FLOW] Fatal error creating Game instance:', err)
    clearWaitTimer()
    waitingSpinner.classList.add('hidden')
    waitingTitle.textContent = 'Failed to Initialize'
    waitingHint.innerHTML = `<span style="color:#ff5252;"><strong>Error:</strong> ${err.message || String(err)}</span><br/><small>Check browser console (F12) for details. Try refreshing or a different browser.</small>`
    if (diagEl) diagEl.textContent = `Init error: ${err.constructor?.name || 'Error'}`
    btnRetry.classList.remove('hidden')
    isFlowActive = false
    return
  }

  // Wait for peer to connect with accurate state feedback
  let connectedPeerId = null
  try {
    console.log('[ECHO-FLOW] Awaiting peer connection...')
    await waitForPeer(activeGame, () => isCancelled, (state, peerId) => {
      if (state === 'ready') {
        waitingTitle.textContent = 'Waiting for opponent…'
        if (badgeEl) {
          badgeEl.textContent = `● LOBBY READY · AWAITING ${oppositeRole}`
          badgeEl.className = 'hud-status-badge badge-connected'
        }
      } else if (state === 'connecting') {
        waitingTitle.textContent = 'Opponent detected! Establishing connection…'
        if (badgeEl) {
          badgeEl.textContent = '● PEER DETECTED · NEGOTIATING WEBRTC'
          badgeEl.className = 'hud-status-badge badge-connected'
        }
      } else if (state === 'connected') {
        connectedPeerId = peerId
        console.log(`[ECHO-FLOW] Peer handshake successful! Peer ID: "${peerId}"`)
        waitingTitle.textContent = 'Opponent connected! Starting match…'
        if (badgeEl) {
          badgeEl.textContent = '● PEER CONNECTED'
          badgeEl.className = 'hud-status-badge badge-connected'
        }
        if (diagEl) {
          diagEl.textContent = `Signaling: Connected · Peer: ${peerId ? peerId.slice(0, 8) + '...' : 'OK'}`
        }
      }
    })
  } catch (err) {
    clearWaitTimer()
    if (isCancelled) return

    console.warn('[ECHO-FLOW] waitForPeer error:', err)
    waitingTitle.textContent = 'Connection Cancelled'
    waitingSpinner.classList.add('hidden')
    isFlowActive = false
    return
  }

  clearWaitTimer()
  if (isCancelled) return
  cancelConnection = null

  // Opponent successfully connected!
  console.log('[ECHO-FLOW] Opponent confirmed connected. Executing transition to countdown...')
  waitingTitle.textContent = 'Opponent connected! Starting match…'
  waitingSpinner.classList.add('hidden')
  if (badgeEl) {
    badgeEl.textContent = '● PEER CONNECTED'
    badgeEl.className = 'hud-status-badge badge-connected'
  }
  await new Promise(r => setTimeout(r, 400))

  if (isCancelled) return

  try {
    // Update HUD and start countdown
    hudRoomCode.textContent = roomId
    console.log('[ECHO-FLOW] Showing HUD...')
    showScreen('hud')

    console.log('[ECHO-FLOW] Running countdown overlay...')
    await runCountdown(['3', '2', '1', 'GO!'], 800)

    // Start 3D gameplay loop
    console.log('[ECHO-FLOW] Countdown finished. Invoking activeGame.start()...')
    activeGame.start()
    console.log('[ECHO-FLOW] activeGame.start() completed. Live match active!')
  } catch (transitionErr) {
    console.error('[ECHO-FLOW] Error during countdown/gameplay transition:', transitionErr)
  }
}

// ── Wait For Peer Helper ──────────────────────────────────────────────
function waitForPeer(game, isCancelled, onStateChange) {
  return new Promise((resolve) => {
    // If peer is already connected, notify and resolve immediately
    if (game.network.hasPeer) {
      const existingPeers = Object.keys(game.network.getPeers())
      const pId = existingPeers[0] || 'remote'
      console.log(`[ECHO-FLOW] Peer already present at waitForPeer call: "${pId}"`)
      if (onStateChange) onStateChange('connected', pId)
      resolve()
      return
    }

    if (onStateChange) onStateChange('ready')

    const peerHandler = (peerId) => {
      console.log(`[ECHO-FLOW] peerHandler invoked with peerId: "${peerId}"`)
      game.network.removePeerJoinListener(peerHandler)
      if (onStateChange) onStateChange('connected', peerId)
      if (!isCancelled()) {
        resolve()
      }
    }

    game.network.addPeerJoinListener(peerHandler)
  })
}

// ── Game End Handler ──────────────────────────────────────────────────
function onGameEnd(won) {
  isFlowActive = false
  const titleEl = document.getElementById('result-title')
  const subEl   = document.getElementById('result-sub')

  if (won) {
    titleEl.textContent = '🏆  YOU WIN!'
    titleEl.style.color = '#00e5ff'
    subEl.textContent   = 'You captured the portal 3 times. The Echo Shift is yours.'
  } else {
    titleEl.textContent = '💀  YOU LOSE…'
    titleEl.style.color = '#e040fb'
    subEl.textContent   = 'The opponent claimed the portal. Reality collapses around you.'
  }

  showScreen('screen-result')
}

// ── Global Event Handlers Setup (Run ONCE at boot) ────────────────────
function setupEventListeners() {
  // Role Buttons: Click immediately selects role and starts flow
  btnHero.addEventListener('click', (e) => {
    e.preventDefault()
    if (isFlowActive) return
    selectRole('hero')
    btnHero.blur()
    startFlow('hero', getRoom())
  })

  btnDevil.addEventListener('click', (e) => {
    e.preventDefault()
    if (isFlowActive) return
    selectRole('devil')
    btnDevil.blur()
    startFlow('devil', getRoom())
  })

  // Room Input: Pressing Enter starts flow with currently selected role
  roomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (isFlowActive) return
      const room = getRoom()
      if (!room) {
        roomInput.focus()
        return
      }
      roomInput.blur()
      startFlow(currentRole, room)
    }
  })

  // Waiting Screen Cancel Button
  btnCancel.addEventListener('click', (e) => {
    e.preventDefault()
    showTitleScreen()
  })

  // Waiting Screen Retry Button
  btnRetry.addEventListener('click', (e) => {
    e.preventDefault()
    if (cancelConnection) {
      cancelConnection()
      cancelConnection = null
    }
    startFlow(currentRole, currentRoom)
  })

  // Copy Room Code Buttons
  const copyCode = (btn, code) => {
    navigator.clipboard?.writeText(code).then(() => {
      const orig = btn.textContent
      btn.textContent = '✓ COPIED!'
      btn.classList.add('btn-copied')
      setTimeout(() => {
        btn.textContent = orig
        btn.classList.remove('btn-copied')
      }, 1500)
    }).catch(() => {})
  }

  const btnWaitingCopy = document.getElementById('btn-waiting-copy')
  if (btnWaitingCopy) {
    btnWaitingCopy.addEventListener('click', (e) => {
      e.preventDefault()
      copyCode(btnWaitingCopy, currentRoom)
    })
  }

  const btnWaitingCopyLink = document.getElementById('btn-waiting-copy-link')
  if (btnWaitingCopyLink) {
    btnWaitingCopyLink.addEventListener('click', (e) => {
      e.preventDefault()
      const oppositeRole = currentRole === 'hero' ? 'devil' : 'hero'
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoom)}&role=${oppositeRole}`
      copyCode(btnWaitingCopyLink, inviteUrl)
    })
  }

  const btnHudCopy = document.getElementById('btn-hud-copy')
  if (btnHudCopy) {
    btnHudCopy.addEventListener('click', (e) => {
      e.preventDefault()
      copyCode(btnHudCopy, currentRoom)
    })
  }

  // Result Screen Play Again Button
  btnAgain.addEventListener('click', (e) => {
    e.preventDefault()
    showTitleScreen()
  })

  // Global Keydown Handler: Handle Enter on Retry screen or Esc
  window.addEventListener('keydown', (e) => {
    // If connection timed out and retry button is visible, Enter triggers retry
    if (e.key === 'Enter' && !btnRetry.classList.contains('hidden')) {
      const waitingScreen = document.getElementById('screen-waiting')
      if (waitingScreen && waitingScreen.classList.contains('active')) {
        e.preventDefault()
        btnRetry.click()
      }
    }
  })
}

// ── Application Boot ──────────────────────────────────────────────────
function init() {
  // Eagerly initialize the shared WebGL renderer at boot so any WebGL
  // context failure is surfaced immediately and clearly, not buried
  // inside the Game constructor during a connection attempt.
  try {
    getSharedRenderer()
    console.log('[ECHO-FLOW] WebGL context ready at boot.')
  } catch (err) {
    console.error('[ECHO-FLOW] CRITICAL: WebGL initialization failed at boot:', err)
    // Show a user-facing error on the title screen
    const storyEl = document.querySelector('#screen-title .story')
    if (storyEl) {
      storyEl.innerHTML = `<span style="color:#ff5252;font-weight:bold;">⚠ WebGL Error: ${err.message || 'Could not initialize 3D renderer.'}<br>Please try a different browser or enable hardware acceleration.</span>`
    }
    return
  }

  // Pre-fill room code from URL parameter if present (?room=ECHO)
  const urlParams = new URLSearchParams(window.location.search)
  const roomParam = urlParams.get('room')
  if (roomParam) {
    roomInput.value = roomParam.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  }

  // Pre-fill role from URL parameter if present (?role=devil or ?role=hero)
  const roleParam = urlParams.get('role')?.toLowerCase()
  if (roleParam === 'devil' || roleParam === 'hero') {
    selectRole(roleParam)
  } else {
    selectRole('hero')
  }

  // Set up listeners once
  setupEventListeners()

  // Display initial title screen
  showTitleScreen()
}

init()
