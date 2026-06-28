import Phaser from 'phaser'

import {
  CHARACTER_BY_ID,
  CHARACTER_LIST,
} from '../characters/CharacterCatalog'
import type { LobbySnapshot } from '@bnb/shared'
import { setBnbState } from '../debug/bnbState'
import {
  createEmptyLobby,
  LOBBY_MAX_PLAYERS,
  occupiedCount,
  type LobbyState,
} from '../lobby/LobbyState'
import {
  BNB_ROOM_COLORS,
  BNB_ROOM_LAYOUT,
  CHAR_GRID,
  TEAM_COLORS,
  charCellCenter,
  chatRect,
  colorSwatchCenter,
  drawGlossyButton,
  drawGlossyPanel,
  drawSectionRule,
  exitBtnRect,
  inviteBtnRect,
  mapBoxRect,
  readyBtnRect,
  sectionLabelX,
  slotCenter,
} from '../ui/bnbRoomUi'
import { getGameClient } from '../net/GameClient'

const DEPTH = {
  BG: 0,
  CHROME: 2,
  SLOTS: 6,
  HIGHLIGHT: 10,
  UI: 20,
  TOAST: 40,
} as const

const FONT = 'Arial, sans-serif'

export class LobbyScene extends Phaser.Scene {
  private lobby!: LobbyState
  private selectedCharIndex = 0
  private teamColorIndex = 5
  private starting = false

  private slotPortraits: Phaser.GameObjects.Image[] = []
  private slotNameTexts: Phaser.GameObjects.Text[] = []
  private slotBadgeTexts: Phaser.GameObjects.Text[] = []
  private charHighlights: Phaser.GameObjects.Rectangle[] = []
  private colorHighlights: Phaser.GameObjects.Rectangle[] = []
  private readyLabel!: Phaser.GameObjects.Text

  private toastText!: Phaser.GameObjects.Text
  private toastPanel!: Phaser.GameObjects.Graphics
  private toastTimer?: Phaser.Time.TimerEvent
  private online = false
  private netUnsub: (() => void) | null = null
  private roomCodeText?: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'LobbyScene' })
  }

  create(): void {
    this.starting = false
    this.cameras.main.fadeIn(200, 0, 0, 0)
    this.online = this.registry.get('playMode') === 'online'

    this.lobby =
      (this.registry.get('lobbyState') as LobbyState | undefined) ??
      createEmptyLobby()
    this.registry.set('lobbyState', this.lobby)

    this.selectedCharIndex = CHARACTER_LIST.findIndex(
      (c) => c.id === this.lobby.slots[0].characterId,
    )
    if (this.selectedCharIndex < 0) this.selectedCharIndex = 0

    this.drawChrome()
    this.buildPlayerSlots()
    this.buildCharacterPicker()
    this.buildColorPicker()
    this.buildActionButtons()
    this.buildExitButton()
    this.buildToast()

    if (this.online) {
      this.bindNetHandlers()
      const snap = getGameClient().lobby
      if (snap) this.applyLobbySnapshot(snap)
    }

    this.refreshAll()
    this.bindInput()
    this.events.once('shutdown', () => {
      this.unbindInput()
      this.netUnsub?.()
      this.netUnsub = null
    })
  }

  private bindNetHandlers(): void {
    const client = getGameClient()
    this.netUnsub = client.onMessage((msg) => {
      if (msg.type === 'lobbyState') {
        this.applyLobbySnapshot(msg.room)
        if (msg.room.phase === 'match' && !this.starting) {
          this.starting = true
          this.cameras.main.fadeOut(200, 0, 0, 0)
          this.time.delayedCall(200, () => this.scene.start('DuelScene'))
        }
        if (msg.room.phase === 'lobby') this.starting = false
      }
      if (msg.type === 'matchStart' && !this.starting) {
        this.starting = true
        this.cameras.main.fadeOut(200, 0, 0, 0)
        this.time.delayedCall(200, () => this.scene.start('DuelScene'))
      }
      if (msg.type === 'error') this.showToast(msg.message)
    })
  }

  private applyLobbySnapshot(snap: LobbySnapshot): void {
    if (this.online) {
      for (const slot of this.lobby.slots) {
        slot.occupied = false
        slot.name = ''
        slot.ready = false
        slot.isLocal = false
      }
    }

    snap.slots.forEach((s) => {
      const slot = this.lobby.slots[s.slot]
      if (!slot) return
      slot.occupied = s.occupied
      slot.name = s.occupied ? (s.playerId === snap.yourPlayerId ? '你' : s.name) : ''
      slot.characterId = s.characterId
      slot.ready = s.ready
      slot.isLocal = s.playerId === snap.yourPlayerId
    })

    const local = snap.slots.find((s) => s.playerId === snap.yourPlayerId)
    if (local) {
      this.selectedCharIndex = CHARACTER_LIST.findIndex(
        (c) => c.id === local.characterId,
      )
      if (this.selectedCharIndex < 0) this.selectedCharIndex = 0
    }

    this.roomCodeText?.setText(`房間 ${snap.roomCode}`)

    const me = snap.slots.find((s) => s.playerId === snap.yourPlayerId)
    if (me) this.readyLabel?.setText(me.ready ? '取消' : '準備')

    this.refreshAll()
    this.syncDebugStateOnline(snap)
  }

  private syncDebugStateOnline(snap: LobbySnapshot): void {
    const local = snap.slots.find((s) => s.playerId === snap.yourPlayerId)
    setBnbState({
      scene: 'lobby',
      online: true,
      lobby: {
        occupied: snap.slots.filter((s) => s.occupied).length,
        localCharacter: local?.characterId ?? 'dao',
        localReady: local?.ready ?? false,
        teamColor: this.teamColorIndex,
        roomCode: snap.roomCode,
      },
    })
  }

  private drawChrome(): void {
    const { width, height } = this.scale
    this.add
      .rectangle(width / 2, height / 2, width, height, BNB_ROOM_COLORS.outer)
      .setDepth(DEPTH.BG)

    const chrome = this.add.graphics().setDepth(DEPTH.CHROME)
    drawGlossyPanel(chrome, BNB_ROOM_LAYOUT.frame, BNB_ROOM_COLORS.frame, BNB_ROOM_COLORS.panelDeep)
    drawGlossyPanel(chrome, BNB_ROOM_LAYOUT.left, BNB_ROOM_COLORS.panel, BNB_ROOM_COLORS.panelDark)
    drawGlossyPanel(chrome, BNB_ROOM_LAYOUT.right, BNB_ROOM_COLORS.panel, BNB_ROOM_COLORS.panelDark)

    const chat = chatRect()
    drawGlossyPanel(chrome, chat, BNB_ROOM_COLORS.chatBg, BNB_ROOM_COLORS.panelDark)
    drawSectionRule(chrome, BNB_ROOM_LAYOUT.left, chat.y - 8)

    const map = mapBoxRect()
    drawGlossyPanel(chrome, map, BNB_ROOM_COLORS.slotFill, BNB_ROOM_COLORS.panelDark)
    drawSectionRule(chrome, BNB_ROOM_LAYOUT.right, map.y - 10)

    this.drawLeftHeader()
    this.drawRightLabels()
    this.drawChatPreview()
    this.drawMapPreview(map)
  }

  private drawLeftHeader(): void {
    const panel = BNB_ROOM_LAYOUT.left

    this.add
      .text(panel.x + 16, panel.y + 14, '001', {
        fontFamily: FONT,
        fontSize: '20px',
        color: BNB_ROOM_COLORS.textGold,
        fontStyle: 'bold',
      })
      .setDepth(DEPTH.UI)

    this.add
      .text(panel.x + 68, panel.y + 18, this.online ? '村10 連線房' : '村10 練習房', {
        fontFamily: FONT,
        fontSize: '14px',
        color: BNB_ROOM_COLORS.text,
      })
      .setDepth(DEPTH.UI)

    this.add
      .text(panel.x + panel.w - 16, panel.y + 18, '等待玩家', {
        fontFamily: FONT,
        fontSize: '12px',
        color: BNB_ROOM_COLORS.textMuted,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.UI)

    if (this.online) {
      this.roomCodeText = this.add
        .text(panel.x + panel.w / 2, panel.y + 18, '房間 ----', {
          fontFamily: FONT,
          fontSize: '13px',
          color: BNB_ROOM_COLORS.textGold,
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0)
        .setDepth(DEPTH.UI)
    }
  }

  private drawRightLabels(): void {
    const panel = BNB_ROOM_LAYOUT.right
    const lx = sectionLabelX(panel)

    this.add
      .text(lx, panel.y + 14, '角色選擇', {
        fontFamily: FONT,
        fontSize: '13px',
        color: BNB_ROOM_COLORS.text,
        fontStyle: 'bold',
      })
      .setDepth(DEPTH.UI)

    this.add
      .text(lx, panel.y + 148, '隊伍選擇', {
        fontFamily: FONT,
        fontSize: '13px',
        color: BNB_ROOM_COLORS.text,
        fontStyle: 'bold',
      })
      .setDepth(DEPTH.UI)

    this.add
      .text(lx, panel.y + 196, '地圖', {
        fontFamily: FONT,
        fontSize: '13px',
        color: BNB_ROOM_COLORS.text,
        fontStyle: 'bold',
      })
      .setDepth(DEPTH.UI)
  }

  private drawChatPreview(): void {
    const chat = chatRect()
    const lines = [
      '[系統] 歡迎來到村10 練習房',
      '[你] 大家好',
      '[爆友A] 準備好了',
    ]
    lines.forEach((line, i) => {
      this.add
        .text(chat.x + 10, chat.y + 10 + i * 18, line, {
          fontFamily: FONT,
          fontSize: '12px',
          color: line.startsWith('[系統]') ? '#ff9800' : '#ffffff',
        })
        .setDepth(DEPTH.UI)
    })
  }

  private drawMapPreview(map: { x: number; y: number; w: number; h: number }): void {
    this.add
      .image(map.x + 40, map.y + map.h / 2, 'tile_grass')
      .setDisplaySize(56, 56)
      .setDepth(DEPTH.UI)

    const infoX = map.x + 88
    this.add
      .text(infoX, map.y + 16, '村10', {
        fontFamily: FONT,
        fontSize: '14px',
        color: BNB_ROOM_COLORS.textDark,
        fontStyle: 'bold',
      })
      .setDepth(DEPTH.UI)

    this.add
      .text(infoX, map.y + 36, '2–6 人 · 練習', {
        fontFamily: FONT,
        fontSize: '11px',
        color: BNB_ROOM_COLORS.textDark,
      })
      .setDepth(DEPTH.UI)
  }

  private buildPlayerSlots(): void {
    const g = BNB_ROOM_LAYOUT.slotGrid
    for (let i = 0; i < LOBBY_MAX_PLAYERS; i++) {
      const { x, y } = slotCenter(i)
      const bg = this.add.graphics().setDepth(DEPTH.SLOTS)
      bg.fillStyle(BNB_ROOM_COLORS.slotEmpty, 1)
      bg.fillRoundedRect(x - g.cellW / 2, y - g.cellH / 2, g.cellW, g.cellH, 8)
      bg.lineStyle(1, BNB_ROOM_COLORS.slotBorder, 0.8)
      bg.strokeRoundedRect(x - g.cellW / 2, y - g.cellH / 2, g.cellW, g.cellH, 8)

      const portrait = this.add
        .image(x, y - 8, 'portrait_dao')
        .setDisplaySize(46, 46)
        .setVisible(false)
        .setDepth(DEPTH.SLOTS + 1)
      this.slotPortraits.push(portrait)

      const nameText = this.add
        .text(x, y + 20, '', {
          fontFamily: FONT,
          fontSize: '11px',
          color: BNB_ROOM_COLORS.textDark,
        })
        .setOrigin(0.5, 0)
        .setDepth(DEPTH.SLOTS + 1)
      this.slotNameTexts.push(nameText)

      const badge = this.add
        .text(x, y - 32, '', {
          fontFamily: FONT,
          fontSize: '10px',
          color: '#ffffff',
          backgroundColor: '#1565c0',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 0)
        .setVisible(false)
        .setDepth(DEPTH.SLOTS + 2)
      this.slotBadgeTexts.push(badge)

      const hit = this.add
        .rectangle(x, y, g.cellW, g.cellH, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH.UI)
      hit.on('pointerdown', () => this.onPlayerSlotClick(i))
    }
  }

  private buildCharacterPicker(): void {
    const g = BNB_ROOM_LAYOUT.charGrid
    CHAR_GRID.forEach(({ grid, charIndex }) => {
      const { x, y } = charCellCenter(grid)
      const bg = this.add.graphics().setDepth(DEPTH.SLOTS)
      bg.fillStyle(BNB_ROOM_COLORS.slotFill, 1)
      bg.fillRoundedRect(x - g.cell / 2, y - g.cell / 2, g.cell, g.cell, 6)
      bg.lineStyle(1, BNB_ROOM_COLORS.panelDark, 1)
      bg.strokeRoundedRect(x - g.cell / 2, y - g.cell / 2, g.cell, g.cell, 6)

      if (charIndex >= 0) {
        const char = CHARACTER_LIST[charIndex]
        this.add
          .image(x, y, char.portrait)
          .setDisplaySize(42, 42)
          .setDepth(DEPTH.SLOTS + 1)
      } else {
        this.add
          .text(x, y, '?', {
            fontFamily: FONT,
            fontSize: '26px',
            color: BNB_ROOM_COLORS.textDark,
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setDepth(DEPTH.SLOTS + 1)
      }

      const highlight = this.add
        .rectangle(x, y, g.cell + 4, g.cell + 4)
        .setStrokeStyle(3, BNB_ROOM_COLORS.selectPink, 0)
        .setFillStyle(BNB_ROOM_COLORS.selectPink, 0)
        .setDepth(DEPTH.HIGHLIGHT)
      this.charHighlights.push(highlight)

      const hit = this.add
        .rectangle(x, y, g.cell, g.cell, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH.UI)
      hit.on('pointerdown', () => this.onCharacterPick(charIndex))
    })
  }

  private buildColorPicker(): void {
    const c = BNB_ROOM_LAYOUT.colors
    TEAM_COLORS.forEach((color, i) => {
      const { x, y } = colorSwatchCenter(i)
      const swatch = this.add.rectangle(x, y, c.size, c.size, color).setDepth(DEPTH.SLOTS)
      swatch.setStrokeStyle(2, BNB_ROOM_COLORS.white, 0.65)

      const highlight = this.add
        .rectangle(x, y, c.size + 6, c.size + 6)
        .setStrokeStyle(3, BNB_ROOM_COLORS.white, 0)
        .setDepth(DEPTH.HIGHLIGHT)
      this.colorHighlights.push(highlight)

      const hit = this.add
        .rectangle(x, y, c.size + 4, c.size + 4, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH.UI)
      hit.on('pointerdown', () => this.onColorPick(i))
    })
  }

  private buildActionButtons(): void {
    const invite = inviteBtnRect()
    const ready = readyBtnRect()

    if (!this.online) {
      const inviteG = this.add.graphics().setDepth(DEPTH.CHROME)
      drawGlossyButton(inviteG, invite, BNB_ROOM_COLORS.btnBlue, 0x1565c0)
      this.add
        .text(invite.x + invite.w / 2, invite.y + invite.h / 2, '邀請電腦', {
          fontFamily: FONT,
          fontSize: '15px',
          color: '#fff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.UI)
      this.bindClick(invite, () => this.onQuickJoin())
    }

    const readyG = this.add.graphics().setDepth(DEPTH.CHROME)
    drawGlossyButton(readyG, ready, BNB_ROOM_COLORS.readyTop, BNB_ROOM_COLORS.readyBottom)
    this.readyLabel = this.add
      .text(ready.x + ready.w / 2, ready.y + ready.h / 2, '準備', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#fff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI)

    this.bindClick(ready, () => this.onReady())
  }

  private buildExitButton(): void {
    const exit = exitBtnRect()
    const g = this.add.graphics().setDepth(DEPTH.CHROME)
    drawGlossyButton(g, exit, BNB_ROOM_COLORS.btnRed, 0xb71c1c)
    this.add
      .text(exit.x + exit.w / 2, exit.y + exit.h / 2, '離開', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#fff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI)
    this.bindClick(exit, () => this.exitToBrowser())
  }

  private exitToBrowser(): void {
    if (this.online) getGameClient().leaveRoom()
    this.scene.start('RoomBrowserScene')
  }

  private bindClick(
    rect: { x: number; y: number; w: number; h: number },
    fn: () => void,
  ): void {
    const zone = this.add
      .rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.UI)
    zone.on('pointerdown', () => {
      this.tweens.add({
        targets: zone,
        scaleX: 0.96,
        scaleY: 0.96,
        duration: 70,
        yoyo: true,
      })
      fn()
    })
  }

  private buildToast(): void {
    this.toastPanel = this.add.graphics().setDepth(DEPTH.TOAST).setAlpha(0)
    this.toastText = this.add
      .text(480, 360, '', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#fff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.TOAST)
      .setAlpha(0)
  }

  private bindInput(): void {
    const kb = this.input.keyboard!
    ;(['ONE', 'TWO', 'THREE', 'FOUR'] as const).forEach((code, i) => {
      kb.on(`keydown-${code}`, this.keyHandlers.select[i])
    })
    kb.on('keydown-ESC', this.keyHandlers.esc)
    kb.on('keydown-ENTER', this.keyHandlers.ready)
    kb.on('keydown-Q', this.keyHandlers.quick)
    kb.on('keydown-S', this.keyHandlers.start)
  }

  private unbindInput(): void {
    const kb = this.input.keyboard
    if (!kb) return
    ;(['ONE', 'TWO', 'THREE', 'FOUR'] as const).forEach((code, i) => {
      kb.off(`keydown-${code}`, this.keyHandlers.select[i])
    })
    kb.off('keydown-ESC', this.keyHandlers.esc)
    kb.off('keydown-ENTER', this.keyHandlers.ready)
    kb.off('keydown-Q', this.keyHandlers.quick)
    kb.off('keydown-S', this.keyHandlers.start)
  }

  private keyHandlers = {
    select: CHARACTER_LIST.map((_, i) => () => this.onCharacterPick(i)),
    esc: () => {
      if (!this.starting) this.exitToBrowser()
    },
    ready: () => this.onReady(),
    quick: () => this.onQuickJoin(),
    start: () => {
      if (occupiedCount(this.lobby) < 2) this.onQuickJoin()
      this.onReady()
    },
  }

  private onCharacterPick(charIndex: number): void {
    const pick =
      charIndex < 0 ? Phaser.Math.Between(0, CHARACTER_LIST.length - 1) : charIndex
    this.selectedCharIndex = pick
    const char = CHARACTER_LIST[pick]

    if (this.online) {
      getGameClient().pickCharacter(char.id)
      this.showToast(`已選 ${char.label}`)
      return
    }

    const local = this.lobby.slots[0]
    local.characterId = char.id
    local.occupied = true
    local.ready = false
    local.name = '你'
    this.refreshAll()
    this.showToast(`已選 ${char.label}`)
  }

  private onColorPick(index: number): void {
    this.teamColorIndex = index
    this.refreshColorHighlights()
    this.syncDebugState()
    this.showToast('隊伍顏色已更新')
  }

  private onPlayerSlotClick(index: number): void {
    if (this.online) return
    if (index === 0) return
    const slot = this.lobby.slots[index]
    if (slot.occupied) {
      slot.occupied = false
      slot.name = ''
      slot.ready = false
      this.showToast(`${index + 1} 號位已空`)
    } else {
      slot.occupied = true
      slot.name = `玩家${index + 1}`
      slot.characterId = CHARACTER_LIST[index % CHARACTER_LIST.length].id
      slot.ready = true
      this.showToast(`${slot.name} 加入`)
    }
    this.refreshPlayerSlots()
  }

  private onQuickJoin(): void {
    const before = occupiedCount(this.lobby)
    const botNames = ['爆友A', '爆友B', '爆友C', '爆友D', '爆友E']
    let bot = 0
    for (let i = 1; i < LOBBY_MAX_PLAYERS && bot < botNames.length; i++) {
      const slot = this.lobby.slots[i]
      if (!slot.occupied) {
        slot.occupied = true
        slot.name = botNames[bot]
        slot.characterId = CHARACTER_LIST[(i + bot) % CHARACTER_LIST.length].id
        slot.ready = true
        bot++
      }
    }
    this.refreshPlayerSlots()
    const after = occupiedCount(this.lobby)
    if (after === before) this.showToast('房間已滿')
    else this.showToast(`已邀請電腦 · ${after}/${LOBBY_MAX_PLAYERS} 人`)
  }

  private onReady(): void {
    if (this.starting) return

    if (this.online) {
      const snap = getGameClient().lobby
      const me = snap?.slots.find((s) => s.playerId === snap.yourPlayerId)
      const nextReady = !me?.ready
      getGameClient().setReady(nextReady)
      this.readyLabel.setText(nextReady ? '取消' : '準備')
      return
    }

    const local = this.lobby.slots[0]
    if (occupiedCount(this.lobby) < 2) {
      this.showToast('至少 2 人 · 請按邀請電腦')
      return
    }
    local.ready = true
    this.refreshPlayerSlots()
    this.readyLabel.setText('開始')
    this.starting = true
    this.registry.set('lobbyState', this.lobby)
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(200, () => this.scene.start('DuelScene'))
  }

  private refreshAll(): void {
    this.refreshPlayerSlots()
    this.refreshCharHighlights()
    this.refreshColorHighlights()
    this.syncDebugState()
  }

  private refreshPlayerSlots(): void {
    this.lobby.slots.forEach((slot, i) => {
      const portrait = this.slotPortraits[i]
      const nameText = this.slotNameTexts[i]
      const badge = this.slotBadgeTexts[i]
      if (!slot.occupied) {
        portrait.setVisible(false)
        nameText.setText('')
        badge.setVisible(false)
        return
      }
      const char = CHARACTER_BY_ID[slot.characterId]
      portrait.setTexture(char.portrait).setVisible(true)
      nameText.setText(slot.name || char.label)
      if (i === 0) {
        badge.setText('室長').setVisible(true)
        badge.setBackgroundColor('#1565c0')
      } else if (slot.ready) {
        badge.setText('準備').setVisible(true)
        badge.setBackgroundColor('#2e7d32')
      } else {
        badge.setVisible(false)
      }
    })
    this.syncDebugState()
  }

  private refreshCharHighlights(): void {
    CHAR_GRID.forEach(({ charIndex }, i) => {
      const selected = charIndex >= 0 && charIndex === this.selectedCharIndex
      this.charHighlights[i].setStrokeStyle(3, BNB_ROOM_COLORS.selectPink, selected ? 1 : 0)
    })
  }

  private refreshColorHighlights(): void {
    this.colorHighlights.forEach((hl, i) => {
      hl.setStrokeStyle(3, BNB_ROOM_COLORS.white, i === this.teamColorIndex ? 1 : 0)
    })
  }

  private syncDebugState(): void {
    if (this.online) {
      const snap = getGameClient().lobby
      if (snap) {
        this.syncDebugStateOnline(snap)
        return
      }
    }
    const local = this.lobby.slots[0]
    setBnbState({
      scene: 'lobby',
      lobby: {
        occupied: occupiedCount(this.lobby),
        localCharacter: local.characterId,
        localReady: local.ready,
        teamColor: this.teamColorIndex,
      },
    })
  }

  private showToast(msg: string): void {
    this.toastTimer?.remove(false)
    const padX = 16
    const padY = 8
    this.toastText.setText(msg)
    const textW = Math.min(this.toastText.width + padX * 2, 420)
    const textH = this.toastText.height + padY * 2
    const cx = 480
    const cy = 360

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
    this.tweens.add({
      targets: [this.toastText, this.toastPanel],
      alpha: 1,
      duration: 120,
    })
    this.toastTimer = this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: [this.toastText, this.toastPanel],
        alpha: 0,
        duration: 200,
      })
    })
  }
}
