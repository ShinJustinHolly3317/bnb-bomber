import { chromium } from 'playwright'

const URL = process.env.QA_URL ?? 'http://localhost:5174'

const browser = await chromium.launch()

async function newClient(tag) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[${tag} console.error]`, m.text())
  })
  page.on('pageerror', (e) => console.log(`[${tag} pageerror]`, e.message))
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  return page
}

const state = (p) => p.evaluate(() => window.bnbState)

// Client A：建立房間
const a = await newClient('A')
await a.keyboard.press('Enter') // menu → browser
await a.waitForTimeout(1200)
console.log('A browser:', JSON.stringify(await state(a)))
await a.keyboard.press('c') // 建立房間
await a.waitForTimeout(1500)
console.log('A after create:', JSON.stringify(await state(a)))
await a.screenshot({ path: '/tmp/rbo-A-room.png' })

// Client B：進大廳應看到 A 的房間
const b = await newClient('B')
await b.keyboard.press('Enter')
await b.waitForTimeout(1500)
const bState = await state(b)
console.log('B browser:', JSON.stringify(bState))
await b.screenshot({ path: '/tmp/rbo-B-browser.png' })

// B 點第一列房間加入
await b.mouse.click(480, 108)
await b.waitForTimeout(1500)
console.log('B after join:', JSON.stringify(await state(b)))
await b.screenshot({ path: '/tmp/rbo-B-room.png' })

// A 端應看到第二位玩家加入
await a.waitForTimeout(500)
console.log('A after B joined:', JSON.stringify(await state(a)))
await a.screenshot({ path: '/tmp/rbo-A-after-join.png' })

await browser.close()
console.log('done')
