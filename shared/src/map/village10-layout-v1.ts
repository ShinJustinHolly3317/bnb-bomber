/**
 * 村10 地圖 layout — **凍結版本 v2**（shared 副本，與 client 同步；6 人加大版 17×15）
 */

export const VILLAGE10_LAYOUT_VERSION = 'v2' as const

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
