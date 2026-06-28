/**
 * 多人連線 smoke test — 需先 npm run dev:server
 * node scripts/qa-multiplayer.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const WS_URL = process.env.VITE_WS_URL ?? 'ws://127.0.0.1:8787'
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
  throw new Error('找不到 dev server（請 npm run dev）')
}

async function ensureGameServer() {
  try {
    const port = new URL(WS_URL.replace('wss://', 'https://').replace('ws://', 'http://')).port || '8787'
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1500),
    })
    if (res.ok) return null
  } catch {
    /* spawn */
  }

  const proc = spawn('npm', ['run', 'dev:server'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
  })
  proc.unref()

  for (let i = 0; i < 20; i++) {
    await sleep(300)
    try {
      const port = new URL(WS_URL.replace('wss://', 'https://').replace('ws://', 'http://')).port || '8787'
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (res.ok) return proc
    } catch {
      /* retry */
    }
  }
  throw new Error('game server 無法啟動')
}

async function waitLobbyOnline(page, expectCode) {
  for (let i = 0; i < 30; i++) {
    const state = await page.evaluate(() => window.bnbState)
    const code = state?.lobby?.roomCode ?? ''
    if (state?.online && state.scene === 'lobby' && code) {
      if (!expectCode || code === expectCode) return state
    }
    await sleep(300)
  }
  return page.evaluate(() => window.bnbState)
}

async function clickReady(page) {
  const canvas = page.locator('canvas').first()
  await canvas.waitFor({ state: 'visible', timeout: 10000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('no canvas')
  const x = 530 + 16 + (412 - 32 - 12) / 2 + 12 + (412 - 32 - 12) / 2
  const y = 18 + 484 - 64 + 26
  await page.mouse.click(box.x + (x / 960) * box.width, box.y + (y / 540) * box.height)
}

async function main() {
  console.log('\n=== MULTIPLAYER QA ===')
  const serverProc = await ensureGameServer()
  const baseUrl = await resolveBaseUrl()
  console.log(`URL: ${baseUrl}`)
  console.log(`WS: ${WS_URL}`)

  const browser = await chromium.launch({ headless: true })
  const host = await browser.newPage({ viewport: { width: 960, height: 540 } })
  const guest = await browser.newPage({ viewport: { width: 960, height: 540 } })
  host.on('dialog', (d) => d.accept())
  guest.on('dialog', (d) => d.accept())

  const results = []
  const pass = (m) => results.push({ ok: true, msg: m })
  const fail = (m) => results.push({ ok: false, msg: m })

  await host.goto(baseUrl, { waitUntil: 'networkidle', timeout: 20000 })
  await host.waitForFunction(() => window.__bnbTest?.createRoom, null, { timeout: 15000 })
  await host.evaluate(async () => {
    await window.__bnbTest?.createRoom()
  })
  const hostState = await waitLobbyOnline(host)
  const roomCode = hostState?.lobby?.roomCode ?? ''
  if (hostState?.online && roomCode) pass(`房主建立房間 ${roomCode}`)
  else fail(`房主 lobby 狀態異常: ${JSON.stringify(hostState)}`)

  if (roomCode) {
    await guest.goto(baseUrl, { waitUntil: 'networkidle' })
    await guest.waitForFunction(() => window.__bnbTest?.joinRoom, null, { timeout: 15000 })
    await guest.evaluate(async (code) => {
      await window.__bnbTest?.joinRoom(code)
    }, roomCode)
    const guestState = await waitLobbyOnline(guest, roomCode)
    if (guestState?.online && guestState.lobby?.roomCode === roomCode) {
      pass('客人加入同房')
    } else {
      fail(`客人加入失敗: ${JSON.stringify(guestState)}`)
    }
  }

  await clickReady(host)
  await sleep(400)
  await clickReady(guest)
  await sleep(400)
  await clickReady(host)
  await sleep(400)
  await clickReady(guest)
  await sleep(2000)

  const hostScene = await host.evaluate(() => window.bnbState?.scene)
  const guestScene = await guest.evaluate(() => window.bnbState?.scene)
  if (hostScene === 'duel') pass('房主進入對戰')
  else fail(`房主 scene=${hostScene}`)
  if (guestScene === 'duel') pass('客人進入對戰')
  else fail(`客人 scene=${guestScene}`)

  await host.keyboard.down('KeyD')
  await sleep(800)
  await host.keyboard.up('KeyD')
  await sleep(600)

  const fighters = await guest.evaluate(() => window.bnbState?.fighters?.length)
  if (fighters === 2) pass('對戰雙方 fighters sync')
  else fail(`fighters count=${fighters}`)

  await browser.close()
  if (serverProc) serverProc.kill()

  for (const r of results) console.log(r.ok ? '✅' : '❌', r.msg)
  const bad = results.filter((r) => !r.ok)
  if (bad.length) {
    console.log(`\nResult: FAIL (${bad.length})`)
    process.exit(1)
  }
  console.log('\n✅ 多人 smoke test 通過')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
