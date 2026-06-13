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

    this.setDisplaySize(36, 36)
    this.setImmovable(true)
    this.body!.setSize(32, 32)
    this.setDepth(8)

    scene.time.delayedCall(BUBBLE_FUSE_MS, () => this.pop(null))
  }

  pop(trapped: Fighter | null): void {
    if (this.popped) return
    this.popped = true
    this.onPop?.(this, trapped)
    this.destroy()
  }
}
