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

export const VILLAGE10_LAYOUT_V1_SPAWN = {
  spawnP1: { col: 2, row: 10 },
  spawnP2: { col: 12, row: 1 },
} as const
