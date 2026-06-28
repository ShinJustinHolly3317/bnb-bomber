/**
 * 房間大廳 UX QA — 座標與 src/game/ui/bnbRoomUi.ts 同步
 * node scripts/qa-lobby-ux.mjs
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../.cursor/qa-screenshots')

const CHAR_IDS = ['dao', 'bazzi', 'maro', 'nana']

const LAYOUT = {
  frame: { x: 10, y: 10, w: 940, h: 520 },
  left: { x: 18, y: 18, w: 504, h: 484 },
  right: { x: 530, y: 18, w: 412, h: 484 },
  slotGrid: { cols: 3, rows: 2, cellW: 148, cellH: 78, gap: 10 },
  charGrid: { cell: 52, gap: 10, cols: 3 },
  colors: { size: 28, gap: 6, count: 8 },
}

const CHAR_GRID = [
  { grid: 0, charIndex: 0 },
  { grid: 1, charIndex: 1 },
  { grid: 2, charIndex: 2 },
  { grid: 3, charIndex: 3 },
  { grid: 4, charIndex: -1 },
]

function gridSize(cols, rows, cellW, cellH, gap) {
  return {
    w: cols * cellW + (cols - 1) * gap,
    h: rows * cellH + (rows - 1) * gap,
  }
}

function slotGridOrigin() {
  const g = LAYOUT.slotGrid
  const size = gridSize(g.cols, g.rows, g.cellW, g.cellH, g.gap)
  return {
    ox: LAYOUT.left.x + (LAYOUT.left.w - size.w) / 2,
    oy: LAYOUT.left.y + 44,
  }
}

function charGridOrigin() {
  const g = LAYOUT.charGrid
  const size = gridSize(g.cols, 2, g.cell, g.cell, g.gap)
  return {
    ox: LAYOUT.right.x + (LAYOUT.right.w - size.w) / 2,
    oy: LAYOUT.right.y + 42,
  }
}

function charCellCenter(gridIndex) {
  const g = LAYOUT.charGrid
  const { ox, oy } = charGridOrigin()
  const col = gridIndex % g.cols
  const row = Math.floor(gridIndex / g.cols)
  return {
    x: ox + col * (g.cell + g.gap) + g.cell / 2,
    y: oy + row * (g.cell + g.gap) + g.cell / 2,
  }
}

function colorSwatchCenter(index) {
  const c = LAYOUT.colors
  const rowW = c.count * c.size + (c.count - 1) * c.gap
  const ox = LAYOUT.right.x + (LAYOUT.right.w - rowW) / 2
  const oy = LAYOUT.right.y + 168
  return {
    x: ox + index * (c.size + c.gap) + c.size / 2,
    y: oy + c.size / 2,
  }
}

function inviteBtnCenter() {
  const panel = LAYOUT.right
  const gap = 12
  const btnW = (panel.w - 32 - gap) / 2
  const x = panel.x + 16 + btnW / 2
  const y = panel.y + panel.h - 64 + 26
  return { x, y }
}

function readyBtnCenter() {
  const panel = LAYOUT.right
  const gap = 12
  const btnW = (panel.w - 32 - gap) / 2
  const x = panel.x + 16 + btnW + gap + btnW / 2
  const y = panel.y + panel.h - 64 + 26
  return { x, y }
}

function exitBtnCenter() {
  const frame = LAYOUT.frame
  const btn = { x: frame.x + frame.w - 96, y: frame.y + 12, w: 80, h: 32 }
  return { x: btn.x + btn.w / 2, y: btn.y + btn.h / 2 }
}

const BTNS = {
  invite: inviteBtnCenter(),
  ready: readyBtnCenter(),
  exit: exitBtnCenter(),
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function resolveBaseUrl() {
  if (process.env.QA_URL) return process.env.QA_URL
  for (const port of [5173, 5174, 5175, 5176, 5177]) {
    const url = `http://localhost:${port}/`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
      if (!res.ok) continue
      const html = await res.text()
      if (html.includes('game-container')) return url
    } catch {
      /* next */
    }
  }
  throw new Error('找不到 bnb-bomber dev server（請先 npm run dev）')
}

async function enterLobby(page) {
  await page.goto(await resolveBaseUrl(), { waitUntil: 'networkidle', timeout: 20000 })
  await page.click('canvas')
  await sleep(600)
  await page.keyboard.press('Enter')
  await sleep(700)
}

async function clickCanvas(page, x, y) {
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas not found')
  const sx = box.x + (x / 960) * box.width
  const sy = box.y + (y / 540) * box.height
  await page.mouse.click(sx, sy)
}

async function main() {
  await import('node:fs/promises').then((fs) => fs.mkdir(OUT, { recursive: true }))
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  const results = []

  const pass = (msg) => results.push({ ok: true, msg })
  const fail = (msg) => results.push({ ok: false, msg })

  console.log('\n=== LOBBY UX QA ===')
  const baseUrl = await resolveBaseUrl()
  console.log(`URL: ${baseUrl}`)

  await enterLobby(page)
  await page.screenshot({ path: path.join(OUT, '01-lobby-layout.png') })
  pass('進入房間大廳')

  for (let i = 0; i < CHAR_GRID.length; i++) {
    const { grid, charIndex } = CHAR_GRID[i]
    const { x, y } = charCellCenter(grid)
    await clickCanvas(page, x, y)
    await sleep(200)
    const state = await page.evaluate(() => window.bnbState?.lobby?.localCharacter)
    const expected = charIndex < 0 ? null : CHAR_IDS[charIndex]
    if (charIndex < 0) pass(`點選隨機格 → ${state}`)
    else if (state === expected) pass(`點選角色格 ${charIndex} → ${expected}`)
    else fail(`角色格 ${charIndex} 期望 ${expected} 得 ${state}`)
  }

  for (let i = 0; i < 8; i++) {
    const { x, y } = colorSwatchCenter(i)
    await clickCanvas(page, x, y)
    await sleep(120)
    const tc = await page.evaluate(() => window.bnbState?.lobby?.teamColor)
    if (tc === i) pass(`隊伍色 ${i} 可選`)
    else fail(`隊伍色 ${i} 失敗 (got ${tc})`)
  }

  await clickCanvas(page, BTNS.ready.x, BTNS.ready.y)
  await sleep(300)
  const sceneAfterReadyAlone = await page.evaluate(() => window.bnbState?.scene)
  if (sceneAfterReadyAlone === 'lobby') pass('未滿 2 人按準備不進對戰')
  else fail('未滿 2 人卻進對戰')

  await clickCanvas(page, BTNS.invite.x, BTNS.invite.y)
  await sleep(400)
  const occ = await page.evaluate(() => window.bnbState?.lobby?.occupied)
  if (occ === 6) pass('邀請電腦 occupied=6')
  else fail(`邀請電腦 occupied=${occ}`)

  await page.keyboard.press('Digit3')
  await sleep(200)
  const c3 = await page.evaluate(() => window.bnbState?.lobby?.localCharacter)
  if (c3 === 'maro') pass('鍵盤 3 → 紅寶')
  else fail(`鍵盤 3 得 ${c3}`)

  await clickCanvas(page, BTNS.ready.x, BTNS.ready.y)
  await sleep(800)
  const duel = await page.evaluate(() => window.bnbState?.scene)
  if (duel === 'duel') pass('準備後進入對戰')
  else fail(`準備後 scene=${duel}`)

  await browser.close()

  for (const r of results) console.log(r.ok ? '✅' : '❌', r.msg)
  const bad = results.filter((r) => !r.ok)
  if (bad.length) {
    console.log(`\nResult: FAIL (${bad.length})`)
    process.exit(1)
  }
  console.log('\n✅ 全部通過')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
