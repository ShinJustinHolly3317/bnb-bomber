/**
 * 村10 地圖 layout — **凍結版本 v1**（shared 副本，與 client 同步）
 */

export const VILLAGE10_LAYOUT_VERSION = 'v1' as const

export const VILLAGE10_LAYOUT_V1 = [
  // 左上角原本被 col3 的永久牆 (#) 完全封死，角色炸不出來 → 打通 (3,0)(3,1) 兩格當門口
  'YYT.Y.RRRVY.Y..',
  '.Y..Y.RRR....YY',
  '.##TY.BRRV..BYR',
  'Y#Y#YYYRRVYYTYT',
  'T#T#.YRRRVYYYYY',
  'YY...RRRRY.YY.T',
  'VYV.YYRRY.V...V',
  'T.Y.Y.YRRVT..T.',
  'BYYYY.YRYYYYYYY',
  '....YVRRRVYYY.Y',
  'Y.....RRRY.T..Y',
  'R.....RRRRVY.Y.',
  'B.Y.TVRRRVT..Y.',
] as const

/**
 * 出生點（6 人）：四角 + 上下道路中央。
 * ⚠️ 每個點都必須落在主連通區（可經草地/木箱/馬路互通），
 *    左上真角 (0,0) 被 #/T 永久牆完全封死（走不出去），故改用 (4,0)：
 *    緊鄰上方道路脊 (6,0)，往右一步即可上路，是最接近左上角的可玩點。
 *    `npm run validate:map` 會用洪水填充強制檢查所有出生點連通。
 */
export const VILLAGE10_LAYOUT_V1_SPAWN = {
  spawns: [
    { col: 4, row: 0 }, // slot0 左上（避開左上封閉牆區，緊鄰上方道路）
    { col: 14, row: 12 }, // slot1 右下角（與 slot0 對角，離線 2 人才會分開）
    { col: 14, row: 0 }, // slot2 右上角
    { col: 0, row: 10 }, // slot3 左下角
    { col: 7, row: 0 }, // slot4 上方道路
    { col: 7, row: 12 }, // slot5 下方道路
  ],
} as const
