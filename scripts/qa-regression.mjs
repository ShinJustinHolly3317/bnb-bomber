/**
 * 回歸測試（純 node，不需瀏覽器）— 鎖住一批「容易再壞掉」的設定值。
 *
 * 對應 bug 回報項目，每次更新都要跑（npm run qa:regression）：
 *   1. 道具掉落率 x2          → CRATE_ITEM_DROP_CHANCE === 0.7
 *   2. 箱子數量 x2            → buildVillage10Map() 木箱 >= 100
 *   3. 出生點不可被箱子悶死    → 兩個 spawn 的十字口袋都可走
 *   4. 角色選單去重、移除 maro → CHARACTER_IDS = [dao,bazzi,nana,dizni]
 *
 * 需先 build shared：npm run build:shared
 */
import {
  CHARACTER_IDS,
  CRATE_ITEM_DROP_CHANCE,
  MAP_COLS,
  MAP_ROWS,
  TileKind,
  buildVillage10Map,
  isWalkable,
} from '../shared/dist/index.js'

const fails = []
const passes = []
const check = (cond, okMsg, failMsg) => {
  if (cond) passes.push(okMsg)
  else fails.push(failMsg)
}

// 1. 道具掉落率 x2
check(
  CRATE_ITEM_DROP_CHANCE === 0.7,
  `道具掉落率 = ${CRATE_ITEM_DROP_CHANCE}（x2 OK）`,
  `🔴 道具掉落率應為 0.7，實際 ${CRATE_ITEM_DROP_CHANCE}`,
)

// 2 & 3. 箱子密度 + 出生點口袋
const map = buildVillage10Map()
let crates = 0
for (let r = 0; r < MAP_ROWS; r++) {
  for (let c = 0; c < MAP_COLS; c++) {
    if (map.tiles[r][c] === TileKind.CRATE) crates++
  }
}
check(
  crates >= 100,
  `木箱數量 = ${crates}（>=100 OK）`,
  `🔴 木箱數量應 >= 100（原 61 的近兩倍），實際 ${crates}`,
)

const cross = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
for (const [name, s] of [
  ['P1', map.spawnP1],
  ['P2', map.spawnP2],
]) {
  let walkable = 0
  for (const [dc, dr] of cross) {
    const c = s.col + dc
    const r = s.row + dr
    if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue
    if (isWalkable(map.tiles[r][c])) walkable++
  }
  // 出生格 + 至少一個鄰格可走，才不會一開局就被箱子悶死
  check(
    isWalkable(map.tiles[s.row][s.col]) && walkable >= 2,
    `${name} 出生點口袋可走（${walkable}/5）`,
    `🔴 ${name} 出生點被悶住（可走格 ${walkable}/5）`,
  )
}

// 4. 角色去重 / 移除 maro
const expected = ['dao', 'bazzi', 'nana', 'dizni']
const uniqueOk = new Set(CHARACTER_IDS).size === CHARACTER_IDS.length
check(
  uniqueOk &&
    CHARACTER_IDS.length === expected.length &&
    expected.every((id, i) => CHARACTER_IDS[i] === id),
  `角色名單 = [${CHARACTER_IDS.join(', ')}]（無重複、無 maro OK）`,
  `🔴 角色名單應為 [${expected.join(', ')}]，實際 [${CHARACTER_IDS.join(', ')}]`,
)
check(
  !CHARACTER_IDS.includes('maro'),
  'maro（重複的紅色睏寶）已移除',
  '🔴 maro 仍在角色名單（兩個紅色睏寶未移除）',
)

console.log('\n=== REGRESSION QA (bnb-bomber) ===')
passes.forEach((p) => console.log('✅', p))
fails.forEach((f) => console.log(f))
console.log(`\nResult: ${fails.length === 0 ? 'PASS' : 'FAIL'} (${fails.length} fail)\n`)
process.exit(fails.length > 0 ? 1 : 0)
