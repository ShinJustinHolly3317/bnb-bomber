#!/usr/bin/env python3
"""繪製 BnB 村10 風格完整素材（homage，非截圖）

對照 reference-village10.png：
- 草地：亮黃綠 lego 底板，每格 2x2 大凸點
- 木箱：橘黃色厚邊框 + X 交叉厚木板
- 樹：深綠蓬蓬圓錐（扇形波浪邊）+ 棕色樹幹
- 房子：lego 磚屋頂（帶凸點）+ 淺色牆 + 白框窗
- 水球：藍色亮面水球，左上大白高光
- 角色：大頭小身 chibi（藍寶 Dao / 睏寶 Bazzi）
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets'
MANIFEST_OUT = OUT / 'sprite-manifest.json'

TILE = 64
FRAME = 40
WALK = 4

# 村10 配色（對照 reference-village10.png）
C = {
    # 草地（亮黃綠 lego 底板）
    'grass': (93, 179, 42),
    'grass_lo': (72, 148, 28),
    'stud_top': (113, 196, 58),
    'stud_hi': (170, 226, 102),
    'stud_shadow': (58, 124, 20),
    # 馬路
    'road': (186, 186, 186),
    'road_dark': (148, 148, 148),
    'dash': (250, 250, 250),
    # 木箱
    'crate': (232, 163, 61),
    'crate_hi': (244, 190, 96),
    'crate_lo': (199, 127, 42),
    'crate_edge': (118, 70, 22),
    # 樹
    'tree': (24, 110, 36),
    'tree_hi': (66, 158, 60),
    'trunk': (124, 80, 42),
    # 房子
    'roof_red': (235, 87, 50),
    'roof_red_hi': (248, 132, 92),
    'wall_red': (247, 198, 122),
    'roof_blue': (62, 134, 222),
    'roof_blue_hi': (110, 176, 246),
    'wall_blue': (196, 226, 250),
    'window': (168, 220, 248),
    # 牆（不可破壞）
    'wall_dark': (96, 66, 46),
    'wall_mortar': (62, 42, 28),
    'wall_hi': (126, 92, 66),
    # 水球
    'bubble': (33, 150, 243),
    'bubble_lo': (21, 101, 192),
    'bubble_edge': (13, 71, 161),
    'bubble_hi': (187, 222, 251),
    # 角色
    'skin': (255, 233, 216),
    'blue_hood': (36, 110, 214),
    'blue_hood_hi': (88, 154, 240),
    'red_hood': (224, 54, 44),
    'red_hood_hi': (246, 108, 92),
    'outline': (36, 27, 24),
}


def new_tile() -> Image.Image:
    return Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))


# ---------------------------------------------------------------- tiles


def tile_grass() -> Image.Image:
    """亮黃綠草地，2x2 大 lego 凸點（每個凸點約半格大）"""
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, TILE - 1, TILE - 1), fill=C['grass'] + (255,))
    # 右、下邊緣微暗，拼接時有底板格的感覺
    d.rectangle((0, TILE - 2, TILE - 1, TILE - 1), fill=C['grass_lo'] + (255,))
    d.rectangle((TILE - 2, 0, TILE - 1, TILE - 1), fill=C['grass_lo'] + (255,))

    r = 13
    for row in range(2):
        for col in range(2):
            cx = col * 32 + 16
            cy = row * 32 + 16
            # 底部陰影
            d.ellipse((cx - r, cy - r + 3, cx + r, cy + r + 3), fill=C['stud_shadow'] + (255,))
            # 凸點主體
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=C['stud_top'] + (255,))
            # 左上高光（月牙感）
            d.ellipse((cx - r + 3, cy - r + 2, cx + 2, cy + 1), fill=C['stud_hi'] + (255,))
            # 頂面中心回填，讓高光變成弧形
            d.ellipse((cx - r + 7, cy - r + 6, cx + r - 4, cy + r - 4), fill=C['stud_top'] + (255,))
    return img


def tile_road() -> Image.Image:
    """淺灰柏油路 + 中央白色虛線（直向）+ 兩側暗邊"""
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, TILE - 1, TILE - 1), fill=C['road'] + (255,))
    # 兩側暗邊
    d.rectangle((0, 0, 4, TILE - 1), fill=C['road_dark'] + (255,))
    d.rectangle((TILE - 5, 0, TILE - 1, TILE - 1), fill=C['road_dark'] + (255,))
    # 中央白色虛線
    cx = TILE // 2
    for y in range(2, TILE - 2, 16):
        d.rectangle((cx - 3, y, cx + 3, y + 9), fill=C['dash'] + (255,))
    return img


def tile_crate() -> Image.Image:
    """木箱：橘黃色厚邊框 + X 交叉厚木板，幾乎填滿整格"""
    img = tile_grass()
    d = ImageDraw.Draw(img)
    # 箱面
    d.rectangle((2, 2, 61, 61), fill=C['crate'] + (255,))
    # X 交叉厚木板（先畫深色寬線當外緣，再覆亮色窄線）
    d.line((7, 7, 56, 56), fill=C['crate_edge'] + (255,), width=14)
    d.line((56, 7, 7, 56), fill=C['crate_edge'] + (255,), width=14)
    d.line((7, 7, 56, 56), fill=C['crate_hi'] + (255,), width=9)
    d.line((56, 7, 7, 56), fill=C['crate_hi'] + (255,), width=9)
    # 邊框厚板：深外緣 → 亮板面 → 內側細暗線
    d.rectangle((2, 2, 61, 61), outline=C['crate_edge'] + (255,), width=2)
    d.rectangle((4, 4, 59, 59), outline=C['crate_hi'] + (255,), width=5)
    d.rectangle((9, 9, 54, 54), outline=C['crate_lo'] + (255,), width=1)
    return img


def _tree_tier(d: ImageDraw.Draw, cx: int, apex_y: int, half_w: int, base_y: int,
               color: tuple, scallops: int, grow: int = 0) -> None:
    """一層蓬蓬樹葉：三角形主體 + 底緣圓弧（波浪邊）"""
    g = grow
    d.polygon([(cx, apex_y - g), (cx - half_w - g, base_y + g), (cx + half_w + g, base_y + g)], fill=color)
    rr = 6 + g
    for i in range(scallops):
        t = i / (scallops - 1)
        x = cx - half_w + t * (2 * half_w)
        d.ellipse((x - rr, base_y - rr, x + rr, base_y + rr), fill=color)


def tile_tree() -> Image.Image:
    """深綠蓬蓬圓錐樹（波浪邊）+ 棕色樹幹"""
    img = tile_grass()
    d = ImageDraw.Draw(img)
    out = C['outline'] + (255,)
    # 樹幹
    d.rectangle((27, 46, 37, 59), fill=C['trunk'] + (255,), outline=out, width=2)
    cx = 32
    tiers = [
        # apex_y, half_w, base_y, scallops
        (24, 22, 48, 4),
        (12, 17, 36, 4),
        (2, 12, 24, 3),
    ]
    # 由下往上逐層畫：每層先畫深色外框版（放大 2px）再畫綠色本體，
    # 上層的外框會壓在下層綠色上，層次才看得出來
    for apex_y, half_w, base_y, n in tiers:
        _tree_tier(d, cx, apex_y, half_w, base_y, out, n, grow=2)
        _tree_tier(d, cx, apex_y, half_w, base_y, C['tree'] + (255,), n)
        # 左側亮綠高光
        d.ellipse((cx - half_w + 3, apex_y + 7, cx - 2, apex_y + 7 + (base_y - apex_y) // 2),
                  fill=C['tree_hi'] + (255,))
    return img


def tile_wall() -> Image.Image:
    """不可破壞牆：深棕磚塊"""
    img = new_tile()
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, TILE - 1, TILE - 1), fill=C['wall_mortar'] + (255,))
    for row in range(4):
        y0 = row * 16
        offset = 0 if row % 2 == 0 else -16
        for col in range(4):
            x0 = offset + col * 32
            d.rectangle((x0 + 2, y0 + 2, x0 + 30, y0 + 14), fill=C['wall_dark'] + (255,))
            d.rectangle((x0 + 2, y0 + 2, x0 + 30, y0 + 5), fill=C['wall_hi'] + (255,))
    d.rectangle((0, 0, TILE - 1, TILE - 1), outline=C['outline'] + (255,), width=2)
    return img


def tile_house(roof: tuple, roof_hi: tuple, wall: tuple) -> Image.Image:
    """Lego 磚屋：彩色屋頂厚板（帶凸點）+ 淺色牆 + 白框窗"""
    img = tile_grass()
    d = ImageDraw.Draw(img)
    out = C['outline'] + (255,)
    # 牆（先畫，屋頂壓在上面）
    d.rectangle((8, 28, 55, 58), fill=wall + (255,), outline=out, width=2)
    # 白框窗 + 十字窗格
    d.rectangle((22, 36, 41, 52), fill=(255, 255, 255, 255), outline=out, width=2)
    d.rectangle((25, 39, 38, 49), fill=C['window'] + (255,))
    d.line((31, 39, 31, 49), fill=(255, 255, 255, 255), width=2)
    d.line((25, 44, 38, 44), fill=(255, 255, 255, 255), width=2)
    # 屋頂厚板（略寬於牆）
    d.rectangle((3, 5, 60, 30), fill=roof + (255,), outline=out, width=2)
    # 屋頂下緣陰影帶
    d.rectangle((5, 25, 58, 28), fill=tuple(int(c * 0.72) for c in roof) + (255,))
    # 屋頂凸點 2 排 x 3 顆
    r = 5
    for cy in (12, 22):
        for cx in (16, 32, 48):
            d.ellipse((cx - r, cy - r + 2, cx + r, cy + r + 2), fill=tuple(int(c * 0.72) for c in roof) + (255,))
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=roof_hi + (255,))
            d.ellipse((cx - r + 2, cy - r + 1, cx, cy - 1), fill=(255, 255, 255, 130))
    return img


# ---------------------------------------------------------------- bubble / explosion / items


def draw_bubble_icon(size: int = FRAME) -> Image.Image:
    """亮面水球：藍色球體、左上大白高光、底部深藍、頂端小結"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    edge = C['bubble_edge'] + (255,)
    s = size / 40.0

    def sc(v: float) -> int:
        return int(round(v * s))

    # 頂端小結（會被球體蓋住下半）
    d.ellipse((sc(15), sc(0), sc(25), sc(9)), fill=C['bubble'] + (255,), outline=edge, width=2)
    body = (sc(2), sc(5), sc(38), sc(39))
    # 整顆先深藍
    d.ellipse(body, fill=C['bubble_lo'] + (255,))
    # 主色往左上偏移，右下只留一圈深色月牙
    d.ellipse((sc(3), sc(6), sc(35), sc(35)), fill=C['bubble'] + (255,))
    # 再往左上一層亮藍
    d.ellipse((sc(5), sc(8), sc(28), sc(28)), fill=(80, 180, 250, 255))
    # 左上大白高光（橢圓）+ 小亮點
    d.ellipse((sc(8), sc(10), sc(20), sc(20)), fill=(255, 255, 255, 240))
    d.ellipse((sc(22), sc(11), sc(26), sc(15)), fill=(255, 255, 255, 170))
    # 外框
    d.ellipse(body, outline=edge, width=2)
    return img


def draw_explosion_sheet() -> Image.Image:
    """水球爆裂 4 幀：第 1 幀紅橘閃光，第 2-4 幀藍白水圈擴散淡出"""
    sheet = Image.new('RGBA', (FRAME * 4, FRAME), (0, 0, 0, 0))
    cx = cy = FRAME // 2

    # frame 0：紅橘色閃光（對照 reference 的紅色水球爆點）
    cell = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(cell)
    d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=(211, 47, 47, 240))
    d.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=(255, 138, 48, 250))
    d.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=(255, 235, 120, 255))
    sheet.paste(cell, (0, 0), cell)

    # frame 1-3：藍白水圈擴散
    for i in range(1, 4):
        cell = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
        d = ImageDraw.Draw(cell)
        r = 9 + i * 3
        alpha = 255 - i * 45
        # 內部淡藍水體
        d.ellipse((cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2), fill=(150, 215, 255, alpha - 60))
        # 水圈（粗藍圈 + 白色內圈）
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(60, 160, 245, alpha), width=5)
        d.ellipse((cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2), outline=(255, 255, 255, alpha), width=2)
        # 外圍水滴
        if i >= 2:
            dr = r + 3
            for ang_x, ang_y in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
                px = cx + int(ang_x * dr * 0.72)
                py = cy + int(ang_y * dr * 0.72)
                d.ellipse((px - 3, py - 3, px + 3, py + 3), fill=(190, 230, 255, alpha))
        sheet.paste(cell, (i * FRAME, 0), cell)
    return sheet


def draw_item(kind: str) -> Image.Image:
    img = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == 'speed':
        d.polygon([(20, 6), (34, 20), (20, 34), (6, 20)], fill=(255, 235, 59, 255), outline=C['outline'] + (255,))
        d.rectangle((17, 17, 23, 23), fill=(255, 193, 7, 255))
    elif kind == 'power':
        d.ellipse((8, 8, 32, 32), fill=(255, 87, 34, 255), outline=C['outline'] + (255,))
        d.polygon([(20, 10), (24, 18), (20, 26), (16, 18)], fill=(255, 255, 255, 255))
    else:
        return draw_bubble_icon(FRAME)
    return img


# ---------------------------------------------------------------- characters


def _draw_feet(d: ImageDraw.Draw, cx: int, color: tuple, facing: str, phase: int) -> None:
    out = C['outline'] + (255,)
    if facing in ('down', 'up'):
        # 左右腳上下交替
        d.ellipse((cx - 9, 33 + phase, cx - 1, 39 + phase), fill=color + (255,), outline=out, width=1)
        d.ellipse((cx + 1, 33 - phase, cx + 9, 39 - phase), fill=color + (255,), outline=out, width=1)
    else:
        # 側面：前後腳
        d.ellipse((cx - 8 + phase * 3, 33, cx + phase * 3, 39), fill=color + (255,), outline=out, width=1)
        d.ellipse((cx - phase * 3, 33, cx + 8 - phase * 3, 39), fill=color + (255,), outline=out, width=1)


def _draw_body(d: ImageDraw.Draw, cx: int, color: tuple, facing: str, phase: int) -> None:
    out = C['outline'] + (255,)
    d.rounded_rectangle((cx - 8, 25, cx + 8, 36), radius=4, fill=color + (255,), outline=out, width=2)
    if facing in ('down', 'up'):
        # 兩隻小手，跟著腳反向擺動
        d.ellipse((cx - 13, 27 - phase, cx - 7, 33 - phase), fill=color + (255,), outline=out, width=1)
        d.ellipse((cx + 7, 27 + phase, cx + 13, 33 + phase), fill=color + (255,), outline=out, width=1)
    else:
        d.ellipse((cx - 3, 27 + phase, cx + 3, 33 + phase), fill=color + (255,), outline=out, width=1)


def _draw_dao_head(d: ImageDraw.Draw, cx: int, top: int, facing: str) -> None:
    """藍寶：藍色兜帽 + 白臉 + 兩顆大圓黑眼"""
    out = C['outline'] + (255,)
    hood = C['blue_hood']
    bottom = top + 26

    if facing == 'up':
        d.ellipse((cx - 13, top, cx + 13, bottom), fill=hood + (255,), outline=out, width=2)
        # 兜帽尖角
        d.ellipse((cx - 12, top - 2, cx - 5, top + 5), fill=hood + (255,), outline=out, width=2)
        d.ellipse((cx + 5, top - 2, cx + 12, top + 5), fill=hood + (255,), outline=out, width=2)
        # 後腦勺亮面
        d.ellipse((cx - 8, top + 5, cx + 2, top + 14), fill=C['blue_hood_hi'] + (255,))
        return

    if facing == 'down':
        d.ellipse((cx - 13, top, cx + 13, bottom), fill=hood + (255,), outline=out, width=2)
        d.ellipse((cx - 12, top - 2, cx - 5, top + 5), fill=hood + (255,), outline=out, width=2)
        d.ellipse((cx + 5, top - 2, cx + 12, top + 5), fill=hood + (255,), outline=out, width=2)
        # 白臉（兜帽開口）
        d.ellipse((cx - 9, top + 8, cx + 9, bottom - 1), fill=C['skin'] + (255,), outline=out, width=1)
        # 大圓黑眼 + 白色亮點
        for ex in (cx - 7, cx + 2):
            d.ellipse((ex, top + 12, ex + 5, top + 19), fill=out)
            d.ellipse((ex + 1, top + 13, ex + 3, top + 15), fill=(255, 255, 255, 255))
        # 小嘴
        d.arc((cx - 3, top + 19, cx + 3, top + 23), 0, 180, fill=out, width=2)
        return

    # 側面（left / right）
    s = 1 if facing == 'right' else -1
    d.ellipse((cx - 12, top, cx + 12, bottom), fill=hood + (255,), outline=out, width=2)
    # 單一兜帽尖角（偏後腦）
    d.ellipse((cx - s * 10 - 3, top - 2, cx - s * 10 + 4, top + 5), fill=hood + (255,), outline=out, width=2)
    # 臉偏向行進方向
    face_x0 = cx + (1 if s > 0 else -11)
    d.ellipse((face_x0, top + 9, face_x0 + 10, bottom - 2), fill=C['skin'] + (255,), outline=out, width=1)
    # 單眼
    ex = cx + s * 5
    d.ellipse((ex - 2, top + 13, ex + 2, top + 18), fill=out)
    d.point((ex - 1, top + 14), fill=(255, 255, 255, 255))


def _draw_bazzi_head(d: ImageDraw.Draw, cx: int, top: int, facing: str) -> None:
    """睏寶：紅色頭盔 + 額頭白色蛙鏡帶 + 瞇瞇眼（下弧）"""
    out = C['outline'] + (255,)
    helmet = C['red_hood']
    bottom = top + 26

    if facing == 'up':
        d.ellipse((cx - 13, top, cx + 13, bottom), fill=helmet + (255,), outline=out, width=2)
        # 繞到後腦的白色蛙鏡帶
        d.rectangle((cx - 11, top + 7, cx + 11, top + 12), fill=(255, 255, 255, 255), outline=out, width=1)
        d.ellipse((cx - 8, top + 14, cx + 2, top + 22), fill=C['red_hood_hi'] + (255,))
        return

    if facing == 'down':
        d.ellipse((cx - 13, top, cx + 13, bottom), fill=helmet + (255,), outline=out, width=2)
        # 額頭白色蛙鏡帶 + 兩顆蛙鏡
        d.rectangle((cx - 11, top + 6, cx + 11, top + 11), fill=(255, 255, 255, 255), outline=out, width=1)
        for gx in (cx - 6, cx + 6):
            d.ellipse((gx - 4, top + 4, gx + 4, top + 12), fill=(210, 210, 215, 255), outline=out, width=1)
            d.ellipse((gx - 2, top + 6, gx + 2, top + 10), fill=C['window'] + (255,))
        # 臉
        d.ellipse((cx - 9, top + 12, cx + 9, bottom - 1), fill=C['skin'] + (255,), outline=out, width=1)
        # 瞇瞇眼（下弧 ∪）
        d.arc((cx - 8, top + 15, cx - 2, top + 20), 0, 180, fill=out, width=2)
        d.arc((cx + 2, top + 15, cx + 8, top + 20), 0, 180, fill=out, width=2)
        # 小嘴（打呵欠的小 o）
        d.ellipse((cx - 2, top + 21, cx + 2, top + 24), fill=out)
        return

    # 側面（left / right）
    s = 1 if facing == 'right' else -1
    d.ellipse((cx - 12, top, cx + 12, bottom), fill=helmet + (255,), outline=out, width=2)
    # 側面蛙鏡帶 + 前側一顆蛙鏡
    d.rectangle((cx - 11, top + 6, cx + 11, top + 11), fill=(255, 255, 255, 255), outline=out, width=1)
    gx = cx + s * 7
    d.ellipse((gx - 4, top + 4, gx + 4, top + 12), fill=(210, 210, 215, 255), outline=out, width=1)
    d.ellipse((gx - 2, top + 6, gx + 2, top + 10), fill=C['window'] + (255,))
    # 臉偏向行進方向
    face_x0 = cx + (1 if s > 0 else -11)
    d.ellipse((face_x0, top + 12, face_x0 + 10, bottom - 2), fill=C['skin'] + (255,), outline=out, width=1)
    # 單隻瞇瞇眼
    ex = cx + s * 5
    d.arc((ex - 3, top + 15, ex + 3, top + 20), 0, 180, fill=out, width=2)


def draw_chibi(d: ImageDraw.Draw, character: str, facing: str, step: int) -> None:
    """大頭小身 chibi：頭約佔高度 60-65%，黑色 2px 外框"""
    cx = FRAME // 2
    phase = (0, 1, 0, -1)[step % 4]
    bob = -1 if step % 2 == 1 else 0
    body_color = C['blue_hood'] if character == 'dao' else C['red_hood']

    _draw_feet(d, cx, body_color, facing, phase)
    _draw_body(d, cx, body_color, facing, phase)
    head_top = 2 + bob
    if character == 'dao':
        _draw_dao_head(d, cx, head_top, facing)
    else:
        _draw_bazzi_head(d, cx, head_top, facing)


def build_player_sheet(character: str) -> Image.Image:
    facings = ['down', 'up', 'left', 'right']
    sheet = Image.new('RGBA', (FRAME * WALK, FRAME * 4), (0, 0, 0, 0))
    for row, facing in enumerate(facings):
        for col in range(WALK):
            cell = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
            d = ImageDraw.Draw(cell)
            draw_chibi(d, character, facing, col)
            sheet.paste(cell, (col * FRAME, row * FRAME), cell)
    return sheet


# ---------------------------------------------------------------- manifest / main


def write_manifest() -> None:
    data = {
        'source': 'bnb-style',
        'characterFrameWidth': FRAME,
        'characterFrameHeight': FRAME,
        'walkFramesPerDirection': WALK,
        'explosionFrameWidth': FRAME,
        'explosionFrameHeight': FRAME,
        'explosionFrames': 4,
        'playerBodySize': 20,
        'playerOffsetX': 10,
        'playerOffsetY': 12,
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
    tile_house(C['roof_red'], C['roof_red_hi'], C['wall_red']).save(OUT / 'tile_house_red.png')
    tile_house(C['roof_blue'], C['roof_blue_hi'], C['wall_blue']).save(OUT / 'tile_house_blue.png')

    draw_bubble_icon().save(OUT / 'bubble.png')
    draw_explosion_sheet().save(OUT / 'explosion.png')
    draw_item('speed').save(OUT / 'item_speed.png')
    draw_item('power').save(OUT / 'item_power.png')
    draw_item('bubble').save(OUT / 'item_bubble.png')

    build_player_sheet('dao').save(OUT / 'player_blue.png')
    build_player_sheet('bazzi').save(OUT / 'player_red.png')

    write_manifest()
    print('ok bnb-style assets →', OUT)


if __name__ == '__main__':
    main()
