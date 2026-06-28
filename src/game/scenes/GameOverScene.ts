import Phaser from 'phaser'

import { setBnbState } from '../debug/bnbState'
import { getGameClient, resetGameClient } from '../net/GameClient'

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' })
  }

  create(data: { winner: string; online?: boolean }): void {
    const online =
      data.online === true || this.registry.get('playMode') === 'online'
    setBnbState({ scene: 'gameover', winner: data.winner, online })
    const { width, height } = this.scale

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)

    this.add
      .text(width / 2, height / 2 - 40, data.winner === '平手' ? '平手！' : `${data.winner} 獲勝！`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '42px',
        color: '#ffeb3b',
      })
      .setOrigin(0.5)

    const hint = online
      ? 'R 回房間再戰  ·  Esc 回主選單'
      : 'R 再戰一局  ·  Esc 回主選單'
    this.add
      .text(width / 2, height / 2 + 30, hint, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.input.keyboard!.once('keydown-R', () => {
      if (online) {
        getGameClient().requestRematch()
        this.scene.start('LobbyScene')
        return
      }
      this.scene.start('DuelScene')
    })
    this.input.keyboard!.once('keydown-ESC', () => {
      if (online) {
        getGameClient().leaveRoom()
        resetGameClient()
        this.registry.set('playMode', 'offline')
      }
      this.scene.start('MenuScene')
    })
  }
}
