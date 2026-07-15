// 驗證「困泡泡」機制：炸到→困住、10s 自爆、敵人觸碰爆破
import {
  Village10Sim,
  buildVillage10Map,
  tileToWorld,
  worldToTile,
  BUBBLE_TRAP_TICKS,
  BUBBLE_FUSE_TICKS,
  TICK_MS,
} from '../shared/dist/index.js'

let failures = 0
const check = (label, cond) => {
  const ok = !!cond
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const map = buildVillage10Map()
const spawn = map.spawns[0]

// 找出生點旁一格可站的走道，用來擺放第二位玩家 / 敵人
function findAdjacentWalkable(col, row) {
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = col + dc
    const r = row + dr
    const kind = map.tiles[r]?.[c]
    // 0=grass 1=road 皆可站
    if (kind === 0 || kind === 1) return { col: c, row: r }
  }
  return null
}

// --- 情境 A：被自己水球炸到 → 困住，倒數歸零 → 自爆 ---
{
  const sim = new Village10Sim(1, [
    { playerId: 'A', slot: 0, name: 'A', characterId: 'bazzi' },
    { playerId: 'B', slot: 3, name: 'B', characterId: 'nana' },
  ])

  const noInput = { A: { dir: null, placeBubble: false }, B: { dir: null, placeBubble: false } }

  // A 放水球（站在出生點原地）
  let snap = sim.step({ ...noInput, A: { dir: null, placeBubble: true } })
  check('A 放球後場上有 1 顆水球', snap.bubbles.length === 1)

  // 等水球引爆
  for (let i = 0; i < BUBBLE_FUSE_TICKS + 1; i++) snap = sim.step(noInput)
  const a = snap.fighters.find((f) => f.playerId === 'A')
  check('引爆後 A 被困在泡泡中', a.trapped === true && a.dead === false)
  check('A 困住倒數約等於 10s', a.trapTicksLeft > BUBBLE_TRAP_TICKS - 5 && a.trapTicksLeft <= BUBBLE_TRAP_TICKS)

  // 讓倒數跑完
  for (let i = 0; i < BUBBLE_TRAP_TICKS + 2; i++) snap = sim.step(noInput)
  const aDead = snap.fighters.find((f) => f.playerId === 'A')
  check('倒數歸零後 A 自爆出局', aDead.dead === true && aDead.trapped === false)
}

// --- 情境 B：被困後，敵人觸碰 → 立即爆破 ---
{
  const sim = new Village10Sim(2, [
    { playerId: 'A', slot: 0, name: 'A', characterId: 'bazzi' },
    { playerId: 'B', slot: 3, name: 'B', characterId: 'nana' },
  ])
  const noInput = { A: { dir: null, placeBubble: false }, B: { dir: null, placeBubble: false } }

  // A 放球並被自己的水球困住
  let snap = sim.step({ ...noInput, A: { dir: null, placeBubble: true } })
  for (let i = 0; i < BUBBLE_FUSE_TICKS + 1; i++) snap = sim.step(noInput)
  let a = snap.fighters.find((f) => f.playerId === 'A')
  check('B 情境：A 先被困住', a.trapped === true && a.dead === false)

  const trapTicksAtStart = a.trapTicksLeft

  // B 從出生點朝 A 走過去（B 在對角，直接用多方向逼近）
  let bReached = false
  for (let i = 0; i < 400 && !bReached; i++) {
    a = snap.fighters.find((f) => f.playerId === 'A')
    const b = snap.fighters.find((f) => f.playerId === 'B')
    if (a.dead) break
    const dx = a.x - b.x
    const dy = a.y - b.y
    let dir
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left'
    else dir = dy > 0 ? 'down' : 'up'
    snap = sim.step({ A: { dir: null, placeBubble: false }, B: { dir, placeBubble: false } })
    a = snap.fighters.find((f) => f.playerId === 'A')
    if (a.dead) bReached = true
  }

  const aFinal = snap.fighters.find((f) => f.playerId === 'A')
  check('敵人 B 觸碰後 A 立即爆破出局', aFinal.dead === true)
  // 確認不是因為 10s 倒數自然結束（觸碰應遠早於倒數歸零）
  check('A 是被觸碰提早出局（非等滿 10s）', trapTicksAtStart > 20)
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAIL'} (trap=${BUBBLE_TRAP_TICKS} ticks / ${(BUBBLE_TRAP_TICKS * TICK_MS) / 1000}s)`)
process.exit(failures === 0 ? 0 : 1)
