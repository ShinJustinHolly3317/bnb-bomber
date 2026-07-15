/**
 * 村10 地圖 layout — **凍結版本 v1**（shared 副本，與 client 同步）
 */

export const VILLAGE10_LAYOUT_VERSION = 'v1' as const

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

/** 出生點（6 人）：四角 + 上下道路中央 */
export const VILLAGE10_LAYOUT_V1_SPAWN = {
  spawns: [
    { col: 0, row: 0 }, // slot0 左上角
    { col: 14, row: 12 }, // slot1 右下角（與 slot0 對角，離線 2 人才會分開）
    { col: 14, row: 0 }, // slot2 右上角
    { col: 0, row: 10 }, // slot3 左下角
    { col: 7, row: 0 }, // slot4 上方道路
    { col: 7, row: 12 }, // slot5 下方道路
  ],
} as const
