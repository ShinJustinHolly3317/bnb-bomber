#!/usr/bin/env python3
"""產生 bnb-bomber 像素素材（CC0 自製）"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
os.makedirs(OUT, exist_ok=True)
TS = 32


def draw_human(draw, ox, oy, frame, direction, shirt, hair, outline=(20, 20, 30)):
    skin = (255, 213, 170)
    pants = (55, 55, 85)
    bob = frame % 2
    cx, cy = ox + 16, oy + 16

    def rect(x1, y1, x2, y2, fill):
        draw.rectangle([x1, y1, x2, y2], fill=fill, outline=outline)

    if direction == 0:
        draw.ellipse([cx - 8, cy - 11 - bob, cx + 8, cy + 1 - bob], fill=skin, outline=outline)
        draw.ellipse([cx - 9, cy - 13 - bob, cx + 9, cy - 1 - bob], fill=hair, outline=outline)
        draw.ellipse([cx - 3, cy - 7 - bob, cx - 1, cy - 5 - bob], fill=(30, 30, 30))
        draw.ellipse([cx + 1, cy - 7 - bob, cx + 3, cy - 5 - bob], fill=(30, 30, 30))
        rect(cx - 8, cy, cx + 8, cy + 10, shirt)
        rect(cx - 6, cy + 10, cx - 2, cy + 15 + bob, pants)
        rect(cx + 2, cy + 10, cx + 6, cy + 15 - bob, pants)
    elif direction == 1:
        rect(cx - 8, cy + 2, cx + 8, cy + 12, shirt)
        draw.ellipse([cx - 8, cy - 9, cx + 8, cy + 3], fill=hair, outline=outline)
        rect(cx - 6, cy + 12, cx - 2, cy + 17 + bob, pants)
        rect(cx + 2, cy + 12, cx + 6, cy + 17 - bob, pants)
    elif direction == 2:
        draw.ellipse([cx - 9, cy - 9 - bob, cx + 5, cy + 5 - bob], fill=skin, outline=outline)
        draw.ellipse([cx - 10, cy - 11 - bob, cx + 6, cy + 1 - bob], fill=hair, outline=outline)
        rect(cx - 7, cy + 1, cx + 9, cy + 11, shirt)
        rect(cx - 9, cy + 11, cx - 3, cy + 16 + bob, pants)
        rect(cx + 1, cy + 11, cx + 5, cy + 16 - bob, pants)
    else:
        draw.ellipse([cx - 5, cy - 9 - bob, cx + 9, cy + 5 - bob], fill=skin, outline=outline)
        draw.ellipse([cx - 6, cy - 11 - bob, cx + 10, cy + 1 - bob], fill=hair, outline=outline)
        rect(cx - 9, cy + 1, cx + 7, cy + 11, shirt)
        rect(cx - 5, cy + 11, cx - 1, cy + 16 + bob, pants)
        rect(cx + 3, cy + 11, cx + 9, cy + 16 - bob, pants)


def make_player_sheet(name, shirt, hair):
    img = Image.new('RGBA', (TS * 4, TS * 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for d in range(4):
        for f in range(4):
            draw_human(draw, f * TS, d * TS, f, d, shirt, hair)
    img.save(f'{OUT}/{name}.png')


def tile(name, fn):
    img = Image.new('RGBA', (TS, TS), (0, 0, 0, 0))
    fn(ImageDraw.Draw(img), TS)
    img.save(f'{OUT}/{name}.png')


def grass(d, ts):
    d.rectangle([0, 0, ts, ts], fill=(76, 175, 80))
    for px, py in [(6, 6), (20, 12), (14, 22), (24, 24)]:
        d.rectangle([px, py, px + 2, py + 2], fill=(56, 142, 60))


def road(d, ts):
    d.rectangle([0, 0, ts, ts], fill=(130, 130, 130))
    d.rectangle([14, 2, 18, ts - 2], fill=(240, 240, 240))
    d.rectangle([2, 14, ts - 2, 18], fill=(200, 200, 200))


def wall(d, ts):
    d.rectangle([0, 0, ts, ts], fill=(121, 85, 72))
    for y in range(0, ts, 8):
        for x in range(0, ts, 8):
            d.rectangle([x + 1, y + 1, x + 7, y + 7], outline=(93, 64, 55))


def tree(d, ts):
    grass(d, ts)
    d.polygon([(16, 3), (5, 26), (27, 26)], fill=(27, 94, 32), outline=(19, 70, 24))
    d.rectangle([13, 24, 19, 29], fill=(93, 64, 55))


def crate(d, ts):
    d.rectangle([3, 3, ts - 3, ts - 3], fill=(255, 193, 7), outline=(180, 120, 0), width=2)
    d.line([(3, 3), (ts - 3, ts - 3)], fill=(180, 120, 0), width=2)
    d.line([(ts - 3, 3), (3, ts - 3)], fill=(180, 120, 0), width=2)


def house(d, ts, roof):
    d.rectangle([4, 14, ts - 4, ts - 3], fill=(240, 230, 210), outline=(120, 100, 80))
    d.polygon([(4, 14), (16, 4), (ts - 4, 14)], fill=roof, outline=(80, 40, 40))
    d.rectangle([12, 18, 20, 28], fill=(100, 160, 220), outline=(60, 100, 160))


make_player_sheet('player_blue', (66, 133, 244), (30, 60, 180))
make_player_sheet('player_red', (229, 57, 53), (120, 30, 30))

tile('tile_grass', grass)
tile('tile_road', road)
tile('tile_wall', wall)
tile('tile_tree', tree)
tile('tile_crate', crate)
tile('tile_house_red', lambda d, ts: house(d, ts, (200, 60, 60)))
tile('tile_house_blue', lambda d, ts: house(d, ts, (50, 100, 200)))

img = Image.new('RGBA', (TS, TS), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.ellipse([5, 5, 27, 27], fill=(100, 200, 255, 230), outline=(30, 120, 200), width=2)
d.ellipse([9, 8, 15, 14], fill=(220, 245, 255, 200))
d.ellipse([18, 16, 22, 20], fill=(220, 245, 255, 150))
img.save(f'{OUT}/bubble.png')

img = Image.new('RGBA', (TS * 4, TS), (0, 0, 0, 0))
for i in range(4):
    d = ImageDraw.Draw(img)
    alpha = 220 - i * 40
    d.ellipse([i * TS + 4, 4, i * TS + 28, 28], fill=(120, 220, 255, alpha))
img.save(f'{OUT}/explosion.png')

for name, color, symbol in [
    ('item_speed', (255, 235, 59), 'S'),
    ('item_power', (255, 87, 34), 'P'),
    ('item_bubble', (41, 182, 246), 'B'),
]:
    img = Image.new('RGBA', (TS, TS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([2, 2, 30, 30], fill=color, outline=(255, 255, 255), width=2)
    d.text((11, 8), symbol, fill=(20, 20, 20))
    img.save(f'{OUT}/{name}.png')

print('ok', os.listdir(OUT))
