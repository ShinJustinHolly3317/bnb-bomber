#!/usr/bin/env python3
"""像素風爆爆王素材（32px 角色 / 40px 地圖格，nearest 無 anti-alias）

對照 design-references/pixel-*.png 概念圖。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets'
MANIFEST_OUT = OUT / 'sprite-manifest.json'

TILE = 40
CHAR = 32
WALK = 4
OUTLINE = (24, 18, 16, 255)

# 村10 像素調色盤
P = {
    'grass': (92, 168, 48, 255),
    'grass_lo': (72, 136, 32, 255),
    'stud': (112, 192, 64, 255),
    'stud_hi': (160, 216, 96, 255),
    'road': (176, 176, 176, 255),
    'road_lo': (136, 136, 136, 255),
    'dash': (248, 248, 248, 255),
    'wall': (88, 56, 40, 255),
    'wall_hi': (120, 80, 56, 255),
    'wall_lo': (56, 36, 24, 255),
    'tree': (32, 120, 40, 255),
    'tree_hi': (56, 152, 56, 255),
    'trunk': (112, 72, 40, 255),
    'crate': (216, 144, 48, 255),
    'crate_hi': (232, 176, 80, 255),
    'crate_lo': (176, 112, 32, 255),
    'roof_r': (224, 72, 48, 255),
    'roof_r_hi': (248, 120, 80, 255),
    'wall_h': (240, 192, 120, 255),
    'roof_b': (56, 128, 208, 255),
    'roof_b_hi': (96, 168, 240, 255),
    'wall_b': (184, 216, 248, 255),
    'win': (152, 208, 248, 255),
    'bubble': (32, 136, 224, 255),
    'bubble_hi': (200, 232, 255, 255),
    'bubble_lo': (16, 80, 160, 255),
    'skin': (255, 224, 192, 255),
    'dao': (40, 96, 208, 255),
    'dao_hi': (72, 144, 240, 255),
    'bazzi': (208, 48, 40, 255),
    'bazzi_hi': (240, 96, 80, 255),
    'maro': (248, 208, 48, 255),
    'maro_hi': (255, 232, 120, 255),
    'maro_cap': (208, 40, 32, 255),
    'nana': (240, 120, 176, 255),
    'nana_hi': (255, 168, 208, 255),
    'nana_hair': (248, 184, 208, 255),
    'white': (255, 255, 255, 255),
    'black': (24, 18, 16, 255),
    'goggle': (200, 200, 208, 255),
    'ui_bg': (144, 200, 232, 255),
    'ui_panel': (96, 64, 40, 255),
    'ui_panel_hi': (128, 88, 56, 255),
    'ui_panel_lo': (64, 40, 24, 255),
    'btn_green': (72, 168, 56, 255),
    'btn_blue': (56, 120, 208, 255),
    'btn_gray': (136, 136, 136, 255),
}


class Grid:
    """整數像素格，禁止 anti-alias"""

    def __init__(self, w: int, h: int) -> None:
        self.w, self.h = w, h
        self.data = [[(0, 0, 0, 0) for _ in range(w)] for _ in range(h)]

    def set(self, x: int, y: int, c: tuple[int, int, int, int]) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.data[y][x] = c

    def rect(self, x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int, int]) -> None:
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                self.set(x, y, c)

    def outline_rect(self, x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int, int]) -> None:
        for x in range(x0, x1 + 1):
            self.set(x, y0, c)
            self.set(x, y1, c)
        for y in range(y0, y1 + 1):
            self.set(x0, y, c)
            self.set(x1, y, c)

    def ellipse(self, cx: int, cy: int, rx: int, ry: int, c: tuple[int, int, int, int]) -> None:
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                dx = (x - cx) / max(rx, 1)
                dy = (y - cy) / max(ry, 1)
                if dx * dx + dy * dy <= 1.0:
                    self.set(x, y, c)

    def to_image(self) -> Image.Image:
        img = Image.new('RGBA', (self.w, self.h))
        px = img.load()
        for y in range(self.h):
            for x in range(self.w):
                px[x, y] = self.data[y][x]
        return img


def upscale(img: Image.Image, factor: int) -> Image.Image:
    w, h = img.size
    return img.resize((w * factor, h * factor), Image.Resampling.NEAREST)


# ---------------------------------------------------------------- tiles (40×40)


def tile_grass() -> Image.Image:
    g = Grid(TILE, TILE)
    g.rect(0, 0, TILE - 1, TILE - 1, P['grass'])
    g.rect(0, TILE - 2, TILE - 1, TILE - 1, P['grass_lo'])
    g.rect(TILE - 2, 0, TILE - 1, TILE - 1, P['grass_lo'])
    for row in range(2):
        for col in range(2):
            cx, cy = col * 20 + 10, row * 20 + 10
            g.ellipse(cx, cy, 8, 8, P['stud'])
            g.ellipse(cx - 2, cy - 3, 4, 3, P['stud_hi'])
    return g.to_image()


def tile_road() -> Image.Image:
    g = Grid(TILE, TILE)
    g.rect(0, 0, TILE - 1, TILE - 1, P['road'])
    g.rect(0, 0, 3, TILE - 1, P['road_lo'])
    g.rect(TILE - 4, 0, TILE - 1, TILE - 1, P['road_lo'])
    cx = TILE // 2
    for y in range(2, TILE - 2, 10):
        g.rect(cx - 2, y, cx + 2, y + 5, P['dash'])
    return g.to_image()


def tile_wall() -> Image.Image:
    g = Grid(TILE, TILE)
    g.rect(0, 0, TILE - 1, TILE - 1, P['wall_lo'])
    for row in range(5):
        off = 4 if row % 2 else 0
        for col in range(3):
            x0 = off + col * 14
            g.rect(x0, row * 8, x0 + 12, row * 8 + 7, P['wall'])
            g.rect(x0 + 1, row * 8 + 1, x0 + 4, row * 8 + 3, P['wall_hi'])
    g.outline_rect(0, 0, TILE - 1, TILE - 1, OUTLINE)
    return g.to_image()


def tile_tree() -> Image.Image:
    g = Grid(TILE, TILE)
    g.rect(0, 0, TILE - 1, TILE - 1, P['grass'])
    g.rect(16, 28, 23, 37, P['trunk'])
    g.outline_rect(16, 28, 23, 37, OUTLINE)
    for cy, rx in ((14, 14), (20, 12), (26, 10)):
        g.ellipse(19, cy, rx, 7, P['tree'])
        g.ellipse(17, cy - 2, rx - 4, 4, P['tree_hi'])
    return g.to_image()


def tile_crate() -> Image.Image:
    g = Grid(TILE, TILE)
    g.rect(0, 0, TILE - 1, TILE - 1, P['grass'])
    g.rect(4, 4, 35, 35, P['crate'])
    g.rect(4, 4, 35, 8, P['crate_hi'])
    g.rect(4, 4, 8, 35, P['crate_hi'])
    g.rect(32, 8, 35, 35, P['crate_lo'])
    g.rect(8, 32, 35, 35, P['crate_lo'])
    for i in range(-28, 32, 4):
        g.rect(4 + i, 4 + i, 8 + i, 8 + i, P['crate_lo'])
        g.rect(35 - i, 4 + i, 31 - i, 8 + i, P['crate_lo'])
    g.outline_rect(4, 4, 35, 35, OUTLINE)
    return g.to_image()


def tile_house(roof: tuple, roof_hi: tuple, wall: tuple) -> Image.Image:
    g = Grid(TILE, TILE)
    g.rect(0, 0, TILE - 1, TILE - 1, P['grass'])
    g.rect(8, 22, 31, 37, wall)
    g.outline_rect(8, 22, 31, 37, OUTLINE)
    g.rect(14, 26, 25, 34, P['white'])
    g.rect(16, 28, 23, 32, P['win'])
    g.rect(19, 26, 21, 34, P['white'])
    g.rect(14, 30, 25, 32, P['white'])
    g.rect(4, 6, 35, 22, roof)
    g.rect(4, 18, 35, 22, tuple(int(c * 0.75) for c in roof[:3]) + (255,))
    for cx in (12, 20, 28):
        g.rect(cx - 3, 10, cx + 3, 16, roof_hi)
        g.rect(cx - 2, 11, cx + 2, 14, roof)
    g.outline_rect(4, 6, 35, 22, OUTLINE)
    return g.to_image()


def draw_bubble(size: int = CHAR) -> Image.Image:
    g = Grid(size, size)
    g.ellipse(size // 2, size // 2 + 2, size // 2 - 3, size // 2 - 3, P['bubble_lo'])
    g.ellipse(size // 2, size // 2, size // 2 - 4, size // 2 - 4, P['bubble'])
    g.ellipse(size // 2 - 4, size // 2 - 4, 5, 5, P['bubble_hi'])
    g.ellipse(size // 2, size // 2, size // 2 - 3, size // 2 - 3, P['bubble'])
    g.outline_rect(2, 4, size - 3, size - 3, OUTLINE)
    return g.to_image()


def draw_explosion_sheet() -> Image.Image:
    sheet = Image.new('RGBA', (CHAR * 4, CHAR), (0, 0, 0, 0))
    for i in range(4):
        g = Grid(CHAR, CHAR)
        cx, cy = CHAR // 2, CHAR // 2
        if i == 0:
            g.ellipse(cx, cy, 8, 8, (208, 48, 32, 255))
            g.ellipse(cx, cy, 5, 5, (255, 200, 64, 255))
        else:
            r = 6 + i * 3
            g.ellipse(cx, cy, r, r, (120, 200, 255, 220 - i * 40))
            g.outline_rect(cx - r, cy - r, cx + r, cy + r, (255, 255, 255, 200 - i * 40))
        sheet.paste(g.to_image(), (i * CHAR, 0))
    return sheet


def draw_item(kind: str) -> Image.Image:
    g = Grid(CHAR, CHAR)
    if kind == 'speed':
        pts = [(16, 4), (26, 16), (16, 28), (6, 16)]
        for i in range(4):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % 4]
            for t in range(20):
                x = int(x0 + (x1 - x0) * t / 20)
                y = int(y0 + (y1 - y0) * t / 20)
                g.rect(x - 1, y - 1, x + 1, y + 1, (255, 224, 64, 255))
        g.rect(14, 14, 18, 18, (255, 176, 0, 255))
    elif kind == 'power':
        g.ellipse(16, 16, 12, 12, (255, 88, 32, 255))
        g.rect(14, 8, 18, 24, P['white'])
        g.rect(8, 14, 24, 18, P['white'])
    else:
        return draw_bubble(CHAR)
    g.outline_rect(2, 2, CHAR - 3, CHAR - 3, OUTLINE)
    return g.to_image()


# ---------------------------------------------------------------- characters (32×32)


def _feet(g: Grid, cx: int, color: tuple, facing: str, phase: int) -> None:
    if facing in ('down', 'up'):
        g.ellipse(cx - 6, 28 + phase, 3, 2, color)
        g.ellipse(cx + 6, 28 - phase, 3, 2, color)
    else:
        s = 1 if facing == 'right' else -1
        g.ellipse(cx + s * 4 + phase, 28, 3, 2, color)
        g.ellipse(cx - s * 2 - phase, 28, 3, 2, color)


def _body_block(g: Grid, cx: int, color: tuple, facing: str, phase: int) -> None:
    g.rect(cx - 5, 20, cx + 5, 28, color)
    g.outline_rect(cx - 5, 20, cx + 5, 28, OUTLINE)
    if facing in ('down', 'up'):
        g.rect(cx - 8, 22 - phase, cx - 5, 26 - phase, color)
        g.rect(cx + 5, 22 + phase, cx + 8, 26 + phase, color)
    else:
        g.rect(cx - 2, 22 + phase, cx + 2, 26 + phase, color)


def _dao_head(g: Grid, cx: int, top: int, facing: str) -> None:
    if facing == 'up':
        g.ellipse(cx, top + 10, 11, 11, P['dao'])
        g.ellipse(cx - 6, top + 4, 5, 4, P['dao'])
        g.ellipse(cx + 6, top + 4, 5, 4, P['dao'])
        g.ellipse(cx - 4, top + 8, 4, 4, P['dao_hi'])
        return
    if facing == 'down':
        g.ellipse(cx, top + 10, 11, 11, P['dao'])
        g.ellipse(cx - 6, top + 4, 5, 4, P['dao'])
        g.ellipse(cx + 6, top + 4, 5, 4, P['dao'])
        g.ellipse(cx, top + 12, 8, 7, P['skin'])
        g.rect(cx - 5, top + 11, cx - 2, top + 14, P['black'])
        g.rect(cx + 2, top + 11, cx + 5, top + 14, P['black'])
        g.set(cx - 4, top + 12, P['white'])
        g.set(cx + 3, top + 12, P['white'])
        g.rect(cx - 2, top + 16, cx + 2, top + 17, P['black'])
        return
    s = 1 if facing == 'right' else -1
    g.ellipse(cx, top + 10, 11, 11, P['dao'])
    g.ellipse(cx - s * 8, top + 4, 5, 4, P['dao'])
    fx = cx + s * 3
    g.ellipse(fx, top + 12, 5, 6, P['skin'])
    g.rect(fx + s * 1, top + 12, fx + s * 3, top + 15, P['black'])
    g.set(fx + s * 2, top + 13, P['white'])


def _bazzi_head(g: Grid, cx: int, top: int, facing: str) -> None:
    if facing == 'up':
        g.ellipse(cx, top + 10, 11, 11, P['bazzi'])
        g.rect(cx - 9, top + 8, cx + 9, top + 10, P['white'])
        return
    if facing == 'down':
        g.ellipse(cx, top + 10, 11, 11, P['bazzi'])
        g.rect(cx - 9, top + 7, cx + 9, top + 9, P['white'])
        for gx in (cx - 5, cx + 5):
            g.ellipse(gx, top + 6, 4, 3, P['goggle'])
            g.rect(gx - 1, top + 6, gx + 1, top + 8, P['win'])
        g.ellipse(cx, top + 13, 7, 6, P['skin'])
        for ex in (cx - 4, cx + 4):
            g.rect(ex - 2, top + 13, ex + 2, top + 14, P['black'])
        g.rect(cx - 1, top + 17, cx + 1, top + 18, P['black'])
        return
    s = 1 if facing == 'right' else -1
    g.ellipse(cx, top + 10, 11, 11, P['bazzi'])
    g.rect(cx - 9, top + 7, cx + 9, top + 9, P['white'])
    gx = cx + s * 6
    g.ellipse(gx, top + 6, 4, 3, P['goggle'])
    g.ellipse(cx + s * 3, top + 13, 5, 6, P['skin'])
    g.rect(cx + s * 4, top + 13, cx + s * 6, top + 14, P['black'])


def _maro_head(g: Grid, cx: int, top: int, facing: str) -> None:
    if facing == 'up':
        g.ellipse(cx, top + 11, 11, 11, P['maro'])
        g.rect(cx - 4, top + 2, cx + 4, top + 6, P['maro_cap'])
        g.outline_rect(cx - 4, top + 2, cx + 4, top + 6, OUTLINE)
        return
    if facing == 'down':
        g.ellipse(cx, top + 11, 11, 11, P['maro'])
        g.rect(cx - 4, top + 2, cx + 4, top + 6, P['maro_cap'])
        g.outline_rect(cx - 4, top + 2, cx + 4, top + 6, OUTLINE)
        g.ellipse(cx, top + 13, 8, 7, P['skin'])
        g.rect(cx - 4, top + 12, cx - 1, top + 14, P['black'])
        g.rect(cx + 1, top + 12, cx + 4, top + 14, P['black'])
        g.set(cx - 3, top + 13, P['white'])
        g.set(cx + 2, top + 13, P['white'])
        g.rect(cx - 2, top + 16, cx + 2, top + 17, P['black'])
        return
    s = 1 if facing == 'right' else -1
    g.ellipse(cx, top + 11, 11, 11, P['maro'])
    g.rect(cx - 3, top + 2, cx + 3, top + 6, P['maro_cap'])
    g.ellipse(cx + s * 3, top + 13, 5, 6, P['skin'])
    g.rect(cx + s * 4, top + 12, cx + s * 6, top + 14, P['black'])


def _nana_head(g: Grid, cx: int, top: int, facing: str) -> None:
    if facing == 'up':
        g.ellipse(cx, top + 10, 10, 10, P['nana'])
        g.rect(cx - 12, top + 8, cx - 7, top + 18, P['nana_hair'])
        g.rect(cx + 7, top + 8, cx + 12, top + 18, P['nana_hair'])
        return
    if facing == 'down':
        g.ellipse(cx - 10, top + 6, 4, 8, P['nana_hair'])
        g.ellipse(cx + 10, top + 6, 4, 8, P['nana_hair'])
        g.ellipse(cx, top + 11, 10, 10, P['nana'])
        g.ellipse(cx, top + 13, 7, 6, P['skin'])
        g.rect(cx - 4, top + 12, cx - 1, top + 14, P['black'])
        g.rect(cx + 1, top + 12, cx + 4, top + 14, P['black'])
        g.set(cx - 3, top + 13, P['white'])
        g.set(cx + 2, top + 13, P['white'])
        g.rect(cx - 1, top + 16, cx + 1, top + 17, (240, 96, 128, 255))
        return
    s = 1 if facing == 'right' else -1
    tail_x = cx - s * 10
    g.rect(tail_x, top + 6, tail_x + s * 4, top + 16, P['nana_hair'])
    g.ellipse(cx, top + 11, 10, 10, P['nana'])
    g.ellipse(cx + s * 3, top + 13, 5, 6, P['skin'])
    g.rect(cx + s * 4, top + 12, cx + s * 6, top + 14, P['black'])


HEAD_DRAW: dict[str, Callable] = {
    'dao': _dao_head,
    'bazzi': _bazzi_head,
    'maro': _maro_head,
    'nana': _nana_head,
}

BODY_COLOR: dict[str, tuple] = {
    'dao': P['dao'],
    'bazzi': P['bazzi'],
    'maro': P['maro'],
    'nana': P['nana'],
}


def draw_character_frame(char: str, facing: str, step: int) -> Image.Image:
    g = Grid(CHAR, CHAR)
    cx = CHAR // 2
    phase = (0, 1, 0, -1)[step % 4]
    bob = -1 if step % 2 else 0
    color = BODY_COLOR[char]
    _feet(g, cx, color, facing, phase)
    _body_block(g, cx, color, facing, phase)
    HEAD_DRAW[char](g, cx, 2 + bob, facing)
    return g.to_image()


def build_player_sheet(char: str) -> Image.Image:
    facings = ['down', 'up', 'left', 'right']
    sheet = Image.new('RGBA', (CHAR * WALK, CHAR * 4), (0, 0, 0, 0))
    for row, facing in enumerate(facings):
        for col in range(WALK):
            sheet.paste(draw_character_frame(char, facing, col), (col * CHAR, row * CHAR))
    return sheet


def portrait(char: str) -> Image.Image:
    return draw_character_frame(char, 'down', 0)


# ---------------------------------------------------------------- lobby UI chrome


def ui_panel(w: int, h: int) -> Image.Image:
    g = Grid(w, h)
    g.rect(0, 0, w - 1, h - 1, P['ui_panel_hi'])
    g.rect(2, 2, w - 3, h - 3, P['ui_panel'])
    g.rect(4, 4, w - 5, h - 5, (72, 48, 32, 255))
    g.outline_rect(0, 0, w - 1, h - 1, OUTLINE)
    g.outline_rect(2, 2, w - 3, h - 3, P['ui_panel_lo'])
    return g.to_image()


def ui_button(label_color: tuple, w: int = 120, h: int = 32) -> Image.Image:
    g = Grid(w, h)
    g.rect(0, 0, w - 1, h - 1, label_color)
    g.rect(2, 2, w - 3, h // 2, tuple(min(255, c + 30) for c in label_color[:3]) + (255,))
    g.rect(2, h // 2, w - 3, h - 3, tuple(max(0, c - 20) for c in label_color[:3]) + (255,))
    g.outline_rect(0, 0, w - 1, h - 1, OUTLINE)
    return g.to_image()


def ui_slot() -> Image.Image:
    g = Grid(72, 88)
    g.rect(0, 0, 71, 87, P['ui_panel'])
    g.rect(4, 4, 67, 67, (48, 32, 24, 255))
    g.outline_rect(0, 0, 71, 87, OUTLINE)
    g.rect(20, 72, 51, 83, (56, 40, 28, 255))
    return g.to_image()


def write_manifest() -> None:
    data = {
        'source': 'pixel',
        'characterFrameWidth': CHAR,
        'characterFrameHeight': CHAR,
        'walkFramesPerDirection': WALK,
        'explosionFrameWidth': CHAR,
        'explosionFrameHeight': CHAR,
        'explosionFrames': 4,
        'playerBodySize': 18,
        'playerOffsetX': 7,
        'playerOffsetY': 10,
        'tileDisplaySize': TILE,
    }
    MANIFEST_OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    tile_grass().save(OUT / 'tile_grass.png')
    tile_road().save(OUT / 'tile_road.png')
    tile_wall().save(OUT / 'tile_wall.png')
    tile_tree().save(OUT / 'tile_tree.png')
    tile_crate().save(OUT / 'tile_crate.png')
    tile_house(P['roof_r'], P['roof_r_hi'], P['wall_h']).save(OUT / 'tile_house_red.png')
    tile_house(P['roof_b'], P['roof_b_hi'], P['wall_b']).save(OUT / 'tile_house_blue.png')

    draw_bubble(CHAR).save(OUT / 'bubble.png')
    draw_explosion_sheet().save(OUT / 'explosion.png')
    draw_item('speed').save(OUT / 'item_speed.png')
    draw_item('power').save(OUT / 'item_power.png')
    draw_item('bubble').save(OUT / 'item_bubble.png')

    build_player_sheet('dao').save(OUT / 'player_blue.png')
    build_player_sheet('bazzi').save(OUT / 'player_red.png')
    build_player_sheet('maro').save(OUT / 'player_yellow.png')
    build_player_sheet('nana').save(OUT / 'player_pink.png')

    portrait('dao').save(OUT / 'portrait_dao.png')
    portrait('bazzi').save(OUT / 'portrait_bazzi.png')
    portrait('maro').save(OUT / 'portrait_maro.png')
    portrait('nana').save(OUT / 'portrait_nana.png')

    ui_panel(400, 300).save(OUT / 'ui_panel_large.png')
    ui_panel(280, 360).save(OUT / 'ui_panel_side.png')
    ui_button(P['btn_green']).save(OUT / 'ui_btn_green.png')
    ui_button(P['btn_blue']).save(OUT / 'ui_btn_blue.png')
    ui_button(P['btn_gray']).save(OUT / 'ui_btn_gray.png')
    ui_slot().save(OUT / 'ui_slot.png')

    write_manifest()
    print(f'pixel 素材完成 → {OUT}')


if __name__ == '__main__':
    main()
