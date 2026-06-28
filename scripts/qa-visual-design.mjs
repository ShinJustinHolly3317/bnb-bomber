/**
 * 視覺設計 QA：截圖 menu / lobby / duel，對照 design-references
 * node scripts/qa-visual-design.mjs
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, '.cursor/qa-screenshots')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function resolveBaseUrl() {
  if (process.env.QA_URL) return process.env.QA_URL
  for (const port of [5173, 5174, 5175, 5176]) {
    const url = `http://localhost:${port}/`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
      if (!res.ok) continue
      const html = await res.text()
      if (html.includes('game-container') || html.includes('bnb-bomber')) return url
    } catch {
      /* try next port */
    }
  }
  throw new Error('找不到 bnb-bomber dev server（5173-5176）')
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const BASE_URL = await resolveBaseUrl()

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  const issues = []

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 })
  await page.click('canvas')
  await sleep(800)
  await page.screenshot({ path: path.join(OUT, '01-menu.png') })

  await page.keyboard.press('Enter')
  await sleep(900)
  await page.screenshot({ path: path.join(OUT, '02-lobby-idle.png') })

  await page.keyboard.press('Digit1')
  await sleep(200)
  await page.mouse.click(469, 516)
  await sleep(500)
  await page.screenshot({ path: path.join(OUT, '02b-lobby-quickjoin.png') })

  await page.mouse.click(713, 512)
  await sleep(1200)
  await page.screenshot({ path: path.join(OUT, '03-duel.png') })

  const refs = [
    'pixel-lobby-ref.png',
    'pixel-characters-ref.png',
    'pixel-tiles-ref.png',
  ]
  for (const ref of refs) {
    const p = path.join(ROOT, 'design-references', ref)
    if (!existsSync(p)) issues.push(`missing ref: ${ref}`)
  }

  const assets = ['lobby_bg.png', 'menu_bg.png', 'player_blue.png', 'tile_grass.png']
  for (const a of assets) {
    const p = path.join(ROOT, 'public/assets', a)
    if (!existsSync(p)) issues.push(`missing asset: ${a}`)
  }

  // DOM / canvas checks
  const canvasBox = await page.locator('canvas').boundingBox()
  if (canvasBox && (canvasBox.width !== 960 || canvasBox.height !== 540)) {
    issues.push(`canvas size ${canvasBox.width}x${canvasBox.height}, expected 960x540`)
  }

  const manifest = await page.evaluate(async () => {
    const r = await fetch('/assets/sprite-manifest.json')
    return r.json()
  }).catch(() => null)

  await browser.close()

  console.log('\n=== VISUAL DESIGN QA ===')
  console.log('URL:', BASE_URL)
  console.log('Screenshots:', OUT)
  console.log('Reference copies: design-references/ → compare manually')
  if (manifest) console.log('manifest source:', manifest.source)
  if (issues.length) {
    issues.forEach((i) => console.log('🔴', i))
    process.exit(1)
  }
  console.log('✅ Captures complete — review 01-menu vs characters-ref, 02-lobby vs lobby-ref, 03-duel vs tiles-ref')
}

main().catch((e) => {
  console.error('🔴', e.message)
  process.exit(1)
})
