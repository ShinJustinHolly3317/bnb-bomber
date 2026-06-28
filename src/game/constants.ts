/** 爆爆王 BnB 標準地圖格：15×13，每格 40px */
export const TILE_SIZE = 40
export const MAP_COLS = 15
export const MAP_ROWS = 13

export const VIEW_WIDTH = 960
export const VIEW_HEIGHT = 540

export const PLAYER_MOVE_SPEED = 130
export const PLAYER_BODY_SIZE = 22

// 角色顯示尺寸：人物含透明邊框，故顯示尺寸要略大於格子，
// 視覺上才會「跟地板格子差不多大」。
export const PLAYER_DISPLAY_SIZE = 60
// 實際碰撞體（世界座標 px）：與顯示尺寸「脫鉤」，固定維持小一點，
// 這樣人物看起來大、但走縫隙仍順暢不卡角。
export const PLAYER_COLLISION_SIZE = 26

export const BUBBLE_FUSE_MS = 2500
export const BASE_BUBBLE_POWER = 2
export const MAX_BUBBLE_POWER = 5
export const BUBBLE_DAMAGE = 50
export const PLAYER_MAX_HP = 100

export const BASE_MAX_BUBBLES = 1
export const MAX_BUBBLES_CAP = 4

export const SPEED_BOOST = 45
export const MAX_MOVE_SPEED = 220

export const CAMERA_LERP = 0.1
export const GAMEPLAY_ZOOM = 1
export const OVERVIEW_ZOOM = 0.82

export const CRATE_ITEM_DROP_CHANCE = 0.7
