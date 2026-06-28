/** 爆爆王角色 ID（maro 與 bazzi 美術重複已移除，剩 dao/bazzi/nana + 痞子妹 dizni） */
export type CharacterId = 'dao' | 'bazzi' | 'nana' | 'dizni'

export const CHARACTER_IDS: CharacterId[] = ['dao', 'bazzi', 'nana', 'dizni']

export function isCharacterId(value: string): value is CharacterId {
  return (CHARACTER_IDS as string[]).includes(value)
}
