import type { WebSocket } from 'ws'

import type { RoomListEntry } from '@bnb/shared'

import { GameRoom } from './GameRoom.js'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

function randomPlayerId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

interface ConnectionState {
  playerId: string
  roomCode: string | null
  browsing: boolean
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>()
  private connections = new Map<WebSocket, ConnectionState>()

  handleConnection(ws: WebSocket): void {
    const playerId = randomPlayerId()
    this.connections.set(ws, { playerId, roomCode: null, browsing: false })
    ws.send(JSON.stringify({ type: 'connected', playerId }))

    ws.on('message', (data) => {
      const raw = typeof data === 'string' ? data : data.toString()
      this.handleMessage(ws, raw)
    })

    ws.on('close', () => {
      this.handleClose(ws)
    })
  }

  private handleMessage(ws: WebSocket, raw: string): void {
    let msg: { type: string; name?: string; roomCode?: string }
    try {
      msg = JSON.parse(raw) as { type: string; name?: string; roomCode?: string }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: '無效 JSON' }))
      return
    }

    const conn = this.connections.get(ws)
    if (!conn) return

    if (msg.type === 'listRooms') {
      conn.browsing = true
      ws.send(JSON.stringify({ type: 'roomList', rooms: this.roomSummaries() }))
      return
    }

    if (msg.type === 'createRoom') {
      this.createRoom(ws, conn, msg.name ?? '玩家1')
      return
    }

    if (msg.type === 'joinRoom') {
      const code = (msg.roomCode ?? '').toUpperCase().trim()
      this.joinRoom(ws, conn, code, msg.name ?? '玩家2')
      return
    }

    if (msg.type === 'leaveRoom') {
      this.leaveRoom(ws, conn, raw)
      return
    }

    const room = conn.roomCode ? this.rooms.get(conn.roomCode) : null
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: '尚未加入房間' }))
      return
    }

    room.handleMessage(conn.playerId, raw)
  }

  /** 玩家離開房間：清掉房號、改回大廳觀看狀態並回傳最新房間列表 */
  private leaveRoom(ws: WebSocket, conn: ConnectionState, raw: string): void {
    if (conn.roomCode) {
      const room = this.rooms.get(conn.roomCode)
      room?.handleMessage(conn.playerId, raw)
      conn.roomCode = null
    }
    conn.browsing = true
    ws.send(JSON.stringify({ type: 'roomList', rooms: this.roomSummaries() }))
    this.broadcastRoomList()
  }

  private createRoom(ws: WebSocket, conn: ConnectionState, name: string): void {
    if (conn.roomCode) {
      ws.send(JSON.stringify({ type: 'error', message: '已在房間中' }))
      return
    }

    let code = randomCode()
    while (this.rooms.has(code)) code = randomCode()

    const room = new GameRoom(
      code,
      conn.playerId,
      name,
      ws,
      () => {
        this.rooms.delete(code)
        this.broadcastRoomList()
      },
      () => this.broadcastRoomList(),
    )
    this.rooms.set(code, room)
    conn.roomCode = code
    conn.browsing = false

    ws.send(JSON.stringify({ type: 'roomCreated', roomCode: code }))
    room.broadcastLobby()
  }

  private joinRoom(ws: WebSocket, conn: ConnectionState, code: string, name: string): void {
    if (!code) {
      ws.send(JSON.stringify({ type: 'error', message: '請輸入房間代碼' }))
      return
    }

    const existing = this.rooms.get(code)
    if (!existing) {
      if (this.tryReconnectAny(ws, conn, code)) return
      ws.send(JSON.stringify({ type: 'error', message: '找不到房間' }))
      return
    }

    if (conn.roomCode && conn.roomCode !== code) {
      ws.send(JSON.stringify({ type: 'error', message: '已在其他房間' }))
      return
    }

    const err = existing.tryJoin(conn.playerId, name, ws)
    if (err) {
      ws.send(JSON.stringify({ type: 'error', message: err }))
      return
    }
    conn.roomCode = code
    conn.browsing = false
  }

  private roomSummaries(): RoomListEntry[] {
    // 最新建立的房間排在最前面，方便玩家看到剛開的房
    return [...this.rooms.values()].reverse().map((room) => room.summary())
  }

  /** 推播最新房間列表給所有正在看大廳（未進房）的連線 */
  private broadcastRoomList(): void {
    const payload = JSON.stringify({ type: 'roomList', rooms: this.roomSummaries() })
    for (const [ws, conn] of this.connections) {
      if (conn.browsing && !conn.roomCode && ws.readyState === 1) {
        ws.send(payload)
      }
    }
  }

  private tryReconnectAny(ws: WebSocket, conn: ConnectionState, code: string): boolean {
    const room = this.rooms.get(code)
    if (!room) return false
    return room.tryReconnect(conn.playerId, ws)
  }

  private handleClose(ws: WebSocket): void {
    const conn = this.connections.get(ws)
    if (!conn) return

    if (conn.roomCode) {
      const room = this.rooms.get(conn.roomCode)
      room?.handleDisconnect(conn.playerId)
    }

    this.connections.delete(ws)
  }
}
