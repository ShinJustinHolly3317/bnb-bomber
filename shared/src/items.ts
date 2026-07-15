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

/** 村10 固定道具位置（開局可拾取）— 15×13 原地圖，放在中央馬路上（不會被木箱覆蓋） */
export const VILLAGE10_ITEM_SPAWNS: ItemSpawn[] = [
  { col: 6, row: 0, kind: ItemKind.SPEED },
  { col: 8, row: 0, kind: ItemKind.POWER },
  { col: 5, row: 5, kind: ItemKind.BUBBLE },
  { col: 8, row: 5, kind: ItemKind.SPEED },
  { col: 6, row: 11, kind: ItemKind.POWER },
  { col: 9, row: 11, kind: ItemKind.BUBBLE },
]
