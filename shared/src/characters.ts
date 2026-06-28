/** 爆爆王角色 ID（OG 四角色 + 痞子妹 dizni） */
export type CharacterId = 'dao' | 'bazzi' | 'maro' | 'nana' | 'dizni'

export const CHARACTER_IDS: CharacterId[] = ['dao', 'bazzi', 'maro', 'nana', 'dizni']

export function isCharacterId(value: string): value is CharacterId {
  return (CHARACTER_IDS as string[]).includes(value)
}
