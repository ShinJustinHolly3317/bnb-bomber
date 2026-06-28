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
  grass: 58,
  road: 37,
  wall: 8,
  tree: 14,
  crate: 61,
  redRoof: 13,
  blueRoof: 4,
  totalCells: 195,
}

function extractLayoutLines(source) {
  const block = source.match(/VILLAGE10_LAYOUT_V1 = \[([\s\S]*?)\] as const/)
  if (!block) throw new Error('找不到 VILLAGE10_LAYOUT_V1')
  const lines = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  if (lines.length !== 13) throw new Error(`layout 行數應為 13，目前 ${lines.length}`)
  return lines
}

function countLayout(lines) {
  const counts = Object.fromEntries(Object.values(CHAR_KEYS).map((k) => [k, 0]))
  let total = 0
  for (const line of lines) {
    if (line.length !== 15) {
      throw new Error(`每行應 15 欄，有一行是 ${line.length}：${line}`)
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
  const counts = countLayout(lines)

  const errors = []
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (counts[key] !== expected) {
      errors.push(`${key}: 預期 ${expected}，實際 ${counts[key]}`)
    }
  }

  if (errors.length) {
    console.error('🔴 村10 layout v1 驗證失敗（地圖跑版）:')
    errors.forEach((e) => console.error('  -', e))
    console.error('\n若有意變更 layout，請 bump 版本並更新 GAME_DESIGN.md + VILLAGE10_LAYOUT_V1_COUNTS')
    process.exit(1)
  }

  console.log('✅ 村10 layout v1 驗證通過')
  console.log('   counts:', counts)
}

main()
