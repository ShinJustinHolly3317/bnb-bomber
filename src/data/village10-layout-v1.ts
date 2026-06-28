/**
 * 村10 地圖 layout — **凍結版本 v1**
 *
 * ⚠️ 此檔只定義「格子放什麼」；美術、素材 pipeline 不得修改此 layout。
 * 規格與變更流程見 `.cursor/docs/GAME_DESIGN.md`
 *
 * 字元對照：. 草地  R 馬路  # 牆  V 樹  Y 木箱  T 紅屋  B 藍屋
 */

export const VILLAGE10_LAYOUT_VERSION = 'v1' as const

/** 13 行 × 15 欄；對照 reference-village10.png 調整過門口的穩定版 */
export const VILLAGE10_LAYOUT_V1 = [
  'YYT#Y.RRRVY.Y..',
  '.Y.#Y.RRR....YY',
  '.##TY.BRRV..BYR',
  'Y#Y#YYYRRVYYTYT',
  'T#T#.YRRRVYYYYY',
  'YY...RRRRY.YY.T',
  'VYV.YYRRY.V...V',
  'T.Y.Y.YRRVT..T.',
  'BYYYY.YRYYYYYYY',
  '....YVRRRVYYY.Y',
  'Y.....RRRY.T..Y',
  'R.....RRRRVY.Y.',
  'B.Y.TVRRRVT..Y.',
] as const

/** v1 各元素數量 — `npm run validate:map` 會強制比對 */
export const VILLAGE10_LAYOUT_V1_COUNTS = {
  grass: 58,
  road: 37,
  wall: 8,
  tree: 14,
  crate: 61,
  redRoof: 13,
  blueRoof: 4,
  totalCells: 195,
} as const

/** v1 出生點（與 layout 綁定；改 spawn 需 bump 版本並更新 QA） */
export const VILLAGE10_LAYOUT_V1_SPAWN = {
  spawnP1: { col: 2, row: 10 },
  spawnP2: { col: 12, row: 1 },
} as const
