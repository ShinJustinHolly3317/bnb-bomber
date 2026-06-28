#!/usr/bin/env python3
"""從 beanfun 官方頁下載 OG 角色 GIF 並裁切參考圖"""
from __future__ import annotations

import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OG_DIR = ROOT / 'design-references' / 'characters' / 'og'
BASE = 'https://tw.beanfun.com/bnb/images/game/2'

# beanfun game2.htm 順序
OG_CHARS = [
    ('bazzi', 1, '睏寶'),
    ('dao', 2, '藍寶'),
    ('nana', 5, '囡囡'),   # Uni 黃色奶嘴
    ('maro', 7, '小蜜桃'),  # Marid 粉紅蘑菇帽
]


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        dest.write_bytes(resp.read())


def crop_character(gif_path: Path, out_path: Path) -> None:
    """GIF 左側為角色立繪"""
    im = Image.open(gif_path).convert('RGBA')
    # 角色約佔左 90px
    crop = im.crop((0, 0, 90, im.height))
    crop = crop.resize((96, 96), Image.Resampling.NEAREST)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(out_path)


def main() -> None:
    for char_id, idx, _label in OG_CHARS:
        gif_name = f'game2_{idx}.gif'
        gif_path = OG_DIR / gif_name
        url = f'{BASE}/{gif_name}'
        if not gif_path.is_file():
            print(f'下載 {url}')
            download(url, gif_path)
        png_path = OG_DIR / f'{char_id}_og_ref.png'
        crop_character(gif_path, png_path)
        print(f'✅ {char_id} → {png_path.name}')

    print(f'\nOG 參考圖 → {OG_DIR}')


if __name__ == '__main__':
    main()
