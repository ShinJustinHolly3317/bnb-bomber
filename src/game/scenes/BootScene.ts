import Phaser from 'phaser'

import { AnimKeys, AssetKeys } from '../assets/AssetKeys'
import {
  DEFAULT_SPRITE_MANIFEST,
  type SpriteManifest,
  walkAnimStart,
} from '../assets/spriteManifest'

const MANIFEST_KEY = 'sprite-manifest'

function registerWalkAnims(
  scene: Phaser.Scene,
  texture: string,
  prefix: string,
  manifest: SpriteManifest,
): void {
  const n = manifest.walkFramesPerDirection
  const dirs: Array<{ key: string; facing: 'down' | 'up' | 'left' | 'right' }> = [
    { key: AnimKeys.WALK_DOWN, facing: 'down' },
    { key: AnimKeys.WALK_UP, facing: 'up' },
    { key: AnimKeys.WALK_LEFT, facing: 'left' },
    { key: AnimKeys.WALK_RIGHT, facing: 'right' },
  ]

  dirs.forEach(({ key, facing }) => {
    const start = walkAnimStart(facing, n)
    scene.anims.create({
      key: `${prefix}-${key}`,
      frames: scene.anims.generateFrameNumbers(texture, {
        start,
        end: start + n - 1,
      }),
      frameRate: 8,
      repeat: -1,
    })
  })
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    this.load.json(MANIFEST_KEY, '/assets/sprite-manifest.json')
  }

  create(): void {
    const manifest =
      (this.cache.json.get(MANIFEST_KEY) as SpriteManifest | undefined) ??
      DEFAULT_SPRITE_MANIFEST

    this.load.spritesheet(AssetKeys.PLAYER_BLUE, '/assets/player_blue.png', {
      frameWidth: manifest.characterFrameWidth,
      frameHeight: manifest.characterFrameHeight,
    })
    this.load.spritesheet(AssetKeys.PLAYER_RED, '/assets/player_red.png', {
      frameWidth: manifest.characterFrameWidth,
      frameHeight: manifest.characterFrameHeight,
    })
    this.load.image(AssetKeys.TILE_GRASS, '/assets/tile_grass.png')
    this.load.image(AssetKeys.TILE_ROAD, '/assets/tile_road.png')
    this.load.image(AssetKeys.TILE_WALL, '/assets/tile_wall.png')
    this.load.image(AssetKeys.TILE_TREE, '/assets/tile_tree.png')
    this.load.image(AssetKeys.TILE_CRATE, '/assets/tile_crate.png')
    this.load.image(AssetKeys.TILE_HOUSE_RED, '/assets/tile_house_red.png')
    this.load.image(AssetKeys.TILE_HOUSE_BLUE, '/assets/tile_house_blue.png')
    this.load.image(AssetKeys.BUBBLE, '/assets/bubble.png')
    this.load.spritesheet(AssetKeys.EXPLOSION, '/assets/explosion.png', {
      frameWidth: manifest.explosionFrameWidth,
      frameHeight: manifest.explosionFrameHeight,
    })
    this.load.image('item_speed', '/assets/item_speed.png')
    this.load.image('item_power', '/assets/item_power.png')
    this.load.image('item_bubble', '/assets/item_bubble.png')

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.registry.set('spriteManifest', manifest)

      registerWalkAnims(this, AssetKeys.PLAYER_BLUE, 'p1', manifest)
      registerWalkAnims(this, AssetKeys.PLAYER_RED, 'p2', manifest)

      this.anims.create({
        key: 'explode',
        frames: this.anims.generateFrameNumbers(AssetKeys.EXPLOSION, {
          start: 0,
          end: manifest.explosionFrames - 1,
        }),
        frameRate: 12,
        repeat: 0,
      })

      this.scene.start('MenuScene')
    })

    this.load.start()
  }
}
