/**
 * 村莊 10（村10）— 載入凍結 layout + 遊戲語意 API
 *
 * Layout 來源：`village10-layout-v1.ts`（不可因美術改動而改這裡的格子）
 * 設計文件：`.cursor/docs/GAME_DESIGN.md`
 */

import { MAP_COLS, MAP_ROWS } from '../game/constants'

import {
  VILLAGE10_LAYOUT_V1,
  VILLAGE10_LAYOUT_V1_SPAWN,
  VILLAGE10_LAYOUT_VERSION,
} from './village10-layout-v1'

export { VILLAGE10_LAYOUT_VERSION, VILLAGE10_LAYOUT_V1_COUNTS } from './village10-layout-v1'

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
  layoutVersion: typeof VILLAGE10_LAYOUT_VERSION
  tiles: TileKindValue[][]
  spawnP1: { col: number; row: number }
  spawnP2: { col: number; row: number }
}

const CHAR_TO_TILE: Record<string, TileKindValue> = {
  '.': TileKind.GRASS,
  R: TileKind.ROAD,
  '#': TileKind.WALL,
  V: TileKind.TREE,
  Y: TileKind.CRATE,
  T: TileKind.RED_ROOF,
  B: TileKind.BLUE_ROOF,
}

function parseGrid(lines: readonly string[]): TileKindValue[][] {
  return lines.map((line) =>
    line.split('').map((ch) => {
      const tile = CHAR_TO_TILE[ch]
      if (!tile) throw new Error(`未知地圖字元: ${ch}`)
      return tile
    }),
  )
}

export function buildVillage10Map(): Village10MapData {
  const tiles = parseGrid(VILLAGE10_LAYOUT_V1)
  if (tiles.length !== MAP_ROWS || tiles[0].length !== MAP_COLS) {
    throw new Error(
      `村10 layout ${VILLAGE10_LAYOUT_VERSION} 尺寸不符（預期 ${MAP_COLS}×${MAP_ROWS}）`,
    )
  }
  return {
    layoutVersion: VILLAGE10_LAYOUT_VERSION,
    tiles,
    spawnP1: { ...VILLAGE10_LAYOUT_V1_SPAWN.spawnP1 },
    spawnP2: { ...VILLAGE10_LAYOUT_V1_SPAWN.spawnP2 },
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
