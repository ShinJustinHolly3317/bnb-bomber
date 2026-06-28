import Phaser from 'phaser'

import { AssetKeys } from '../assets/AssetKeys'
import { BUBBLE_FUSE_MS } from '../constants'
import type { Fighter } from './Fighter'

export class WaterBubble extends Phaser.Physics.Arcade.Sprite {
  readonly owner: Fighter
  readonly col: number
  readonly row: number

  private popped = false

  onPop:
    | ((bubble: WaterBubble, trapped: Fighter | null) => void)
    | null = null

  constructor(
    scene: Phaser.Scene,
    col: number,
    row: number,
    x: number,
    y: number,
    owner: Fighter,
  ) {
    super(scene, x, y, AssetKeys.BUBBLE)
    this.owner = owner
    this.col = col
    this.row = row

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setDisplaySize(40, 40)
    this.setImmovable(true)
    this.body!.setSize(36, 36)
    this.setDepth(8)

    this.playSpawnAndPulse()

    scene.time.delayedCall(BUBBLE_FUSE_MS, () => this.pop(null))
  }

  /** 放下時彈出 + 持續輕微脈動，水球看起來會「呼吸」而非靜止貼圖 */
  private playSpawnAndPulse(): void {
    const sx = this.scaleX
    const sy = this.scaleY
    this.setScale(sx * 0.4, sy * 0.4)
    this.scene.tweens.add({
      targets: this,
      scaleX: sx,
      scaleY: sy,
      duration: 180,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          scaleX: sx * 1.12,
          scaleY: sy * 0.9,
          duration: 520,
          ease: 'Sine.InOut',
          yoyo: true,
          repeat: -1,
        })
      },
    })
  }

  pop(trapped: Fighter | null): void {
    if (this.popped) return
    this.popped = true
    this.onPop?.(this, trapped)
    this.destroy()
  }
}
