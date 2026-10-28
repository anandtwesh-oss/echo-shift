/* =====================================================================
   src/network.js — Trystero P2P wrapper (BitTorrent signaling strategy)
   
   Uses public BitTorrent WebSocket trackers as the signaling channel —
   no server, no API key, no cost. Both peers must share the same roomId.

   Trystero handles WebRTC data channels internally. Once connected,
   the tracker is no longer involved in data transfer.
   ===================================================================== */

import { joinRoom, getRelaySockets, selfId } from 'trystero/torrent'

// A stable, unique app ID so our room namespaces don't collide with
// other Trystero apps using the same trackers.
const APP_ID = 'echo-shift-hero-vs-devil-2026-v1'

// Standard WebTorrent public tracker WebSocket relays
const TRACKER_URLS = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce',
]

// Additional robust public STUN servers for cross-network WebRTC NAT traversal
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
}

export class Network {
  /**
   * @param {string} roomId  — shared code that both players type in
   */
  constructor(roomId) {
    this.roomId = roomId.toLowerCase().trim()
    this.selfId = selfId

    console.log(`[ECHO-NET] Initializing room "${this.roomId}" | App ID: "${APP_ID}" | Self ID: "${selfId}"`)

    this._room = joinRoom(
      {
        appId: APP_ID,
        relayUrls: TRACKER_URLS,
        relayRedundancy: 4,
        rtcConfig: RTC_CONFIG,
      },
      this.roomId
    )

    // Callbacks (set by Game or callers)
    this.onPeerJoin  = null   // (peerId)
    this.onPeerLeave = null   // (peerId)
    this.onPosition  = null   // ({ x, y, z, ry })
    this.onCapture   = null   // ()

    // Multi-subscriber listener sets
    this._peerJoinListeners  = new Set()
    this._peerLeaveListeners = new Set()

    // Build Trystero actions
    const [sendPos,  getPos] = this._room.makeAction('pos')
    const [sendCap,  getCap] = this._room.makeAction('cap')

    this._sendPos = sendPos
    this._sendCap = sendCap

    // Wire incoming handlers
    let firstPosLogged = false
    getPos((data, peerId) => {
      if (!firstPosLogged) {
        firstPosLogged = true
        console.log(`[ECHO-NET] Received first position sync from peer "${peerId}"`)
      }
      if (this.onPosition) this.onPosition(data)
    })

    getCap((_, peerId) => {
      console.log(`[ECHO-NET] Received portal capture packet from peer "${peerId}"`)
      if (this.onCapture) this.onCapture()
    })

    const existingPeers = this._room.getPeers()
    this._hasPeer = Object.keys(existingPeers).length > 0
    if (this._hasPeer) {
      console.log(`[ECHO-NET] Room already has existing connected peers:`, Object.keys(existingPeers))
    }

    this._room.onPeerJoin((peerId) => {
      this._hasPeer = true
      console.log(`[ECHO-NET] >>> PEER JOINED <<< peerId: "${peerId}" | Connected peers:`, Object.keys(this._room.getPeers()))
      if (typeof this.onPeerJoin === 'function') this.onPeerJoin(peerId)
      for (const fn of this._peerJoinListeners) {
        try { fn(peerId) } catch (e) { console.error('[ECHO-NET] Error in peerJoinListener:', e) }
      }
    })

    this._room.onPeerLeave((peerId) => {
      const peers = this._room.getPeers()
      this._hasPeer = Object.keys(peers).length > 0
      console.log(`[ECHO-NET] <<< PEER LEFT <<< peerId: "${peerId}" | Remaining peers:`, Object.keys(peers))
      if (typeof this.onPeerLeave === 'function') this.onPeerLeave(peerId)
      for (const fn of this._peerLeaveListeners) {
        try { fn(peerId) } catch (e) { console.error('[ECHO-NET] Error in peerLeaveListener:', e) }
      }
    })
  }

  /**
   * Diagnostic helper: returns the live connection state of each tracker WebSocket.
   */
  getTrackerStats() {
    try {
      const sockets = getRelaySockets()
      const details = {}
      let openCount = 0
      let totalCount = 0
      for (const [url, ws] of Object.entries(sockets)) {
        totalCount++
        const state = ws ? ws.readyState : 3
        const stateName = state === 0 ? 'CONNECTING' : state === 1 ? 'OPEN' : state === 2 ? 'CLOSING' : 'CLOSED'
        details[url] = stateName
        if (state === 1) openCount++
      }
      return { openCount, totalCount, details }
    } catch {
      return { openCount: 0, totalCount: 0, details: {} }
    }
  }

  /** Add a listener that triggers when an opponent connects. */
  addPeerJoinListener(fn) {
    this._peerJoinListeners.add(fn)
    // If a peer is already connected, notify listener immediately
    if (this.hasPeer) {
      const peers = Object.keys(this._room.getPeers())
      if (peers.length > 0) {
        console.log(`[ECHO-NET] Immediate notification to new listener for peer: "${peers[0]}"`)
        setTimeout(() => fn(peers[0]), 0)
      }
    }
  }

  /** Remove a registered peer join listener. */
  removePeerJoinListener(fn) {
    this._peerJoinListeners.delete(fn)
  }

  /** Send local player transform to the peer. */
  sendPosition(data) {
    if (this._hasPeer) this._sendPos(data)
  }

  /** Notify peer that we captured the portal. */
  sendCapture() {
    if (this._hasPeer) this._sendCap(null)
  }

  /** Whether a peer is currently connected. */
  get hasPeer() {
    return this._hasPeer || Object.keys(this._room.getPeers()).length > 0
  }

  /** Returns map of connected peers */
  getPeers() {
    return this._room.getPeers()
  }

  /** Leave the room and tear down the WebRTC connection. */
  leave() {
    console.log(`[ECHO-NET] Leaving room "${this.roomId}"`)
    this._peerJoinListeners.clear()
    this._peerLeaveListeners.clear()
    this._room.leave()
  }
}



