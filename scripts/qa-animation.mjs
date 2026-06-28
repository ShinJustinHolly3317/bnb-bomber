/**
 * 動畫整合測試（每次開發完都要跑）
 *
 * 目的：確保角色「走路時影格真的有在更新」，而不是圖片靜止平移。
 * 同時覆蓋【離線練習】與【連線對戰】兩條路徑，因為走路動畫在兩個渲染管線
 * （離線 Fighter / 連線 OnlineDuelController）各寫一份，必須分別驗證。
 *
 * 判定核心：移動時 bnbState.fighters[i].anim
 *   - isPlaying === true
 *   - key 結尾符合該方向 walk-<dir>
 *   - 取樣期間 frame index 至少出現 2 個不同值（代表動畫真的在跑）
 * 靜止時：isPlaying === false 且 frame 不再變動。
 *
 * 用法：
 *   node scripts/qa-animation.mjs              # 離線 + 連線（需 dev server + game server）
 *   QA_URL=http://localhost:5174 node scripts/qa-animation.mjs
 */
import { chromium } from 'playwright'

const URL = process.env.QA_URL || 'http://localhost:5174'
const WS_HEALTH = process.env.WS_HEALTH || 'http://localhost:8787/health'

const issues = []
const passes = []
const fail = (m) => issues.push(`🔴 ${m}`)
const warn = (m) => issues.push(`🟡 ${m}`)
const pass = (m) => passes.push(m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const getState = (page) => page.evaluate(() => window.bnbState ?? { scene: 'unknown' })

/** 輪詢等待場景切換（取代固定 sleep，降低連線 setup 的不穩定） */
async function waitForScene(page, scene, timeoutMs = 7000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if ((await getState(page)).scene === scene) return true
    await sleep(150)
  }
  return false
}

/** 等待大廳出現至少一間房 */
async function waitForRooms(page, timeoutMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const s = await getState(page)
    if (s.scene === 'browser' && (s.browser?.rooms ?? 0) >= 1) return true
    await sleep(150)
  }
  return false
}

async function newPage(browser, tag) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  page.on('pageerror', (e) => fail(`[${tag}] JS: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[${tag} console.error]`, m.text())
  })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await sleep(1500)
  return page
}

async function releaseAllKeys(page) {
  for (const k of ['a', 'd', 'w', 's', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    await page.keyboard.up(k).catch(() => {})
  }
}

/** 按住某方向鍵一段時間，取樣動畫狀態 + 實際位移 */
async function sampleWalk(page, key, fighterIndex, ms = 800) {
  await releaseAllKeys(page)
  await page.click('canvas')
  const f0 = (await getState(page)).fighters?.[fighterIndex]
  await page.keyboard.down(key)
  const frames = new Set()
  let lastKey = null
  let anyPlaying = false
  const start = Date.now()
  while (Date.now() - start < ms) {
    const s = await getState(page)
    const a = s.fighters?.[fighterIndex]?.anim
    if (a) {
      frames.add(a.frame)
      lastKey = a.key
      if (a.isPlaying) anyPlaying = true
    }
    await sleep(55)
  }
  await page.keyboard.up(key)
  const f1 = (await getState(page)).fighters?.[fighterIndex]
  const moved =
    f0 && f1 ? Math.hypot(f1.x - f0.x, f1.y - f0.y) : 0
  return { distinctFrames: frames.size, animKey: lastKey, anyPlaying, moved }
}

/** 取樣靜止狀態：影格應穩定、動畫停止 */
async function sampleIdle(page, fighterIndex) {
  await releaseAllKeys(page)
  await sleep(350)
  const a1 = (await getState(page)).fighters?.[fighterIndex]?.anim
  await sleep(350)
  const a2 = (await getState(page)).fighters?.[fighterIndex]?.anim
  return {
    isPlaying: a2?.isPlaying ?? true,
    frameStable: a1?.frame === a2?.frame,
  }
}

const DIRS = [
  { key: 'a', dir: 'left' },
  { key: 'd', dir: 'right' },
  { key: 'w', dir: 'up' },
  { key: 's', dir: 'down' },
]
// 被地形擋住時，往反方向讓出空間再重試
const OPPOSITE = { left: 'd', right: 'a', up: 's', down: 'w' }
const MOVE_EPS = 6 // px，視為「有實際走動」的最小位移
const MOVE_CLEAR = 24 // px，足以跑過多個 tick、可要求影格一定要更新的距離

async function assertWalkAllDirs(page, fighterIndex, modeLabel) {
  for (const { key, dir } of DIRS) {
    let r = await sampleWalk(page, key, fighterIndex)
    // 沒位移可能是被箱子/樹/邊界擋住 → 先往反方向退一步再試一次，排除地形誤判
    if (r.moved < MOVE_EPS) {
      await sampleWalk(page, OPPOSITE[dir], fighterIndex, 360)
      r = await sampleWalk(page, key, fighterIndex)
    }

    if (r.moved < MOVE_EPS) {
      warn(`${modeLabel} 走 ${dir} 兩次都被地形擋住、沒有位移，略過此方向動畫判定`)
      continue
    }

    // 主判定（最可靠）：有實際走動時，walk 動畫一定要在播且方向正確。
    //   靜止平移 bug 的特徵就是「位置在動但 isPlaying=false / key=null」。
    const keyOk = !!r.animKey && r.animKey.endsWith(`walk-${dir}`)
    if (!r.anyPlaying || !keyOk) {
      fail(
        `${modeLabel} 走 ${dir} 有位移 ${Math.round(r.moved)}px 但動畫沒在播` +
          `（isPlaying=${r.anyPlaying}, key=${r.animKey}）→ 靜止平移`,
      )
      continue
    }
    // 補強判定：走了夠遠（多個 tick）就「必須」看到影格更新；
    //   走太短（被牆邊卡住只挪一兩格）不強制，避免地形誤判。
    if (r.moved >= MOVE_CLEAR && r.distinctFrames < 2) {
      fail(
        `${modeLabel} 走 ${dir} 走了 ${Math.round(r.moved)}px 但影格完全沒換` +
          `（frames=${r.distinctFrames}）→ 靜止平移`,
      )
    } else {
      pass(
        `${modeLabel} 走 ${dir} 動畫正常（位移 ${Math.round(r.moved)}px, frames=${r.distinctFrames}, key=${r.animKey}）`,
      )
    }
  }

  const idle = await sampleIdle(page, fighterIndex)
  if (idle.isPlaying || !idle.frameStable) {
    warn(`${modeLabel} 靜止時動畫未停（isPlaying=${idle.isPlaying}, frameStable=${idle.frameStable}）`)
  } else {
    pass(`${modeLabel} 靜止 idle 正常（停在待機影格）`)
  }
}

/**
 * 放水球 → 水球出現 → 引信爆炸動畫。
 * 判定核心（離線/連線共用 bnbState）：
 *   - 按空白鍵後 bubbles 應 >= 1（水球有生成、有脈動貼圖）
 *   - 約 2.5s 引信後 explosionsSpawned 應增加（爆炸動畫真的有播）
 *   - 爆炸後場上水球清除
 */
async function assertBubbleAndExplosion(page, fighterIndex, modeLabel) {
  await releaseAllKeys(page)
  await page.click('canvas')
  // 先走一步確保站在可放置的空地（避免剛好卡在牆角）
  await sampleWalk(page, 's', fighterIndex, 240)
  await releaseAllKeys(page)

  const before = await getState(page)
  const explBefore = before.explosionsSpawned ?? 0

  // 用按住再放開放水球；press() 太快，Phaser 的 JustDown 還沒輪詢就被放開
  await page.keyboard.down('Space')
  await sleep(120)
  await page.keyboard.up('Space')

  let appeared = false
  const t0 = Date.now()
  while (Date.now() - t0 < 1500) {
    if (((await getState(page)).bubbles ?? 0) >= 1) {
      appeared = true
      break
    }
    await sleep(80)
  }
  if (!appeared) {
    fail(`${modeLabel} 放水球後場上沒出現水球（bubbles 未增加）`)
    return
  }
  pass(`${modeLabel} 放水球：水球有生成`)

  // 放完馬上走開，避免被自己水球炸死影響後續
  await sampleWalk(page, 'w', fighterIndex, 200)
  await releaseAllKeys(page)

  let exploded = false
  const t1 = Date.now()
  while (Date.now() - t1 < 4500) {
    if (((await getState(page)).explosionsSpawned ?? 0) > explBefore) {
      exploded = true
      break
    }
    await sleep(100)
  }
  if (!exploded) {
    fail(`${modeLabel} 水球未觸發爆炸動畫（explosionsSpawned 沒增加）`)
    return
  }
  pass(`${modeLabel} 水球爆炸動畫有觸發`)

  await sleep(500)
  const after = await getState(page)
  if ((after.bubbles ?? 0) !== 0) {
    warn(`${modeLabel} 爆炸後水球未清除（bubbles=${after.bubbles}）`)
  } else {
    pass(`${modeLabel} 爆炸後水球已清除`)
  }
}

// ── 離線練習 ─────────────────────────────────────────────────────────────────
async function testOffline(browser) {
  const page = await newPage(browser, 'offline')
  await page.click('canvas')
  await page.keyboard.press('Enter') // 封面 → 大廳
  await waitForScene(page, 'browser')
  await page.mouse.click(480, 460) // 練習模式按鈕 → 房間（離線）
  if (!(await waitForScene(page, 'lobby'))) {
    fail('離線：點練習模式後未進房間')
    await page.close()
    return
  }
  await page.keyboard.press('s') // 邀請電腦 + 準備 → 開賽

  if (!(await waitForScene(page, 'duel'))) {
    fail(`離線無法進入對戰（目前 scene=${(await getState(page)).scene}），動畫測試中止`)
    await page.close()
    return
  }
  pass('離線進入對戰')
  await assertWalkAllDirs(page, 0, '離線')
  await assertBubbleAndExplosion(page, 0, '離線')
  await page.close()
}

// ── 連線對戰 ─────────────────────────────────────────────────────────────────
async function serverUp() {
  try {
    const res = await fetch(WS_HEALTH)
    return res.ok
  } catch {
    return false
  }
}

/** 建立兩人連線對戰；用輪詢取代固定 sleep，回傳 {a,b} 或 null（並記錄原因） */
async function setupOnlineMatch(browser) {
  const a = await newPage(browser, 'A')
  await a.click('canvas')
  await a.keyboard.press('Enter')
  await waitForScene(a, 'browser')
  await a.keyboard.press('c') // 建立房間
  if (!(await waitForScene(a, 'lobby'))) {
    await a.close()
    return { ok: false, why: 'A 建立房間後未進房' }
  }
  await a.keyboard.press('Enter') // A 準備
  await sleep(400)

  const b = await newPage(browser, 'B')
  await b.click('canvas')
  await b.keyboard.press('Enter')
  await waitForScene(b, 'browser')
  if (!(await waitForRooms(b))) {
    await a.close()
    await b.close()
    return { ok: false, why: 'B 大廳沒看到房間' }
  }
  await b.mouse.click(480, 108) // 加入第一列
  if (!(await waitForScene(b, 'lobby'))) {
    await a.close()
    await b.close()
    return { ok: false, why: 'B 加入房間失敗' }
  }
  await b.keyboard.press('Enter') // B 準備 → 兩邊 ready → 開賽

  const okA = await waitForScene(a, 'duel', 9000)
  const okB = await waitForScene(b, 'duel', 9000)
  if (!okA || !okB) {
    const sa = (await getState(a)).scene
    const sb = (await getState(b)).scene
    await a.close()
    await b.close()
    return { ok: false, why: `對戰未開始（A=${sa}, B=${sb}）` }
  }
  return { ok: true, a, b }
}

async function testOnline(browser) {
  if (!(await serverUp())) {
    fail(`game server 沒在跑（${WS_HEALTH}）— 連線動畫無法測，請先啟動 npm run dev:server`)
    return
  }

  // 連線 setup 偶有時序問題，最多重試 2 次
  let session = null
  let lastWhy = ''
  for (let attempt = 1; attempt <= 2 && !session; attempt++) {
    const r = await setupOnlineMatch(browser)
    if (r.ok) session = r
    else lastWhy = r.why
  }
  if (!session) {
    fail(`連線：重試後仍無法開始對戰（${lastWhy}）`)
    return
  }
  pass('連線進入對戰（雙人）')

  // 主要驗收：連線模式本機角色走路動畫（這就是先前壞掉的地方）
  await assertWalkAllDirs(session.a, 0, '連線(本機)')
  // 連線水球/爆炸動畫（先前連線端完全沒有爆炸動畫）
  await assertBubbleAndExplosion(session.a, 0, '連線(本機)')

  await session.a.close()
  await session.b.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    await testOffline(browser)
    await testOnline(browser)
  } finally {
    await browser.close()
  }

  console.log('\n=== ANIMATION QA (bnb-bomber) ===')
  console.log('URL:', URL)
  passes.forEach((p) => console.log('✅', p))
  issues.forEach((i) => console.log(i))
  const critical = issues.filter((i) => i.startsWith('🔴'))
  const warns = issues.filter((i) => i.startsWith('🟡'))
  console.log(
    `\nResult: ${critical.length === 0 ? 'PASS' : 'FAIL'} (${critical.length} critical, ${warns.length} warn)\n`,
  )
  process.exit(critical.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('🔴 qa-animation crashed:', e.message)
  process.exit(1)
})
