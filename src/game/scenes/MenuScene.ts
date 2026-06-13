import Phaser from 'phaser'

import { setBnbState } from '../debug/bnbState'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
  }

  create(): void {
    setBnbState({ scene: 'menu' })
    const { width, height } = this.scale

    this.add
      .rectangle(width / 2, height / 2, width, height, 0x1b5e20)
      .setAlpha(0.35)

    this.add
      .text(width / 2, height / 2 - 80, 'bnb-bomber', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '48px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 - 20, '村10 · 雙人對戰', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffdd88',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 + 40, '按 Enter 開始', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 + 100, 'P1: WASD + Space\nP2: 方向鍵 + Enter\n道具: S加速 P威力 B水球+', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#cccccc',
        align: 'center',
      })
      .setOrigin(0.5)

    this.input.keyboard!.once('keydown-ENTER', () => {
      this.scene.start('DuelScene')
    })
  }
}
