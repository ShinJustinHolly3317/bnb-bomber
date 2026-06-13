/**
 * 健康檢查：建置、素材、console 錯誤、對戰流程
 * node scripts/health-check.mjs
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
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

async function main() {
  // 1. 建置
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe' })
    pass('npm run build')
  } catch (e) {
    fail(`build failed: ${e.stderr?.toString().slice(0, 200) || e.message}`)
  }

  // 2. 必要素材
  const assets = [
    'public/assets/sprite-manifest.json',
    'public/assets/player_blue.png',
    'public/assets/tile_grass.png',
    'public/assets/bubble.png',
  ]
  for (const rel of assets) {
    if (existsSync(path.join(ROOT, rel))) pass(`asset exists: ${rel}`)
    else fail(`missing asset: ${rel}`)
  }

  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, 'public/assets/sprite-manifest.json'), 'utf8'),
  )
  if (manifest.source !== 'reference' && manifest.source !== 'bnb' && manifest.source !== 'bnb-style') {
    warn(`manifest source=${manifest.source}`)
  } else {
    pass(`manifest source=${manifest.source}`)
  }

  // 3. HTTP 素材可載入
  for (const p of ['/assets/sprite-manifest.json', '/assets/player_blue.png', '/assets/tile_grass.png']) {
    const res = await fetch(new URL(p, BASE_URL))
    if (res.ok) pass(`HTTP ${res.status} ${p}`)
    else fail(`HTTP ${res.status} ${p}`)
  }

  const consoleErrors = []
  const pageErrors = []

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(err.message))

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 })
  await page.click('canvas', { timeout: 8000 })
  pass('page loaded + canvas focused')

  await sleep(800)
  let state = await page.evaluate(() => window.bnbState ?? null)
  if (state?.scene === 'menu') pass('menu scene')
  else fail(`expected menu, got ${state?.scene}`)

  // BootScene 不應有 manifest JSON 解析錯誤
  const manifestErrors = [...consoleErrors, ...pageErrors].filter(
    (e) => e.includes('sprite-manifest') || e.includes('Unexpected token'),
  )
  if (manifestErrors.length) fail(`sprite-manifest load: ${manifestErrors[0]}`)
  else pass('no sprite-manifest JSON errors')

  await page.keyboard.press('Enter')
  await sleep(1500)
  state = await page.evaluate(() => window.bnbState ?? null)
  if (state?.scene === 'duel') pass('duel scene')
  else fail(`expected duel, got ${state?.scene}`)

  // 角色有在動、HP 正常
  if (state?.fighters?.length === 2 && state.fighters.every((f) => f.hp === 100)) {
    pass('both fighters HP 100 at start')
  } else {
    warn(`fighters at duel start: ${JSON.stringify(state?.fighters)}`)
  }

  // P1 移動
  const p1x0 = state.fighters[0].x
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down('d')
    await sleep(90)
    await page.keyboard.up('d')
    await sleep(40)
  }
  state = await page.evaluate(() => window.bnbState ?? null)
  if (state.fighters[0].x > p1x0 + 30) pass(`P1 moved x ${p1x0}→${state.fighters[0].x}`)
  else fail(`P1 stuck at x=${state.fighters[0].x}`)

  // P2 移動
  const p2x0 = state.fighters[1].x
  for (let i = 0; i < 10; i++) {
    await page.keyboard.down('ArrowLeft')
    await sleep(90)
    await page.keyboard.up('ArrowLeft')
    await sleep(40)
  }
  state = await page.evaluate(() => window.bnbState ?? null)
  if (state.fighters[1].x < p2x0 - 20) pass(`P2 moved x ${p2x0}→${state.fighters[1].x}`)
  else fail(`P2 stuck at x=${state.fighters[1].x}`)

  // 對戰至 GameOver（瞬間 press 不會觸發 Phaser JustDown，放球鍵需按住 ~150ms）
  for (let round = 0; round < 90; round++) {
    await page.click('canvas')
    await page.keyboard.down('d')
    await sleep(120)
    await page.keyboard.up('d')
    await page.keyboard.down('Space')
    await sleep(150)
    await page.keyboard.up('Space')
    await page.keyboard.down('ArrowLeft')
    await sleep(120)
    await page.keyboard.up('ArrowLeft')
    await page.keyboard.down('Enter')
    await sleep(150)
    await page.keyboard.up('Enter')
    await sleep(450)
    state = await page.evaluate(() => window.bnbState ?? null)
    if (state?.scene === 'gameover') {
      pass(`gameover winner=${state.winner} round=${round + 1}`)
      break
    }
  }
  if (state?.scene !== 'gameover') {
    const hp = state?.fighters?.map((f) => `${f.label}:${f.hp}`).join(', ')
    fail(`match did not finish. HP: ${hp}`)
  }

  // Rematch
  if (state?.scene === 'gameover') {
    await page.keyboard.press('r')
    await sleep(900)
    state = await page.evaluate(() => window.bnbState ?? null)
    if (state?.scene === 'duel' && state.fighters?.every((f) => f.hp === 100)) {
      pass('rematch HP reset')
    } else {
      warn(`rematch state: scene=${state?.scene}`)
    }
  }

  // 其他 console 錯誤
  const otherErrors = [...consoleErrors, ...pageErrors].filter(
    (e) => !e.includes('WebGL') && !e.includes('Framebuffer'),
  )
  if (otherErrors.length) {
    warn(`console errors (${otherErrors.length}): ${otherErrors.slice(0, 2).join(' | ')}`)
  } else {
    pass('no critical console errors')
  }

  await browser.close()

  console.log('\n=== HEALTH CHECK (bnb-bomber) ===')
  console.log('URL:', BASE_URL)
  passes.forEach((p) => console.log('✅', p))
  issues.forEach((i) => console.log(i))
  const critical = issues.filter((i) => i.startsWith('🔴'))
  console.log(`\nResult: ${critical.length === 0 ? 'PASS' : 'FAIL'} (${critical.length} critical, ${issues.filter((i) => i.startsWith('🟡')).length} warn)\n`)
  process.exit(critical.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('🔴 health-check crashed:', e.message)
  process.exit(1)
})
