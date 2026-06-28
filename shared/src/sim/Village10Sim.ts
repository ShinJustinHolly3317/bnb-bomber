import {
  BASE_BUBBLE_POWER,
  BASE_MAX_BUBBLES,
  BUBBLE_DAMAGE,
  BUBBLE_FUSE_TICKS,
  CRATE_ITEM_DROP_CHANCE,
  MAP_COLS,
  MAP_ROWS,
  MAX_BUBBLE_POWER,
  MAX_BUBBLES_CAP,
  MAX_MOVE_SPEED,
  PLAYER_BODY_HALF,
  PLAYER_MAX_HP,
  PLAYER_MOVE_SPEED,
  SPEED_BOOST,
  TICK_MS,
} from '../constants.js'
import type { CharacterId } from '../characters.js'
import type {
  ExplosionEvent,
  Facing,
  FighterSnapshot,
  ItemSnapshot,
  MatchSnapshot,
  PlayerInput,
} from '../protocol.js'
import { tileToWorld, worldToTile } from '../grid.js'
import { ItemKind, VILLAGE10_ITEM_SPAWNS, type ItemKindValue } from '../items.js'
import {
  buildVillage10Map,
  isBlocking,
  isDestructible,
  isWalkable,
  TileKind,
  type TileKindValue,
} from '../map/village10-map.js'
import { SeededRng } from '../rng.js'

interface SimPlayer {
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

interface SimBubble {
  id: number
  ownerId: string
  col: number
  row: number
  fuseTicksLeft: number
}

interface SimItem {
  id: number
  col: number
  row: number
  kind: ItemKindValue
}

export interface MatchPlayerInit {
  playerId: string
  slot: number
  name: string
  characterId: CharacterId
}

export class Village10Sim {
  readonly tickMs = TICK_MS
  private tick = 0
  private tiles: TileKindValue[][] = []
  private players: SimPlayer[] = []
  private bubbles: SimBubble[] = []
  private items: SimItem[] = []
  // 累積本 tick 的爆炸事件，step 結束時附到 snapshot
  private explosionsThisTick: ExplosionEvent[] = []
  private rng: SeededRng
  private nextBubbleId = 1
  private nextItemId = 1
  private finished = false
  private winnerId: string | null = null
  private winnerLabel: string | null = null

  constructor(seed: number, players: MatchPlayerInit[]) {
    this.rng = new SeededRng(seed)
    const map = buildVillage10Map()
    this.tiles = map.tiles.map((row) => [...row])

    const spawns = [map.spawnP1, map.spawnP2]
    this.players = players.map((p, i) => {
      const spawn = spawns[p.slot] ?? spawns[i]!
      const pos = tileToWorld(spawn.col, spawn.row)
      return {
        playerId: p.playerId,
        slot: p.slot,
        name: p.name,
        characterId: p.characterId,
        x: pos.x,
        y: pos.y,
        facing: 'down',
        hp: PLAYER_MAX_HP,
        trapped: false,
        dead: false,
        moveSpeed: PLAYER_MOVE_SPEED,
        bubblePower: BASE_BUBBLE_POWER,
        maxBubbles: BASE_MAX_BUBBLES,
      }
    })

    VILLAGE10_ITEM_SPAWNS.forEach((spawn) => {
      if (!isWalkable(this.tiles[spawn.row]![spawn.col]!)) return
      this.items.push({
        id: this.nextItemId++,
        col: spawn.col,
        row: spawn.row,
        kind: spawn.kind,
      })
    })
  }

  step(inputs: Record<string, PlayerInput>): MatchSnapshot {
    if (this.finished) return this.snapshot()

    this.tick += 1
    this.explosionsThisTick = []
    const dt = TICK_MS / 1000

    for (const player of this.players) {
      if (player.dead || player.trapped) continue
      const input = inputs[player.playerId]
      if (!input) continue

      let vx = 0
      let vy = 0
      if (input.dir === 'left') vx -= 1
      if (input.dir === 'right') vx += 1
      if (input.dir === 'up') vy -= 1
      if (input.dir === 'down') vy += 1

      if (vx !== 0 && vy !== 0) {
        vx *= Math.SQRT1_2
        vy *= Math.SQRT1_2
      }

      if (vx !== 0 || vy !== 0) {
        if (Math.abs(vx) >= Math.abs(vy)) {
          player.facing = vx < 0 ? 'left' : 'right'
        } else {
          player.facing = vy < 0 ? 'up' : 'down'
        }
      }

      const speed = player.moveSpeed
      this.movePlayer(player, vx * speed * dt, 0)
      this.movePlayer(player, 0, vy * speed * dt)

      if (input.placeBubble) {
        this.tryPlaceBubble(player)
      }
    }

    this.tickBubbles()
    this.collectItems()
    this.checkWinner()

    const snap = this.snapshot()
    snap.explosions = this.explosionsThisTick
    return snap
  }

  snapshot(): MatchSnapshot {
    return {
      tick: this.tick,
      tiles: this.tiles.map((row) => [...row]),
      fighters: this.players.map((p) => this.toFighterSnapshot(p)),
      bubbles: this.bubbles.map((b) => ({
        id: b.id,
        ownerId: b.ownerId,
        col: b.col,
        row: b.row,
      })),
      items: this.items.map((it) => ({
        id: it.id,
        col: it.col,
        row: it.row,
        kind: it.kind,
      })),
      // 預設空陣列；爆炸事件只由 step() 即時附上（reconnect/初始狀態不重播）
      explosions: [],
      finished: this.finished,
      winnerId: this.winnerId,
      winnerLabel: this.winnerLabel,
    }
  }

  private toFighterSnapshot(p: SimPlayer): FighterSnapshot {
    return {
      playerId: p.playerId,
      slot: p.slot,
      name: p.name,
      characterId: p.characterId,
      x: Math.round(p.x),
      y: Math.round(p.y),
      facing: p.facing,
      hp: p.hp,
      trapped: p.trapped,
      dead: p.dead,
      moveSpeed: p.moveSpeed,
      bubblePower: p.bubblePower,
      maxBubbles: p.maxBubbles,
    }
  }

  private movePlayer(player: SimPlayer, dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return
    const nextX = player.x + dx
    const nextY = player.y + dy
    if (this.canStandAt(nextX, player.y, player.playerId)) {
      player.x = nextX
    }
    if (this.canStandAt(player.x, nextY, player.playerId)) {
      player.y = nextY
    }
  }

  private canStandAt(x: number, y: number, playerId: string): boolean {
    const half = PLAYER_BODY_HALF
    const corners = [
      { x: x - half, y: y - half },
      { x: x + half, y: y - half },
      { x: x - half, y: y + half },
      { x: x + half, y: y + half },
    ]
    for (const c of corners) {
      const { col, row } = worldToTile(c.x, c.y)
      if (!this.isInBounds(col, row)) return false
      const kind = this.tiles[row]![col]!
      if (isBlocking(kind)) return false
      if (this.isBubbleBlocking(col, row, playerId)) return false
    }
    return true
  }

  private isBubbleBlocking(col: number, row: number, playerId: string): boolean {
    return this.bubbles.some(
      (b) => b.col === col && b.row === row && b.ownerId !== playerId,
    )
  }

  private tryPlaceBubble(player: SimPlayer): void {
    const active = this.bubbles.filter((b) => b.ownerId === player.playerId).length
    if (active >= player.maxBubbles) return

    const { col, row } = worldToTile(player.x, player.y)
    if (!this.isInBounds(col, row)) return
    if (!isWalkable(this.tiles[row]![col]!)) return
    if (this.bubbles.some((b) => b.col === col && b.row === row)) return

    const bubble: SimBubble = {
      id: this.nextBubbleId++,
      ownerId: player.playerId,
      col,
      row,
      fuseTicksLeft: BUBBLE_FUSE_TICKS,
    }
    this.bubbles.push(bubble)

    const victim = this.players.find(
      (p) =>
        p.playerId !== player.playerId &&
        !p.dead &&
        worldToTile(p.x, p.y).col === col &&
        worldToTile(p.x, p.y).row === row,
    )
    if (victim) {
      victim.trapped = true
      this.popBubble(bubble, victim)
    }
  }

  private tickBubbles(): void {
    const toPop = [...this.bubbles]
    for (const bubble of toPop) {
      bubble.fuseTicksLeft -= 1
      if (bubble.fuseTicksLeft <= 0) {
        const victim = this.players.find(
          (p) =>
            p.trapped &&
            !p.dead &&
            worldToTile(p.x, p.y).col === bubble.col &&
            worldToTile(p.x, p.y).row === bubble.row,
        )
        this.popBubble(bubble, victim ?? null)
      }
    }
  }

  private popBubble(bubble: SimBubble, trapped: SimPlayer | null): void {
    this.bubbles = this.bubbles.filter((b) => b.id !== bubble.id)
    const owner = this.players.find((p) => p.playerId === bubble.ownerId)
    if (!owner) return

    const hits = this.computeExplosionTiles(bubble.col, bubble.row, owner.bubblePower)
    this.explosionsThisTick.push({ col: bubble.col, row: bubble.row, tiles: hits })
    this.applyExplosionToMap(hits)

    if (trapped) {
      trapped.trapped = false
      this.damagePlayer(trapped, BUBBLE_DAMAGE)
    }

    for (const p of this.players) {
      if (p.dead) continue
      const t = worldToTile(p.x, p.y)
      if (hits.some((h) => h.col === t.col && h.row === t.row)) {
        this.damagePlayer(p, BUBBLE_DAMAGE)
      }
    }
  }

  private computeExplosionTiles(
    col: number,
    row: number,
    power: number,
  ): { col: number; row: number }[] {
    const hits: { col: number; row: number }[] = [{ col, row }]
    const dirs = [
      { dc: 0, dr: -1 },
      { dc: 0, dr: 1 },
      { dc: -1, dr: 0 },
      { dc: 1, dr: 0 },
    ]

    for (const { dc, dr } of dirs) {
      for (let i = 1; i <= power; i++) {
        const nc = col + dc * i
        const nr = row + dr * i
        if (!this.isInBounds(nc, nr)) break
        hits.push({ col: nc, row: nr })
        const kind = this.tiles[nr]![nc]!
        if (isDestructible(kind)) continue
        if (isBlocking(kind)) break
      }
    }

    return hits
  }

  private applyExplosionToMap(tiles: { col: number; row: number }[]): void {
    for (const { col, row } of tiles) {
      if (!isDestructible(this.tiles[row]![col]!)) continue
      this.tiles[row]![col] = TileKind.GRASS
      this.maybeDropItem(col, row)
    }
  }

  private maybeDropItem(col: number, row: number): void {
    if (this.rng.next() > CRATE_ITEM_DROP_CHANCE) return
    const kinds: ItemKindValue[] = [ItemKind.SPEED, ItemKind.POWER, ItemKind.BUBBLE]
    this.items.push({
      id: this.nextItemId++,
      col,
      row,
      kind: this.rng.pick(kinds),
    })
  }

  private collectItems(): void {
    for (const player of this.players) {
      if (player.dead) continue
      const t = worldToTile(player.x, player.y)
      const idx = this.items.findIndex((it) => it.col === t.col && it.row === t.row)
      if (idx < 0) continue
      const item = this.items[idx]!
      this.items.splice(idx, 1)
      this.applyItem(player, item.kind)
    }
  }

  private applyItem(player: SimPlayer, kind: ItemKindValue): void {
    if (kind === ItemKind.SPEED) {
      player.moveSpeed = Math.min(MAX_MOVE_SPEED, player.moveSpeed + SPEED_BOOST)
    } else if (kind === ItemKind.POWER) {
      player.bubblePower = Math.min(MAX_BUBBLE_POWER, player.bubblePower + 1)
    } else {
      player.maxBubbles = Math.min(MAX_BUBBLES_CAP, player.maxBubbles + 1)
    }
  }

  private damagePlayer(player: SimPlayer, amount: number): void {
    if (player.dead) return
    player.hp = Math.max(0, player.hp - amount)
    if (player.hp <= 0) {
      player.dead = true
      player.trapped = false
    }
  }

  private checkWinner(): void {
    const alive = this.players.filter((p) => !p.dead)
    if (alive.length === 1) {
      this.finished = true
      this.winnerId = alive[0]!.playerId
      this.winnerLabel = alive[0]!.name
    } else if (alive.length === 0) {
      this.finished = true
      this.winnerId = null
      this.winnerLabel = '平手'
    }
  }

  private isInBounds(col: number, row: number): boolean {
    return col >= 0 && col < MAP_COLS && row >= 0 && row < MAP_ROWS
  }
}

export type { ItemSnapshot }
