#!/usr/bin/env python3
"""從 design-references/pixel-*.png 萃取遊戲素材（對齊使用者看到的概念圖）"""
from __future__ import annotations

import json
from pathlib import Path

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))

from bnb_walk_sheets import build_player_sheet, portrait_frame
REF = ROOT / 'design-references'
OUT = ROOT / 'public' / 'assets'
MANIFEST = OUT / 'sprite-manifest.json'

TILE = 40
CHAR = 48
WALK = 4
VIEW_W = 960
VIEW_H = 540

TILE_NAMES = [
    'tile_grass.png',
    'tile_road.png',
    'tile_wall.png',
    'tile_tree.png',
    'tile_crate.png',
    'tile_house_red.png',
    'tile_house_blue.png',
    'bubble.png',
]

CHAR_FILES = {
    'dao': ('player_blue.png', 'portrait_dao.png'),
    'bazzi': ('player_red.png', 'portrait_bazzi.png'),
    'maro': ('player_yellow.png', 'portrait_maro.png'),
    'nana': ('player_pink.png', 'portrait_nana.png'),
}

CHAR_GRID = [('dao', 0, 0), ('bazzi', 1, 0), ('maro', 0, 1), ('nana', 1, 1)]


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert('RGBA')


def nearest(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.Resampling.NEAREST)


def fit_cover_bottom(img: Image.Image, tw: int, th: int) -> Image.Image:
    """裁成目標比例後縮放；垂直以底部對齊，保留大廳底欄按鈕。"""
    target_ratio = tw / th
    w, h = img.size
    src_ratio = w / h
    if src_ratio > target_ratio:
        new_w = int(h * target_ratio)
        x0 = (w - new_w) // 2
        crop = img.crop((x0, 0, x0 + new_w, h))
    else:
        new_h = int(w / target_ratio)
        y0 = h - new_h
        crop = img.crop((0, y0, w, h))
    return crop.resize((tw, th), Image.Resampling.NEAREST)


def fit_cover_center(img: Image.Image, tw: int, th: int) -> Image.Image:
    """裁成目標比例後縮放；置中裁切（角色選單用）。"""
    target_ratio = tw / th
    w, h = img.size
    src_ratio = w / h
    if src_ratio > target_ratio:
        new_w = int(h * target_ratio)
        x0 = (w - new_w) // 2
        crop = img.crop((x0, 0, x0 + new_w, h))
    else:
        new_h = int(w / target_ratio)
        y0 = (h - new_h) // 2
        crop = img.crop((0, y0, w, y0 + new_h))
    return crop.resize((tw, th), Image.Resampling.NEAREST)


def fit_contain(img: Image.Image, tw: int, th: int) -> Image.Image:
    """等比縮放完整概念圖，letterbox 補邊（大廳用，保留頂欄與底欄）。"""
    w, h = img.size
    scale = min(tw / w, th / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((nw, nh), Image.Resampling.NEAREST)
    corners = [
        img.getpixel((0, 0))[:3],
        img.getpixel((w - 1, 0))[:3],
        img.getpixel((0, h - 1))[:3],
        img.getpixel((w - 1, h - 1))[:3],
    ]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    canvas = Image.new('RGBA', (tw, th), (*bg, 255))
    ox, oy = (tw - nw) // 2, (th - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def key_transparent(img: Image.Image, keys: list[tuple[int, int, int]], tol: int = 42) -> Image.Image:
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            for kr, kg, kb in keys:
                if abs(r - kr) <= tol and abs(g - kg) <= tol and abs(b - kb) <= tol:
                    px[x, y] = (r, g, b, 0)
                    break
    return img


def trim_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def crop_char_cell(sheet: Image.Image, col: int, row: int) -> Image.Image:
    w, h = sheet.size
    cw, ch = w // 2, h // 2
    x0, y0 = col * cw, row * ch
    # 避開底部 label 文字
    cell = sheet.crop((x0, y0, x0 + cw, y0 + int(ch * 0.82)))
    cell = key_transparent(cell, [(255, 255, 255), (250, 250, 250)])
    return trim_alpha(cell)


def crop_tile_row(sheet: Image.Image, index: int) -> Image.Image:
    w, h = sheet.size
    tw = w // 8
    pad = max(2, tw // 16)
    x0 = index * tw + pad
    x1 = (index + 1) * tw - pad
    tile = sheet.crop((x0, pad, x1, h - pad))
    tile = key_transparent(tile, [(26, 46, 26), (30, 50, 30), (20, 40, 20)])
    return trim_alpha(tile)


def draw_explosion_sheet() -> Image.Image:
    sheet = Image.new('RGBA', (CHAR * 4, CHAR), (0, 0, 0, 0))
    cx, cy = CHAR // 2, CHAR // 2
    for i in range(4):
        cell = Image.new('RGBA', (CHAR, CHAR), (0, 0, 0, 0))
        px = cell.load()
        r = 6 + i * 4
        for y in range(CHAR):
            for x in range(CHAR):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if d <= r:
                    if i == 0:
                        px[x, y] = (255, 120, 40, 255)
                    elif d >= r - 2:
                        px[x, y] = (255, 255, 255, 220 - i * 40)
                    else:
                        px[x, y] = (100, 180, 255, 200 - i * 45)
        sheet.paste(cell, (i * CHAR, 0))
    return sheet


def draw_item(kind: str) -> Image.Image:
    img = Image.new('RGBA', (CHAR, CHAR), (0, 0, 0, 0))
    px = img.load()
    cx, cy = CHAR // 2, CHAR // 2
    if kind == 'speed':
        for y in range(CHAR):
            for x in range(CHAR):
                if abs(x - cx) + abs(y - cy) <= 10:
                    px[x, y] = (255, 220, 60, 255)
    elif kind == 'power':
        for y in range(CHAR):
            for x in range(CHAR):
                if abs(x - cx) <= 3 and abs(y - cy) <= 12:
                    px[x, y] = (255, 255, 255, 255)
                if abs(y - cy) <= 3 and abs(x - cx) <= 12:
                    px[x, y] = (255, 255, 255, 255)
                if ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 <= 11:
                    px[x, y] = (255, 100, 40, 255)
    else:
        bomb = crop_tile_row(load_rgba(REF / 'pixel-tiles-ref.png'), 7)
        return nearest(bomb, CHAR)
    return img


def write_manifest() -> None:
    data = {
        'source': 'design-reference',
        'characterFrameWidth': CHAR,
        'characterFrameHeight': CHAR,
        'walkFramesPerDirection': WALK,
        'explosionFrameWidth': CHAR,
        'explosionFrameHeight': CHAR,
        'explosionFrames': 4,
        'playerBodySize': 26,
        'playerOffsetX': 11,
        'playerOffsetY': 14,
        'tileDisplaySize': TILE,
    }
    MANIFEST.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')


def patch_char_design_ref(ref_path: Path, portraits: dict[str, Image.Image]) -> None:
    """以新版 sprite 回寫概念圖四格"""
    sheet = load_rgba(ref_path)
    w, h = sheet.size
    cw, ch = w // 2, h // 2
    for name, col, row in CHAR_GRID:
        portrait = portraits[name]
        cell = Image.new('RGBA', (cw, ch), (255, 255, 255, 255))
        usable_h = int(ch * 0.82)
        scale = min((cw - 20) / CHAR, (usable_h - 12) / CHAR)
        nw = max(1, int(CHAR * scale))
        nh = max(1, int(CHAR * scale))
        scaled = portrait.resize((nw, nh), Image.Resampling.NEAREST)
        ox = (cw - nw) // 2
        oy = max(6, (usable_h - nh) // 2)
        cell.paste(scaled, (ox, oy), scaled)
        sheet.paste(cell, (col * cw, row * ch))
    sheet.save(ref_path)


def main() -> None:
    chars_ref = REF / 'pixel-characters-ref.png'
    tiles_ref = REF / 'pixel-tiles-ref.png'
    lobby_ref = REF / 'pixel-lobby-ref.png'

    for p in (chars_ref, tiles_ref, lobby_ref):
        if not p.is_file():
            raise SystemExit(f'缺少概念圖：{p}')

    OUT.mkdir(parents=True, exist_ok=True)
    char_sheet = load_rgba(chars_ref)
    tile_sheet = load_rgba(tiles_ref)
    lobby_img = load_rgba(lobby_ref)

    portraits: dict[str, Image.Image] = {}
    for name, col, row in CHAR_GRID:
        player_file, portrait_file = CHAR_FILES[name]
        build_player_sheet(name, CHAR).save(OUT / player_file)
        portrait = portrait_frame(name, CHAR)
        portrait.save(OUT / portrait_file)
        portraits[name] = portrait

    patch_char_design_ref(chars_ref, portraits)
    char_sheet = load_rgba(chars_ref)

    for i, dest in enumerate(TILE_NAMES):
        nearest(crop_tile_row(tile_sheet, i), TILE).save(OUT / dest)

    draw_explosion_sheet().save(OUT / 'explosion.png')
    draw_item('speed').save(OUT / 'item_speed.png')
    draw_item('power').save(OUT / 'item_power.png')
    draw_item('bubble').save(OUT / 'item_bubble.png')

    fit_contain(lobby_img, VIEW_W, VIEW_H).save(OUT / 'lobby_bg.png')
    fit_cover_center(char_sheet, VIEW_W, VIEW_H).save(OUT / 'menu_bg.png')

    write_manifest()
    print(f'design-reference 素材完成 → {OUT}')


if __name__ == '__main__':
    main()
