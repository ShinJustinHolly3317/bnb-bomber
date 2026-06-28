import Phaser from 'phaser'

import { AnimKeys } from '../assets/AssetKeys'
import {
  DEFAULT_SPRITE_MANIFEST,
  idleFrameForFacing,
  type SpriteManifest,
} from '../assets/spriteManifest'
import {
  BASE_BUBBLE_POWER,
  BASE_MAX_BUBBLES,
  MAX_BUBBLE_POWER,
  MAX_BUBBLES_CAP,
  MAX_MOVE_SPEED,
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

    // 顯示尺寸縮到接近格子大小，人物不再比箱子大一截
    this.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE)

    this.setCollideWorldBounds(true)
    this.setBounce(0)
    this.setDrag(200)
    this.setMaxVelocity(this.moveSpeed)
    this.setSize(
      this.spriteManifest.playerBodySize,
      this.spriteManifest.playerBodySize,
    )
    this.setOffset(
      this.spriteManifest.playerOffsetX,
      this.spriteManifest.playerOffsetY,
    )
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
    if (this.dead || this.trapped) {
      this.setVelocity(0, 0)
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

  takeDamage(amount: number): void {
    if (this.dead) return
    this.hp = Math.max(0, this.hp - amount)
    this.setTint(0xff8888)
    this.scene.time.delayedCall(120, () => this.clearTint())
    if (this.hp <= 0) {
      this.dead = true
      this.trapped = false
      this.setVelocity(0, 0)
      this.setAlpha(0.35)
    }
  }

  setTrapped(value: boolean): void {
    this.trapped = value
    if (value) {
      this.setVelocity(0, 0)
      this.setTint(0xaaddff)
    } else {
      this.clearTint()
    }
  }
}
