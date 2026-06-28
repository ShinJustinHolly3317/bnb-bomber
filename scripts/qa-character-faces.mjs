/**
 * 對戰中四方向截圖 + 與設計圖並排比對圖
 * node scripts/qa-character-faces.mjs
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, '.cursor/qa-screenshots/character-faces')

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
  throw new Error('找不到 dev server')
}

/** 世界座標 → 960×540 canvas 像素（camera 置中全圖） */
function worldToScreen(x, y) {
  const worldW = 15 * 40
  const worldH = 13 * 40
  const sx = 480 + (x - worldW / 2)
  const sy = 270 + (y - worldH / 2)
  return { sx, sy }
}

async function enterDuel(page) {
  await page.click('canvas')
  await sleep(500)
  await page.keyboard.press('Enter')
  await sleep(600)
  await page.keyboard.press('KeyQ')
  await sleep(400)
  await page.keyboard.press('Enter')
  await sleep(900)
}

const DIRS = [
  { name: 'down', key: 'KeyS' },
  { name: 'up', key: 'KeyW' },
  { name: 'left', key: 'KeyA' },
  { name: 'right', key: 'KeyD' },
]

async function main() {
  const BASE_URL = await resolveBaseUrl()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 })
  await enterDuel(page)

  let state = await page.evaluate(() => window.bnbState ?? null)
  if (state?.scene !== 'duel') {
    throw new Error(`預期 duel，實際 ${state?.scene}`)
  }

  // P1 移到中央空曠草地
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down('KeyS')
    await sleep(120)
    await page.keyboard.up('KeyS')
    await sleep(40)
  }
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyD')
    await sleep(120)
    await page.keyboard.up('KeyD')
    await sleep(40)
  }

  const results = []

  for (const { name, key } of DIRS) {
    await page.keyboard.down(key)
    await sleep(450)
    state = await page.evaluate(() => window.bnbState ?? null)
    await page.keyboard.up(key)
    await sleep(80)

    const p1 = state?.fighters?.[0]
    const facing = p1?.facing
    const file = path.join(OUT, `ingame-dao-${name}.png`)
    await page.screenshot({ path: file })

    if (p1) {
      const { sx, sy } = worldToScreen(p1.x, p1.y)
      const size = 72
      const clip = {
        x: Math.max(0, Math.min(960 - size, Math.round(sx - size / 2))),
        y: Math.max(0, Math.min(540 - size, Math.round(sy - size / 2))),
        width: size,
        height: size,
      }
      await page.screenshot({
        path: path.join(OUT, `ingame-dao-${name}-crop.png`),
        clip,
      })
    }

    results.push({ name, facing, ok: facing === name })
    await sleep(200)
  }

  await browser.close()

  execSync(`python3 scripts/compare-character-refs.py`, { cwd: ROOT, stdio: 'inherit' })

  console.log('\n=== CHARACTER FACE QA ===')
  console.log('URL:', BASE_URL)
  console.log('Output:', OUT)
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '🔴'} ${r.name} facing=${r.facing}`)
  }
}

main().catch((e) => {
  console.error('🔴', e.message)
  process.exit(1)
})
