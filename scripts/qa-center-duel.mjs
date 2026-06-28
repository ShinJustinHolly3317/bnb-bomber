/**
 * QA 驗收腳本：村10 雙人對戰完整流程
 * 場景：雙方各自走到地圖中央 → P1 轟炸 P2 直到獲勝 → gameover → rematch
 *
 * 前一輪發現的 64×64 碰撞體 bug 已修復（碰撞體縮回 40×40），
 * 本版改為直接行走驗證，並把舊夾點 (7,9)→(7,8)、(12,1)→(10,1) 當回歸檢查。
 */
import { chromium } from 'playwright'

const URL = process.env.QA_URL || 'http://localhost:5177/'
const TILE = 40
const CENTER = { x: 300, y: 260 } // tile (7,6)

const KEYS = [
  { left: 'a', right: 'd', up: 'w', down: 's', bubble: 'Space' }, // P1
  { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', bubble: 'Enter' }, // P2
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const pageErrors = []
const hpTimeline = []
let samplerOn = false

function record(step, pass, info) {
  results.push({ step, pass, info })
  console.log(`${pass === true ? '✅' : pass === 'warn' ? '🟡' : '🔴'} ${step}${info ? ` — ${info}` : ''}`)
}

async function getState(page) {
  try {
    return await page.evaluate(() => window.bnbState ?? null)
  } catch {
    return null
  }
}
async function getFighter(page, idx) {
  const s = await getState(page)
  return s?.fighters?.[idx] ?? null
}
async function waitFor(page, predicate, timeoutMs, pollMs = 100) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const s = await getState(page)
    if (s && predicate(s)) return s
    await sleep(pollMs)
  }
  return null
}
async function tap(page, key, ms) {
  await page.keyboard.down(key)
  try {
    await sleep(ms)
  } finally {
    await page.keyboard.up(key)
  }
}

/** 沿單一軸收斂到 target；卡住（連續 4 次位移 <2px）回傳 false */
async function moveAxisTo(page, idx, axis, target, { tol = 5, maxIters = 40 } = {}) {
  const keys = KEYS[idx]
  let lastV = null
  let stuck = 0
  for (let i = 0; i < maxIters; i++) {
    const f = await getFighter(page, idx)
    if (!f) return false
    const v = axis === 'x' ? f.x : f.y
    const d = target - v
    if (Math.abs(d) <= tol) return true
    const key = axis === 'x' ? (d > 0 ? keys.right : keys.left) : d > 0 ? keys.down : keys.up
    await tap(page, key, Math.max(30, Math.min(220, Math.round((Math.abs(d) / 130) * 1000))))
    await sleep(40)
    const f2 = await getFighter(page, idx)
    const v2 = axis === 'x' ? f2.x : f2.y
    if (lastV !== null && Math.abs(v2 - lastV) < 2) stuck++
    else stuck = 0
    lastV = v2
    if (stuck >= 4) return false
  }
  return false
}

const T = (c, r) => ({ c, r })

/** 沿相鄰 tile 路徑走；每步先對齊垂直軸再走主軸 */
async function walkPath(page, idx, tiles, label) {
  for (let i = 1; i < tiles.length; i++) {
    const from = tiles[i - 1]
    const to = tiles[i]
    const tx = to.c * TILE + TILE / 2
    const ty = to.r * TILE + TILE / 2
    let ok
    if (to.c !== from.c) {
      ok =
        (await moveAxisTo(page, idx, 'y', from.r * TILE + TILE / 2, { tol: 4 })) &&
        (await moveAxisTo(page, idx, 'x', tx))
    } else {
      ok =
        (await moveAxisTo(page, idx, 'x', from.c * TILE + TILE / 2, { tol: 4 })) &&
        (await moveAxisTo(page, idx, 'y', ty))
    }
    if (!ok) {
      // 重試一次
      const retry =
        (await moveAxisTo(page, idx, 'x', tx)) && (await moveAxisTo(page, idx, 'y', ty))
      if (!retry) {
        const f = await getFighter(page, idx)
        return { ok: false, reason: `${label} 第 ${i} 步 (${from.c},${from.r})→(${to.c},${to.r}) 卡住，現在 (${f?.x},${f?.y})` }
      }
    }
  }
  return { ok: true }
}

async function placeBubble(page, idx) {
  // Phaser JustDown 需要按住 ~150ms
  await tap(page, KEYS[idx].bubble, 160)
}

async function startHpSampler(page) {
  samplerOn = true
  const t0 = Date.now()
  ;(async () => {
    let lastKey = ''
    while (samplerOn) {
      const s = await getState(page)
      if (s?.scene === 'duel' && s.fighters?.length === 2) {
        const key = `${s.fighters[0].hp}/${s.fighters[1].hp}`
        if (key !== lastKey) {
          lastKey = key
          hpTimeline.push({
            t: ((Date.now() - t0) / 1000).toFixed(1),
            p1: s.fighters[0].hp,
            p2: s.fighters[1].hp,
          })
        }
      }
      await sleep(80)
    }
  })()
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } })
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(`console.error: ${m.text()}`)
  })

  // ---- Step 1: 進入對戰 ----
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.click('canvas')
  if (!(await waitFor(page, (s) => s.scene === 'menu', 15000))) {
    record('Step 1: 載入主選單', false, 'scene 一直不是 menu')
    throw new Error('abort')
  }
  await page.keyboard.press('Enter')
  await sleep(600)
  await page.keyboard.press('s')
  const duelState = await waitFor(page, (s) => s.scene === 'duel' && s.fighters?.length === 2, 10000)
  if (!duelState) {
    record('Step 1: Enter 進入對戰', false, '沒進入 duel scene')
    throw new Error('abort')
  }
  const [p1Init, p2Init] = duelState.fighters
  record('Step 1: 進入對戰', true, `P1 (${p1Init.x},${p1Init.y}) HP ${p1Init.hp}, P2 (${p2Init.x},${p2Init.y}) HP ${p2Init.hp}`)
  await startHpSampler(page)

  // ---- Step 2: P1 走到中心 (7,6)，含回歸檢查 (7,9)→(7,8) 直接通過 ----
  let w = await walkPath(page, 0, [T(2, 10), T(3, 10), T(4, 10), T(5, 10), T(6, 10), T(7, 10), T(7, 9)], 'P1')
  if (!w.ok) {
    record('Step 2 前置: P1 走到 (7,9)', false, w.reason)
    throw new Error('abort')
  }
  // 回歸檢查：舊 bug 會在 (7,9)→(7,8) 被 (6,8)/(8,8) 木箱溢出夾死
  const reg1 = await walkPath(page, 0, [T(7, 9), T(7, 8)], 'P1-回歸')
  record('回歸: P1 (7,9)→(7,8) 直接通過（舊夾點）', reg1.ok, reg1.ok ? '不需炸箱' : reg1.reason)
  if (!reg1.ok) throw new Error('abort')

  w = await walkPath(page, 0, [T(7, 8), T(7, 7), T(7, 6)], 'P1')
  const p1Pos = await getFighter(page, 0)
  const p1Dist = Math.hypot(p1Pos.x - CENTER.x, p1Pos.y - CENTER.y)
  record('Step 2: P1 抵達中央區', w.ok && p1Dist <= TILE * 1.5, `P1 (${p1Pos.x},${p1Pos.y})，離中心 ${p1Dist.toFixed(0)}px`)
  if (!w.ok) throw new Error('abort')

  // ---- Step 3: P2 走到中心附近 (7,5)，含回歸檢查 (12,1)→…→(8,1) ----
  w = await walkPath(page, 1, [T(12, 1), T(11, 1), T(10, 1), T(9, 1), T(8, 1)], 'P2')
  if (!w.ok) {
    record('Step 3 前置: P2 從 spawn (12,1) 出發', false, w.reason)
    throw new Error('abort')
  }
  // 回歸檢查：舊 bug 在 (9,1) 被 (9,0)/(9,2) 樹夾死，P2 永遠到不了中央
  const reg2 = await walkPath(page, 1, [T(12, 1), T(11, 1), T(10, 1), T(9, 1), T(8, 1)], 'P2-回歸')
  record('回歸: P2 (12,1)→(10,1) 樹縫可通行', reg2.ok, reg2.ok ? '舊夾點 OK' : reg2.reason)
  if (!reg2.ok) throw new Error('abort')

  // 南下 road col 8 到 (8,5)，西移到 (7,5)（離中心 40px，容差內）
  w = await walkPath(page, 1, [T(8, 1), T(8, 2), T(8, 3), T(8, 4), T(8, 5), T(7, 5)], 'P2')
  const p2Pos = await getFighter(page, 1)
  const p2Dist = Math.hypot(p2Pos.x - CENTER.x, p2Pos.y - CENTER.y)
  const p2Hp = (await getFighter(page, 1)).hp
  record(
    'Step 3: P2 抵達中央區（未放球、未受傷）',
    w.ok && p2Dist <= TILE * 1.5 && p2Hp === 100,
    `P2 (${p2Pos.x},${p2Pos.y})，離中心 ${p2Dist.toFixed(0)}px，HP ${p2Hp}`,
  )
  if (!w.ok) throw new Error('abort')

  // ---- Step 4: 雙人位置截圖 ----
  await page.screenshot({ path: '/tmp/qa-center-both.png' })
  record('Step 4: 雙人中央位置截圖', true, '/tmp/qa-center-both.png')

  // ---- Step 5: P1 轟炸 P2 直到獲勝 ----
  // P2 在 (7,5)。P1 從 (7,6) 放球：十字爆風(power 2)沿 col 7 向上涵蓋 (7,5)(7,4)。
  // 爆風涵蓋 col7 rows4-8 + row6 cols5-9，撤退必須完全離開十字：
  // (7,6)→(7,7)→(8,7)（road，col≠7 且 row≠6）。(6,7) 是木箱不可走。
  let won = false
  let rounds = 0
  for (let round = 1; round <= 6; round++) {
    const s = await getState(page)
    if (s?.scene === 'gameover' || s?.fighters?.[1]?.dead) {
      won = true
      break
    }
    // 回到攻擊位 (7,6)
    const back = await moveAxisTo(page, 0, 'x', 300, { tol: 6 })
    const back2 = await moveAxisTo(page, 0, 'y', 260, { tol: 6 })
    if (!back || !back2) {
      record('Step 5: P1 回攻擊位 (7,6)', false, `第 ${round} 回合走位失敗`)
      throw new Error('abort')
    }
    const hpBefore = (await getFighter(page, 1)).hp
    await placeBubble(page, 0)
    rounds++
    console.log(`   [round ${round}] P1 在 (7,6) 放球（P2 HP ${hpBefore}），撤退 (8,7)`)
    // 撤退：南 (7,7) 再東 (8,7) — 完全離開 col 7 / row 6 十字線
    await moveAxisTo(page, 0, 'y', 7 * TILE + TILE / 2, { tol: 6 })
    await moveAxisTo(page, 0, 'x', 8 * TILE + TILE / 2, { tol: 6 })

    const after = await waitFor(
      page,
      (st) => st.scene === 'gameover' || st.fighters?.[1]?.dead || st.fighters?.[1]?.hp < hpBefore,
      5000,
    )
    if (!after) {
      console.log(`   [round ${round}] P2 HP 沒掉（可能放球沒成功），重試`)
      continue
    }
    if (after.scene === 'gameover' || after.fighters?.[1]?.dead || after.fighters?.[1]?.hp <= 0) {
      won = true
      break
    }
    console.log(`   [round ${round}] P2 HP ${hpBefore} → ${after.fighters[1].hp}`)
    await sleep(400)
  }
  const p1Final = await getFighter(page, 0)
  record(
    'Step 5: P1 轟炸至 P2 倒地（P2 未還手）',
    won,
    `P1 共放 ${rounds} 顆水球，傷害全來自 P1`,
  )
  if (!won) throw new Error('abort')

  // ---- Step 6: gameover & winner ----
  const over = await waitFor(page, (s) => s.scene === 'gameover', 8000)
  const winnerOk = over?.winner === 'P1 藍寶'
  record('Step 6: GameOver 勝者為 P1 藍寶', !!over && winnerOk, over ? `winner = ${over.winner}` : '等不到 gameover')
  await sleep(400)
  await page.screenshot({ path: '/tmp/qa-p1-wins.png' })
  record('Step 6: 勝利截圖', true, '/tmp/qa-p1-wins.png')

  // ---- Step 7: R 重賽 ----
  await page.keyboard.press('r')
  const rematch = await waitFor(
    page,
    (s) =>
      s.scene === 'duel' &&
      s.fighters?.length === 2 &&
      s.fighters[0].hp === 100 &&
      s.fighters[1].hp === 100,
    8000,
  )
  record(
    'Step 7: R 重賽重置',
    !!rematch,
    rematch
      ? `P1 HP ${rematch.fighters[0].hp} @(${rematch.fighters[0].x},${rematch.fighters[0].y}), P2 HP ${rematch.fighters[1].hp} @(${rematch.fighters[1].x},${rematch.fighters[1].y})`
      : '按 R 後沒回到雙方滿血的 duel',
  )

  // ---- 次要檢查 ----
  samplerOn = false
  record(
    '次要: 無 JS page error',
    pageErrors.length === 0 ? true : 'warn',
    pageErrors.length ? pageErrors.slice(0, 5).join(' | ') : '0 個 page/console error',
  )
  let p1Clean = true
  for (const h of hpTimeline) {
    if (h.p1 < 100 && !(h.p1 === 100 && h.p2 === 100)) p1Clean = false
  }
  record('次要: P1 未誤傷自己', p1Clean ? true : 'warn', `timeline: ${hpTimeline.map((h) => `[${h.t}s P1:${h.p1} P2:${h.p2}]`).join(' ')}`)

  await browser.close()
}

main()
  .catch((e) => {
    if (e.message !== 'abort') record('腳本執行', false, e.stack?.split('\n')[0])
  })
  .finally(() => {
    samplerOn = false
    console.log('\n========== QA 報告 ==========')
    for (const r of results) {
      console.log(`${r.pass === true ? '✅' : r.pass === 'warn' ? '🟡' : '🔴'} ${r.step}${r.info ? ` — ${r.info}` : ''}`)
    }
    const hardFail = results.some((r) => r.pass === false)
    console.log(hardFail ? '\n結果: FAIL' : '\n結果: PASS')
    process.exit(hardFail ? 1 : 0)
  })
