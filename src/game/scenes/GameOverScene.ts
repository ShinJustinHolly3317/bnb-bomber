import Phaser from 'phaser'

import { setBnbState } from '../debug/bnbState'

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' })
  }

  create(data: { winner: string }): void {
    setBnbState({ scene: 'gameover', winner: data.winner })
    const { width, height } = this.scale

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)

    this.add
      .text(width / 2, height / 2 - 40, data.winner === '平手' ? '平手！' : `${data.winner} 獲勝！`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '42px',
        color: '#ffeb3b',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 + 30, 'R 再戰一局  ·  Esc 回主選單', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.input.keyboard!.once('keydown-R', () => {
      this.scene.start('DuelScene')
    })
    this.input.keyboard!.once('keydown-ESC', () => {
      this.scene.start('MenuScene')
    })
  }
}
