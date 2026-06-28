/** QA / debug 用遊戲狀態（Playwright 讀取） */
export interface BnbDebugState {
  scene: string
  online?: boolean
  browser?: {
    rooms: number
  }
  // 場上水球數量 + 累積爆炸動畫次數（供水球/爆炸動畫測試）
  bubbles?: number
  explosionsSpawned?: number
  // 場上木箱數量（供「箱子密度」回歸測試）
  crates?: number
  // 本機角色實際顯示寬度（px），供「人物不要又變太小」回歸測試
  playerDisplaySize?: number
  lobby?: {
    occupied: number
    localCharacter: string
    localReady: boolean
    teamColor?: number
    roomCode?: string
  }
  fighters?: {
    label: string
    hp: number
    dead: boolean
    trapped: boolean
    facing?: string
    x: number
    y: number
    vx: number
    vy: number
    // 動畫狀態：供動畫測試驗證走路時影格是否真的在更新
    anim?: {
      key: string | null
      frame: number
      isPlaying: boolean
    }
  }[]
  winner?: string
}

declare global {
  interface Window {
    bnbState?: BnbDebugState
    __bnbTest?: {
      createRoom: () => Promise<void>
      joinRoom: (code: string) => Promise<void>
    }
  }
}

export function setBnbState(state: BnbDebugState): void {
  window.bnbState = state
}
