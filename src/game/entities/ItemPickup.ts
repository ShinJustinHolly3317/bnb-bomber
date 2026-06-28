import Phaser from 'phaser'

import { ITEM_TEXTURE, type ItemKindValue } from '../items/ItemKind'
import { tileToWorld } from '../utils/grid'

export class ItemPickup extends Phaser.Physics.Arcade.Sprite {
  readonly kind: ItemKindValue

  constructor(scene: Phaser.Scene, col: number, row: number, kind: ItemKindValue) {
    const pos = tileToWorld(col, row)
    super(scene, pos.x, pos.y, ITEM_TEXTURE[kind])
    this.kind = kind

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setDisplaySize(32, 32)
    this.setDepth(6)
    this.body!.setSize(28, 28)

    scene.tweens.add({
      targets: this,
      y: pos.y - 4,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }
}
