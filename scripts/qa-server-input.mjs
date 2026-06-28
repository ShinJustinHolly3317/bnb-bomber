/**
 * 伺服器輸入合併回歸測試（純 node，不需瀏覽器）。
 *
 * 對應 bug：連線「放水球常常放不出來」。
 * 根因：client ~60fps 上傳、server 每 tick(50ms) 才取用，一個 tick 內會收到多筆
 *       input 互相覆蓋；放球的 placeBubble 只在按下那一幀為 true，常被後續 false 覆蓋。
 * 修法：GameRoom 對 placeBubble 做 OR 合併直到該 tick 取用。
 *
 * 本測試「同步」連送 true→false→false（模擬同一 tick 內的多幀），等一個 tick 後
 * 檢查 snapshot 是否真的長出水球。沒修的話最後一筆 false 會蓋掉 → 不會有水球。
 *
 * 需先 build server：npm run build:server
 */
import { GameRoom } from '../server/dist/GameRoom.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const passes = []

function fakeWs() {
  const recv = []
  return {
    readyState: 1,
    send: (s) => recv.push(JSON.parse(s)),
    recv,
  }
}

function lastMatchState(ws) {
  const states = ws.recv.filter((m) => m.type === 'matchState')
  return states[states.length - 1] ?? null
}

async function run() {
  const wsA = fakeWs()
  const wsB = fakeWs()
  const room = new GameRoom('TEST', 'p1', 'A', wsA, () => {}, () => {})
  room.tryJoin('p2', 'B', wsB)

  // 兩邊 ready → 開賽（startMatch 會啟動真實 50ms tick timer）
  room.handleMessage('p1', JSON.stringify({ type: 'setReady', ready: true }))
  room.handleMessage('p2', JSON.stringify({ type: 'setReady', ready: true }))

  const started = wsA.recv.some((m) => m.type === 'matchStart')
  if (!started) {
    fails.push('🔴 兩邊 ready 後對戰未開始（matchStart 沒收到）')
    return
  }

  // 同步連送（同一 tick 內的多幀）：放球幀 true，其後 false 覆蓋
  const inp = (place) =>
    JSON.stringify({ type: 'input', tick: 0, dir: null, placeBubble: place })
  room.handleMessage('p1', inp(true))
  room.handleMessage('p1', inp(false))
  room.handleMessage('p1', inp(false))

  await sleep(160) // 讓 tick timer 跑幾次，消化 pendingInputs

  const state = lastMatchState(wsA)
  if (!state) {
    fails.push('🔴 開賽後沒收到任何 matchState')
  } else {
    const bubbles = state.snapshot.bubbles ?? []
    const mine = bubbles.filter((b) => b.ownerId === 'p1')
    if (mine.length >= 1) {
      passes.push(`放水球輸入合併 OK：同 tick true→false 仍成功放出水球（${mine.length} 顆）`)
    } else {
      fails.push(
        '🔴 同 tick 內 placeBubble 被 false 覆蓋 → 水球沒放出（OR 合併失效，會「常常放不出來」）',
      )
    }
  }

  // 收尾：兩邊離開以停掉 tick timer
  room.handleMessage('p1', JSON.stringify({ type: 'leaveRoom' }))
  room.handleMessage('p2', JSON.stringify({ type: 'leaveRoom' }))
}

run()
  .catch((e) => fails.push(`🔴 qa-server-input crashed: ${e.message}`))
  .finally(() => {
    console.log('\n=== SERVER INPUT QA (bnb-bomber) ===')
    passes.forEach((p) => console.log('✅', p))
    fails.forEach((f) => console.log(f))
    console.log(`\nResult: ${fails.length === 0 ? 'PASS' : 'FAIL'} (${fails.length} fail)\n`)
    process.exit(fails.length > 0 ? 1 : 0)
  })
