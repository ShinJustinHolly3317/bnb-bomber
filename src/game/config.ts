import Phaser from 'phaser'

import { VIEW_HEIGHT, VIEW_WIDTH } from './constants'
import { BootScene } from './scenes/BootScene'
import { DuelScene } from './scenes/DuelScene'
import { GameOverScene } from './scenes/GameOverScene'
import { LobbyScene } from './scenes/LobbyScene'
import { MenuScene } from './scenes/MenuScene'
import { RoomBrowserScene } from './scenes/RoomBrowserScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#2d5016',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, RoomBrowserScene, LobbyScene, DuelScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}
