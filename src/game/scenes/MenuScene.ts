import Phaser from 'phaser'

import { AnimKeys } from '../assets/AssetKeys'
import { CHARACTER_LIST } from '../characters/CharacterCatalog'
import { setBnbState } from '../debug/bnbState'
import { getGameClient, resetGameClient } from '../net/GameClient'
import { type SpriteManifest } from '../assets/spriteManifest'

// ── 遊戲主選單畫面 ──────────────────────────────────────────────────────────
// 使用生成的 menu_bg.png 作為背景（包含村莊場景、藍框邊界、地板磚塊、炸彈圖案）
// 上方疊加「爆爆王」標題文字、四隻角色精靈、BOMB!/ITEM! 貼紙標籤、底部操作列

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
  }

  create(): void {
    setBnbState({ scene: 'menu' })
    const W = this.scale.width   // 960
    const H = this.scale.height  // 600

    this.buildBackground(W, H)
    this.buildTitle(W)
    this.buildCharacters(W)
    this.buildStickerLabels(W)
    this.buildMenuBar(W, H)

    this.bindKeys()
    this.handleDevHashRoute()
    this.exposeTestHooks()
  }

  // ── 背景圖（村莊場景 + 藍色邊框 + 地板 + 炸彈裝飾）────────────────────────
  private buildBackground(W: number, H: number): void {
    // 延伸一點避免邊緣露出黑色
    this.add.image(W / 2, H / 2, 'menu_bg')
      .setDisplaySize(W + 2, H + 2)
      .setDepth(0)
  }

  // ── 標題文字（疊在背景圖頂部深色橫幅上）────────────────────────────────────
  private buildTitle(W: number): void {
    // 主標題「爆爆王」
    const titleText = this.add.text(W / 2, 44, '爆爆王', {
      fontFamily: '"Arial Black", "Noto Sans TC", "Microsoft JhengHei", Impact, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#FFE000',
      stroke: '#110044',
      strokeThickness: 10,
      shadow: {
        offsetX: 3,
        offsetY: 4,
        color: '#0033aa',
        blur: 0,
        fill: true,
      },
    }).setOrigin(0.5).setDepth(10)

    // 副標題「CRAZY ARCADE」
    this.add.text(W / 2, 82, '★  CRAZY ARCADE  ★', {
      fontFamily: '"Arial", sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000033',
      strokeThickness: 4,
      letterSpacing: 5,
    }).setOrigin(0.5).setDepth(10)

    // 標題輕微浮動
    this.tweens.add({
      targets: titleText,
      y: 40,
      duration: 2000,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    })
  }

  // ── 四隻角色展示 ──────────────────────────────────────────────────────────
  private buildCharacters(W: number): void {
    const manifest = this.registry.get('spriteManifest') as SpriteManifest | undefined
    const fw = manifest?.characterFrameWidth ?? 64
    // 顯示尺寸：約 3.8x 放大，讓角色在畫面中夠大夠醒目
    const D = Math.round(fw * 3.8) // ~243px

    // 位置：左右各兩隻，高度微差
    // x 分散在畫面各區塊，y 對齊地板磚塊上方
    const slots: Array<{ x: number; y: number; charIdx: number; flip: boolean; delay: number }> = [
      { x: 148,       y: 376, charIdx: 0, flip: false, delay: 0 },
      { x: 328,       y: 360, charIdx: 1, flip: false, delay: 200 },
      { x: W - 328,   y: 360, charIdx: 2, flip: true,  delay: 100 },
      { x: W - 148,   y: 376, charIdx: 3, flip: true,  delay: 300 },
    ]

    slots.forEach(({ x, y, charIdx, flip, delay }) => {
      const def = CHARACTER_LIST[charIdx]

      // 地板陰影橢圓
      const shadow = this.add.graphics().setDepth(9)
      shadow.fillStyle(0x000000, 0.28)
      shadow.fillEllipse(x, y + D / 2 - 10, D * 0.6, 18)

      // 角色精靈
      const sprite = this.add.sprite(x, y, def.texture, 0)
      sprite.setDisplaySize(D, D)
      sprite.setFlipX(flip)
      sprite.setDepth(11)
      sprite.play(`${def.animPrefix}-${AnimKeys.WALK_DOWN}`)

      // 上下輕微浮動，讓畫面有生命感
      this.tweens.add({
        targets: sprite,
        y: y - 14,
        duration: 1300 + charIdx * 160,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
        delay,
      })
    })
  }

  // ── BOMB! / ITEM! 貼紙標籤 ──────────────────────────────────────────────
  private buildStickerLabels(W: number): void {
    type StickerDef = { x: number; y: number; text: string; color: string; stroke: string; angle: number; delay: number }
    const stickers: StickerDef[] = [
      // 左側炸彈附近
      { x: 102,    y: 280, text: 'BOMB!', color: '#FFE000', stroke: '#CC0000', angle: -16, delay: 0 },
      // 左下角（配合背景底部炸彈）
      { x: 155,    y: 458, text: 'BOMB!', color: '#FFE000', stroke: '#CC0000', angle: -8,  delay: 250 },
      // 右側道具附近
      { x: W - 95, y: 268, text: 'ITEM!', color: '#44FF44', stroke: '#005500', angle: 14,  delay: 130 },
      // 右下角
      { x: W - 200, y: 462, text: 'ITEM!', color: '#44FF44', stroke: '#005500', angle: -6, delay: 380 },
    ]

    stickers.forEach(({ x, y, text, color, stroke, angle, delay }) => {
      const t = this.add.text(x, y, text, {
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color,
        stroke,
        strokeThickness: 6,
      }).setOrigin(0.5).setAngle(angle).setDepth(15)

      // 輕微 pulse 動畫
      this.tweens.add({
        targets: t,
        scaleX: 1.22,
        scaleY: 1.22,
        duration: 750 + delay * 0.5,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
        delay,
      })
    })
  }

  // ── 底部操作列 ────────────────────────────────────────────────────────────
  private buildMenuBar(W: number, H: number): void {
    const PW = 640
    const PH = 52
    const barY = H - 38

    const panel = this.add.graphics().setDepth(20)
    // 深色半透明背景板
    panel.fillStyle(0x0a0820, 0.88)
    panel.fillRoundedRect(W / 2 - PW / 2, barY - PH / 2, PW, PH, 10)
    // 藍色外框
    panel.lineStyle(3, 0x3399ff, 1)
    panel.strokeRoundedRect(W / 2 - PW / 2, barY - PH / 2, PW, PH, 10)
    // 內側細高光
    panel.lineStyle(1, 0xaaddff, 0.3)
    panel.strokeRoundedRect(W / 2 - PW / 2 + 2, barY - PH / 2 + 2, PW - 4, PH - 4, 9)

    const bar = this.add.text(W / 2, barY, '按任意鍵進入遊戲大廳', {
      fontFamily: '"Courier New", monospace',
      fontSize: '16px',
      color: '#e0e8ff',
      stroke: '#000033',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21)

    // 文字輕微閃爍，提示玩家可以按鍵
    this.tweens.add({
      targets: bar,
      alpha: 0.4,
      duration: 900,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    })
  }

  // ── 按鍵綁定：按任意鍵 / 點畫面 → 進入遊戲大廳 ───────────────────────────
  private bindKeys(): void {
    this.input.keyboard!.once('keydown', () => this.enterBrowser())
    this.input.once('pointerdown', () => this.enterBrowser())
  }

  private enterBrowser(): void {
    this.cameras.main.fadeOut(180, 0, 0, 0)
    this.time.delayedCall(180, () => this.scene.start('RoomBrowserScene'))
  }

  private exposeTestHooks(): void {
    window.__bnbTest = {
      createRoom: () => this.startOnlineCreate(),
      joinRoom: (code: string) => this.startOnlineJoinWithCode(code),
    }
  }

  // QA / 開發用：#create 或 #join=CODE
  private handleDevHashRoute(): void {
    const hash = window.location.hash.replace(/^#/, '')
    if (hash === 'create') {
      window.location.hash = ''
      void this.startOnlineCreate()
      return
    }
    if (hash.startsWith('join=')) {
      const code = decodeURIComponent(hash.slice(5))
      window.location.hash = ''
      void this.startOnlineJoinWithCode(code)
    }
  }

  private async startOnlineJoinWithCode(code: string): Promise<void> {
    if (!code.trim()) return
    try {
      const client = getGameClient()
      await client.connect()
      await this.waitForRoom(client, () => client.joinRoom(code, '玩家2'))
      this.registry.set('playMode', 'online')
      this.scene.start('LobbyScene')
    } catch (err) {
      this.showNetError(String(err))
    }
  }

  private async startOnlineCreate(): Promise<void> {
    try {
      const client = getGameClient()
      await client.connect()
      await this.waitForRoom(client, () => client.createRoom('玩家1'))
      this.registry.set('playMode', 'online')
      this.scene.start('LobbyScene')
    } catch (err) {
      this.showNetError(String(err))
    }
  }

  private waitForRoom(
    client: ReturnType<typeof getGameClient>,
    action: () => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        off()
        reject(new Error('連線逾時'))
      }, 8000)
      const off = client.onMessage((msg) => {
        if (msg.type === 'lobbyState') {
          window.clearTimeout(timer)
          off()
          resolve()
        }
        if (msg.type === 'error') {
          window.clearTimeout(timer)
          off()
          reject(new Error(msg.message))
        }
      })
      action()
    })
  }

  private showNetError(msg: string): void {
    resetGameClient()
    window.alert(`連線失敗：${msg}`)
    this.scene.restart()
  }
}
