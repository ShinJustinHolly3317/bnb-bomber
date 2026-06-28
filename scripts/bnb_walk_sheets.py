#!/usr/bin/env python3
"""四方向走路 spritesheet（爆爆王 chibi 步態，每格獨立繪製）"""
from __future__ import annotations

import math
from typing import Callable

from PIL import Image

WALK = 4
OUTLINE = (40, 32, 48, 255)  # OG 深褐描邊

CHAR = 48

# 色票取自 beanfun 官方 game2_*.gif
P = {
    'skin': (255, 220, 176, 255),
    'eye': (32, 24, 40, 255),
    'white': (255, 255, 255, 255),
    'black': (32, 24, 40, 255),
    'shadow': (0, 0, 0, 40),
    # 藍寶 Dao
    'dao': (48, 96, 200, 255),
    'dao_hi': (96, 144, 232, 255),
    'dao_lo': (32, 64, 160, 255),
    'dao_boot': (32, 64, 160, 255),
    # 睏寶 Bazzi
    'bazzi': (224, 64, 56, 255),
    'bazzi_hi': (248, 112, 96, 255),
    'bazzi_boot': (192, 48, 48, 255),
    # 紅寶 Marid（小蜜桃）— 粉蘑菇帽 + 紅衣
    'maro_cap': (248, 112, 168, 255),
    'maro_cap_hi': (255, 160, 200, 255),
    'maro': (216, 48, 64, 255),
    'maro_hi': (240, 80, 96, 255),
    'maro_btn': (255, 208, 48, 255),
    'maro_boot': (192, 40, 56, 255),
    # 囡囡 Uni — 黃衣 + 白兜帽邊 + 奶嘴
    'nana': (248, 192, 48, 255),
    'nana_hi': (255, 224, 96, 255),
    'nana_trim': (255, 255, 255, 255),
    'nana_pacifier': (248, 136, 32, 255),
    'nana_boot': (216, 160, 32, 255),
}

BODY_COLOR: dict[str, tuple] = {
    'dao': P['dao'],
    'bazzi': P['bazzi'],
    'maro': P['maro'],
    'nana': P['nana'],
}


class Grid:
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

    def arc_lower(self, cx: int, cy: int, rx: int, ry: int, c: tuple[int, int, int, int], thick: int = 2) -> None:
        """下弧線（微笑 / 瞇眼）"""
        for deg in range(0, 181, 2):
            rad = math.radians(deg)
            x = int(round(cx + rx * math.cos(rad)))
            y = int(round(cy + ry * math.sin(rad)))
            for t in range(-thick // 2, thick // 2 + 1):
                self.set(x + t, y, c)
                self.set(x, y + t, c)

    def arc_upper(self, cx: int, cy: int, rx: int, ry: int, c: tuple[int, int, int, int], thick: int = 2) -> None:
        """上弧線（可愛笑嘴）"""
        for deg in range(180, 361, 2):
            rad = math.radians(deg)
            x = int(round(cx + rx * math.cos(rad)))
            y = int(round(cy + ry * math.sin(rad)))
            for t in range(-thick // 2, thick // 2 + 1):
                self.set(x + t, y, c)
                self.set(x, y + t, c)

    def to_image(self) -> Image.Image:
        img = Image.new('RGBA', (self.w, self.h))
        px = img.load()
        for y in range(self.h):
            for x in range(self.w):
                px[x, y] = self.data[y][x]
        return img


def _leg_swing(step: int) -> int:
    """0 → 前腳 → 並腳 → 後腳"""
    return (0, 2, 0, -2)[step % WALK]


def _draw_shadow(g: Grid, cx: int) -> None:
    g.ellipse(cx, 44, 10, 3, P['shadow'])


def _outline_ellipse(g: Grid, cx: int, cy: int, rx: int, ry: int, c: tuple[int, int, int, int]) -> None:
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(cx - rx - 1, cx + rx + 2):
            dx = (x - cx) / max(rx, 1)
            dy = (y - cy) / max(ry, 1)
            d = dx * dx + dy * dy
            if 1.0 < d <= 1.28:
                g.set(x, y, c)


def _og_feet(g: Grid, cx: int, facing: str, step: int, boot: tuple) -> None:
    swing = _leg_swing(step)
    if facing == 'down':
        for fx, sy in ((cx - 7, 42 + swing), (cx + 7, 42 - swing)):
            g.ellipse(fx, sy, 3, 2, boot)
            _outline_ellipse(g, fx, sy, 3, 2, OUTLINE)
    elif facing == 'up':
        for fx, sy in ((cx - 6, 43 - swing), (cx + 6, 43 + swing)):
            g.ellipse(fx, sy, 2, 2, boot)
    elif facing == 'right':
        g.ellipse(cx + 5 + swing, 41, 3, 2, boot)
        g.ellipse(cx - 5 - swing, 41, 3, 2, boot)
    else:
        g.ellipse(cx - 5 - swing, 41, 3, 2, boot)
        g.ellipse(cx + 5 + swing, 41, 3, 2, boot)


def _og_gloves(g: Grid, cx: int, facing: str, step: int, color: tuple) -> None:
    """OG 白手套（藍寶）"""
    swing = _leg_swing(step)
    if facing in ('down', 'up'):
        for side, sx in ((-1, cx - 11), (1, cx + 7)):
            g.ellipse(sx + 2, 35 - swing * side, 3, 3, color)
            _outline_ellipse(g, sx + 2, 35 - swing * side, 3, 3, OUTLINE)
    elif facing == 'right':
        g.ellipse(cx + 8, 36 + swing, 3, 3, color)
    else:
        g.ellipse(cx - 8, 36 + swing, 3, 3, color)


def _og_body_simple(g: Grid, cx: int, facing: str, step: int, color: tuple, hi: tuple) -> None:
    swing = _leg_swing(step)
    g.ellipse(cx, 35, 8, 7, color)
    _outline_ellipse(g, cx, 35, 8, 7, OUTLINE)
    g.ellipse(cx - 3, 33, 3, 2, hi)
    if facing in ('down', 'up'):
        for side, sx in ((-1, cx - 11), (1, cx + 7)):
            g.ellipse(sx + 2, 34 - swing * side, 2, 3, color)
    elif facing == 'right':
        g.ellipse(cx + 6, 34 + swing, 3, 4, color)
    else:
        g.ellipse(cx - 6, 34 + swing, 3, 4, color)


def _draw_og_eyes(g: Grid, cx: int, top: int, *, side: str = 'both', tall: bool = False) -> None:
    """OG 直向橢圓黑眼"""
    ry = 4 if tall else 3
    if side in ('both', 'down'):
        for ex in (cx - 5, cx + 5):
            g.ellipse(ex, top + 17, 2, ry, P['eye'])
    elif side == 'right':
        g.ellipse(cx + 4, top + 17, 2, ry, P['eye'])
    elif side == 'left':
        g.ellipse(cx - 4, top + 17, 2, ry, P['eye'])


def _draw_og_brows(g: Grid, cx: int, top: int, color: tuple) -> None:
    g.rect(cx - 7, top + 14, cx - 3, top + 15, color)
    g.rect(cx + 3, top + 14, cx + 7, top + 15, color)


def _draw_sleepy_eyes(g: Grid, cx: int, top: int, facing: str) -> None:
    """睏寶 OG 半閉眼"""
    if facing == 'down':
        for ex in (cx - 5, cx + 5):
            g.rect(ex - 2, top + 15, ex + 2, top + 17, P['bazzi'])
            g.rect(ex - 2, top + 17, ex + 2, top + 18, P['eye'])
            g.set(ex, top + 18, P['eye'])
        g.ellipse(cx, top + 21, 2, 2, P['eye'])
        return
    if facing == 'up':
        return
    s = 1 if facing == 'right' else -1
    ex = cx + s * 4
    g.rect(ex - 2, top + 15, ex + 2, top + 17, P['bazzi'])
    g.rect(ex - 2, top + 17, ex + 2, top + 18, P['eye'])


# ── 藍寶 Dao ──────────────────────────────────────────

def _dao_hood(g: Grid, cx: int, top: int, facing: str) -> None:
    """OG 水滴兜帽 + 兩側圓耳"""
    if facing == 'down':
        g.ellipse(cx, top + 14, 14, 14, P['dao'])
        g.ellipse(cx - 11, top + 12, 4, 4, P['dao'])
        g.ellipse(cx + 11, top + 12, 4, 4, P['dao'])
        for dy in range(4):
            w = max(0, 2 - dy // 2)
            for dx in range(-w, w + 1):
                g.set(cx + dx, top + 2 + dy, P['dao'])
        g.ellipse(cx - 5, top + 10, 6, 5, P['dao_hi'])
        _outline_ellipse(g, cx, top + 14, 14, 14, OUTLINE)
        return
    if facing == 'up':
        g.ellipse(cx, top + 14, 14, 14, P['dao'])
        g.ellipse(cx - 11, top + 12, 4, 4, P['dao'])
        g.ellipse(cx + 11, top + 12, 4, 4, P['dao'])
        g.set(cx, top + 2, P['dao'])
        _outline_ellipse(g, cx, top + 14, 14, 14, OUTLINE)
        return
    s = 1 if facing == 'right' else -1
    g.ellipse(cx, top + 14, 13, 14, P['dao'])
    g.ellipse(cx - s * 10, top + 12, 4, 4, P['dao'])
    g.set(cx + s, top + 2, P['dao'])
    _outline_ellipse(g, cx, top + 14, 13, 14, OUTLINE)


def _dao_head(g: Grid, cx: int, top: int, facing: str) -> None:
    _dao_hood(g, cx, top, facing)
    if facing == 'down':
        g.ellipse(cx, top + 19, 8, 7, P['skin'])
        _outline_ellipse(g, cx, top + 19, 8, 7, OUTLINE)
        _draw_og_brows(g, cx, top, P['dao_lo'])
        _draw_og_eyes(g, cx, top, side='down', tall=True)
    elif facing == 'up':
        g.ellipse(cx - 3, top + 15, 4, 3, P['dao_hi'])
    else:
        s = 1 if facing == 'right' else -1
        fx = cx + s * 4
        g.ellipse(fx, top + 19, 6, 7, P['skin'])
        _outline_ellipse(g, fx, top + 19, 6, 7, OUTLINE)
        g.rect(fx + s, top + 14, fx + s * 4, top + 15, P['dao_lo'])
        _draw_og_eyes(g, cx, top, side='right' if s > 0 else 'left', tall=True)


def _dao_frame(g: Grid, cx: int, facing: str, step: int) -> None:
    _og_feet(g, cx, facing, step, P['dao_boot'])
    _og_body_simple(g, cx, facing, step, P['dao'], P['dao_hi'])
    _og_gloves(g, cx, facing, step, P['white'])


# ── 睏寶 Bazzi ────────────────────────────────────────

def _bazzi_hood(g: Grid, cx: int, top: int, facing: str) -> None:
    """OG 紅色連帽 + 熊耳"""
    if facing == 'down':
        g.ellipse(cx, top + 14, 14, 15, P['bazzi'])
        for ex in (cx - 12, cx + 12):
            g.ellipse(ex, top + 5, 4, 5, P['bazzi'])
            _outline_ellipse(g, ex, top + 5, 4, 5, OUTLINE)
        g.ellipse(cx - 5, top + 10, 6, 5, P['bazzi_hi'])
        _outline_ellipse(g, cx, top + 14, 14, 15, OUTLINE)
        return
    if facing == 'up':
        g.ellipse(cx, top + 14, 14, 14, P['bazzi'])
        for ex in (cx - 12, cx + 12):
            g.ellipse(ex, top + 6, 4, 4, P['bazzi'])
        _outline_ellipse(g, cx, top + 14, 14, 14, OUTLINE)
        return
    s = 1 if facing == 'right' else -1
    g.ellipse(cx, top + 14, 13, 15, P['bazzi'])
    ear = cx - s * 12
    g.ellipse(ear, top + 5, 4, 5, P['bazzi'])
    _outline_ellipse(g, cx, top + 14, 13, 15, OUTLINE)
    _outline_ellipse(g, ear, top + 5, 4, 5, OUTLINE)


def _bazzi_head(g: Grid, cx: int, top: int, facing: str) -> None:
    _bazzi_hood(g, cx, top, facing)
    if facing == 'down':
        g.ellipse(cx, top + 19, 8, 7, P['skin'])
        _outline_ellipse(g, cx, top + 19, 8, 7, OUTLINE)
        _draw_sleepy_eyes(g, cx, top, facing)
    elif facing == 'up':
        g.ellipse(cx - 3, top + 15, 4, 3, P['bazzi_hi'])
    else:
        s = 1 if facing == 'right' else -1
        fx = cx + s * 4
        g.ellipse(fx, top + 19, 5, 7, P['skin'])
        _outline_ellipse(g, fx, top + 19, 5, 7, OUTLINE)
        _draw_sleepy_eyes(g, cx, top, facing)


def _bazzi_frame(g: Grid, cx: int, facing: str, step: int) -> None:
    _og_feet(g, cx, facing, step, P['bazzi_boot'])
    _og_body_simple(g, cx, facing, step, P['bazzi'], P['bazzi_hi'])


# ── 紅寶 Marid（小蜜桃）────────────────────────────────

def _maro_cap(g: Grid, cx: int, top: int, facing: str) -> None:
    """OG 粉紅蘑菇帽"""
    if facing == 'down':
        g.ellipse(cx, top + 8, 15, 8, P['maro_cap'])
        g.ellipse(cx - 6, top + 7, 6, 4, P['maro_cap_hi'])
        _outline_ellipse(g, cx, top + 8, 15, 8, OUTLINE)
        return
    if facing == 'up':
        g.ellipse(cx, top + 8, 15, 8, P['maro_cap'])
        _outline_ellipse(g, cx, top + 8, 15, 8, OUTLINE)
        return
    s = 1 if facing == 'right' else -1
    g.ellipse(cx, top + 8, 14, 8, P['maro_cap'])
    g.ellipse(cx - s * 5, top + 7, 5, 4, P['maro_cap_hi'])
    _outline_ellipse(g, cx, top + 8, 14, 8, OUTLINE)


def _maro_head(g: Grid, cx: int, top: int, facing: str) -> None:
    _maro_cap(g, cx, top, facing)
    if facing == 'down':
        g.ellipse(cx, top + 19, 8, 7, P['skin'])
        _outline_ellipse(g, cx, top + 19, 8, 7, OUTLINE)
        _draw_og_eyes(g, cx, top, side='down')
        g.ellipse(cx, top + 22, 2, 1, P['eye'])
    elif facing == 'up':
        g.ellipse(cx - 3, top + 16, 4, 3, P['maro_cap_hi'])
    else:
        s = 1 if facing == 'right' else -1
        fx = cx + s * 4
        g.ellipse(fx, top + 19, 5, 7, P['skin'])
        _outline_ellipse(g, fx, top + 19, 5, 7, OUTLINE)
        _draw_og_eyes(g, cx, top, side='right' if s > 0 else 'left')


def _maro_body(g: Grid, cx: int, facing: str, step: int) -> None:
    """OG 紅衣 + 兩顆黃扣"""
    swing = _leg_swing(step)
    g.ellipse(cx, 35, 8, 7, P['maro'])
    _outline_ellipse(g, cx, 35, 8, 7, OUTLINE)
    if facing in ('down', 'up'):
        g.ellipse(cx - 3, 34, 2, 2, P['maro_btn'])
        g.ellipse(cx + 3, 34, 2, 2, P['maro_btn'])
        for side, sx in ((-1, cx - 11), (1, cx + 7)):
            g.ellipse(sx + 2, 34 - swing * side, 2, 3, P['maro'])
    elif facing == 'right':
        g.ellipse(cx + 6, 34 + swing, 3, 4, P['maro'])
        g.ellipse(cx + 4, 35, 2, 2, P['maro_btn'])
    else:
        g.ellipse(cx - 6, 34 + swing, 3, 4, P['maro'])
        g.ellipse(cx - 4, 35, 2, 2, P['maro_btn'])


def _maro_frame(g: Grid, cx: int, facing: str, step: int) -> None:
    _og_feet(g, cx, facing, step, P['maro_boot'])
    _maro_body(g, cx, facing, step)


# ── 囡囡 Uni ────────────────────────────────────────────

def _nana_hood(g: Grid, cx: int, top: int, facing: str) -> None:
    """OG 黃色連帽 + 白邊"""
    if facing == 'down':
        g.ellipse(cx, top + 14, 14, 14, P['nana'])
        g.ellipse(cx - 5, top + 10, 6, 5, P['nana_hi'])
        g.ellipse(cx, top + 19, 9, 8, P['nana_trim'])
        _outline_ellipse(g, cx, top + 14, 14, 14, OUTLINE)
        return
    if facing == 'up':
        g.ellipse(cx, top + 14, 14, 14, P['nana'])
        _outline_ellipse(g, cx, top + 14, 14, 14, OUTLINE)
        return
    s = 1 if facing == 'right' else -1
    g.ellipse(cx, top + 14, 13, 14, P['nana'])
    g.ellipse(cx - s * 4, top + 10, 5, 5, P['nana_hi'])
    _outline_ellipse(g, cx, top + 14, 13, 14, OUTLINE)


def _nana_head(g: Grid, cx: int, top: int, facing: str) -> None:
    _nana_hood(g, cx, top, facing)
    if facing == 'down':
        g.ellipse(cx, top + 19, 7, 6, P['skin'])
        _outline_ellipse(g, cx, top + 19, 7, 6, OUTLINE)
        for ex in (cx - 4, cx + 4):
            g.ellipse(ex, top + 16, 2, 3, P['eye'])
        g.ellipse(cx, top + 21, 3, 3, P['nana_pacifier'])
        _outline_ellipse(g, cx, top + 21, 3, 3, OUTLINE)
        g.ellipse(cx, top + 21, 1, 1, P['nana_hi'])
    elif facing == 'up':
        g.ellipse(cx - 3, top + 15, 4, 3, P['nana_hi'])
    else:
        s = 1 if facing == 'right' else -1
        fx = cx + s * 4
        g.ellipse(fx, top + 19, 5, 6, P['skin'])
        _outline_ellipse(g, fx, top + 19, 5, 6, OUTLINE)
        g.ellipse(fx, top + 17, 2, 3, P['eye'])
        g.ellipse(fx + s, top + 21, 2, 2, P['nana_pacifier'])


def _nana_frame(g: Grid, cx: int, facing: str, step: int) -> None:
    _og_feet(g, cx, facing, step, P['nana_boot'])
    _og_body_simple(g, cx, facing, step, P['nana'], P['nana_hi'])


HEAD_DRAW: dict[str, Callable] = {
    'dao': _dao_head,
    'bazzi': _bazzi_head,
    'maro': _maro_head,
    'nana': _nana_head,
}

FRAME_DRAW: dict[str, Callable] = {
    'dao': _dao_frame,
    'bazzi': _bazzi_frame,
    'maro': _maro_frame,
    'nana': _nana_frame,
}


def draw_character_frame(char: str, facing: str, step: int, size: int = CHAR) -> Image.Image:
    g = Grid(size, size)
    cx = size // 2
    swing = _leg_swing(step)
    bob = -1 if step % 2 else 0
    _draw_shadow(g, cx)
    FRAME_DRAW[char](g, cx, facing, step)
    HEAD_DRAW[char](g, cx, 4 + bob + (swing // 2), facing)
    return g.to_image()


def build_player_sheet(char: str, size: int = CHAR) -> Image.Image:
    facings = ['down', 'up', 'left', 'right']
    native = Image.new('RGBA', (CHAR * WALK, CHAR * 4), (0, 0, 0, 0))
    for row, facing in enumerate(facings):
        for col in range(WALK):
            native.paste(draw_character_frame(char, facing, col, CHAR), (col * CHAR, row * CHAR))
    if size == CHAR:
        return native
    scaled = Image.new('RGBA', (size * WALK, size * 4), (0, 0, 0, 0))
    for row in range(4):
        for col in range(WALK):
            frame = native.crop((col * CHAR, row * CHAR, (col + 1) * CHAR, (row + 1) * CHAR))
            scaled.paste(frame.resize((size, size), Image.Resampling.NEAREST), (col * size, row * size))
    return scaled


def portrait_frame(char: str, size: int = CHAR) -> Image.Image:
    frame = draw_character_frame(char, 'down', 0, CHAR)
    if size == CHAR:
        return frame
    return frame.resize((size, size), Image.Resampling.NEAREST)
