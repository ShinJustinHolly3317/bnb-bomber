import Phaser from 'phaser'

import {
  buildVillage10Map,
  isBlocking,
  isDestructible,
  isWalkable,
  type TileKindValue,
  TileKind,
} from '../../data/village10-map'
import { AssetKeys } from '../assets/AssetKeys'
import {
  BUBBLE_DAMAGE,
  CRATE_ITEM_DROP_CHANCE,
  GAMEPLAY_ZOOM,
  MAP_COLS,
  MAP_ROWS,
  OVERVIEW_ZOOM,
  TILE_SIZE,
  VIEW_HEIGHT,
} from '../constants'
import { Fighter } from '../entities/Fighter'
import { ItemPickup } from '../entities/ItemPickup'
import { WaterBubble } from '../entities/WaterBubble'
import {
  ItemKind,
  VILLAGE10_ITEM_SPAWNS,
  type ItemKindValue,
} from '../items/ItemKind'
import { setBnbState } from '../debug/bnbState'
import { tileToWorld, worldToTile } from '../utils/grid'

const TILE_TEXTURE: Record<TileKindValue, string> = {
  [TileKind.GRASS]: AssetKeys.TILE_GRASS,
  [TileKind.ROAD]: AssetKeys.TILE_ROAD,
  [TileKind.WALL]: AssetKeys.TILE_WALL,
  [TileKind.TREE]: AssetKeys.TILE_TREE,
  [TileKind.CRATE]: AssetKeys.TILE_CRATE,
  [TileKind.RED_ROOF]: AssetKeys.TILE_HOUSE_RED,
  [TileKind.BLUE_ROOF]: AssetKeys.TILE_HOUSE_BLUE,
}

export class DuelScene extends Phaser.Scene {
  private mapTiles: TileKindValue[][] = []
  private blockingGroup!: Phaser.Physics.Arcade.StaticGroup
  private itemGroup!: Phaser.Physics.Arcade.Group
  private fighters: Fighter[] = []
  private hpTexts: Phaser.GameObjects.Text[] = []
  private gameEnded = false
  private mapOverview = false

  constructor() {
    super({ key: 'DuelScene' })
  }

  create(): void {
    this.gameEnded = false
    this.mapOverview = false
    this.fighters = []

    const mapData = buildVillage10Map()
    this.mapTiles = mapData.tiles.map((row) => [...row])

    this.drawBackground()
    this.blockingGroup = this.physics.add.staticGroup()
    this.itemGroup = this.physics.add.group({ allowGravity: false })
    this.buildTilemap()
    this.spawnItems()

    const p1Pos = tileToWorld(mapData.spawnP1.col, mapData.spawnP1.row)
    const p2Pos = tileToWorld(mapData.spawnP2.col, mapData.spawnP2.row)

    const wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Phaser.Types.Input.Keyboard.CursorKeys
    const spaceKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    )
    const arrows = this.input.keyboard!.createCursorKeys()
    const enterKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER,
    )

    const p1 = new Fighter(
      this,
      p1Pos.x,
      p1Pos.y,
      AssetKeys.PLAYER_BLUE,
      1,
      'P1 藍寶',
      wasd,
      spaceKey,
      'p1',
    )
    const p2 = new Fighter(
      this,
      p2Pos.x,
      p2Pos.y,
      AssetKeys.PLAYER_RED,
      2,
      'P2 紅寶',
      arrows,
      enterKey,
      'p2',
    )

    p1.onPlaceBubble = (f) => this.tryPlaceBubble(f)
    p2.onPlaceBubble = (f) => this.tryPlaceBubble(f)

    this.fighters.push(p1, p2)

    this.physics.add.collider(p1, this.blockingGroup)
    this.physics.add.collider(p2, this.blockingGroup)
    this.physics.add.collider(p1, p2)

    this.fighters.forEach((f) => {
      this.physics.add.overlap(f, this.itemGroup, (_p, item) => {
        this.collectItem(f, item as ItemPickup)
      })
    })

    const worldWidth = MAP_COLS * TILE_SIZE
    const worldHeight = MAP_ROWS * TILE_SIZE
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight)
    // 地圖比視窗小，不設 camera bounds，直接置中顯示整張地圖
    this.cameras.main.setZoom(GAMEPLAY_ZOOM)
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2)

    this.hpTexts = this.fighters.map((_f, i) =>
      this.add
        .text(12, 12 + i * 36, '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#1a237ecc',
          padding: { x: 10, y: 6 },
        })
        .setScrollFactor(0)
        .setDepth(200),
    )

    this.add
      .text(12, VIEW_HEIGHT - 40, 'M 全圖  |  S/Enter 放水球  |  撿 S加速 P威力 B水球+', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#e0e0e0',
        backgroundColor: '#1a237eaa',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(200)

    this.input.keyboard!.on('keydown-M', () => {
      this.mapOverview = !this.mapOverview
      this.cameras.main.setZoom(
        this.mapOverview ? OVERVIEW_ZOOM : GAMEPLAY_ZOOM,
      )
    })

    this.publishState()
  }

  private publishState(): void {
    setBnbState({
      scene: 'duel',
      fighters: this.fighters.map((f) => ({
        label: f.label,
        hp: f.hp,
        dead: f.dead,
        trapped: f.trapped,
        x: Math.round(f.x),
        y: Math.round(f.y),
        vx: Math.round(f.body?.velocity.x ?? 0),
        vy: Math.round(f.body?.velocity.y ?? 0),
      })),
    })
  }

  update(): void {
    if (this.gameEnded) return

    this.fighters.forEach((f) => f.update())
    this.updateHpUi()
    this.updateCamera()
    this.publishState()

    const alive = this.fighters.filter((f) => !f.dead)
    if (alive.length === 1) {
      this.endMatch(alive[0].label)
    } else if (alive.length === 0) {
      // 同時陣亡（double-KO）也要結束，否則卡死在對戰畫面
      this.endMatch('平手')
    }
  }

  private drawBackground(): void {
    const w = MAP_COLS * TILE_SIZE
    const h = MAP_ROWS * TILE_SIZE
    this.add.rectangle(w / 2, h / 2, w + 80, h + 80, 0x2e7d32).setDepth(-2)
  }

  private spawnItems(): void {
    VILLAGE10_ITEM_SPAWNS.forEach(({ col, row, kind }) => {
      if (!isWalkable(this.mapTiles[row][col])) return
      const item = new ItemPickup(this, col, row, kind)
      this.itemGroup.add(item)
    })
  }

  private collectItem(fighter: Fighter, item: ItemPickup): void {
    if (!item.active || fighter.dead) return
    fighter.applyItem(item.kind)
    item.destroy()

    const toast = this.add
      .text(fighter.x, fighter.y - 24, `+${item.kind}`, {
        fontSize: '12px',
        color: '#ffeb3b',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setDepth(50)
    this.tweens.add({
      targets: toast,
      y: fighter.y - 48,
      alpha: 0,
      duration: 600,
      onComplete: () => toast.destroy(),
    })
  }

  private maybeDropItemFromCrate(col: number, row: number): void {
    if (Math.random() > CRATE_ITEM_DROP_CHANCE) return
    const kinds: ItemKindValue[] = [
      ItemKind.SPEED,
      ItemKind.POWER,
      ItemKind.BUBBLE,
    ]
    const kind = kinds[Math.floor(Math.random() * kinds.length)]
    const item = new ItemPickup(this, col, row, kind)
    this.itemGroup.add(item)
  }

  private updateHpUi(): void {
    this.fighters.forEach((f, i) => {
      const tag = f.trapped ? ' [困]' : f.dead ? ' [出局]' : ''
      this.hpTexts[i].setText(
        `${f.label}  HP ${f.hp}${tag}\n${f.statsLine()}`,
      )
    })
  }

  private updateCamera(): void {
    // 整張地圖小於視窗，固定置中即可（原作也是全圖顯示）
    const worldWidth = MAP_COLS * TILE_SIZE
    const worldHeight = MAP_ROWS * TILE_SIZE
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2)
  }

  private tryPlaceBubble(fighter: Fighter): void {
    if (this.gameEnded || fighter.dead || fighter.trapped) return
    if (fighter.activeBubbleCount >= fighter.maxBubbles) return

    const { col, row } = worldToTile(fighter.x, fighter.y)
    if (!this.isInBounds(col, row)) return
    if (!isWalkable(this.mapTiles[row][col])) return
    if (this.hasBubbleAt(col, row)) return

    const pos = tileToWorld(col, row)
    const bubble = new WaterBubble(this, col, row, pos.x, pos.y, fighter)
    fighter.registerBubble(bubble)

    // 自己的水球不擋路（同格放置會卡死）
    this.fighters.forEach((f) => {
      if (f === fighter) return
      this.physics.add.collider(f, bubble)
    })

    bubble.onPop = (b, trapped) => this.handleBubblePop(b, trapped)

    const victim = this.fighters.find(
      (f) =>
        f !== fighter &&
        !f.dead &&
        worldToTile(f.x, f.y).col === col &&
        worldToTile(f.x, f.y).row === row,
    )
    if (victim) {
      victim.setTrapped(true)
      bubble.pop(victim)
    }
  }

  private handleBubblePop(
    bubble: WaterBubble,
    trapped: Fighter | null,
  ): void {
    bubble.owner.unregisterBubble(bubble)

    this.showExplosion(bubble.col, bubble.row, bubble.owner.bubblePower)

    const hitTiles = this.computeExplosionTiles(
      bubble.col,
      bubble.row,
      bubble.owner.bubblePower,
    )
    this.applyExplosionToMap(hitTiles)

    if (trapped) {
      trapped.setTrapped(false)
      trapped.takeDamage(BUBBLE_DAMAGE)
    }

    this.fighters.forEach((f) => {
      if (f.dead) return
      const t = worldToTile(f.x, f.y)
      if (hitTiles.some((h) => h.col === t.col && h.row === t.row)) {
        f.takeDamage(BUBBLE_DAMAGE)
      }
    })
  }

  private showExplosion(col: number, row: number, power: number): void {
    const tiles = this.computeExplosionTiles(col, row, power)
    tiles.forEach(({ col: c, row: r }) => {
      const { x, y } = tileToWorld(c, r)
      const fx = this.add.sprite(x, y, AssetKeys.EXPLOSION)
      fx.setDisplaySize(TILE_SIZE, TILE_SIZE)
      fx.setDepth(15)
      fx.setAlpha(0.85)
      fx.play('explode')
      this.time.delayedCall(280, () => fx.destroy())
    })
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

    dirs.forEach(({ dc, dr }) => {
      for (let i = 1; i <= power; i++) {
        const nc = col + dc * i
        const nr = row + dr * i
        if (!this.isInBounds(nc, nr)) break
        hits.push({ col: nc, row: nr })
        const kind = this.mapTiles[nr][nc]
        if (isDestructible(kind)) continue
        if (isBlocking(kind)) break
      }
    })

    return hits
  }

  private applyExplosionToMap(
    tiles: { col: number; row: number }[],
  ): void {
    tiles.forEach(({ col, row }) => {
      if (!isDestructible(this.mapTiles[row][col])) return
      this.mapTiles[row][col] = TileKind.GRASS
      this.rebuildTileAt(col, row)
      this.maybeDropItemFromCrate(col, row)
    })
  }

  private rebuildTileAt(col: number, row: number): void {
    const kind = this.mapTiles[row][col]
    const key = `${col},${row}`
    const existing = this.children.getByName(key)
    existing?.destroy()

    const px = col * TILE_SIZE + TILE_SIZE / 2
    const py = row * TILE_SIZE + TILE_SIZE / 2
    this.add
      .image(px, py, TILE_TEXTURE[kind])
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(0)
      .setName(key)

    this.blockingGroup.getChildren().forEach((child) => {
      const body = child as Phaser.Physics.Arcade.Sprite
      if (Math.abs(body.x - px) < 1 && Math.abs(body.y - py) < 1) {
        body.destroy()
      }
    })

    if (isBlocking(kind)) {
      const block = this.blockingGroup.create(px, py, TILE_TEXTURE[kind])
      block.setVisible(false)
      // 貼圖原始 64px，碰撞體必須縮回格子大小，否則會夾死走道
      block.setDisplaySize(TILE_SIZE, TILE_SIZE)
      block.refreshBody()
    }
  }

  private buildTilemap(): void {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const kind = this.mapTiles[row][col]
        const px = col * TILE_SIZE + TILE_SIZE / 2
        const py = row * TILE_SIZE + TILE_SIZE / 2

        this.add
          .image(px, py, TILE_TEXTURE[kind])
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setDepth(0)
          .setName(`${col},${row}`)

        if (isBlocking(kind)) {
          const block = this.blockingGroup.create(
            px,
            py,
            TILE_TEXTURE[kind],
          )
          block.setVisible(false)
          // 貼圖原始 64px，碰撞體必須縮回格子大小
          block.setDisplaySize(TILE_SIZE, TILE_SIZE)
          block.refreshBody()
        }
      }
    }
  }

  private hasBubbleAt(col: number, row: number): boolean {
    return this.fighters.some((f) =>
      f.activeBubbles.some(
        (b) => b.active && b.col === col && b.row === row,
      ),
    )
  }

  private isInBounds(col: number, row: number): boolean {
    return col >= 0 && col < MAP_COLS && row >= 0 && row < MAP_ROWS
  }

  private endMatch(winner: string): void {
    this.gameEnded = true
    this.time.delayedCall(600, () => {
      this.scene.start('GameOverScene', { winner })
    })
  }
}
