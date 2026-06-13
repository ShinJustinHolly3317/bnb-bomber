/**
 * 完整遊戲性 QA：四方向長按、放水球後移動、對戰至結束
 * node scripts/qa-gameplay.mjs
 */
import { chromium } from 'playwright'

const BASE_URL = process.env.QA_URL || 'http://localhost:5177/'

const issues = []
const passes = []

function pass(msg) {
  passes.push(msg)
}

function fail(msg) {
  issues.push(`🔴 ${msg}`)
}

function warn(msg) {
  issues.push(`🟡 ${msg}`)
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function getState(page) {
  return page.evaluate(() => window.bnbState ?? { scene: 'unknown' })
}

async function reloadDuel(page) {
  await page.reload({ waitUntil: 'networkidle' })
  await page.click('canvas')
  await page.keyboard.press('Enter')
  await sleep(1200)
  const state = await getState(page)
  if (state.scene !== 'duel') fail(`reload 後無法進 duel：${state.scene}`)
}

async function releaseAllKeys(page) {
  for (const key of ['a', 'd', 'w', 's', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    await page.keyboard.up(key)
  }
}

async function holdKey(page, key, ms = 1000, fighterIndex = 0) {
  await releaseAllKeys(page)
  await page.click('canvas')
  const before = await getState(page)
  const fx = before.fighters?.[fighterIndex]
  if (!fx) return { dx: 0, dy: 0, trapped: false }

  const taps = Math.max(4, Math.round(ms / 120))
  for (let i = 0; i < taps; i++) {
    await page.keyboard.down(key)
    await sleep(100)
    await page.keyboard.up(key)
    await sleep(35)
  }
  await sleep(80)
  const after = await getState(page)
  const fy = after.fighters?.[fighterIndex]
  if (!fy) return { dx: 0, dy: 0, trapped: false }
  return {
    dx: fy.x - fx.x,
    dy: fy.y - fx.y,
    trapped: !!fy.trapped,
  }
}

async function startDuel(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.click('canvas')
  await page.keyboard.press('Enter')
  await sleep(1200)
  const state = await getState(page)
  if (state.scene !== 'duel') fail(`無法進入 duel，目前 ${state.scene}`)
  else pass('進入 duel')
}

async function testP1Directions(page) {
  const MIN_MOVE = 24
  const moves = [
    { key: 'd', axis: 'x', min: MIN_MOVE, label: '右' },
    { key: 'a', axis: 'x', max: -MIN_MOVE, label: '左' },
    { key: 's', axis: 'y', min: MIN_MOVE, label: '下' },
    { key: 'w', axis: 'y', max: -MIN_MOVE, label: '上' },
  ]

  for (const m of moves) {
    const { dx, dy, trapped } = await holdKey(page, m.key, 900)
    const delta = m.axis === 'x' ? dx : dy
    if (trapped) {
      warn(`P1 ${m.label} 時 trapped=true（可能剛被泡泡困住）`)
    }
    if (m.min !== undefined && delta < m.min) {
      fail(`P1 長按 ${m.label} 位移不足：${delta}px（預期 ≥${m.min}）`)
    } else if (m.max !== undefined && delta > m.max) {
      fail(`P1 長按 ${m.label} 幾乎沒動：${delta}px（預期 ≤${m.max}，可能卡死）`)
    } else {
      pass(`P1 長按 ${m.label} OK（Δ${m.axis}=${delta}px）`)
    }
  }
}

async function testBubbleThenMove(page) {
  await reloadDuel(page)
  const before = await getState(page)
  const x0 = before.fighters?.[0]?.x ?? 0
  const y0 = before.fighters?.[0]?.y ?? 0

  // 放水球
  await page.keyboard.press('Space')
  await sleep(300)

  const mid = await getState(page)
  if (mid.fighters?.[0]?.trapped) {
    fail('P1 放水球後 trapped=true（不應困住自己）')
  }

  // 放水球後四方向各試一次
  for (const { key, label } of [
    { key: 'd', label: '右' },
    { key: 'a', label: '左' },
    { key: 's', label: '下' },
    { key: 'w', label: '上' },
  ]) {
    const { dx, dy } = await holdKey(page, key, 700)
    const moved = Math.abs(dx) + Math.abs(dy)
    if (moved < 18) {
      fail(`P1 放水球後按 ${label} 卡死（位移 ${moved}px）`)
    } else {
      pass(`P1 放水球後 ${label} 可動（${moved}px）`)
    }
  }

  const after = await getState(page)
  const dist =
    Math.abs((after.fighters?.[0]?.x ?? x0) - x0) +
    Math.abs((after.fighters?.[0]?.y ?? y0) - y0)
  if (dist < 30) fail(`P1 放水球後整體幾乎沒離開原點（${dist}px）`)
  else pass(`P1 放水球後可離開原點（總位移 ${dist}px）`)
}

/** 將角色的指定軸收斂到 target 座標（避免跨格被鄰格阻擋物正常擋住而誤判卡死） */
async function alignAxis(page, fighterIndex, axis, target) {
  const keys =
    fighterIndex === 0
      ? { pos: axis === 'x' ? 'd' : 's', neg: axis === 'x' ? 'a' : 'w' }
      : {
          pos: axis === 'x' ? 'ArrowRight' : 'ArrowDown',
          neg: axis === 'x' ? 'ArrowLeft' : 'ArrowUp',
        }
  for (let i = 0; i < 15; i++) {
    const s = await getState(page)
    const f = s.fighters?.[fighterIndex]
    if (!f) return
    const v = axis === 'x' ? f.x : f.y
    const d = target - v
    if (Math.abs(d) <= 4) return
    await page.keyboard.down(d > 0 ? keys.pos : keys.neg)
    await sleep(Math.max(30, Math.min(150, Math.abs(d) * 7)))
    await page.keyboard.up(d > 0 ? keys.pos : keys.neg)
    await sleep(40)
  }
}

async function testP2Directions(page) {
  await reloadDuel(page)
  const MIN_MOVE = 20
  const moves = [
    { key: 'ArrowLeft', axis: 'x', min: MIN_MOVE, label: '左', abs: true },
    { key: 'ArrowDown', axis: 'y', min: MIN_MOVE, label: '下' },
    { key: 'ArrowUp', axis: 'y', min: MIN_MOVE, label: '上', abs: true },
    // P2 出生在右側，往右很快貼世界邊界
    { key: 'ArrowRight', axis: 'x', label: '右', nearWall: true },
  ]

  for (const m of moves) {
    if (m.axis === 'y') {
      // 垂直測試前把 P2 對齊到 col 10 (x=420)：(10,2) 往下是草地可走
      // （col 9 下方是樹、col 12 下方是房子，對齊錯欄會被正常物理擋住而誤判）
      // y 不重置：「下」從 row1 起跑，「上」接在「下」之後自然有上行空間
      await alignAxis(page, 1, 'x', 420)
    }
    const { dx, dy } = await holdKey(page, m.key, 1000, 1)
    const delta = m.axis === 'x' ? dx : dy
    const amount = m.abs ? Math.abs(delta) : delta
    if (m.nearWall) {
      if (delta > 8) pass(`P2 長按 ${m.label} OK（Δx=${delta}px）`)
      else pass(`P2 長按 ${m.label} 貼邊預期（Δx=${delta}px）`)
      continue
    }
    if (m.min !== undefined && amount < m.min) {
      fail(`P2 長按 ${m.label} 位移不足：${delta}px`)
    } else if (m.max !== undefined && delta > m.max) {
      fail(`P2 長按 ${m.label} 卡死：${delta}px`)
    } else {
      pass(`P2 長按 ${m.label} OK（Δ${m.axis}=${delta}px）`)
    }
  }
}

async function testFullMatch(page) {
  await reloadDuel(page)
  for (let round = 0; round < 100; round++) {
    await page.click('canvas')
    await page.keyboard.down('d')
    await sleep(100)
    await page.keyboard.up('d')
    await page.keyboard.press('Space')
    await page.keyboard.down('ArrowLeft')
    await sleep(100)
    await page.keyboard.up('ArrowLeft')
    await page.keyboard.press('Enter')
    await sleep(450)

    const state = await getState(page)
    if (state.scene === 'gameover') {
      pass(`完整對戰結束 winner=${state.winner} round=${round + 1}`)
      await page.keyboard.press('r')
      await sleep(800)
      const rematch = await getState(page)
      if (rematch.scene === 'duel' && rematch.fighters?.every((f) => f.hp === 100)) {
        pass('Rematch HP 重置')
      } else {
        warn(`Rematch 狀態異常: ${rematch.scene}`)
      }
      return
    }
  }
  const state = await getState(page)
  const hp = state.fighters?.map((f) => `${f.label}:${f.hp}`).join(', ')
  fail(`100 回合內未分出勝負 HP=${hp}`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('pageerror', (err) => fail(`JS: ${err.message}`))

  await startDuel(page)
  await testP1Directions(page)
  await testBubbleThenMove(page)
  await testP2Directions(page)
  await testFullMatch(page)

  await browser.close()

  console.log('\n=== GAMEPLAY QA (bnb-bomber) ===')
  console.log('URL:', BASE_URL)
  passes.forEach((p) => console.log('✅', p))
  issues.forEach((i) => console.log(i))
  const critical = issues.filter((i) => i.startsWith('🔴'))
  console.log(
    `\nResult: ${critical.length === 0 ? 'PASS' : 'FAIL'} (${critical.length} critical, ${issues.filter((i) => i.startsWith('🟡')).length} warn)\n`,
  )
  process.exit(critical.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('🔴 qa-gameplay crashed:', e.message)
  process.exit(1)
})
