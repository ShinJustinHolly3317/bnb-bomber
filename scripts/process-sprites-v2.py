#!/usr/bin/env python3
"""
v2: 改進版 sprite sheet 處理
問題：舊版直接 256x142 → 64x64，X 縮放 0.25 但 Y 縮放 0.45 → 角色嚴重變形（太高太窄）
修正：先裁切到角色邊界（~112x141），再 letterbox 縮放保持原始 AR（0.79）

角色對應關係（使用者確認）：
  藍色 BAZZI (BLUE BO) → 藍寶 (dao)   → player_blue.png
  紅色 red bear        → 睏寶 (bazzi)  → player_red.png
  黃色 NAN-NAN         → 囡囡 (nana)   → player_pink.png
  紅寶 (maro)         → 維持原狀（同樣 re-process 修比例）→ player_yellow.png
"""

import sys
import numpy as np
from PIL import Image
from collections import deque

# ── 來源檔案（新版三張）────────────────────────────────────────────────────
BASE = '/Users/justinkao/.cursor/projects/Users-justinkao-projects-bnb-bomber/assets'

SRC_FILES = {
    'dao':   f'{BASE}/S__46833669_0-c96f0997-f4e1-438e-b03d-0f1e999c4e88-1ca75720-ee41-4f0e-9d15-c3058863cf61.png',
    'bazzi': f'{BASE}/S__46833670-9cbf88aa-b572-4868-9bd1-305ac57f9d17-bc0128f8-fc81-4051-bf72-e67a5e199750.png',
    'nana':  f'{BASE}/S__46833668-5f9b5404-6ba3-43c1-b391-04acab093ad9-fef13e63-e25e-4652-af05-e1fb15e9091f.png',
    # maro 使用與 bazzi 相同 source（紅熊），但維持原狀的設計
    'maro':  f'{BASE}/S__46833670-9cbf88aa-b572-4868-9bd1-305ac57f9d17-bc0128f8-fc81-4051-bf72-e67a5e199750.png',
}

CHAR_TEXTURE = {
    'dao':   'player_blue',
    'bazzi': 'player_red',
    'nana':  'player_pink',
    'maro':  'player_yellow',
}

DEST_DIR    = '/Users/justinkao/projects/bnb-bomber/public/assets'
FRAME_OUT   = 64     # 輸出每格尺寸（square）
COLS        = 4
ROWS        = 4
PADDING     = 6      # 角色邊界外加的留白
TITLE_ROW0  = 22     # row0 頂部標題文字高度（px in source）


# ── flood-fill 去背 ────────────────────────────────────────────────────────
def flood_fill_bg(arr: np.ndarray, gray_tol: int = 22, min_val: int = 155) -> np.ndarray:
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

    for x in range(w):
        for ys in [0, h - 1]:
            if not visited[ys, x] and is_bg(ys, x):
                visited[ys, x] = True
                queue.append((ys, x))
    for y in range(h):
        for xs in [0, w - 1]:
            if not visited[y, xs] and is_bg(y, xs):
                visited[y, xs] = True
                queue.append((y, xs))

    while queue:
        cy, cx = queue.popleft()
        bg_mask[cy, cx] = True
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg(ny, nx):
                visited[ny, nx] = True
                queue.append((ny, nx))

    return bg_mask


# ── 找全域角色邊界 ────────────────────────────────────────────────────────
def find_global_bounds(rgba_arr: np.ndarray, fw: int, fh: int) -> tuple[int, int, int, int]:
    """跨所有 frame 找到角色最大 bounding box（相對於單一 frame 左上角）"""
    gx0, gy0 = fw, fh
    gx1, gy1 = 0, 0

    for row in range(ROWS):
        for col in range(COLS):
            fx0, fy0 = col * fw, row * fh
            alpha = rgba_arr[fy0:fy0 + fh, fx0:fx0 + fw, 3].copy()
            # row0 清除標題文字殘留
            if row == 0:
                alpha[:TITLE_ROW0, :] = 0

            ys = np.where(np.any(alpha > 20, axis=1))[0]
            xs = np.where(np.any(alpha > 20, axis=0))[0]

            if len(ys) > 0 and len(xs) > 0:
                gx0 = min(gx0, int(xs[0]))
                gy0 = min(gy0, int(ys[0]))
                gx1 = max(gx1, int(xs[-1]))
                gy1 = max(gy1, int(ys[-1]))

    # 加 padding，但不超出 frame
    gx0 = max(0, gx0 - PADDING)
    gy0 = max(0, gy0 - PADDING)
    gx1 = min(fw - 1, gx1 + PADDING)
    gy1 = min(fh - 1, gy1 + PADDING)

    return gx0, gy0, gx1, gy1


# ── 主處理函式 ────────────────────────────────────────────────────────────
def process_sheet(src_path: str, char_name: str) -> None:
    print(f'\n[{char_name}] 讀取 {src_path.split("/")[-1]}')
    img = Image.open(src_path).convert('RGB')
    arr = np.array(img)
    h, w = arr.shape[:2]
    fw, fh = w // COLS, h // ROWS
    print(f'  原始尺寸：{w}×{h}，每格 {fw}×{fh}')

    # Step 1：flood-fill 去背
    bg_mask = flood_fill_bg(arr)
    rgba_arr = np.zeros((h, w, 4), dtype=np.uint8)
    rgba_arr[:, :, :3] = arr
    rgba_arr[:, :, 3] = np.where(bg_mask, 0, 255).astype(np.uint8)

    # Step 2：找全域角色邊界
    gx0, gy0, gx1, gy1 = find_global_bounds(rgba_arr, fw, fh)
    crop_w = gx1 - gx0
    crop_h = gy1 - gy0
    char_ar = crop_w / crop_h
    print(f'  角色邊界：({gx0},{gy0})-({gx1},{gy1}) = {crop_w}×{crop_h}，AR={char_ar:.2f}')

    # Step 3：letterbox 縮放參數
    scale = min(FRAME_OUT / crop_w, FRAME_OUT / crop_h)
    scaled_w = round(crop_w * scale)
    scaled_h = round(crop_h * scale)
    x_off = (FRAME_OUT - scaled_w) // 2
    y_off = (FRAME_OUT - scaled_h) // 2
    print(f'  縮放 scale={scale:.3f}，輸出角色 {scaled_w}×{scaled_h} in {FRAME_OUT}×{FRAME_OUT}')

    # Step 4：組合輸出 sheet
    output = Image.new('RGBA', (FRAME_OUT * COLS, FRAME_OUT * ROWS), (0, 0, 0, 0))

    for row in range(ROWS):
        for col in range(COLS):
            fx0, fy0 = col * fw, row * fh
            frame_rgba = rgba_arr[fy0:fy0 + fh, fx0:fx0 + fw].copy()

            # 清除 row0 標題文字
            if row == 0:
                frame_rgba[:TITLE_ROW0, :, :] = 0

            # 裁切到角色邊界
            cropped = Image.fromarray(frame_rgba[gy0:gy1, gx0:gx1], 'RGBA')

            # LANCZOS 縮放
            scaled = cropped.resize((scaled_w, scaled_h), Image.LANCZOS)

            # Letterbox 置入 FRAME_OUT×FRAME_OUT
            canvas = Image.new('RGBA', (FRAME_OUT, FRAME_OUT), (0, 0, 0, 0))
            canvas.paste(scaled, (x_off, y_off), scaled)

            output.paste(canvas, (col * FRAME_OUT, row * FRAME_OUT), canvas)

    dest = f'{DEST_DIR}/{CHAR_TEXTURE[char_name]}.png'
    output.save(dest, 'PNG')
    print(f'  ✓ sheet → {dest}')

    # Step 5：生成 portrait（48×48，取 row0 col0 正面，NEAREST 保留像素感）
    # 用比 48×48 大的尺寸先裁再縮，確保品質
    front_frame = output.crop((0, 0, FRAME_OUT, FRAME_OUT))
    # 找角色在這格的非透明區域並緊密裁切
    fa = np.array(front_frame)
    ys_p = np.where(np.any(fa[:, :, 3] > 20, axis=1))[0]
    xs_p = np.where(np.any(fa[:, :, 3] > 20, axis=0))[0]
    if len(ys_p) > 0 and len(xs_p) > 0:
        px0, py0, px1, py1 = int(xs_p[0]), int(ys_p[0]), int(xs_p[-1]) + 1, int(ys_p[-1]) + 1
        tight = front_frame.crop((px0, py0, px1, py1))
        # letterbox 到 48×48
        pw, ph = tight.size
        ps = min(48 / pw, 48 / ph)
        psw, psh = round(pw * ps), round(ph * ps)
        pxoff, pyoff = (48 - psw) // 2, (48 - psh) // 2
        portrait = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
        portrait.paste(tight.resize((psw, psh), Image.NEAREST), (pxoff, pyoff), tight.resize((psw, psh), Image.NEAREST))
        portrait_dest = f'{DEST_DIR}/portrait_{char_name}.png'
        portrait.save(portrait_dest, 'PNG')
        print(f'  ✓ portrait → {portrait_dest}')


def main() -> None:
    for char_name, src_path in SRC_FILES.items():
        try:
            process_sheet(src_path, char_name)
        except Exception as e:
            print(f'  ✗ {char_name} 錯誤：{e}', file=sys.stderr)
            raise

    print('\n✅ 全部完成')


if __name__ == '__main__':
    main()
