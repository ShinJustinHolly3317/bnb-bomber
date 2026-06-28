/**
 * QA：雙人完整對戰流程（Playwright 鍵盤模擬）
 * 執行：node scripts/qa-duel.mjs
 */
import { chromium } from 'playwright'

const URL = process.env.QA_URL || 'http://localhost:5177/'

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function getState(page) {
  return page.evaluate(() => window.bnbState ?? { scene: 'unknown' })
}

async function main() {
  const issues = []
  const passes = []

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('pageerror', (err) => issues.push(`🔴 JS Error: ${err.message}`))

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.click('canvas', { timeout: 8000 })
  passes.push('Canvas loaded')

  let state = await getState(page)
  if (state.scene !== 'menu') issues.push(`🔴 Expected menu, got ${state.scene}`)
  else passes.push('Menu scene active')

  await page.keyboard.press('Enter')
  await sleep(600)
  await page.keyboard.press('s')
  await sleep(1200)

  for (let i = 0; i < 10; i++) {
    try {
      state = await getState(page)
      if (state.scene === 'duel') break
    } catch {
      await sleep(300)
    }
  }
  if (state.scene !== 'duel') issues.push(`🔴 Expected duel after Enter, got ${state.scene}`)
  else passes.push('Duel scene started')

  await page.click('canvas')
  const p1Start = state.fighters?.[0]
  const p2Start = state.fighters?.[1]
  if (!p1Start || !p2Start) issues.push('🔴 Fighters missing in debug state')

  // P1 move down then right (spawn on road row 10)
  for (let i = 0; i < 4; i++) {
    await page.keyboard.down('s')
    await sleep(80)
    await page.keyboard.up('s')
    await sleep(40)
  }
  for (let i = 0; i < 10; i++) {
    await page.keyboard.down('d')
    await sleep(100)
    await page.keyboard.up('d')
    await sleep(40)
  }
  state = await getState(page)
  const p1After = state.fighters?.[0]
  if (p1After && p1Start && p1After.x <= p1Start.x + 20) {
    issues.push('🔴 P1 stuck — cannot leave spawn (x did not increase)')
  } else {
    passes.push(`P1 moved (${p1Start?.x} → ${p1After?.x})`)
  }

  // P2 move left
  await page.click('canvas')
  for (let i = 0; i < 12; i++) {
    await page.keyboard.down('ArrowLeft')
    await sleep(100)
    await page.keyboard.up('ArrowLeft')
    await sleep(40)
  }
  state = await getState(page)
  const p2After = state.fighters?.[1]
  if (p2After && p2Start && p2After.x >= p2Start.x - 20) {
    issues.push('🔴 P2 stuck — cannot leave spawn (x did not decrease)')
  } else {
    passes.push(`P2 moved (${p2Start?.x} → ${p2After?.x})`)
  }

  // Bring fighters closer and fight
  for (let round = 0; round < 50; round++) {
    await page.click('canvas')

    // converge + bubble
    await page.keyboard.down('d')
    await sleep(150)
    await page.keyboard.up('d')
    await page.keyboard.press('Space')
    await sleep(200)

    await page.keyboard.down('ArrowLeft')
    await sleep(150)
    await page.keyboard.up('ArrowLeft')
    await page.keyboard.press('Enter')
    await sleep(600)

    state = await getState(page)
    if (state.scene === 'gameover') {
      passes.push(`GameOver reached — winner: ${state.winner} (round ${round + 1})`)
      break
    }
    if (state.fighters?.some((f) => f.dead)) {
      passes.push('Fighter died — waiting for game over transition')
    }
  }

  state = await getState(page)
  if (state.scene !== 'gameover') {
    const hp = state.fighters?.map((f) => `${f.label}:${f.hp}`).join(', ')
    issues.push(`🔴 Match never finished. Final HP: ${hp ?? 'unknown'}`)
  } else {
    // Rematch
    await page.keyboard.press('r')
    await sleep(900)
    state = await getState(page)
    if (state.scene === 'duel' && state.fighters?.every((f) => f.hp === 100)) {
      passes.push('Rematch reset HP to 100')
    } else if (state.scene === 'duel') {
      passes.push('Rematch returned to duel')
    } else {
      issues.push(`🟡 Rematch unexpected scene: ${state.scene}`)
    }
  }

  await browser.close()

  console.log('\n=== QA REPORT (bnb-bomber) ===')
  console.log('URL:', URL)
  passes.forEach((p) => console.log('✅', p))
  issues.forEach((i) => console.log(i))
  const critical = issues.filter((i) => i.startsWith('🔴'))
  console.log(`\nResult: ${critical.length === 0 ? 'PASS' : 'FAIL'} (${critical.length} critical)\n`)
  process.exit(critical.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('🔴 QA runner failed:', e.message)
  process.exit(1)
})
