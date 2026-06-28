import type { CharacterId } from './characters.js'

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Facing = Dir

export type RoomPhase = 'lobby' | 'match' | 'ended'

export interface LobbySlotSnapshot {
  slot: number
  occupied: boolean
  playerId: string | null
  name: string
  characterId: CharacterId
  ready: boolean
  isHost: boolean
}

export interface LobbySnapshot {
  roomCode: string
  phase: RoomPhase
  mapName: string
  slots: LobbySlotSnapshot[]
  yourPlayerId: string
  yourSlot: number
}

/** 大廳房間列表的單筆摘要 */
export interface RoomListEntry {
  code: string
  hostName: string
  mapName: string
  players: number
  maxPlayers: number
  phase: RoomPhase
}

export interface PlayerInput {
  dir: Dir | null
  placeBubble: boolean
}

export interface MatchPlayerConfig {
  playerId: string
  slot: number
  name: string
  characterId: CharacterId
}

export interface BubbleSnapshot {
  id: number
  ownerId: string
  col: number
  row: number
}

export interface ItemSnapshot {
  id: number
  col: number
  row: number
  kind: string
}

/** 這個 tick 發生的水球爆炸事件（供 client 播放爆炸動畫） */
export interface ExplosionEvent {
  col: number
  row: number
  tiles: { col: number; row: number }[]
}

export interface FighterSnapshot {
  playerId: string
  slot: number
  name: string
  characterId: CharacterId
  x: number
  y: number
  facing: Facing
  hp: number
  trapped: boolean
  dead: boolean
  moveSpeed: number
  bubblePower: number
  maxBubbles: number
}

export interface MatchSnapshot {
  tick: number
  tiles: number[][]
  fighters: FighterSnapshot[]
  bubbles: BubbleSnapshot[]
  items: ItemSnapshot[]
  // 僅這個 tick 發生的爆炸（state snapshot / reconnect 時為空陣列）
  explosions: ExplosionEvent[]
  finished: boolean
  winnerId: string | null
  winnerLabel: string | null
}

/** Client → Server */
export type ClientMessage =
  | { type: 'createRoom'; name: string }
  | { type: 'joinRoom'; roomCode: string; name: string }
  | { type: 'listRooms' }
  | { type: 'pickCharacter'; characterId: CharacterId }
  | { type: 'setReady'; ready: boolean }
  | { type: 'input'; tick: number; dir: Dir | null; placeBubble: boolean }
  | { type: 'leaveRoom' }
  | { type: 'requestRematch' }

/** Server → Client */
export type ServerMessage =
  | { type: 'connected'; playerId: string }
  | { type: 'roomCreated'; roomCode: string }
  | { type: 'roomList'; rooms: RoomListEntry[] }
  | { type: 'lobbyState'; room: LobbySnapshot }
  | { type: 'matchStart'; seed: number; tickRate: number; players: MatchPlayerConfig[] }
  | { type: 'matchState'; tick: number; snapshot: MatchSnapshot }
  | { type: 'matchEnd'; winnerId: string | null; winnerLabel: string | null }
  | { type: 'error'; message: string }

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw) as ClientMessage
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return null
    return msg
  } catch {
    return null
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const msg = JSON.parse(raw) as ServerMessage
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return null
    return msg
  } catch {
    return null
  }
}
