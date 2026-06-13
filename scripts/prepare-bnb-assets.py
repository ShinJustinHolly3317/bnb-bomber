#!/usr/bin/env python3
"""將 assets/raw/bnb/ 私人解包素材轉成 Phaser 用的 public/assets/ + sprite-manifest.json"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets' / 'raw' / 'bnb'
OUT = ROOT / 'public' / 'assets'
MANIFEST_OUT = OUT / 'sprite-manifest.json'

DIRECTIONS = ['walk_down', 'walk_up', 'walk_left', 'walk_right']
DIR_ROW = {d: i for i, d in enumerate(DIRECTIONS)}


def load_json(path: Path) -> dict:
    with path.open(encoding='utf-8') as f:
        return json.load(f)


def resize_center(img: Image.Image, size: int) -> Image.Image:
    img = img.convert('RGBA')
    w, h = img.size
    scale = min(size / w, size / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def list_frames(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    if not path.is_dir():
        return []
    files = sorted(path.glob('*.png')) + sorted(path.glob('*.PNG'))
    return files


def pick_frames(paths: list[Path], count: int) -> list[Image.Image]:
    if not paths:
        return []
    imgs = [Image.open(p).convert('RGBA') for p in paths]
    if len(imgs) >= count:
        return imgs[:count]
    while len(imgs) < count:
        imgs.append(imgs[-1].copy())
    return imgs


def build_character_sheet(
    raw_root: Path,
    char_cfg: dict,
    frame_size: int,
    frames_per_dir: int,
    dest_name: str,
) -> bool:
    cells: list[list[Image.Image | None]] = [
        [None] * frames_per_dir for _ in range(4)
    ]
    ok = False

    for direction in DIRECTIONS:
        rel = char_cfg.get(direction)
        if not rel:
            continue
        src = raw_root / rel
        frame_paths = list_frames(src)
        if not frame_paths:
            continue
        row = DIR_ROW[direction]
        picked = pick_frames(frame_paths, frames_per_dir)
        for col, img in enumerate(picked):
            cells[row][col] = resize_center(img, frame_size)
        ok = True

    if not ok:
        return False

    # 缺方向時用朝下影格補
    fallback = cells[0][0]
    for row in range(4):
        for col in range(frames_per_dir):
            if cells[row][col] is None:
                cells[row][col] = fallback.copy() if fallback else Image.new(
                    'RGBA', (frame_size, frame_size), (0, 0, 0, 0)
                )

    sheet = Image.new(
        'RGBA',
        (frame_size * frames_per_dir, frame_size * 4),
        (0, 0, 0, 0),
    )
    for row in range(4):
        for col in range(frames_per_dir):
            cell = cells[row][col]
            assert cell is not None
            sheet.paste(cell, (col * frame_size, row * frame_size), cell)

    sheet.save(OUT / dest_name)
    return True


def copy_tile(raw_root: Path, rel: str, dest: str, size: int) -> bool:
    src = raw_root / rel
    if not src.is_file():
        return False
    resize_center(Image.open(src), size).save(OUT / dest)
    return True


def copy_effect(raw_root: Path, rel: str, dest: str, size: int) -> bool:
    src = raw_root / rel
    if src.is_file():
        resize_center(Image.open(src), size).save(OUT / dest)
        return True
    return False


def build_explosion(raw_root: Path, rel: str, frame_size: int, max_frames: int = 4) -> bool:
    src = raw_root / rel
    paths = list_frames(src)
    if not paths:
        return False
    imgs = pick_frames(paths, max_frames)
    sheet = Image.new('RGBA', (frame_size * len(imgs), frame_size), (0, 0, 0, 0))
    for i, img in enumerate(imgs):
        cell = resize_center(img, frame_size)
        sheet.paste(cell, (i * frame_size, 0), cell)
    sheet.save(OUT / 'explosion.png')
    return True


def kenney_fallback() -> None:
    import subprocess

    kenney = ROOT / 'scripts' / 'prepare-kenney-assets.py'
    if kenney.is_file():
        subprocess.run([sys.executable, str(kenney)], check=True)


def bnb_style_fallback() -> None:
    """繪製 BnB homage 完整素材（預設，非截圖）"""
    import subprocess

    gen = ROOT / 'scripts' / 'generate-bnb-style-assets.py'
    if gen.is_file():
        subprocess.run([sys.executable, str(gen)], check=True)
        return
    reference_fallback()


def reference_fallback() -> None:
    """無 raw 素材時從 reference-village10 + design-references 萃取"""
    import subprocess

    ref_script = ROOT / 'scripts' / 'prepare-reference-assets.py'
    if ref_script.is_file():
        subprocess.run([sys.executable, str(ref_script)], check=True)
        return
    kenney_fallback()


def write_runtime_manifest(
    cfg: dict,
    frames_per_dir: int,
    frame_size: int,
    explosion_frames: int,
    *,
    source: str,
) -> None:
    runtime = {
        'source': source,
        'characterFrameWidth': frame_size,
        'characterFrameHeight': frame_size,
        'walkFramesPerDirection': frames_per_dir,
        'explosionFrameWidth': frame_size,
        'explosionFrameHeight': frame_size,
        'explosionFrames': explosion_frames,
        'playerBodySize': cfg.get('playerBodySize', 28),
        'playerOffsetX': cfg.get('playerOffsetX', 10),
        'playerOffsetY': cfg.get('playerOffsetY', 14),
        'tileDisplaySize': cfg.get('tileOutputSize', 64),
    }
    with MANIFEST_OUT.open('w', encoding='utf-8') as f:
        json.dump(runtime, f, indent=2, ensure_ascii=False)


def has_raw_tiles(cfg: dict) -> bool:
    tiles = cfg.get('tiles', {})
    return any((RAW / rel).is_file() for rel in tiles.values())


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cfg_path = RAW / 'manifest.json'
    if not cfg_path.is_file():
        print('缺少 assets/raw/bnb/manifest.json，改用 bnb-style 素材')
        bnb_style_fallback()
        return

    cfg = load_json(cfg_path)
    frames_per_dir = int(cfg.get('walkFramesPerDirection', 4))
    frame_size = int(cfg.get('characterFrameSize', 48))
    tile_size = int(cfg.get('tileOutputSize', 64))

    if not has_raw_tiles(cfg):
        print('raw/bnb 尚無 tile PNG，改用 bnb-style 完整美術')
        bnb_style_fallback()
        return

    print('處理爆爆王 raw 素材…')
    tiles = cfg.get('tiles', {})
    tile_map = {
        'grass': 'tile_grass.png',
        'road': 'tile_road.png',
        'wall': 'tile_wall.png',
        'tree': 'tile_tree.png',
        'crate': 'tile_crate.png',
        'house_red': 'tile_house_red.png',
        'house_blue': 'tile_house_blue.png',
    }
    for key, dest in tile_map.items():
        rel = tiles.get(key, '')
        if not copy_tile(RAW, rel, dest, tile_size):
            print(f'  警告：缺少 {rel}')

    chars = cfg.get('characters', {})
    blue_ok = build_character_sheet(
        RAW, chars.get('blue', {}), frame_size, frames_per_dir, 'player_blue.png'
    )
    red_ok = build_character_sheet(
        RAW, chars.get('red', {}), frame_size, frames_per_dir, 'player_red.png'
    )
    if not blue_ok:
        print('  警告：藍角色 walk 影格未就緒')
    if not red_ok:
        print('  警告：紅角色 walk 影格未就緒')

    effects = cfg.get('effects', {})
    bubble_rel = effects.get('bubble', 'effects/bubble.png')
    if not copy_effect(RAW, bubble_rel, 'bubble.png', frame_size):
        print(f'  警告：缺少 {bubble_rel}')

    explosion_frames = 4
    if build_explosion(RAW, effects.get('explosion', 'effects/explosion'), frame_size):
        paths = list_frames(RAW / effects.get('explosion', 'effects/explosion'))
        explosion_frames = min(4, max(1, len(paths)))

    items = cfg.get('items', {})
    for key, dest in [
        ('speed', 'item_speed.png'),
        ('power', 'item_power.png'),
        ('bubble', 'item_bubble.png'),
    ]:
        rel = items.get(key, f'items/{key}.png')
        if not copy_effect(RAW, rel, dest, frame_size):
            print(f'  警告：缺少道具 {rel}')

    write_runtime_manifest(cfg, frames_per_dir, frame_size, explosion_frames, source='bnb')
    print(f'完成 → {OUT}（manifest: {frame_size}px × {frames_per_dir} 格/方向）')


if __name__ == '__main__':
    main()
