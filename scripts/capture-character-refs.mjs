/**
 * 從官方介紹頁截圖人物參考（設計用，非遊戲素材）
 * node scripts/capture-character-refs.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../design-references/characters')

const PAGES = [
  {
    name: 'official_beanfun_characters',
    url: 'https://tw.beanfun.com/bnb/game2.htm',
    fullPage: true,
  },
  {
    name: 'official_mlwd_personage',
    url: 'http://mlwd.com.tw/BNB/personage.htm',
    fullPage: true,
  },
  {
    name: 'official_beanfun_home',
    url: 'https://tw.beanfun.com/bnb/',
    fullPage: false,
  },
]

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  for (const { name, url, fullPage } of PAGES) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForTimeout(1500)
      await page.screenshot({
        path: path.join(OUT, `${name}.png`),
        fullPage,
      })
      console.log('✅', name, url)
    } catch (err) {
      console.log('⚠️', name, err.message)
    }
  }

  await browser.close()
  console.log('\nSaved to', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
