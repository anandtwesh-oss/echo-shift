/* =====================================================================
   src/network.js — Trystero P2P wrapper (BitTorrent signaling strategy)
   
   Uses public BitTorrent WebSocket trackers as the signaling channel —
   no server, no API key, no cost. Both peers must share the same roomId.

   Trystero handles WebRTC data channels internally. Once connected,
   the tracker is no longer involved in data transfer.
   ===================================================================== */

import { joinRoom } from 'trystero/torrent'

// A stable, unique app ID so our room namespaces don't collide with
// other Trystero apps using the same trackers.
const APP_ID = 'echo-shift-hero-vs-devil-2026-v1'

const TRACKER_URLS = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce',
]

export class Network {
  /**
   * @param {string} roomId  — shared code that both players type in
   */
  constructor(roomId) {
    this.roomId = roomId.toLowerCase().trim()
    this._room = joinRoom(
      {
        appId: APP_ID,
        relayUrls: TRACKER_URLS,
        relayRedundancy: 4,
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
    getPos((data) => { if (this.onPosition) this.onPosition(data) })
    getCap(()     => { if (this.onCapture)  this.onCapture()      })

    const existingPeers = this._room.getPeers()
    this._hasPeer = Object.keys(existingPeers).length > 0

    this._room.onPeerJoin((peerId) => {
      this._hasPeer = true
      if (typeof this.onPeerJoin === 'function') this.onPeerJoin(peerId)
      for (const fn of this._peerJoinListeners) {
        try { fn(peerId) } catch (e) { console.error('Error in peerJoinListener:', e) }
      }
    })

    this._room.onPeerLeave((peerId) => {
      const peers = this._room.getPeers()
      this._hasPeer = Object.keys(peers).length > 0
      if (typeof this.onPeerLeave === 'function') this.onPeerLeave(peerId)
      for (const fn of this._peerLeaveListeners) {
        try { fn(peerId) } catch (e) { console.error('Error in peerLeaveListener:', e) }
      }
    })
  }

  /** Add a listener that triggers when an opponent connects. */
  addPeerJoinListener(fn) {
    this._peerJoinListeners.add(fn)
    // If a peer is already connected, notify listener immediately
    if (this.hasPeer) {
      const peers = Object.keys(this._room.getPeers())
      if (peers.length > 0) {
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
    this._peerJoinListeners.clear()
    this._peerLeaveListeners.clear()
    this._room.leave()
  }
}


