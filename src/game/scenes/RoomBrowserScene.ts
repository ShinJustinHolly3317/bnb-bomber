import Phaser from 'phaser'

import type { RoomListEntry } from '@bnb/shared'
import { setBnbState } from '../debug/bnbState'
import { getGameClient, resetGameClient } from '../net/GameClient'
import {
  BNB_ROOM_COLORS,
  BNB_ROOM_LAYOUT,
  drawGlossyButton,
  drawGlossyPanel,
  type Rect,
} from '../ui/bnbRoomUi'

// ── 遊戲大廳列表 ────────────────────────────────────────────────────────────
// 玩家從封面進來先看到這裡：連到 server 取得真實房間列表並即時更新，
// 點某一間房 → 加入 → 進入遊戲房間（LobbyScene 連線模式）。
// 若連不上 server，可改用「練習模式」走離線房間。

const FONT = 'Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif'

const DEPTH = {
  BG: 0,
  CHROME: 2,
  ROW: 6,
  STATUS: 8,
  HIGHLIGHT: 10,
  UI: 20,
  TOAST: 40,
} as const

const JOIN_TIMEOUT_MS = 8000

// 版面：960×540，沿用房間 UI 的藍色系外框
const LIST = {
  x: 30,
  y: 78,
  w: 900,
  rowH: 60,
  rowGap: 10,
  rows: 5,
} as const

type BrowserStatus = 'connecting' | 'ready' | 'offline'

export class RoomBrowserScene extends Phaser.Scene {
  private rooms: RoomListEntry[] = []
  private status: BrowserStatus = 'connecting'
  private entering = false
  private enterTimer?: Phaser.Time.TimerEvent
  private netUnsub: (() => void) | null = null

  private rowLayer!: Phaser.GameObjects.Container
  private statusText!: Phaser.GameObjects.Text

  private toastText!: Phaser.GameObjects.Text
  private toastPanel!: Phaser.GameObjects.Graphics
  private toastTimer?: Phaser.Time.TimerEvent

  constructor() {
    super({ key: 'RoomBrowserScene' })
  }

  create(): void {
    this.rooms = []
    this.status = 'connecting'
    this.entering = false
    this.cameras.main.fadeIn(200, 0, 0, 0)

    this.drawChrome()
    this.buildHeader()
    this.buildBottomBar()
    this.buildToast()

    this.rowLayer = this.add.container(0, 0).setDepth(DEPTH.ROW)
    this.statusText = this.add
      .text(LIST.x + LIST.w / 2, LIST.y + this.listAreaH() / 2, '', {
        fontFamily: FONT,
        fontSize: '16px',
        color: BNB_ROOM_COLORS.textDark,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.STATUS)

    this.bindNet()
    void this.connectAndList()

    this.bindKeys()
    this.events.once('shutdown', () => {
      this.unbindKeys()
      this.netUnsub?.()
      this.netUnsub = null
      this.enterTimer?.remove(false)
    })

    setBnbState({ scene: 'browser', browser: { rooms: 0 } })
  }

  // ── 連線 + 取房間列表 ─────────────────────────────────────────────────────
  private async connectAndList(): Promise<void> {
    this.status = 'connecting'
    this.renderStatus()
    try {
      const client = getGameClient()
      await client.connect()
      // 清掉任何殘留房籍，回到大廳觀看狀態並取得列表
      client.leaveRoom()
      client.listRooms()
    } catch {
      resetGameClient()
      this.status = 'offline'
      this.rooms = []
      this.renderRows()
      this.renderStatus()
    }
  }

  private bindNet(): void {
    const client = getGameClient()
    this.netUnsub = client.onMessage((msg) => {
      if (msg.type === 'roomList') {
        this.status = 'ready'
        this.rooms = msg.rooms
        this.renderRows()
        this.renderStatus()
        setBnbState({ scene: 'browser', browser: { rooms: this.rooms.length } })
        return
      }
      if (msg.type === 'lobbyState' && this.entering) {
        this.enterTimer?.remove(false)
        this.registry.set('playMode', 'online')
        this.cameras.main.fadeOut(200, 0, 0, 0)
        this.time.delayedCall(200, () => this.scene.start('LobbyScene'))
        return
      }
      if (msg.type === 'error') {
        if (this.entering) {
          this.entering = false
          this.enterTimer?.remove(false)
        }
        this.showToast(msg.message)
      }
    })
  }

  // ── 外框 ──────────────────────────────────────────────────────────────────
  private drawChrome(): void {
    const { width, height } = this.scale
    this.add
      .rectangle(width / 2, height / 2, width, height, BNB_ROOM_COLORS.outer)
      .setDepth(DEPTH.BG)

    const chrome = this.add.graphics().setDepth(DEPTH.CHROME)
    drawGlossyPanel(
      chrome,
      BNB_ROOM_LAYOUT.frame,
      BNB_ROOM_COLORS.frame,
      BNB_ROOM_COLORS.panelDeep,
    )
    drawGlossyPanel(
      chrome,
      { x: LIST.x - 6, y: LIST.y - 6, w: LIST.w + 12, h: this.listAreaH() + 12 },
      BNB_ROOM_COLORS.panel,
      BNB_ROOM_COLORS.panelDark,
    )
  }

  private listAreaH(): number {
    return LIST.rows * LIST.rowH + (LIST.rows - 1) * LIST.rowGap
  }

  // ── 標題列 + 返回 ─────────────────────────────────────────────────────────
  private buildHeader(): void {
    this.add
      .text(30, 24, '遊戲大廳', {
        fontFamily: FONT,
        fontSize: '26px',
        color: BNB_ROOM_COLORS.textGold,
        fontStyle: 'bold',
      })
      .setDepth(DEPTH.UI)

    this.add
      .text(168, 34, '選一間房間加入', {
        fontFamily: FONT,
        fontSize: '13px',
        color: BNB_ROOM_COLORS.textMuted,
      })
      .setDepth(DEPTH.UI)

    const back: Rect = { x: 854, y: 22, w: 76, h: 32 }
    const g = this.add.graphics().setDepth(DEPTH.CHROME)
    drawGlossyButton(g, back, BNB_ROOM_COLORS.btnRed, 0xb71c1c)
    this.add
      .text(back.x + back.w / 2, back.y + back.h / 2, '返回', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#fff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI)
    this.bindClick(back, () => this.goMenu())
  }

  // ── 底部按鈕列：建立房間 / 練習模式 / 重新整理 ───────────────────────────
  private buildBottomBar(): void {
    const y = LIST.y + this.listAreaH() + 18
    const gap = 14
    const btnW = (LIST.w - gap * 2) / 3
    const btnH = 48

    const create: Rect = { x: LIST.x, y, w: btnW, h: btnH }
    const cg = this.add.graphics().setDepth(DEPTH.CHROME)
    drawGlossyButton(cg, create, BNB_ROOM_COLORS.btnGreenHi, BNB_ROOM_COLORS.btnGreen)
    this.label(create, '＋ 建立房間')
    this.bindClick(create, () => this.createRoom())

    const practice: Rect = { x: LIST.x + btnW + gap, y, w: btnW, h: btnH }
    const pg = this.add.graphics().setDepth(DEPTH.CHROME)
    drawGlossyButton(pg, practice, BNB_ROOM_COLORS.readyTop, BNB_ROOM_COLORS.readyBottom)
    this.label(practice, '練習模式')
    this.bindClick(practice, () => this.startPractice())

    const refresh: Rect = { x: LIST.x + (btnW + gap) * 2, y, w: btnW, h: btnH }
    const rg = this.add.graphics().setDepth(DEPTH.CHROME)
    drawGlossyButton(rg, refresh, BNB_ROOM_COLORS.btnBlue, 0x1565c0)
    this.label(refresh, '↻ 重新整理')
    this.bindClick(refresh, () => this.refresh())
  }

  private label(rect: Rect, text: string): void {
    this.add
      .text(rect.x + rect.w / 2, rect.y + rect.h / 2, text, {
        fontFamily: FONT,
        fontSize: '17px',
        color: '#fff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI)
  }

  // ── 房間列表狀態文字 ──────────────────────────────────────────────────────
  private renderStatus(): void {
    if (this.status === 'connecting') {
      this.statusText.setText('連線中…').setVisible(true)
      return
    }
    if (this.status === 'offline') {
      this.statusText
        .setText('無法連線到伺服器\n可改玩「練習模式」')
        .setVisible(true)
      return
    }
    if (this.rooms.length === 0) {
      this.statusText
        .setText('目前沒有開放的房間\n按「建立房間」開一間吧')
        .setVisible(true)
      return
    }
    this.statusText.setVisible(false)
  }

  // ── 繪製房間列 ────────────────────────────────────────────────────────────
  private renderRows(): void {
    this.rowLayer.removeAll(true)
    this.rooms.slice(0, LIST.rows).forEach((room, i) => {
      const ry = LIST.y + i * (LIST.rowH + LIST.rowGap)
      this.buildRow(room, ry)
    })
  }

  private buildRow(room: RoomListEntry, ry: number): void {
    const waiting = room.phase === 'lobby'
    const full = room.players >= room.maxPlayers
    const joinable = waiting && !full

    const bg = this.add.graphics()
    drawGlossyPanel(
      bg,
      { x: LIST.x, y: ry, w: LIST.w, h: LIST.rowH },
      joinable ? BNB_ROOM_COLORS.slotFill : 0x90a4ae,
      BNB_ROOM_COLORS.panelDark,
    )
    this.rowLayer.add(bg)

    // 房號（房間代碼）
    this.rowLayer.add(
      this.add.text(LIST.x + 18, ry + LIST.rowH / 2, room.code, {
        fontFamily: FONT,
        fontSize: '22px',
        color: BNB_ROOM_COLORS.textDark,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5),
    )

    // 房主名稱
    this.rowLayer.add(
      this.add.text(LIST.x + 110, ry + 12, `${room.hostName} 的房間`, {
        fontFamily: FONT,
        fontSize: '17px',
        color: BNB_ROOM_COLORS.textDark,
        fontStyle: 'bold',
      }),
    )

    // 地圖
    this.rowLayer.add(
      this.add.text(LIST.x + 110, ry + 36, `地圖：${room.mapName}`, {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#1565c0',
      }),
    )

    // 人數
    this.rowLayer.add(
      this.add.text(LIST.x + LIST.w - 230, ry + LIST.rowH / 2, `${room.players}/${room.maxPlayers}`, {
        fontFamily: FONT,
        fontSize: '20px',
        color: full ? '#b71c1c' : BNB_ROOM_COLORS.textDark,
        fontStyle: 'bold',
      }).setOrigin(0.5),
    )

    // 狀態徽章
    const badgeText = !waiting ? '對戰中' : full ? '已滿' : '等待中'
    const badgeBg = !waiting ? '#ef6c00' : full ? '#b71c1c' : '#2e7d32'
    this.rowLayer.add(
      this.add.text(LIST.x + LIST.w - 150, ry + LIST.rowH / 2, badgeText, {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#fff',
        backgroundColor: badgeBg,
        padding: { x: 8, y: 4 },
        fontStyle: 'bold',
      }).setOrigin(0.5),
    )

    // 加入按鈕
    const join: Rect = { x: LIST.x + LIST.w - 92, y: ry + 12, w: 76, h: LIST.rowH - 24 }
    const jg = this.add.graphics()
    drawGlossyButton(
      jg,
      join,
      joinable ? BNB_ROOM_COLORS.readyTop : 0xbdbdbd,
      joinable ? BNB_ROOM_COLORS.readyBottom : 0x9e9e9e,
    )
    this.rowLayer.add(jg)
    this.rowLayer.add(
      this.add.text(join.x + join.w / 2, join.y + join.h / 2, '加入', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#fff',
        fontStyle: 'bold',
      }).setOrigin(0.5),
    )

    // 整列可點
    const hit = this.add
      .rectangle(LIST.x + LIST.w / 2, ry + LIST.rowH / 2, LIST.w, LIST.rowH, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => this.onRoomClick(room))
    this.rowLayer.add(hit)
  }

  // ── 互動 ──────────────────────────────────────────────────────────────────
  private onRoomClick(room: RoomListEntry): void {
    if (room.phase !== 'lobby') {
      this.showToast('對戰進行中，無法加入')
      return
    }
    if (room.players >= room.maxPlayers) {
      this.showToast('房間已滿')
      return
    }
    this.beginEnter(() => getGameClient().joinRoom(room.code, '玩家'))
  }

  private createRoom(): void {
    this.beginEnter(() => getGameClient().createRoom('玩家'))
  }

  /** 連線進房（建立或加入）；先確保連線開啟再送，等 server 回 lobbyState 才切場景 */
  private beginEnter(action: () => void): void {
    if (this.entering) return
    this.entering = true
    this.showToast('連線中…')
    void this.ensureConnectedThen(action)
  }

  private async ensureConnectedThen(action: () => void): Promise<void> {
    try {
      // 連線尚未開啟時就送 createRoom/joinRoom 會被丟掉，這裡先等 socket open
      await getGameClient().connect()
    } catch {
      resetGameClient()
      this.entering = false
      this.status = 'offline'
      this.rooms = []
      this.renderRows()
      this.renderStatus()
      this.showToast('無法連線到伺服器，請玩練習模式')
      return
    }
    action()
    this.enterTimer = this.time.delayedCall(JOIN_TIMEOUT_MS, () => {
      this.entering = false
      this.showToast('連線逾時，請重試')
    })
  }

  private startPractice(): void {
    this.registry.set('playMode', 'offline')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(200, () => this.scene.start('LobbyScene'))
  }

  private refresh(): void {
    if (this.status === 'offline') {
      void this.connectAndList()
      return
    }
    getGameClient().listRooms()
    this.showToast('已重新整理')
  }

  private goMenu(): void {
    this.cameras.main.fadeOut(180, 0, 0, 0)
    this.time.delayedCall(180, () => this.scene.start('MenuScene'))
  }

  // ── 按鍵 ──────────────────────────────────────────────────────────────────
  private keyHandlers = {
    esc: () => this.goMenu(),
    refresh: () => this.refresh(),
    create: () => this.createRoom(),
  }

  private bindKeys(): void {
    const kb = this.input.keyboard!
    kb.on('keydown-ESC', this.keyHandlers.esc)
    kb.on('keydown-R', this.keyHandlers.refresh)
    kb.on('keydown-C', this.keyHandlers.create)
  }

  private unbindKeys(): void {
    const kb = this.input.keyboard
    if (!kb) return
    kb.off('keydown-ESC', this.keyHandlers.esc)
    kb.off('keydown-R', this.keyHandlers.refresh)
    kb.off('keydown-C', this.keyHandlers.create)
  }

  private bindClick(rect: Rect, fn: () => void): void {
    const zone = this.add
      .rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.UI)
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: zone, scaleX: 0.96, scaleY: 0.96, duration: 70, yoyo: true })
      fn()
    })
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  private buildToast(): void {
    this.toastPanel = this.add.graphics().setDepth(DEPTH.TOAST).setAlpha(0)
    this.toastText = this.add
      .text(480, 470, '', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#fff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.TOAST)
      .setAlpha(0)
  }

  private showToast(msg: string): void {
    this.toastTimer?.remove(false)
    const padX = 16
    const padY = 8
    this.toastText.setText(msg)
    const textW = Math.min(this.toastText.width + padX * 2, 420)
    const textH = this.toastText.height + padY * 2
    const cx = 480
    const cy = 470

    this.toastPanel.clear()
    drawGlossyPanel(
      this.toastPanel,
      { x: cx - textW / 2, y: cy - textH / 2, w: textW, h: textH },
      BNB_ROOM_COLORS.panelDark,
      BNB_ROOM_COLORS.panelDeep,
    )

    this.tweens.killTweensOf([this.toastText, this.toastPanel])
    this.toastText.setAlpha(0)
    this.toastPanel.setAlpha(0)
    this.tweens.add({ targets: [this.toastText, this.toastPanel], alpha: 1, duration: 120 })
    this.toastTimer = this.time.delayedCall(1800, () => {
      this.tweens.add({ targets: [this.toastText, this.toastPanel], alpha: 0, duration: 200 })
    })
  }
}
