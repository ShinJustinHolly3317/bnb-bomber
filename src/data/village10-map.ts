/**
 * 村莊 10（村10）碰撞地圖
 * 修正版：四角出生區可通往中央馬路（對照 reference-village10.png 調整門口）
 */

import { MAP_COLS, MAP_ROWS } from '../game/constants'

export const TileKind = {
  GRASS: 1,
  ROAD: 2,
  WALL: 3,
  TREE: 4,
  CRATE: 5,
  RED_ROOF: 6,
  BLUE_ROOF: 7,
} as const

export type TileKindValue = (typeof TileKind)[keyof typeof TileKind]

export interface Village10MapData {
  tiles: TileKindValue[][]
  spawnP1: { col: number; row: number }
  spawnP2: { col: number; row: number }
}

const VILLAGE10_CHARS = [
  '..T#..RRRVY.Y..',
  '.Y.#Y.RRR......',
  '.##TY.BRRV..BYR',
  'Y#Y#YYYRRVYYTYT',
  'T#T#.YRRRVYYYYY',
  '.....RRRRY....T',
  'V.V.YYRRY.V...V',
  'T.Y...YRRVT..T.',
  'BYYYY.YRYYYYYYY',
  '....YVRRRVYYY.Y',
  'R.....RRRY.T..Y',
  'R.....RRRRVY.Y.',
  'B.Y.TVRRRVT..Y.',
] as const

const CHAR_TO_TILE: Record<string, TileKindValue> = {
  '.': TileKind.GRASS,
  R: TileKind.ROAD,
  '#': TileKind.WALL,
  V: TileKind.TREE,
  Y: TileKind.CRATE,
  T: TileKind.RED_ROOF,
  B: TileKind.BLUE_ROOF,
}

function parseGrid(): TileKindValue[][] {
  return VILLAGE10_CHARS.map((line) =>
    line.split('').map((ch) => {
      const tile = CHAR_TO_TILE[ch]
      if (!tile) throw new Error(`未知地圖字元: ${ch}`)
      return tile
    }),
  )
}

export function buildVillage10Map(): Village10MapData {
  const tiles = parseGrid()
  if (tiles.length !== MAP_ROWS || tiles[0].length !== MAP_COLS) {
    throw new Error('村10 地圖尺寸不符')
  }
  return {
    tiles,
    // 避開 col 0 / col 14 世界邊界，否則貼牆時垂直移動會卡死
    spawnP1: { col: 2, row: 10 },
    spawnP2: { col: 12, row: 1 },
  }
}

export function isWalkable(kind: TileKindValue): boolean {
  return kind === TileKind.GRASS || kind === TileKind.ROAD
}

export function isBlocking(kind: TileKindValue): boolean {
  return !isWalkable(kind)
}

export function isDestructible(kind: TileKindValue): boolean {
  return kind === TileKind.CRATE
}
