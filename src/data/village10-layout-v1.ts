/**
 * 村10 地圖 layout — **凍結版本 v2**（6 人加大版 17×15）
 *
 * ⚠️ 此檔只定義「格子放什麼」；美術、素材 pipeline 不得修改此 layout。
 * 規格與變更流程見 `.cursor/docs/GAME_DESIGN.md`
 *
 * 字元對照：. 草地  R 馬路  # 牆  V 樹  Y 木箱  T 紅屋  B 藍屋
 * 說明：中央十字大馬路 + 內圈環狀馬路串起四角與上下出生點；
 *       其餘草地會在 build 期被 densifyCrates 長成木箱（出生十字口袋除外）。
 */

export const VILLAGE10_LAYOUT_VERSION = 'v2' as const

/** 15 行 × 17 欄；6 人加大版 */
export const VILLAGE10_LAYOUT_V1 = [
  '........R........',
  '........R........',
  '..RRRRRRRRRRRRR..',
  '..R...V.R.V...R..',
  '..R.TT..R.....R..',
  '..R.TT..R.....R..',
  '..RV....R....VR..',
  'RRRRRRRRRRRRRRRRR',
  '..R.....R.....R..',
  '..R.....R..BB.R..',
  '..R.....R..BB.R..',
  '..R...V.R.V...R..',
  '..RRRRRRRRRRRRR..',
  '........R........',
  '........R........',
] as const

/** v2 各元素數量 — `npm run validate:map` 會強制比對 */
export const VILLAGE10_LAYOUT_V1_COUNTS = {
  grass: 170,
  road: 71,
  wall: 0,
  tree: 6,
  crate: 0,
  redRoof: 4,
  blueRoof: 4,
  totalCells: 255,
} as const

/** v2 出生點（6 人）：四角 + 上下道路；改 spawn 需 bump 版本並更新 QA */
export const VILLAGE10_LAYOUT_V1_SPAWN = {
  spawns: [
    { col: 1, row: 1 }, // 左上角
    { col: 15, row: 1 }, // 右上角
    { col: 1, row: 13 }, // 左下角
    { col: 15, row: 13 }, // 右下角
    { col: 8, row: 1 }, // 上方道路
    { col: 8, row: 13 }, // 下方道路
  ],
} as const
