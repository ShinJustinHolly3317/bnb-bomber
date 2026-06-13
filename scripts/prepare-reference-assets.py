#!/usr/bin/env python3
"""從 reference-village10.png 與 design-references 截圖萃取遊戲素材（村10 視覺）"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REF_MAP = ROOT / 'reference-village10.png'
REF_CHARS = ROOT / 'design-references' / 'characters' / 'official_beanfun_characters.png'
OUT = ROOT / 'public' / 'assets'
MANIFEST_OUT = OUT / 'sprite-manifest.json'

# reference-village10.png (612×531) 手動標定中心點
REF_CENTERS: dict[str, tuple[int, int]] = {
    'grass': (34, 95),
    'road': (295, 280),
    'wall': (170, 45),
    'tree': (226, 28),
    'crate': (190, 55),
    'house_red': (430, 95),
    'house_blue': (420, 410),
    'bubble': (278, 102),
    'explosion': (305, 298),
}

# beanfun 角色介紹頁裁切（睏寶 / 藍寶）
BEANFUN_PORTRAITS = {
    'bazzi': (40, 115, 130, 205),
    'dao': (360, 115, 450, 205),
}

TILE_PX = 39
TILE_OUT = 64
SPRITE_FRAME = 40
WALK_FRAMES = 4


def crop_center(ref: Image.Image, cx: int, cy: int, size: int = TILE_PX) -> Image.Image:
    return ref.crop((cx - size // 2, cy - size // 2, cx - size // 2 + size, cy - size // 2 + size))


def resize_tile(img: Image.Image, size: int = TILE_OUT) -> Image.Image:
    return img.convert('RGBA').resize((size, size), Image.Resampling.LANCZOS)


def resize_center(img: Image.Image, size: int) -> Image.Image:
    img = img.convert('RGBA')
    w, h = img.size
    scale = min(size / w, size / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def extract_tiles(ref: Image.Image) -> None:
    mapping = {
        'grass': 'tile_grass.png',
        'road': 'tile_road.png',
        'wall': 'tile_wall.png',
        'tree': 'tile_tree.png',
        'crate': 'tile_crate.png',
        'house_red': 'tile_house_red.png',
        'house_blue': 'tile_house_blue.png',
    }
    for key, dest in mapping.items():
        cx, cy = REF_CENTERS[key]
        resize_tile(crop_center(ref, cx, cy)).save(OUT / dest)


def extract_effects(ref: Image.Image) -> None:
    bx, by = REF_CENTERS['bubble']
    resize_center(crop_center(ref, bx, by, 42), SPRITE_FRAME).save(OUT / 'bubble.png')

    ex, ey = REF_CENTERS['explosion']
    red = crop_center(ref, ex, ey, 42)
    sheet = Image.new('RGBA', (SPRITE_FRAME * 4, SPRITE_FRAME), (0, 0, 0, 0))
    for i in range(4):
        frame = resize_center(red, SPRITE_FRAME)
        sheet.paste(frame, (i * SPRITE_FRAME, 0), frame)
    sheet.save(OUT / 'explosion.png')

    potion = ref.crop((520, 470, 580, 520))
    icon = resize_center(potion, SPRITE_FRAME)
    icon.save(OUT / 'item_speed.png')
    icon.save(OUT / 'item_bubble.png')
    power = resize_center(crop_center(ref, *REF_CENTERS['house_red']), SPRITE_FRAME)
    power.save(OUT / 'item_power.png')


def orient_frame(frame: Image.Image, direction: str) -> Image.Image:
    if direction == 'down':
        return frame
    if direction == 'up':
        return frame.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    if direction == 'left':
        return frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return frame


def build_player_sheet(base: Image.Image, dest: str) -> None:
    cell = resize_center(base, SPRITE_FRAME)
    directions = ['down', 'up', 'left', 'right']
    sheet = Image.new('RGBA', (SPRITE_FRAME * WALK_FRAMES, SPRITE_FRAME * 4), (0, 0, 0, 0))
    for row, direction in enumerate(directions):
        oriented = orient_frame(cell, direction)
        for col in range(WALK_FRAMES):
            wobble = Image.new('RGBA', (SPRITE_FRAME, SPRITE_FRAME), (0, 0, 0, 0))
            ox = (col % 2) * 2 - 1
            oy = (col // 2) % 2
            wobble.paste(oriented, (ox, oy), oriented)
            sheet.paste(wobble, (col * SPRITE_FRAME, row * SPRITE_FRAME), wobble)
    sheet.save(OUT / dest)


def extract_characters(beanfun: Image.Image | None) -> None:
    if beanfun:
        x1, y1, x2, y2 = BEANFUN_PORTRAITS['dao']
        dao = beanfun.crop((x1, y1, x2, y2))
        x1, y1, x2, y2 = BEANFUN_PORTRAITS['bazzi']
        bazzi = beanfun.crop((x1, y1, x2, y2))
        build_player_sheet(dao, 'player_blue.png')
        build_player_sheet(bazzi, 'player_red.png')
        return

    ref = Image.open(REF_MAP).convert('RGBA')
    build_player_sheet(crop_center(ref, 305, 118), 'player_blue.png')
    build_player_sheet(crop_center(ref, 305, 298), 'player_red.png')


def write_manifest() -> None:
    runtime = {
        'source': 'reference',
        'characterFrameWidth': SPRITE_FRAME,
        'characterFrameHeight': SPRITE_FRAME,
        'walkFramesPerDirection': WALK_FRAMES,
        'explosionFrameWidth': SPRITE_FRAME,
        'explosionFrameHeight': SPRITE_FRAME,
        'explosionFrames': 4,
        'playerBodySize': 22,
        'playerOffsetX': 8,
        'playerOffsetY': 10,
        'tileDisplaySize': TILE_OUT,
    }
    with MANIFEST_OUT.open('w', encoding='utf-8') as f:
        json.dump(runtime, f, indent=2, ensure_ascii=False)


def main() -> None:
    if not REF_MAP.is_file():
        raise SystemExit(f'缺少 {REF_MAP}')

    OUT.mkdir(parents=True, exist_ok=True)
    ref = Image.open(REF_MAP).convert('RGBA')
    beanfun = Image.open(REF_CHARS).convert('RGBA') if REF_CHARS.is_file() else None

    extract_tiles(ref)
    extract_effects(ref)
    extract_characters(beanfun)
    write_manifest()

    print('ok reference assets →', OUT)
    print('  tiles: reference-village10.png')
    print('  chars: official_beanfun (藍寶 / 睏寶)')


if __name__ == '__main__':
    main()
