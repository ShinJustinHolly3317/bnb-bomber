/**
 * 村10 layout 凍結驗證 — 美術改動不得讓元素數量跑版
 * node scripts/validate-village10-layout.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const LAYOUT_FILE = path.join(ROOT, 'src/data/village10-layout-v1.ts')

const CHAR_KEYS = {
  '.': 'grass',
  R: 'road',
  '#': 'wall',
  V: 'tree',
  Y: 'crate',
  T: 'redRoof',
  B: 'blueRoof',
}

const EXPECTED = {
  grass: 60,
  road: 37,
  wall: 6,
  tree: 14,
  crate: 61,
  redRoof: 13,
  blueRoof: 4,
  totalCells: 195,
}

const EXPECTED_ROWS = 13
const EXPECTED_COLS = 15

function extractLayoutLines(source) {
  const block = source.match(/VILLAGE10_LAYOUT_V1 = \[([\s\S]*?)\] as const/)
  if (!block) throw new Error('找不到 VILLAGE10_LAYOUT_V1')
  const lines = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  if (lines.length !== EXPECTED_ROWS)
    throw new Error(`layout 行數應為 ${EXPECTED_ROWS}，目前 ${lines.length}`)
  return lines
}

function extractSpawns(source) {
  const block = source.match(/VILLAGE10_LAYOUT_V1_SPAWN = \{([\s\S]*?)\} as const/)
  if (!block) throw new Error('找不到 VILLAGE10_LAYOUT_V1_SPAWN')
  const spawns = [...block[1].matchAll(/\{\s*col:\s*(\d+),\s*row:\s*(\d+)\s*\}/g)].map(
    (m) => ({ col: Number(m[1]), row: Number(m[2]) }),
  )
  if (spawns.length === 0) throw new Error('找不到任何出生點')
  return spawns
}

// 可通行 = 草地/馬路/木箱（木箱可炸開）；#、V、T、B 為永久牆
const PASSABLE = new Set(['.', 'R', 'Y'])

function floodFill(lines, startCol, startRow) {
  const cols = lines[0].length
  const rows = lines.length
  const seen = new Set([startRow * cols + startCol])
  const stack = [[startCol, startRow]]
  while (stack.length) {
    const [c, r] = stack.pop()
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue
      const id = nr * cols + nc
      if (seen.has(id)) continue
      if (!PASSABLE.has(lines[nr][nc])) continue
      seen.add(id)
      stack.push([nc, nr])
    }
  }
  return seen
}

/**
 * 出生點連通性驗證：每個出生點必須可通行，且都落在同一個連通區，
 * 否則玩家會像左上角 (0,0) 那樣被永久牆困死、走不出來。
 */
function validateSpawnConnectivity(lines, spawns) {
  const cols = lines[0].length
  const errors = []

  for (const { col, row } of spawns) {
    const ch = lines[row]?.[col]
    if (!PASSABLE.has(ch)) {
      errors.push(`出生點 (${col},${row}) 落在永久牆 '${ch}'（無法站立）`)
    }
  }

  const base = spawns[0]
  const component = floodFill(lines, base.col, base.row)
  for (const { col, row } of spawns) {
    if (!component.has(row * cols + col)) {
      errors.push(
        `出生點 (${col},${row}) 與 slot0 (${base.col},${base.row}) 不連通（被永久牆封死）`,
      )
    }
  }
  return errors
}

function countLayout(lines) {
  const counts = Object.fromEntries(Object.values(CHAR_KEYS).map((k) => [k, 0]))
  let total = 0
  for (const line of lines) {
    if (line.length !== EXPECTED_COLS) {
      throw new Error(`每行應 ${EXPECTED_COLS} 欄，有一行是 ${line.length}：${line}`)
    }
    for (const ch of line) {
      const key = CHAR_KEYS[ch]
      if (!key) throw new Error(`非法字元 '${ch}'`)
      counts[key]++
      total++
    }
  }
  counts.totalCells = total
  return counts
}

function main() {
  const source = readFileSync(LAYOUT_FILE, 'utf8')
  const lines = extractLayoutLines(source)
  const spawns = extractSpawns(source)
  const counts = countLayout(lines)

  const errors = []
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (counts[key] !== expected) {
      errors.push(`${key}: 預期 ${expected}，實際 ${counts[key]}`)
    }
  }

  errors.push(...validateSpawnConnectivity(lines, spawns))

  if (errors.length) {
    console.error('🔴 村10 layout v1 驗證失敗（地圖跑版 / 出生點被困）:')
    errors.forEach((e) => console.error('  -', e))
    console.error('\n若有意變更 layout，請 bump 版本並更新 GAME_DESIGN.md + VILLAGE10_LAYOUT_V1_COUNTS')
    process.exit(1)
  }

  console.log('✅ 村10 layout v1 驗證通過')
  console.log('   counts:', counts)
  console.log(`   spawns: ${spawns.length} 個，皆連通可走`)
}

main()
