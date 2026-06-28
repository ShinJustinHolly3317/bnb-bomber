#!/usr/bin/env python3
"""
處理新版高清 sprite sheet，移除棋格背景後輸出成 Phaser 相容格式。

新 sheet 格式：1024x571，4 cols × 4 rows（對應 down/up/left/right × 4 walk frames）
輸出格式：4 cols × 4 rows，每 frame 64×64，整張 256×256 RGBA
"""

import sys
import numpy as np
from PIL import Image
from collections import deque

# ── 設定 ──────────────────────────────────────────────────────────────────
SRC_FILES = {
    'bazzi': '/Users/justinkao/.cursor/projects/Users-justinkao-projects-bnb-bomber/assets/S__46833669_0-0f7b366c-df0d-44dc-8e45-6e8ea6122562.png',
    'maro':  '/Users/justinkao/.cursor/projects/Users-justinkao-projects-bnb-bomber/assets/S__46833670-a2a2454a-f975-496c-96b5-db8ee6517ae8.png',
    'nana':  '/Users/justinkao/.cursor/projects/Users-justinkao-projects-bnb-bomber/assets/S__46833668-17285985-dd20-463d-94f4-b70c36a074dc.png',
}

# CharacterCatalog 對應的 texture key → 檔名
CHAR_TEXTURE = {
    'bazzi': 'player_red',
    'maro':  'player_yellow',
    'nana':  'player_pink',
}

DEST_DIR = '/Users/justinkao/projects/bnb-bomber/public/assets'
FRAME_OUT = 64       # 輸出每格大小
COLS      = 4        # 每行幾格（walk frames）
ROWS      = 4        # 幾行（down/up/left/right）


def flood_fill_bg(arr: np.ndarray, gray_tol: int = 22, min_val: int = 155) -> np.ndarray:
    """
    從四邊緣做 flood fill，把接觸到外緣的灰色棋格像素標為背景。
    回傳 bool mask，True = 背景。
    """
    h, w = arr.shape[:2]
    r = arr[:, :, 0].astype(np.int32)
    g = arr[:, :, 1].astype(np.int32)
    b = arr[:, :, 2].astype(np.int32)

    def is_bg(y: int, x: int) -> bool:
        avg = (r[y, x] + g[y, x] + b[y, x]) / 3.0
        return (abs(r[y, x] - avg) < gray_tol and
                abs(g[y, x] - avg) < gray_tol and
                abs(b[y, x] - avg) < gray_tol and
                avg > min_val)

    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    queue: deque = deque()

    # 邊緣種子
    for x in range(w):
        for y_seed in [0, h - 1]:
            if not visited[y_seed, x] and is_bg(y_seed, x):
                visited[y_seed, x] = True
                queue.append((y_seed, x))
    for y in range(h):
        for x_seed in [0, w - 1]:
            if not visited[y, x_seed] and is_bg(y, x_seed):
                visited[y, x_seed] = True
                queue.append((y, x_seed))

    while queue:
        cy, cx = queue.popleft()
        bg_mask[cy, cx] = True
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg(ny, nx):
                visited[ny, nx] = True
                queue.append((ny, nx))

    return bg_mask


def process_sheet(src_path: str, char_name: str) -> None:
    print(f'\n[{char_name}] 讀取 {src_path}')
    img = Image.open(src_path).convert('RGB')
    arr = np.array(img)
    h, w = arr.shape[:2]
    print(f'  原始尺寸：{w}×{h}')

    # 計算每格大小（允許最後一行高度略不整除）
    fw = w // COLS
    fh = h // ROWS
    print(f'  原始每格：{fw}×{fh}')

    # 去背
    bg_mask = flood_fill_bg(arr)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = arr
    rgba[:, :, 3] = np.where(bg_mask, 0, 255).astype(np.uint8)
    img_rgba = Image.fromarray(rgba, 'RGBA')

    # 切 frame → resize → 組合輸出 sheet
    out_w = FRAME_OUT * COLS
    out_h = FRAME_OUT * ROWS
    output = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))

    total_px = h * w
    bg_px = int(bg_mask.sum())
    print(f'  去背像素：{bg_px}/{total_px} ({bg_px/total_px*100:.1f}%)')

    # 原始圖頂部有標題文字（約前 22 px），只出現在第 0 行（down 方向）
    # 計算縮放比例後要清除的行數
    TITLE_CROP_SRC = 22
    title_clear_rows = int(np.ceil(TITLE_CROP_SRC / fh * FRAME_OUT)) + 1

    for row in range(ROWS):
        for col in range(COLS):
            x0 = col * fw
            y0 = row * fh
            x1 = x0 + fw
            y1 = y0 + fh
            frame = img_rgba.crop((x0, y0, x1, y1))
            # LANCZOS 縮放保持品質
            frame_resized = frame.resize((FRAME_OUT, FRAME_OUT), Image.LANCZOS)

            # 第 0 行：清除頂部標題文字殘留像素
            if row == 0:
                arr_f = np.array(frame_resized)
                arr_f[:title_clear_rows, :, :] = 0
                frame_resized = Image.fromarray(arr_f, 'RGBA')

            dst_x = col * FRAME_OUT
            dst_y = row * FRAME_OUT
            output.paste(frame_resized, (dst_x, dst_y), frame_resized)

    dest = f'{DEST_DIR}/{CHAR_TEXTURE[char_name]}.png'
    output.save(dest, 'PNG')
    print(f'  ✓ 輸出 → {dest} ({out_w}×{out_h} RGBA)')

    # 同步存一份到 design-references 備份
    backup = f'/Users/justinkao/projects/bnb-bomber/design-references/characters/{char_name}_hd_sheet.png'
    img.save(backup, 'PNG')
    print(f'  ✓ 備份原圖 → {backup}')


def main():
    for char_name, src_path in SRC_FILES.items():
        try:
            process_sheet(src_path, char_name)
        except Exception as e:
            print(f'  ✗ 錯誤：{e}', file=sys.stderr)
            raise

    print('\n全部完成！請更新 sprite-manifest.json 的 characterFrameWidth/Height 為 64。')


if __name__ == '__main__':
    main()
