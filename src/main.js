/* =====================================================================
   src/main.js — Entry point and UI flow manager
   
   Manages screen transitions:
     title → waiting (connecting to room) → countdown → gameplay → result
   
   Does NOT own the Three.js renderer — that lives in game.js.
   ===================================================================== */

import { Game } from './game.js'

// ── UI helper: show / hide screens ────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'))
  const el = document.getElementById(id)
  if (el) el.classList.add('active')
}

function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'))
}

// ── Score pip helper (also used in hud resets) ─────────────────────────
function resetHUD() {
  document.getElementById('score-pips-hero').textContent  = '□□□'
  document.getElementById('score-pips-devil').textContent = '□□□'
  document.getElementById('hud-status').textContent = 'Walk into the portal to capture it!'
}

// ── Countdown overlay ─────────────────────────────────────────────────
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

// ── Main application state ────────────────────────────────────────────
let activeGame = null

// ── Title screen setup ────────────────────────────────────────────────
function initTitleScreen() {
  showScreen('screen-title')

  const roomInput = document.getElementById('room-input')
  const btnHero   = document.getElementById('btn-hero')
  const btnDevil  = document.getElementById('btn-devil')

  // Pre-fill room code from URL query param if present (e.g. ?room=ECHO)
  const urlParams = new URLSearchParams(window.location.search)
  const roomParam = urlParams.get('room')
  if (roomParam && !roomInput.value) {
    roomInput.value = roomParam.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  }

  function getRoom() {
    return roomInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ECHO'
  }

  btnHero.addEventListener('click', () => {
    const room = getRoom()
    if (!room) { roomInput.focus(); return }
    startFlow('hero', room)
  })

  btnDevil.addEventListener('click', () => {
    const room = getRoom()
    if (!room) { roomInput.focus(); return }
    startFlow('devil', room)
  })

  // Allow Enter key in room input to focus the first role button
  roomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnHero.focus()
  })
}

// ── Game start flow ───────────────────────────────────────────────────
async function startFlow(role, roomId) {
  // Show waiting screen
  document.getElementById('waiting-code').textContent  = roomId
  document.getElementById('waiting-title').textContent = 'Waiting for opponent…'
  document.getElementById('waiting-hint').textContent  =
    `Share room code "${roomId}" with the other player. They must choose ${role === 'hero' ? 'DEVIL' : 'HERO'}.`
  showScreen('screen-waiting')

  // Cancel button
  const cancelBtn = document.getElementById('btn-cancel')
  let cancelled = false
  const cancelHandler = () => {
    cancelled = true
    cleanup()
    initTitleScreen()
  }
  cancelBtn.addEventListener('click', cancelHandler, { once: true })

  // Set up game instance (connects to network on construction)
  resetHUD()
  activeGame = new Game(role, roomId, onGameEnd)

  // Wait for peer to join
  await waitForPeer(activeGame, () => cancelled)

  if (cancelled) {
    activeGame.stop()
    activeGame = null
    return
  }

  // Remove cancel handler (peer joined)
  cancelBtn.removeEventListener('click', cancelHandler)

  // Update HUD room code
  document.getElementById('hud-room-code').textContent = roomId

  // Run countdown, then start game
  showScreen('hud')
  await runCountdown(['3', '2', '1', 'GO!'], 900)

  // Game is now running
  activeGame.start()

  function cleanup() {
    if (activeGame) { activeGame.stop(); activeGame = null }
  }
}

// ── Wait for peer helper ──────────────────────────────────────────────
function waitForPeer(game, isCancelled) {
  return new Promise(resolve => {
    // Check if peer already joined
    if (game.network.hasPeer) { resolve(); return }

    const prevJoin = game.network.onPeerJoin
    game.network.onPeerJoin = (peerId) => {
      if (typeof prevJoin === 'function') prevJoin(peerId)
      if (!isCancelled()) resolve()
    }

    // Update waiting text
    document.getElementById('waiting-title').textContent = 'Connected to room — waiting for opponent…'
  })
}

// ── Game end handler ──────────────────────────────────────────────────
function onGameEnd(won) {
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

  document.getElementById('btn-again').addEventListener('click', () => {
    if (activeGame) { activeGame.stop(); activeGame = null }
    initTitleScreen()
  }, { once: true })
}

// ── Boot ──────────────────────────────────────────────────────────────
initTitleScreen()

