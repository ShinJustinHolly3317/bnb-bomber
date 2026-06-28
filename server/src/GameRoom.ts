import type { WebSocket } from 'ws'

import type {
  CharacterId,
  LobbySnapshot,
  MatchPlayerConfig,
  PlayerInput,
  RoomListEntry,
  ServerMessage,
} from '@bnb/shared'
import {
  LOBBY_MAX_PLAYERS,
  RECONNECT_MS,
  TICK_MS,
  Village10Sim,
  isCharacterId,
  parseClientMessage,
} from '@bnb/shared'

interface RoomPlayer {
  playerId: string
  name: string
  slot: number
  characterId: CharacterId
  ready: boolean
  ws: WebSocket | null
  disconnectedAt: number | null
}

export class GameRoom {
  readonly code: string
  readonly hostId: string
  private players = new Map<string, RoomPlayer>()
  private phase: 'lobby' | 'match' | 'ended' = 'lobby'
  private sim: Village10Sim | null = null
  private matchSeed = 0
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private pendingInputs = new Map<string, PlayerInput>()
  private onEmpty: () => void
  private onUpdate: () => void

  constructor(
    code: string,
    hostId: string,
    hostName: string,
    hostWs: WebSocket,
    onEmpty: () => void,
    onUpdate: () => void = () => {},
  ) {
    this.code = code
    this.hostId = hostId
    this.onEmpty = onEmpty
    this.onUpdate = onUpdate
    this.addPlayer(hostId, hostName, 0, hostWs, true)
  }

  get playerCount(): number {
    return [...this.players.values()].filter((p) => p.ws || p.disconnectedAt).length
  }

  get isEmpty(): boolean {
    return this.players.size === 0
  }

  get hostName(): string {
    return this.players.get(this.hostId)?.name ?? '玩家'
  }

  /** 大廳列表用的房間摘要 */
  summary(): RoomListEntry {
    return {
      code: this.code,
      hostName: this.hostName,
      mapName: '村10',
      players: this.playerCount,
      maxPlayers: LOBBY_MAX_PLAYERS,
      phase: this.phase,
    }
  }

  tryJoin(playerId: string, name: string, ws: WebSocket): string | null {
    if (this.phase === 'match') return '對戰進行中，無法加入'
    const occupied = new Set([...this.players.values()].map((p) => p.slot))
    let slot = -1
    for (let i = 0; i < LOBBY_MAX_PLAYERS; i++) {
      if (!occupied.has(i)) {
        slot = i
        break
      }
    }
    if (slot < 0) return '房間已滿'
    this.addPlayer(playerId, name, slot, ws, false)
    this.broadcastLobby()
    return null
  }

  handleMessage(playerId: string, raw: string): void {
    const msg = parseClientMessage(raw)
    if (!msg) {
      this.send(playerId, { type: 'error', message: '無效訊息格式' })
      return
    }

    switch (msg.type) {
      case 'pickCharacter':
        this.handlePickCharacter(playerId, msg.characterId)
        break
      case 'setReady':
        this.handleSetReady(playerId, msg.ready)
        break
      case 'input': {
        if (this.phase !== 'match') return
        // client 以 ~60fps 上傳、server 每 tick(50ms) 才消化，一個 tick 內會收到
        // 多筆 input 並互相覆蓋。放球只在按下那一幀 placeBubble=true，若被後續
        // false 覆蓋就會「常常放不出來」→ 這裡對 placeBubble 做 OR 合併直到 tick 取用。
        const prev = this.pendingInputs.get(playerId)
        this.pendingInputs.set(playerId, {
          dir: msg.dir,
          placeBubble: msg.placeBubble || prev?.placeBubble || false,
        })
        break
      }
      case 'leaveRoom':
        this.removePlayer(playerId)
        break
      case 'requestRematch':
        this.resetToLobby()
        break
      default:
        break
    }
  }

  handleDisconnect(playerId: string): void {
    const player = this.players.get(playerId)
    if (!player) return
    player.ws = null
    player.disconnectedAt = Date.now()
    player.ready = false

    if (this.phase === 'match') {
      this.stopMatch()
      this.phase = 'ended'
      const other = [...this.players.values()].find((p) => p.playerId !== playerId && p.ws)
      if (other) {
        this.broadcast({
          type: 'matchEnd',
          winnerId: other.playerId,
          winnerLabel: `${other.name}（對手離線）`,
        })
      }
    }

    setTimeout(() => {
      const p = this.players.get(playerId)
      if (p && !p.ws && p.disconnectedAt && Date.now() - p.disconnectedAt >= RECONNECT_MS) {
        this.removePlayer(playerId)
      }
    }, RECONNECT_MS + 50)

    this.broadcastLobby()
  }

  tryReconnect(playerId: string, ws: WebSocket): boolean {
    const player = this.players.get(playerId)
    if (!player || !player.disconnectedAt) return false
    if (Date.now() - player.disconnectedAt > RECONNECT_MS) return false
    player.ws = ws
    player.disconnectedAt = null
    this.send(playerId, { type: 'connected', playerId })
    this.sendLobbyTo(playerId)
    if (this.phase === 'match' && this.sim) {
      this.send(playerId, {
        type: 'matchStart',
        seed: this.matchSeed,
        tickRate: TICK_MS,
        players: this.matchPlayerConfigs(),
      })
      this.send(playerId, {
        type: 'matchState',
        tick: this.sim.snapshot().tick,
        snapshot: this.sim.snapshot(),
      })
    }
    return true
  }

  private addPlayer(
    playerId: string,
    name: string,
    slot: number,
    ws: WebSocket,
    isHost: boolean,
  ): void {
    void isHost
    this.players.set(playerId, {
      playerId,
      name: name.slice(0, 12) || `玩家${slot + 1}`,
      slot,
      characterId: slot === 0 ? 'dao' : 'bazzi',
      ready: false,
      ws,
      disconnectedAt: null,
    })
  }

  private handlePickCharacter(playerId: string, characterId: CharacterId): void {
    if (this.phase !== 'lobby') return
    if (!isCharacterId(characterId)) return
    const player = this.players.get(playerId)
    if (!player) return
    player.characterId = characterId
    player.ready = false
    this.broadcastLobby()
  }

  private handleSetReady(playerId: string, ready: boolean): void {
    if (this.phase !== 'lobby') return
    const player = this.players.get(playerId)
    if (!player) return
    player.ready = ready
    this.broadcastLobby()

    const active = [...this.players.values()].filter((p) => p.ws)
    if (active.length >= 2 && active.every((p) => p.ready)) {
      this.startMatch()
    }
  }

  private startMatch(): void {
    this.phase = 'match'
    this.matchSeed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
    const configs = this.matchPlayerConfigs()
    this.sim = new Village10Sim(
      this.matchSeed,
      configs.map((c) => ({
        playerId: c.playerId,
        slot: c.slot,
        name: c.name,
        characterId: c.characterId,
      })),
    )

    this.broadcast({
      type: 'matchStart',
      seed: this.matchSeed,
      tickRate: TICK_MS,
      players: configs,
    })

    this.pendingInputs.clear()
    this.tickTimer = setInterval(() => this.tickMatch(), TICK_MS)
    this.broadcastLobby()
  }

  private tickMatch(): void {
    if (!this.sim || this.phase !== 'match') return
    const inputs = Object.fromEntries(this.pendingInputs.entries())
    this.pendingInputs.clear()
    const snapshot = this.sim.step(inputs)
    this.broadcast({ type: 'matchState', tick: snapshot.tick, snapshot })

    if (snapshot.finished) {
      this.stopMatch()
      this.phase = 'ended'
      this.broadcast({
        type: 'matchEnd',
        winnerId: snapshot.winnerId,
        winnerLabel: snapshot.winnerLabel,
      })
      this.onUpdate()
    }
  }

  private stopMatch(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  private resetToLobby(): void {
    this.stopMatch()
    this.sim = null
    this.phase = 'lobby'
    for (const p of this.players.values()) {
      p.ready = false
    }
    this.broadcastLobby()
  }

  private removePlayer(playerId: string): void {
    this.players.delete(playerId)
    if (this.players.size === 0) {
      this.stopMatch()
      this.onEmpty()
      return
    }
    if (this.phase === 'match') {
      this.stopMatch()
      this.phase = 'ended'
    }
    this.broadcastLobby()
  }

  private matchPlayerConfigs(): MatchPlayerConfig[] {
    return [...this.players.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((p) => ({
        playerId: p.playerId,
        slot: p.slot,
        name: p.name,
        characterId: p.characterId,
      }))
  }

  private lobbySnapshot(forPlayerId: string): LobbySnapshot {
    const me = this.players.get(forPlayerId)
    const slots = Array.from({ length: LOBBY_MAX_PLAYERS }, (_, slot) => {
      const p = [...this.players.values()].find((pl) => pl.slot === slot)
      return {
        slot,
        occupied: Boolean(p),
        playerId: p?.playerId ?? null,
        name: p?.name ?? '',
        characterId: p?.characterId ?? ('dao' as CharacterId),
        ready: p?.ready ?? false,
        isHost: p?.playerId === this.hostId,
      }
    })
    return {
      roomCode: this.code,
      phase: this.phase,
      mapName: '村10',
      slots,
      yourPlayerId: forPlayerId,
      yourSlot: me?.slot ?? -1,
    }
  }

  private sendLobbyTo(playerId: string): void {
    this.send(playerId, { type: 'lobbyState', room: this.lobbySnapshot(playerId) })
  }

  broadcastLobby(): void {
    for (const id of this.players.keys()) {
      this.sendLobbyTo(id)
    }
    // 房間人數 / 狀態有變，通知大廳列表的觀看者更新
    this.onUpdate()
  }

  private send(playerId: string, msg: ServerMessage): void {
    const player = this.players.get(playerId)
    if (!player?.ws || player.ws.readyState !== 1) return
    player.ws.send(JSON.stringify(msg))
  }

  private broadcast(msg: ServerMessage): void {
    const raw = JSON.stringify(msg)
    for (const player of this.players.values()) {
      if (player.ws && player.ws.readyState === 1) {
        player.ws.send(raw)
      }
    }
  }
}
