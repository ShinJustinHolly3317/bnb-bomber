#!/usr/bin/env python3
"""設計圖 vs spritesheet vs 大廳 portrait 並排比對圖"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / 'design-references' / 'pixel-characters-ref.png'
ASSETS = ROOT / 'public' / 'assets'
OUT = ROOT / '.cursor' / 'qa-screenshots' / 'character-faces'

CHAR = 48
WALK = 4
PAD = 8
LABEL_H = 22

CHARS = [
    ('dao', 'player_blue.png', 'portrait_dao.png', 0, 0, '藍寶'),
    ('bazzi', 'player_red.png', 'portrait_bazzi.png', 1, 0, '睏寶'),
    ('maro', 'player_yellow.png', 'portrait_maro.png', 0, 1, '紅寶'),
    ('nana', 'player_pink.png', 'portrait_nana.png', 1, 1, '囡囡'),
]

FACINGS = ['down', 'up', 'left', 'right']
ROW = {'down': 0, 'up': 1, 'left': 2, 'right': 3}


def crop_ref_cell(sheet: Image.Image, col: int, row: int) -> Image.Image:
    w, h = sheet.size
    cw, ch = w // 2, h // 2
    cell = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
    return cell.resize((CHAR, CHAR), Image.Resampling.NEAREST)


def sheet_frame(sheet: Image.Image, facing: str, step: int = 0) -> Image.Image:
    row = ROW[facing]
    return sheet.crop((step * CHAR, row * CHAR, (step + 1) * CHAR, (row + 1) * CHAR))


def label(img: Image.Image, text: str) -> Image.Image:
    out = Image.new('RGBA', (img.width, img.height + LABEL_H), (32, 32, 48, 255))
    out.paste(img, (0, 0))
    d = ImageDraw.Draw(out)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 12)
    except OSError:
        font = ImageFont.load_default()
    d.text((4, img.height + 4), text, fill=(255, 255, 255, 255), font=font)
    return out


def hstack(images: list[Image.Image], gap: int = PAD) -> Image.Image:
    w = sum(i.width for i in images) + gap * (len(images) - 1)
    h = max(i.height for i in images)
    out = Image.new('RGBA', (w, h), (32, 32, 48, 255))
    x = 0
    for img in images:
        out.paste(img, (x, 0), img)
        x += img.width + gap
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ref_sheet = Image.open(REF).convert('RGBA')

    for _id, player_file, portrait_file, gcol, grow, cn in CHARS:
        player = Image.open(ASSETS / player_file).convert('RGBA')
        portrait = Image.open(ASSETS / portrait_file).convert('RGBA').resize(
            (CHAR, CHAR), Image.Resampling.NEAREST
        )
        ref = crop_ref_cell(ref_sheet, gcol, grow)

        rows = []
        for facing in FACINGS:
            ref_l = label(ref, f'設計圖(正面)')
            sprite = label(sheet_frame(player, facing, 1), f'遊戲 {facing}')
            ingame = OUT / f'ingame-dao-{facing}-crop.png'
            if _id == 'dao' and ingame.is_file():
                game = label(Image.open(ingame).convert('RGBA'), f'實機 {facing}')
            else:
                game = label(Image.new('RGBA', (CHAR, CHAR), (48, 48, 64, 255)), '實機 n/a')
            rows.append(hstack([ref_l, portrait if facing == 'down' else ref_l.copy(), sprite, game]))

        grid_h = sum(r.height + PAD for r in rows) + PAD
        grid_w = rows[0].width + PAD * 2
        grid = Image.new('RGBA', (grid_w, grid_h), (24, 24, 36, 255))
        y = PAD
        title = ImageDraw.Draw(grid)
        try:
            font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 14)
        except OSError:
            font = ImageFont.load_default()
        title.text((PAD, y), f'{cn} ({_id}) — 設計圖 vs portrait vs 四方向 sprite vs 實機', fill=(255, 220, 80, 255), font=font)
        y += 20
        for row in rows:
            grid.paste(row, (PAD, y), row)
            y += row.height + PAD

        grid.save(OUT / f'compare-{ _id }.png')

    # 全角色 down 方向一覽
    down_row = []
    for _id, player_file, _p, gcol, grow, cn in CHARS:
        ref = crop_ref_cell(ref_sheet, gcol, grow)
        sprite = sheet_frame(Image.open(ASSETS / player_file), 'down', 1)
        down_row.append(label(hstack([ref, sprite]), cn))
    hstack(down_row, 12).save(OUT / 'compare-all-down.png')
    print(f'比對圖 → {OUT}')


if __name__ == '__main__':
    main()
