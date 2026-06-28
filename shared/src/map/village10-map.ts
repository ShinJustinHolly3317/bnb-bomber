import { MAP_COLS, MAP_ROWS } from '../constants.js'
import {
  VILLAGE10_LAYOUT_V1,
  VILLAGE10_LAYOUT_V1_SPAWN,
  VILLAGE10_LAYOUT_VERSION,
} from './village10-layout-v1.js'

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

/**
 * 加密木箱：把空草地轉成木箱，讓地圖箱子量約成長到接近兩倍。
 * 只保留出生點十字口袋（出生格 + 上下左右）可走，其餘草地都長箱子。
 * 馬路、樹、牆、屋頂維持不變；木箱可炸，故兩個出生點仍可互通。
 */
function densifyCrates(
  tiles: TileKindValue[][],
  spawns: { col: number; row: number }[],
): void {
  const safe = new Set<number>()
  const cross = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const s of spawns) {
    for (const [dc, dr] of cross) {
      const c = s.col + dc
      const r = s.row + dr
      if (c >= 0 && c < MAP_COLS && r >= 0 && r < MAP_ROWS) {
        safe.add(r * MAP_COLS + c)
      }
    }
  }
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const id = r * MAP_COLS + c
      if (safe.has(id)) {
        if (tiles[r]![c] !== TileKind.ROAD) tiles[r]![c] = TileKind.GRASS
        continue
      }
      if (tiles[r]![c] === TileKind.GRASS) tiles[r]![c] = TileKind.CRATE
    }
  }
}

export function buildVillage10Map(): Village10MapData {
  const tiles = parseGrid(VILLAGE10_LAYOUT_V1)
  if (tiles.length !== MAP_ROWS || tiles[0].length !== MAP_COLS) {
    throw new Error(
      `村10 layout ${VILLAGE10_LAYOUT_VERSION} 尺寸不符（預期 ${MAP_COLS}×${MAP_ROWS}）`,
    )
  }
  const spawnP1 = { ...VILLAGE10_LAYOUT_V1_SPAWN.spawnP1 }
  const spawnP2 = { ...VILLAGE10_LAYOUT_V1_SPAWN.spawnP2 }
  densifyCrates(tiles, [spawnP1, spawnP2])
  return {
    layoutVersion: VILLAGE10_LAYOUT_VERSION,
    tiles,
    spawnP1,
    spawnP2,
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
