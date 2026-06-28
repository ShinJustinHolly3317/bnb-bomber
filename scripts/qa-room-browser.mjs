import { chromium } from 'playwright'

const URL = process.env.QA_URL ?? 'http://localhost:5174'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text())
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
await page.screenshot({ path: '/tmp/rb-01-menu.png' })
console.log('menu state:', JSON.stringify(await page.evaluate(() => window.bnbState)))

// 按任意鍵 → 大廳
await page.keyboard.press('Enter')
await page.waitForTimeout(1000)
await page.screenshot({ path: '/tmp/rb-02-browser.png' })
console.log('browser state:', JSON.stringify(await page.evaluate(() => window.bnbState)))

// 重新整理
await page.keyboard.press('r')
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/rb-03-refresh.png' })
console.log('after refresh:', JSON.stringify(await page.evaluate(() => window.bnbState)))

// 點第一列房間（座標：第一列中央）
await page.mouse.click(480, 108)
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/rb-04-room.png' })
console.log('after click row:', JSON.stringify(await page.evaluate(() => window.bnbState)))

await browser.close()
console.log('done')
