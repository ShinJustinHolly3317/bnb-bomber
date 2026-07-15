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

/** 村10 固定道具位置（開局可拾取）— v2 加大地圖，放在馬路上（不會被木箱覆蓋） */
export const VILLAGE10_ITEM_SPAWNS: ItemSpawn[] = [
  { col: 8, row: 4, kind: ItemKind.POWER },
  { col: 8, row: 10, kind: ItemKind.BUBBLE },
  { col: 2, row: 7, kind: ItemKind.SPEED },
  { col: 14, row: 7, kind: ItemKind.SPEED },
  { col: 4, row: 7, kind: ItemKind.POWER },
  { col: 12, row: 7, kind: ItemKind.BUBBLE },
]

export const ITEM_TEXTURE: Record<ItemKindValue, string> = {
  [ItemKind.SPEED]: 'item_speed',
  [ItemKind.POWER]: 'item_power',
  [ItemKind.BUBBLE]: 'item_bubble',
}

export const ITEM_LABEL: Record<ItemKindValue, string> = {
  [ItemKind.SPEED]: '加速',
  [ItemKind.POWER]: '威力',
  [ItemKind.BUBBLE]: '水球+',
}
