/** 爆爆王房間大廳 UI — 960×540 對稱格線版面 */
export const BNB_ROOM_COLORS = {
  outer: 0x0a3d6e,
  frame: 0x1565b8,
  panel: 0x4fc3f7,
  panelDark: 0x0288d1,
  panelDeep: 0x01579b,
  slotEmpty: 0x039be5,
  slotFill: 0xb3e5fc,
  slotBorder: 0x01579b,
  chatBg: 0x81d4fa,
  sectionLine: 0xffffff,
  selectPink: 0xff4081,
  readyTop: 0xffca28,
  readyBottom: 0xff6f00,
  btnGreen: 0x43a047,
  btnGreenHi: 0x66bb6a,
  btnBlue: 0x1e88e5,
  btnRed: 0xe53935,
  white: 0xffffff,
  text: '#ffffff',
  textMuted: '#e3f2fd',
  textDark: '#0d47a1',
  textGold: '#ffeb3b',
} as const

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const VIEW_W = 960
export const VIEW_H = 540

/** 外框與雙區：左玩家 / 右設定（無底欄 mock 按鈕） */
export const BNB_ROOM_LAYOUT = {
  frame: { x: 10, y: 10, w: 940, h: 520 } satisfies Rect,
  left: { x: 18, y: 18, w: 504, h: 484 } satisfies Rect,
  right: { x: 530, y: 18, w: 412, h: 484 } satisfies Rect,
  slotGrid: { cols: 3, rows: 2, cellW: 148, cellH: 78, gap: 10 },
  charGrid: { cell: 52, gap: 10, cols: 3, rows: 2 },
  colors: { size: 28, gap: 6, count: 8 },
} as const

export const TEAM_COLORS = [
  0xf44336, 0xffeb3b, 0xff9800, 0x4caf50,
  0x00bcd4, 0x2196f3, 0x9c27b0, 0xe91e63,
] as const

export const CHAR_GRID = [
  { grid: 0, charIndex: 0 },
  { grid: 1, charIndex: 1 },
  { grid: 2, charIndex: 2 },
  { grid: 3, charIndex: 3 },
  { grid: 4, charIndex: 4 },
  { grid: 5, charIndex: -1 },
] as const

function gridSize(cols: number, rows: number, cellW: number, cellH: number, gap: number) {
  return {
    w: cols * cellW + (cols - 1) * gap,
    h: rows * cellH + (rows - 1) * gap,
  }
}

export function slotGridOrigin(): { ox: number; oy: number } {
  const panel = BNB_ROOM_LAYOUT.left
  const g = BNB_ROOM_LAYOUT.slotGrid
  const size = gridSize(g.cols, g.rows, g.cellW, g.cellH, g.gap)
  return {
    ox: panel.x + (panel.w - size.w) / 2,
    oy: panel.y + 44,
  }
}

export function slotCenter(index: number): { x: number; y: number } {
  const g = BNB_ROOM_LAYOUT.slotGrid
  const { ox, oy } = slotGridOrigin()
  const col = index % g.cols
  const row = Math.floor(index / g.cols)
  return {
    x: ox + col * (g.cellW + g.gap) + g.cellW / 2,
    y: oy + row * (g.cellH + g.gap) + g.cellH / 2,
  }
}

export function slotGridRect(): Rect {
  const g = BNB_ROOM_LAYOUT.slotGrid
  const { ox, oy } = slotGridOrigin()
  const size = gridSize(g.cols, g.rows, g.cellW, g.cellH, g.gap)
  return { x: ox, y: oy, w: size.w, h: size.h }
}

/** 聊天框：玩家格下方、左 panel 內置中 */
export function chatRect(): Rect {
  const panel = BNB_ROOM_LAYOUT.left
  const slots = slotGridRect()
  const y = slots.y + slots.h + 14
  const h = panel.y + panel.h - y - 10
  return { x: panel.x + 12, y, w: panel.w - 24, h }
}

/** 右側角色格原點（3 欄置中） */
export function charGridOrigin(): { ox: number; oy: number } {
  const panel = BNB_ROOM_LAYOUT.right
  const g = BNB_ROOM_LAYOUT.charGrid
  const size = gridSize(g.cols, g.rows, g.cell, g.cell, g.gap)
  return {
    ox: panel.x + (panel.w - size.w) / 2,
    oy: panel.y + 42,
  }
}

export function charCellCenter(gridIndex: number): { x: number; y: number } {
  const g = BNB_ROOM_LAYOUT.charGrid
  const { ox, oy } = charGridOrigin()
  const col = gridIndex % g.cols
  const row = Math.floor(gridIndex / g.cols)
  return {
    x: ox + col * (g.cell + g.gap) + g.cell / 2,
    y: oy + row * (g.cell + g.gap) + g.cell / 2,
  }
}

/** 隊伍色票列（8 色水平置中） */
export function colorRowOrigin(): { ox: number; oy: number } {
  const panel = BNB_ROOM_LAYOUT.right
  const c = BNB_ROOM_LAYOUT.colors
  const rowW = c.count * c.size + (c.count - 1) * c.gap
  return {
    ox: panel.x + (panel.w - rowW) / 2,
    oy: panel.y + 168,
  }
}

export function colorSwatchCenter(index: number): { x: number; y: number } {
  const c = BNB_ROOM_LAYOUT.colors
  const { ox, oy } = colorRowOrigin()
  return {
    x: ox + index * (c.size + c.gap) + c.size / 2,
    y: oy + c.size / 2,
  }
}

/** 地圖預覽 + 選擇按鈕列 */
export function mapBoxRect(): Rect {
  const panel = BNB_ROOM_LAYOUT.right
  const boxW = 168
  const boxH = 76
  return {
    x: panel.x + 16,
    y: panel.y + 212,
    w: boxW,
    h: boxH,
  }
}

/** 右上角離開 */
export function exitBtnRect(): Rect {
  const frame = BNB_ROOM_LAYOUT.frame
  return {
    x: frame.x + frame.w - 96,
    y: frame.y + 12,
    w: 80,
    h: 32,
  }
}

/** 邀請 / 準備 — 右 panel 底欄對半 */
export function inviteBtnRect(): Rect {
  const panel = BNB_ROOM_LAYOUT.right
  const gap = 12
  const btnW = (panel.w - 32 - gap) / 2
  return {
    x: panel.x + 16,
    y: panel.y + panel.h - 64,
    w: btnW,
    h: 52,
  }
}

export function readyBtnRect(): Rect {
  const invite = inviteBtnRect()
  return {
    x: invite.x + invite.w + 12,
    y: invite.y,
    w: invite.w,
    h: invite.h,
  }
}

export function sectionLabelX(panel: Rect): number {
  return panel.x + 16
}

export function drawGlossyPanel(
  g: Phaser.GameObjects.Graphics,
  { x, y, w, h }: Rect,
  fill: number,
  dark: number,
): void {
  g.fillStyle(dark, 1)
  g.fillRoundedRect(x + 2, y + 3, w, h, 10)
  g.fillStyle(fill, 1)
  g.fillRoundedRect(x, y, w, h, 10)
  g.lineStyle(2, BNB_ROOM_COLORS.white, 0.5)
  g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 3, 9)
  g.lineStyle(1, dark, 0.85)
  g.strokeRoundedRect(x, y, w, h, 10)
}

export function drawGlossyButton(
  g: Phaser.GameObjects.Graphics,
  { x, y, w, h }: Rect,
  top: number,
  bottom: number,
): void {
  g.fillStyle(bottom, 1)
  g.fillRoundedRect(x, y + 2, w, h, 8)
  g.fillStyle(top, 1)
  g.fillRoundedRect(x, y, w, h - 2, 8)
  g.lineStyle(2, BNB_ROOM_COLORS.white, 0.4)
  g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 4, 7)
}

/** 區塊分隔線 */
export function drawSectionRule(
  g: Phaser.GameObjects.Graphics,
  panel: Rect,
  y: number,
): void {
  g.lineStyle(1, BNB_ROOM_COLORS.sectionLine, 0.25)
  g.beginPath()
  g.moveTo(panel.x + 12, y)
  g.lineTo(panel.x + panel.w - 12, y)
  g.strokePath()
}
