#!/usr/bin/env python3
"""從 Kenney CC0 素材複製並縮放至 public/assets/（取代 generate-assets.py 像素圖）"""
from __future__ import annotations

import os
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets'

KENNEY_TDS = Path('/tmp/kenney-tds')
KENNEY_TANKS = Path('/tmp/kenney-tanks/PNG/Default size')
KENNEY_PARTICLES = Path('/tmp/kenney-particles/PNG')

# BootScene 與 Fighter 使用 32×32 動畫格
SPRITE_FRAME = 32
TILE_OUT = 64


def ensure_dirs() -> None:
    OUT.mkdir(parents=True, exist_ok=True)


def resize_center(img: Image.Image, size: int) -> Image.Image:
    """等比縮放後置中於透明畫布"""
    img = img.convert('RGBA')
    w, h = img.size
    scale = min(size / w, size / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def save_tile(src: Path, dest_name: str, size: int = TILE_OUT) -> None:
    img = Image.open(src).convert('RGBA')
    img = resize_center(img, size)
    img.save(OUT / dest_name)


def composite_on_grass(overlay: Path, dest_name: str) -> None:
    """小物件貼在草地底圖上"""
    grass = Image.open(KENNEY_TANKS / 'tileGrass1.png').convert('RGBA')
    grass = grass.resize((TILE_OUT, TILE_OUT), Image.Resampling.LANCZOS)
    obj = Image.open(overlay).convert('RGBA')
    obj = resize_center(obj, int(TILE_OUT * 0.85))
    grass.paste(obj, ((TILE_OUT - obj.width) // 2, (TILE_OUT - obj.height) // 2), obj)
    grass.save(OUT / dest_name)


def crop_particle_center(src: Path, frame: int = SPRITE_FRAME) -> Image.Image:
    """512×512 粒子圖取中央不透明區域"""
    img = Image.open(src).convert('RGBA')
    bbox = img.getbbox()
    if not bbox:
        return resize_center(img, frame)
    cropped = img.crop(bbox)
    return resize_center(cropped, frame)


def build_explosion_sheet() -> None:
    """火焰粒子橫向 4 格爆炸動畫"""
    frames = ['flame_01.png', 'flame_02.png', 'flame_03.png', 'flame_04.png']
    sheet = Image.new('RGBA', (SPRITE_FRAME * 4, SPRITE_FRAME), (0, 0, 0, 0))
    for i, name in enumerate(frames):
        frame = crop_particle_center(KENNEY_PARTICLES / name, SPRITE_FRAME)
        sheet.paste(frame, (i * SPRITE_FRAME, 0), frame)
    sheet.save(OUT / 'explosion.png')


def parse_character_rects(sheet_xml: Path, prefix: str) -> dict[str, tuple[int, int, int, int]]:
    tree = ET.parse(sheet_xml)
    rects: dict[str, tuple[int, int, int, int]] = {}
    for sub in tree.getroot():
        name = sub.attrib.get('name', '')
        if not name.startswith(prefix):
            continue
        pose = name.replace(prefix, '').replace('.png', '')
        rects[pose] = (
            int(sub.attrib['x']),
            int(sub.attrib['y']),
            int(sub.attrib['width']),
            int(sub.attrib['height']),
        )
    return rects


def crop_sprite(sheet: Image.Image, rect: tuple[int, int, int, int]) -> Image.Image:
    x, y, w, h = rect
    return sheet.crop((x, y, x + w, y + h))


def orient_frame(frame: Image.Image, direction: str) -> Image.Image:
    """Kenney 角色預設朝下；依方向翻轉／旋轉"""
    if direction == 'down':
        return frame
    if direction == 'up':
        return frame.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    if direction == 'left':
        return frame.transpose(Image.Transpose.ROTATE_90)
    return frame.transpose(Image.Transpose.ROTATE_270)


def build_player_sheet(
    sheet_path: Path,
    xml_path: Path,
    prefix: str,
    dest_name: str,
) -> None:
    """16 格：4 方向 × 4 幀（stand/hold 交替模擬走路）"""
    sheet = Image.open(sheet_path).convert('RGBA')
    rects = parse_character_rects(xml_path, prefix)
    pose_cycle = ['stand', 'hold', 'stand', 'hold']
    for pose in pose_cycle:
        if pose not in rects:
            raise KeyError(f'缺少姿勢 {prefix}{pose}')

    directions = ['down', 'up', 'left', 'right']
    out = Image.new('RGBA', (SPRITE_FRAME * 4, SPRITE_FRAME * 4), (0, 0, 0, 0))

    for row, direction in enumerate(directions):
        for col, pose in enumerate(pose_cycle):
            raw = crop_sprite(sheet, rects[pose])
            oriented = orient_frame(raw, direction)
            cell = resize_center(oriented, SPRITE_FRAME)
            out.paste(cell, (col * SPRITE_FRAME, row * SPRITE_FRAME), cell)

    out.save(OUT / dest_name)


def main() -> None:
    ensure_dirs()

    # 地形（Kenney Top-down Tanks）
    save_tile(KENNEY_TANKS / 'tileGrass1.png', 'tile_grass.png')
    save_tile(KENNEY_TANKS / 'tileGrass_roadEast.png', 'tile_road.png')
    composite_on_grass(KENNEY_TANKS / 'barricadeWood.png', 'tile_wall.png')
    composite_on_grass(KENNEY_TANKS / 'treeGreen_large.png', 'tile_tree.png')
    composite_on_grass(KENNEY_TANKS / 'crateWood.png', 'tile_crate.png')

    # 房屋（Kenney Top-down Shooter 建築磚）
    tds_tiles = KENNEY_TDS / 'PNG' / 'Tiles'
    save_tile(tds_tiles / 'tile_51.png', 'tile_house_red.png')
    save_tile(tds_tiles / 'tile_131.png', 'tile_house_blue.png')

    # 角色（Man Blue / Soldier 1）
    char_sheet = KENNEY_TDS / 'Spritesheet' / 'spritesheet_characters.png'
    char_xml = KENNEY_TDS / 'Spritesheet' / 'spritesheet_characters.xml'
    build_player_sheet(char_sheet, char_xml, 'manBlue_', 'player_blue.png')
    build_player_sheet(char_sheet, char_xml, 'soldier1_', 'player_red.png')

    # 水泡與道具（Kenney Particle Pack）
    crop_particle_center(KENNEY_PARTICLES / 'circle_03.png', SPRITE_FRAME).save(
        OUT / 'bubble.png',
    )
    build_explosion_sheet()
    crop_particle_center(KENNEY_PARTICLES / 'light_01.png', SPRITE_FRAME).save(
        OUT / 'item_speed.png',
    )
    crop_particle_center(KENNEY_PARTICLES / 'fire_01.png', SPRITE_FRAME).save(
        OUT / 'item_power.png',
    )
    crop_particle_center(KENNEY_PARTICLES / 'circle_02.png', SPRITE_FRAME).save(
        OUT / 'item_bubble.png',
    )

    files = sorted(p.name for p in OUT.iterdir() if p.suffix == '.png')
    print('ok', files)


if __name__ == '__main__':
    main()
