import { AssetKeys } from '../assets/AssetKeys'

/** 爆爆王 OG 角色（maro 因美術與 bazzi 重複（兩個紅色睏寶）已移除） */
export type CharacterId = 'dao' | 'bazzi' | 'nana' | 'dizni'

export interface CharacterDef {
  id: CharacterId
  label: string
  texture: string
  portrait: string
  animPrefix: string
}

export const CHARACTER_LIST: CharacterDef[] = [
  {
    id: 'dao',
    label: '藍寶',
    texture: AssetKeys.PLAYER_BLUE,
    portrait: 'portrait_dao',
    animPrefix: 'dao',
  },
  {
    id: 'bazzi',
    label: '睏寶',
    texture: AssetKeys.PLAYER_RED,
    portrait: 'portrait_bazzi',
    animPrefix: 'bazzi',
  },
  {
    id: 'nana',
    label: '囡囡',
    texture: AssetKeys.PLAYER_PINK,
    portrait: 'portrait_nana',
    animPrefix: 'nana',
  },
  {
    id: 'dizni',
    label: '痞子妹',
    texture: AssetKeys.PLAYER_PURPLE,
    portrait: 'portrait_dizni',
    animPrefix: 'dizni',
  },
]

export const CHARACTER_BY_ID: Record<CharacterId, CharacterDef> =
  Object.fromEntries(CHARACTER_LIST.map((c) => [c.id, c])) as Record<
    CharacterId,
    CharacterDef
  >

export function characterByIndex(index: number): CharacterDef {
  return CHARACTER_LIST[index % CHARACTER_LIST.length]
}
