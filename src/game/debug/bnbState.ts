/** QA / debug 用遊戲狀態（Playwright 讀取） */
export interface BnbDebugState {
  scene: string
  fighters?: {
    label: string
    hp: number
    dead: boolean
    trapped: boolean
    x: number
    y: number
    vx: number
    vy: number
  }[]
  winner?: string
}

declare global {
  interface Window {
    bnbState?: BnbDebugState
  }
}

export function setBnbState(state: BnbDebugState): void {
  window.bnbState = state
}
