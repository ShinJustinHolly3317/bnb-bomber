/** 由 scripts/prepare-bnb-assets.py 產生，BootScene 執行期讀取 */
export interface SpriteManifest {
  source: 'bnb' | 'kenney'
  characterFrameWidth: number
  characterFrameHeight: number
  walkFramesPerDirection: number
  explosionFrameWidth: number
  explosionFrameHeight: number
  explosionFrames: number
  playerBodySize: number
  playerOffsetX: number
  playerOffsetY: number
  tileDisplaySize: number
}

export const DEFAULT_SPRITE_MANIFEST: SpriteManifest = {
  source: 'kenney',
  characterFrameWidth: 32,
  characterFrameHeight: 32,
  walkFramesPerDirection: 4,
  explosionFrameWidth: 32,
  explosionFrameHeight: 32,
  explosionFrames: 4,
  playerBodySize: 22,
  playerOffsetX: 5,
  playerOffsetY: 8,
  tileDisplaySize: 64,
}

export function idleFrameForFacing(
  facing: 'down' | 'up' | 'left' | 'right',
  framesPerDir: number,
): number {
  const row = { down: 0, up: 1, left: 2, right: 3 }[facing]
  return row * framesPerDir
}

export function walkAnimStart(
  facing: 'down' | 'up' | 'left' | 'right',
  framesPerDir: number,
): number {
  return idleFrameForFacing(facing, framesPerDir)
}
