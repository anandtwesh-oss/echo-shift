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

export class Network {
  /**
   * @param {string} roomId  — shared code that both players type in
   */
  constructor(roomId) {
    this._room = joinRoom({ appId: APP_ID }, roomId.toLowerCase().trim())

    // Callbacks (set by Game)
    this.onPeerJoin  = null   // ()
    this.onPeerLeave = null   // ()
    this.onPosition  = null   // ({ x, y, z, ry })
    this.onCapture   = null   // ()

    // Build Trystero actions
    const [sendPos,  getPos]     = this._room.makeAction('pos')
    const [sendCap,  getCap]     = this._room.makeAction('cap')

    this._sendPos = sendPos
    this._sendCap = sendCap

    // Wire incoming handlers
    getPos((data) => { if (this.onPosition) this.onPosition(data) })
    getCap(()     => { if (this.onCapture)  this.onCapture()      })

    this._hasPeer = false
    this._room.onPeerJoin((peerId) => {
      this._hasPeer = true
      if (this.onPeerJoin) this.onPeerJoin(peerId)
    })
    this._room.onPeerLeave((peerId) => {
      const peers = this._room.getPeers()
      this._hasPeer = Object.keys(peers).length > 0
      if (this.onPeerLeave) this.onPeerLeave(peerId)
    })
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
  get hasPeer() { return this._hasPeer }

  /** Returns map of connected peers */
  getPeers() {
    return this._room.getPeers()
  }

  /** Leave the room and tear down the WebRTC connection. */
  leave() {
    this._room.leave()
  }
}

