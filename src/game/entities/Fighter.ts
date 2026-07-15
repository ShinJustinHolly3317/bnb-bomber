import Phaser from 'phaser'

import { AnimKeys, AssetKeys } from '../assets/AssetKeys'
import {
  DEFAULT_SPRITE_MANIFEST,
  idleFrameForFacing,
  type SpriteManifest,
} from '../assets/spriteManifest'
import {
  BASE_BUBBLE_POWER,
  BASE_MAX_BUBBLES,
  BUBBLE_TRAP_MS,
  MAX_BUBBLE_POWER,
  MAX_BUBBLES_CAP,
  MAX_MOVE_SPEED,
  PLAYER_COLLISION_SIZE,
  PLAYER_DISPLAY_SIZE,
  PLAYER_MAX_HP,
  PLAYER_MOVE_SPEED,
  SPEED_BOOST,
} from '../constants'
import type { WaterBubble } from './WaterBubble'

export type Facing = 'down' | 'up' | 'left' | 'right'

export class Fighter extends Phaser.Physics.Arcade.Sprite {
  readonly playerId: 1 | 2
  readonly label: string

  hp = PLAYER_MAX_HP
  trapped = false
  dead = false
  facing: Facing = 'down'
  // 泡泡困住的到期時間（scene.time.now 毫秒），0 = 沒被困
  trapUntil = 0
  private trapFx: Phaser.GameObjects.Sprite | null = null

  moveSpeed = PLAYER_MOVE_SPEED
  bubblePower = BASE_BUBBLE_POWER
  maxBubbles = BASE_MAX_BUBBLES
  activeBubbles: WaterBubble[] = []

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private bubbleKey: Phaser.Input.Keyboard.Key
  private walkPrefix: string
  private spriteManifest: SpriteManifest

  onPlaceBubble: ((fighter: Fighter) => void) | null = null

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    playerId: 1 | 2,
    label: string,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    bubbleKey: Phaser.Input.Keyboard.Key,
    walkPrefix: string,
  ) {
    super(scene, x, y, texture)
    this.playerId = playerId
    this.label = label
    this.cursors = cursors
    this.bubbleKey = bubbleKey
    this.walkPrefix = walkPrefix
    this.spriteManifest =
      (scene.registry.get('spriteManifest') as SpriteManifest | undefined) ??
      DEFAULT_SPRITE_MANIFEST

    scene.add.existing(this)
    scene.physics.add.existing(this)

    // 顯示尺寸放大到跟格子差不多大（含透明邊框故略大於 TILE）
    this.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE)

    this.setCollideWorldBounds(true)
    this.setBounce(0)
    this.setDrag(200)
    this.setMaxVelocity(this.moveSpeed)

    // 碰撞體與顯示尺寸「脫鉤」：固定維持 PLAYER_COLLISION_SIZE 的世界大小，
    // 顯示放大也不會讓碰撞變大、卡在窄路。body 是 source px，會被 scale 放大，
    // 故先除回 scale 換算。
    const frameW = this.spriteManifest.characterFrameWidth
    const frameH = this.spriteManifest.characterFrameHeight
    const bodyW = PLAYER_COLLISION_SIZE / this.scaleX
    const bodyH = PLAYER_COLLISION_SIZE / this.scaleY
    this.setSize(bodyW, bodyH)
    this.setOffset((frameW - bodyW) / 2, (frameH - bodyH) / 2 + 4)
    this.setDepth(10)
    this.setFlipX(false)
    this.anims.stop()
    this.setFrame(0)
  }

  get activeBubbleCount(): number {
    return this.activeBubbles.filter((b) => b.active).length
  }

  registerBubble(bubble: WaterBubble): void {
    this.activeBubbles.push(bubble)
  }

  unregisterBubble(bubble: WaterBubble): void {
    this.activeBubbles = this.activeBubbles.filter((b) => b !== bubble)
  }

  applyItem(kind: 'speed' | 'power' | 'bubble'): void {
    if (kind === 'speed') {
      this.moveSpeed = Math.min(MAX_MOVE_SPEED, this.moveSpeed + SPEED_BOOST)
      this.setMaxVelocity(this.moveSpeed)
    } else if (kind === 'power') {
      this.bubblePower = Math.min(MAX_BUBBLE_POWER, this.bubblePower + 1)
    } else {
      this.maxBubbles = Math.min(MAX_BUBBLES_CAP, this.maxBubbles + 1)
    }
  }

  statsLine(): string {
    return `速${this.moveSpeed} 威${this.bubblePower} 球${this.maxBubbles}`
  }

  update(): void {
    if (this.dead) {
      this.setVelocity(0, 0)
      return
    }
    if (this.trapped) {
      this.setVelocity(0, 0)
      this.trapFx?.setPosition(this.x, this.y)
      if (this.scene.time.now >= this.trapUntil) this.burst()
      return
    }

    let vx = 0
    let vy = 0
    if (this.cursors.left?.isDown) vx -= 1
    if (this.cursors.right?.isDown) vx += 1
    if (this.cursors.up?.isDown) vy -= 1
    if (this.cursors.down?.isDown) vy += 1

    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2
      vy *= Math.SQRT1_2
    }

    this.setVelocity(vx * this.moveSpeed, vy * this.moveSpeed)

    if (vx !== 0 || vy !== 0) {
      if (Math.abs(vx) >= Math.abs(vy)) {
        this.facing = vx < 0 ? 'left' : 'right'
      } else {
        this.facing = vy < 0 ? 'up' : 'down'
      }
      const facingKey = {
        down: AnimKeys.WALK_DOWN,
        up: AnimKeys.WALK_UP,
        left: AnimKeys.WALK_LEFT,
        right: AnimKeys.WALK_RIGHT,
      }[this.facing]
      const anim = `${this.walkPrefix}-${facingKey}`
      this.setFlipX(false)
      if (this.anims.currentAnim?.key !== anim) {
        this.play(anim, true)
      } else if (!this.anims.isPlaying) {
        this.play(anim, true)
      }
    } else {
      this.anims.stop()
      this.setFrame(
        idleFrameForFacing(
          this.facing,
          this.spriteManifest.walkFramesPerDirection,
        ),
      )
    }

    if (Phaser.Input.Keyboard.JustDown(this.bubbleKey) && this.onPlaceBubble) {
      this.onPlaceBubble(this)
    }
  }

  /** 被炸到：困進淡藍泡泡，開始 10s 倒數（已困或已死則不處理） */
  trap(): void {
    if (this.dead || this.trapped) return
    this.trapped = true
    this.trapUntil = this.scene.time.now + BUBBLE_TRAP_MS
    this.setVelocity(0, 0)
    this.setTint(0xaaddff)
    this.spawnTrapFx()
  }

  /** 泡泡爆破：出局 */
  burst(): void {
    if (this.dead) return
    this.dead = true
    this.trapped = false
    this.trapUntil = 0
    this.setVelocity(0, 0)
    this.setAlpha(0.35)
    this.clearTint()
    this.trapFx?.destroy()
    this.trapFx = null
  }

  /** 剩餘困住秒數（給 UI 倒數顯示用） */
  trapSecondsLeft(): number {
    if (!this.trapped) return 0
    return Math.max(0, Math.ceil((this.trapUntil - this.scene.time.now) / 1000))
  }

  private spawnTrapFx(): void {
    const fx = this.scene.add.sprite(this.x, this.y, AssetKeys.BUBBLE)
    fx.setDepth(20)
    fx.setDisplaySize(this.displayWidth * 1.15, this.displayHeight * 1.15)
    fx.setTint(0x9fdcff)
    fx.setAlpha(0.7)
    const sx = fx.scaleX
    const sy = fx.scaleY
    this.scene.tweens.add({
      targets: fx,
      scaleX: sx * 1.08,
      scaleY: sy * 0.92,
      duration: 480,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    })
    this.trapFx = fx
  }
}
