export const ItemKind = {
  SPEED: 'speed',
  POWER: 'power',
  BUBBLE: 'bubble',
} as const

export type ItemKindValue = (typeof ItemKind)[keyof typeof ItemKind]

export interface ItemSpawn {
  col: number
  row: number
  kind: ItemKindValue
}

/** 村10 固定道具箱位置（開局可拾取） */
export const VILLAGE10_ITEM_SPAWNS: ItemSpawn[] = [
  { col: 2, row: 0, kind: ItemKind.SPEED },
  { col: 12, row: 0, kind: ItemKind.POWER },
  { col: 7, row: 5, kind: ItemKind.BUBBLE },
  { col: 3, row: 8, kind: ItemKind.SPEED },
  { col: 11, row: 8, kind: ItemKind.POWER },
  { col: 7, row: 11, kind: ItemKind.BUBBLE },
]
