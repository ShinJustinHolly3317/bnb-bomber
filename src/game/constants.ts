/** 爆爆王 BnB 標準地圖格：15×13，每格 40px */
export const TILE_SIZE = 40
export const MAP_COLS = 15
export const MAP_ROWS = 13

export const VIEW_WIDTH = 960
export const VIEW_HEIGHT = 540

export const PLAYER_MOVE_SPEED = 130
export const PLAYER_BODY_SIZE = 22

// 角色顯示尺寸：刻意接近 TILE_SIZE(40)，讓人物視覺與箱子差不多大，
// 物理碰撞體也會等比縮小，走道縫隙更順暢、不卡角。
export const PLAYER_DISPLAY_SIZE = 46

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

export const CRATE_ITEM_DROP_CHANCE = 0.35
