import type { CharacterId } from '../characters/CharacterCatalog'

export const LOBBY_MAX_PLAYERS = 6

export interface LobbySlot {
  occupied: boolean
  name: string
  characterId: CharacterId
  isLocal: boolean
  ready: boolean
}

export interface LobbyRoom {
  id: number
  mapName: string
  players: number
  maxPlayers: number
  status: '等待中' | '對戰中'
}

export interface LobbyState {
  channel: string
  slots: LobbySlot[]
  rooms: LobbyRoom[]
}

export function createEmptyLobby(): LobbyState {
  const slots: LobbySlot[] = Array.from({ length: LOBBY_MAX_PLAYERS }, (_, i) => ({
    occupied: i === 0,
    name: i === 0 ? '你' : '',
    characterId: i === 0 ? 'dao' : 'dao',
    isLocal: i === 0,
    ready: i === 0,
  }))

  return {
    channel: '自由頻道',
    slots,
    rooms: [
      { id: 101, mapName: '村10', players: 2, maxPlayers: 4, status: '等待中' },
      { id: 102, mapName: '村10', players: 4, maxPlayers: 6, status: '對戰中' },
      { id: 103, mapName: '村10', players: 1, maxPlayers: 2, status: '等待中' },
      { id: 104, mapName: '村10', players: 3, maxPlayers: 6, status: '等待中' },
    ],
  }
}

export function occupiedCount(state: LobbyState): number {
  return state.slots.filter((s) => s.occupied).length
}
