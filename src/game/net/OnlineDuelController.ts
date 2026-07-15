import Phaser from 'phaser'

import type { ExplosionEvent, FighterSnapshot, MatchSnapshot } from '@bnb/shared'
import { MAP_COLS, MAP_ROWS, TICK_MS, TILE_SIZE } from '@bnb/shared'
import type { Dir } from '@bnb/shared'
import {
  TileKind,
  type TileKindValue,
} from '../../data/village10-map'
import { AnimKeys, AssetKeys } from '../assets/AssetKeys'
import {
  DEFAULT_SPRITE_MANIFEST,
  idleFrameForFacing,
  type SpriteManifest,
} from '../assets/spriteManifest'
import { CHARACTER_BY_ID } from '../characters/CharacterCatalog'
import { GAMEPLAY_ZOOM, PLAYER_DISPLAY_SIZE, VIEW_HEIGHT } from '../constants'
import { ItemPickup } from '../entities/ItemPickup'
import { setBnbState } from '../debug/bnbState'
import type { GameClient } from '../net/GameClient'
import { tileToWorld } from '../utils/grid'

// 各 slot 的識別底色（允許重複選角時用來區分玩家）
const SLOT_COLORS = [0xe53935, 0x1e88e5, 0xfdd835, 0x8e24aa, 0x43a047, 0xfb8c00]
const cssColor = (c: number) => `#${c.toString(16).padStart(6, '0')}`

const TILE_TEXTURE: Record<TileKindValue, string> = {
  [TileKind.GRASS]: AssetKeys.TILE_GRASS,
  [TileKind.ROAD]: AssetKeys.TILE_ROAD,
  [TileKind.WALL]: AssetKeys.TILE_WALL,
  [TileKind.TREE]: AssetKeys.TILE_TREE,
  [TileKind.CRATE]: AssetKeys.TILE_CRATE,
  [TileKind.RED_ROOF]: AssetKeys.TILE_HOUSE_RED,
  [TileKind.BLUE_ROOF]: AssetKeys.TILE_HOUSE_BLUE,
}

/** 線上對戰：snapshot 驅動渲染 + 本地輸入上傳 */
export class OnlineDuelController {
  private scene: Phaser.Scene
  private client: GameClient
  private localPlayerId: string
  private mapTiles: TileKindValue[][] = []
  private fighterSprites = new Map<string, Phaser.GameObjects.Sprite>()
  // 上一個 snapshot 的位置，用來判斷角色是否在走動以播放/停止動畫
  private fighterPrevPos = new Map<string, { x: number; y: number }>()
  private framesPerDir = DEFAULT_SPRITE_MANIFEST.walkFramesPerDirection
  private bubbleSprites = new Map<number, Phaser.GameObjects.Sprite>()
  private itemSprites = new Map<number, ItemPickup>()
  // 頭上名牌 + 腳下底色圈（區分重複選角的玩家）
  private namePlates = new Map<string, Phaser.GameObjects.Text>()
  private baseRings = new Map<string, Phaser.GameObjects.Ellipse>()
  // 被困住時罩在角色外的淡藍泡泡
  private trapBubbles = new Map<string, Phaser.GameObjects.Sprite>()
  private hpTexts: Phaser.GameObjects.Text[] = []
  private explosionsSpawned = 0
  private gameEnded = false
  private lastTick = 0
  private bubbleKeyWasDown = false
  private unsub: (() => void) | null = null

  private keys!: Phaser.Types.Input.Keyboard.CursorKeys
  // 方向鍵：與 WASD 並存，任一組都能操作
  private arrowKeys!: Phaser.Types.Input.Keyboard.CursorKeys
  private bubbleKey!: Phaser.Input.Keyboard.Key
  // Enter：方向鍵玩家的放球鍵（與 Space 並存）
  private bubbleKey2!: Phaser.Input.Keyboard.Key

  constructor(scene: Phaser.Scene, client: GameClient, localPlayerId: string) {
    this.scene = scene
    this.client = client
    this.localPlayerId = localPlayerId
  }

  create(): void {
    this.gameEnded = false
    const manifest = this.scene.registry.get('spriteManifest') as
      | SpriteManifest
      | undefined
    this.framesPerDir =
      manifest?.walkFramesPerDirection ??
      DEFAULT_SPRITE_MANIFEST.walkFramesPerDirection
    this.keys = this.scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Phaser.Types.Input.Keyboard.CursorKeys
    this.arrowKeys = this.scene.input.keyboard!.createCursorKeys()
    this.bubbleKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    )
    this.bubbleKey2 = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER,
    )

    const w = MAP_COLS * TILE_SIZE
    const h = MAP_ROWS * TILE_SIZE
    this.scene.add.rectangle(w / 2, h / 2, w + 80, h + 80, 0x2e7d32).setDepth(-2)

    if (this.client.lastSnapshot) {
      this.applySnapshot(this.client.lastSnapshot, true)
    }

    this.scene.cameras.main.setZoom(GAMEPLAY_ZOOM)
    this.scene.cameras.main.centerOn(w / 2, h / 2)

    this.scene.add
      .text(12, VIEW_HEIGHT - 40, '線上對戰 | WASD/方向鍵 移動 | Space/Enter 放球', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#fffde7',
        backgroundColor: '#5d4037cc',
        padding: { x: 8, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(200)

    this.unsub = this.client.onMessage((msg) => {
      if (msg.type === 'matchState') this.applySnapshot(msg.snapshot, false)
      if (msg.type === 'matchEnd' && !this.gameEnded) {
        this.gameEnded = true
        this.scene.time.delayedCall(600, () => {
          this.scene.registry.set('playMode', 'online')
          this.scene.scene.start('GameOverScene', {
            winner: msg.winnerLabel ?? '平手',
            online: true,
          })
        })
      }
    })
  }

  update(): void {
    if (this.gameEnded) return
    this.sendLocalInput()
    this.publishState()
  }

  destroy(): void {
    this.unsub?.()
    this.unsub = null
  }

  private sendLocalInput(): void {
    const k = this.keys
    const a = this.arrowKeys
    let dir: Dir | null = null
    if (k.left?.isDown || a.left?.isDown) dir = 'left'
    else if (k.right?.isDown || a.right?.isDown) dir = 'right'
    else if (k.up?.isDown || a.up?.isDown) dir = 'up'
    else if (k.down?.isDown || a.down?.isDown) dir = 'down'

    const bubbleDown = this.bubbleKey.isDown || this.bubbleKey2.isDown
    const placeBubble = bubbleDown && !this.bubbleKeyWasDown
    this.bubbleKeyWasDown = bubbleDown

    const tick = this.client.lastSnapshot?.tick ?? this.lastTick
    this.client.sendInput(tick, dir, placeBubble)
  }

  private applySnapshot(snapshot: MatchSnapshot, initial: boolean): void {
    this.lastTick = snapshot.tick

    if (initial || this.mapTiles.length === 0) {
      this.mapTiles = snapshot.tiles as TileKindValue[][]
      this.buildTilemap()
    } else {
      for (let row = 0; row < MAP_ROWS; row++) {
        for (let col = 0; col < MAP_COLS; col++) {
          const next = snapshot.tiles[row]![col]! as TileKindValue
          if (this.mapTiles[row]![col] !== next) {
            this.mapTiles[row]![col] = next
            this.rebuildTileAt(col, row)
          }
        }
      }
    }

    this.syncFighters(snapshot.fighters)
    this.syncBubbles(snapshot.bubbles)
    this.syncItems(snapshot.items)
    this.updateHpUi(snapshot.fighters)
    // 初始/reconnect 不重播爆炸；只播這個 tick 真的發生的爆炸
    if (!initial) this.playExplosions(snapshot.explosions)
  }

  private playExplosions(events: ExplosionEvent[]): void {
    if (!events || events.length === 0) return
    for (const ev of events) {
      for (const { col, row } of ev.tiles) {
        const x = col * TILE_SIZE + TILE_SIZE / 2
        const y = row * TILE_SIZE + TILE_SIZE / 2
        const fx = this.scene.add.sprite(x, y, AssetKeys.EXPLOSION)
        fx.setDisplaySize(TILE_SIZE, TILE_SIZE)
        fx.setDepth(15)
        fx.setAlpha(0.9)
        fx.play('explode')
        this.explosionsSpawned += 1
        fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy())
        this.scene.time.delayedCall(400, () => fx.destroy())
      }
    }
  }

  private syncFighters(fighters: FighterSnapshot[]): void {
    const seen = new Set<string>()
    fighters.forEach((f, i) => {
      seen.add(f.playerId)
      let sprite = this.fighterSprites.get(f.playerId)
      const char = CHARACTER_BY_ID[f.characterId]
      if (!sprite) {
        sprite = this.scene.add.sprite(f.x, f.y, char.texture).setDepth(10)
        sprite.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE)
        sprite.setFlipX(false)
        sprite.setFrame(idleFrameForFacing(f.facing, this.framesPerDir))
        this.fighterSprites.set(f.playerId, sprite)
      } else {
        sprite.setPosition(f.x, f.y)
      }
      sprite.setAlpha(f.dead ? 0.35 : 1)
      sprite.setTint(f.trapped ? 0xaaddff : 0xffffff)

      this.syncNameplate(f)
      this.syncTrapBubble(f)

      // 依 snapshot 位移判斷是否在走動，播放對應方向的 walk 動畫；
      // 靜止時停下動畫並回到該方向的待機影格（修正「靜止平移」問題）
      const prev = this.fighterPrevPos.get(f.playerId)
      const moving =
        !f.dead &&
        !f.trapped &&
        !!prev &&
        (Math.abs(f.x - prev.x) > 0.01 || Math.abs(f.y - prev.y) > 0.01)
      this.fighterPrevPos.set(f.playerId, { x: f.x, y: f.y })
      this.updateFighterAnim(sprite, char.animPrefix, f.facing, moving)

      if (!this.hpTexts[i]) {
        this.hpTexts[i] = this.scene.add
          .text(12, 12 + i * 40, '', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#fffde7',
            backgroundColor: '#5d4037cc',
            padding: { x: 8, y: 5 },
          })
          .setScrollFactor(0)
          .setDepth(200)
      }
    })

    for (const id of this.fighterSprites.keys()) {
      if (!seen.has(id)) {
        this.fighterSprites.get(id)?.destroy()
        this.fighterSprites.delete(id)
        this.fighterPrevPos.delete(id)
        this.namePlates.get(id)?.destroy()
        this.namePlates.delete(id)
        this.baseRings.get(id)?.destroy()
        this.baseRings.delete(id)
        this.trapBubbles.get(id)?.destroy()
        this.trapBubbles.delete(id)
      }
    }
  }

  /** 被困住時在角色外圍畫一顆會脈動的淡藍泡泡；解除/出局就移除 */
  private syncTrapBubble(f: FighterSnapshot): void {
    const existing = this.trapBubbles.get(f.playerId)
    if (!f.trapped || f.dead) {
      if (existing) {
        existing.destroy()
        this.trapBubbles.delete(f.playerId)
      }
      return
    }
    let bubble = existing
    if (!bubble) {
      bubble = this.scene.add.sprite(f.x, f.y, AssetKeys.BUBBLE).setDepth(20)
      const size = PLAYER_DISPLAY_SIZE * 1.15
      bubble.setDisplaySize(size, size)
      bubble.setTint(0x9fdcff)
      bubble.setAlpha(0.7)
      const sx = bubble.scaleX
      const sy = bubble.scaleY
      this.scene.tweens.add({
        targets: bubble,
        scaleX: sx * 1.08,
        scaleY: sy * 0.92,
        duration: 480,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      })
      this.trapBubbles.set(f.playerId, bubble)
    } else {
      bubble.setPosition(f.x, f.y)
    }
  }

  private syncNameplate(f: FighterSnapshot): void {
    const color = SLOT_COLORS[f.slot % SLOT_COLORS.length]!
    const ringY = f.y + PLAYER_DISPLAY_SIZE * 0.34
    let ring = this.baseRings.get(f.playerId)
    if (!ring) {
      ring = this.scene.add
        .ellipse(
          f.x,
          ringY,
          PLAYER_DISPLAY_SIZE * 0.72,
          PLAYER_DISPLAY_SIZE * 0.28,
          color,
          0.55,
        )
        .setDepth(9)
      this.baseRings.set(f.playerId, ring)
    } else {
      ring.setPosition(f.x, ringY)
    }
    ring.setVisible(!f.dead)

    const plateY = f.y - PLAYER_DISPLAY_SIZE * 0.52
    const isLocal = f.playerId === this.localPlayerId
    const label = `${isLocal ? '★' : ''}${f.name}`
    let plate = this.namePlates.get(f.playerId)
    if (!plate) {
      plate = this.scene.add
        .text(f.x, plateY, label, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffffff',
          backgroundColor: cssColor(color),
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5, 1)
        .setDepth(30)
      this.namePlates.set(f.playerId, plate)
    } else {
      plate.setPosition(f.x, plateY)
      if (plate.text !== label) plate.setText(label)
    }
    plate.setAlpha(f.dead ? 0.4 : 1)
  }

  private updateFighterAnim(
    sprite: Phaser.GameObjects.Sprite,
    animPrefix: string,
    facing: FighterSnapshot['facing'],
    moving: boolean,
  ): void {
    const facingKey = {
      down: AnimKeys.WALK_DOWN,
      up: AnimKeys.WALK_UP,
      left: AnimKeys.WALK_LEFT,
      right: AnimKeys.WALK_RIGHT,
    }[facing]
    const anim = `${animPrefix}-${facingKey}`

    if (moving) {
      if (sprite.anims.currentAnim?.key !== anim || !sprite.anims.isPlaying) {
        sprite.play(anim, true)
      }
    } else {
      sprite.anims.stop()
      sprite.setFrame(idleFrameForFacing(facing, this.framesPerDir))
    }
  }

  private syncBubbles(bubbles: { id: number; col: number; row: number }[]): void {
    const seen = new Set<number>()
    bubbles.forEach((b) => {
      seen.add(b.id)
      let sprite = this.bubbleSprites.get(b.id)
      const { x, y } = tileToWorld(b.col, b.row)
      if (!sprite) {
        sprite = this.scene.add.sprite(x, y, AssetKeys.BUBBLE).setDepth(8)
        const base = TILE_SIZE * 0.85
        sprite.setDisplaySize(base, base)
        // 放下時彈出 + 持續輕微脈動，讓水球看起來是活的而非靜止貼圖
        sprite.setScale(sprite.scaleX * 0.4)
        this.scene.tweens.add({
          targets: sprite,
          scaleX: sprite.scaleX / 0.4,
          scaleY: sprite.scaleY / 0.4,
          duration: 180,
          ease: 'Back.Out',
          onComplete: () => {
            const sx = sprite!.scaleX
            const sy = sprite!.scaleY
            this.scene.tweens.add({
              targets: sprite,
              scaleX: sx * 1.12,
              scaleY: sy * 0.9,
              duration: 520,
              ease: 'Sine.InOut',
              yoyo: true,
              repeat: -1,
            })
          },
        })
        this.bubbleSprites.set(b.id, sprite)
      } else {
        sprite.setPosition(x, y)
      }
    })
    for (const id of this.bubbleSprites.keys()) {
      if (!seen.has(id)) {
        this.bubbleSprites.get(id)?.destroy()
        this.bubbleSprites.delete(id)
      }
    }
  }

  private syncItems(items: { id: number; col: number; row: number; kind: string }[]): void {
    const seen = new Set<number>()
    items.forEach((it) => {
      seen.add(it.id)
      if (!this.itemSprites.has(it.id)) {
        const pickup = new ItemPickup(
          this.scene,
          it.col,
          it.row,
          it.kind as 'speed' | 'power' | 'bubble',
        )
        this.itemSprites.set(it.id, pickup)
      }
    })
    for (const id of this.itemSprites.keys()) {
      if (!seen.has(id)) {
        this.itemSprites.get(id)?.destroy()
        this.itemSprites.delete(id)
      }
    }
  }

  private updateHpUi(fighters: FighterSnapshot[]): void {
    fighters.forEach((f, i) => {
      const tag = f.playerId === this.localPlayerId ? ' [你]' : ''
      const secs = Math.ceil((f.trapTicksLeft * TICK_MS) / 1000)
      const status = f.dead
        ? ' [出局]'
        : f.trapped
          ? ` [困 ${secs}s]`
          : ' [存活]'
      this.hpTexts[i]?.setText(
        `${f.name}${tag}${status}\n速${f.moveSpeed} 威${f.bubblePower} 球${f.maxBubbles}`,
      )
    })
  }

  private buildTilemap(): void {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const kind = this.mapTiles[row]![col]!
        const px = col * TILE_SIZE + TILE_SIZE / 2
        const py = row * TILE_SIZE + TILE_SIZE / 2
        this.scene.add
          .image(px, py, TILE_TEXTURE[kind])
          .setDisplaySize(TILE_SIZE, TILE_SIZE)
          .setDepth(0)
          .setName(`${col},${row}`)
      }
    }
  }

  private rebuildTileAt(col: number, row: number): void {
    const kind = this.mapTiles[row]![col]!
    const key = `${col},${row}`
    this.scene.children.getByName(key)?.destroy()
    const px = col * TILE_SIZE + TILE_SIZE / 2
    const py = row * TILE_SIZE + TILE_SIZE / 2
    this.scene.add
      .image(px, py, TILE_TEXTURE[kind])
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(0)
      .setName(key)
  }

  private countCrates(): number {
    let n = 0
    for (const row of this.mapTiles) {
      for (const kind of row) if (kind === TileKind.CRATE) n++
    }
    return n
  }

  private publishState(): void {
    const snap = this.client.lastSnapshot
    if (!snap) return
    setBnbState({
      scene: 'duel',
      online: true,
      bubbles: this.bubbleSprites.size,
      explosionsSpawned: this.explosionsSpawned,
      crates: this.countCrates(),
      playerDisplaySize: Math.round(
        [...this.fighterSprites.values()][0]?.displayWidth ?? 0,
      ),
      fighters: snap.fighters.map((f) => {
        const sprite = this.fighterSprites.get(f.playerId)
        return {
          label: f.name,
          hp: f.hp,
          dead: f.dead,
          trapped: f.trapped,
          facing: f.facing,
          x: f.x,
          y: f.y,
          vx: 0,
          vy: 0,
          anim: {
            key: sprite?.anims.currentAnim?.key ?? null,
            frame: sprite?.anims.currentFrame?.index ?? 0,
            isPlaying: sprite?.anims.isPlaying ?? false,
          },
        }
      }),
    })
  }
}
