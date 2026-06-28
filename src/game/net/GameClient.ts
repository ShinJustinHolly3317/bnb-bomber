import type {
  CharacterId,
  ClientMessage,
  Dir,
  LobbySnapshot,
  MatchSnapshot,
  RoomListEntry,
  ServerMessage,
} from '@bnb/shared'
import { parseServerMessage } from '@bnb/shared'

export type GameClientHandler = (msg: ServerMessage) => void

function defaultWsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined
  if (env) return env
  const host = typeof location !== 'undefined' ? location.hostname : '127.0.0.1'
  const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${host}:8787`
}

export class GameClient {
  private ws: WebSocket | null = null
  private handlers = new Set<GameClientHandler>()
  private connectPromise: Promise<void> | null = null

  playerId = ''
  roomCode = ''
  lobby: LobbySnapshot | null = null
  roomList: RoomListEntry[] = []
  lastSnapshot: MatchSnapshot | null = null

  onMessage(handler: GameClientHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(defaultWsUrl())
      this.ws = ws

      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('WebSocket 連線失敗'))
      ws.onclose = () => {
        this.connectPromise = null
      }
      ws.onmessage = (ev) => {
        const msg = parseServerMessage(String(ev.data))
        if (!msg) return
        if (msg.type === 'connected') this.playerId = msg.playerId
        if (msg.type === 'roomCreated') this.roomCode = msg.roomCode
        if (msg.type === 'roomList') this.roomList = msg.rooms
        if (msg.type === 'lobbyState') this.lobby = msg.room
        if (msg.type === 'matchState') this.lastSnapshot = msg.snapshot
        for (const h of this.handlers) h(msg)
      }
    })

    try {
      await this.connectPromise
    } finally {
      this.connectPromise = null
    }
  }

  private send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(msg))
  }

  createRoom(name: string): void {
    this.send({ type: 'createRoom', name })
  }

  joinRoom(roomCode: string, name: string): void {
    this.send({ type: 'joinRoom', roomCode: roomCode.toUpperCase(), name })
  }

  listRooms(): void {
    this.send({ type: 'listRooms' })
  }

  pickCharacter(characterId: CharacterId): void {
    this.send({ type: 'pickCharacter', characterId })
  }

  setReady(ready: boolean): void {
    this.send({ type: 'setReady', ready })
  }

  sendInput(tick: number, dir: Dir | null, placeBubble: boolean): void {
    this.send({ type: 'input', tick, dir, placeBubble })
  }

  leaveRoom(): void {
    this.send({ type: 'leaveRoom' })
  }

  requestRematch(): void {
    this.send({ type: 'requestRematch' })
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }
}

/** 全域連線（跨 scene 共用） */
let sharedClient: GameClient | null = null

export function getGameClient(): GameClient {
  if (!sharedClient) sharedClient = new GameClient()
  return sharedClient
}

export function resetGameClient(): void {
  sharedClient?.disconnect()
  sharedClient = null
}
