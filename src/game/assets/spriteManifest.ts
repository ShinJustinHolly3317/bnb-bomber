/** 由 scripts/prepare-bnb-assets.py 產生，BootScene 執行期讀取 */
export interface SpriteManifest {
  source: 'bnb' | 'kenney' | 'bnb-style' | 'pixel' | 'design-reference'
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
  source: 'design-reference',
  characterFrameWidth: 64,
  characterFrameHeight: 64,
  walkFramesPerDirection: 4,
  explosionFrameWidth: 48,
  explosionFrameHeight: 48,
  explosionFrames: 4,
  playerBodySize: 34,
  playerOffsetX: 15,
  playerOffsetY: 18,
  tileDisplaySize: 40,
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
