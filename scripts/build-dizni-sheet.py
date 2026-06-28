#!/usr/bin/env python3
"""
從 dizni-turnaround.png（4 方向轉身圖）組裝出遊戲用的 256x256 walk sprite sheet。

流程：
1. flood-fill 去除淺灰背景
2. 找出 4 個角色連通區塊，由左到右排序 → [down(正面), up(背面), left(左), right(右)]
3. 每個方向裁切到角色邊界，letterbox 縮放置入 64x64 base frame
4. 每個方向產 4 帳走路循環（垂直 bob + 下半身左右交替位移模擬踏步）
5. 輸出 256x256 sheet（row0=down, row1=up, row2=left, row3=right）
6. 另外輸出 48x48 portrait（取正面）

格式對齊其他角色：64x64 frame、透明背景。
"""

import numpy as np
from PIL import Image, ImageOps
from collections import deque

SRC = '/Users/justinkao/.cursor/projects/Users-justinkao-projects-bnb-bomber/assets/dizni-turnaround.png'
DEST_SHEET = '/Users/justinkao/projects/bnb-bomber/public/assets/player_purple.png'
DEST_PORTRAIT = '/Users/justinkao/projects/bnb-bomber/public/assets/portrait_dizni.png'

FRAME = 64
COLS = 4
ROWS = 4
# 角色在 frame 內的目標高度（留上下小邊距），對齊其他角色約 0.9 高度比
TARGET_H = 60
PADDING = 4


# ── flood-fill 去淺灰背景 ──────────────────────────────────────────────────
def remove_bg(arr: np.ndarray, tol: int = 28, min_val: int = 185) -> np.ndarray:
    h, w = arr.shape[:2]
    r = arr[:, :, 0].astype(np.int32)
    g = arr[:, :, 1].astype(np.int32)
    b = arr[:, :, 2].astype(np.int32)

    def is_bg(y: int, x: int) -> bool:
        avg = (r[y, x] + g[y, x] + b[y, x]) / 3.0
        return (abs(r[y, x] - avg) < tol and abs(g[y, x] - avg) < tol and
                abs(b[y, x] - avg) < tol and avg > min_val)

    visited = np.zeros((h, w), dtype=bool)
    bg = np.zeros((h, w), dtype=bool)
    q: deque = deque()
    for x in range(w):
        for ys in (0, h - 1):
            if not visited[ys, x] and is_bg(ys, x):
                visited[ys, x] = True
                q.append((ys, x))
    for y in range(h):
        for xs in (0, w - 1):
            if not visited[y, xs] and is_bg(y, xs):
                visited[y, xs] = True
                q.append((y, xs))
    while q:
        cy, cx = q.popleft()
        bg[cy, cx] = True
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg(ny, nx):
                visited[ny, nx] = True
                q.append((ny, nx))
    return bg


# ── 連通元件 labeling（找 4 個角色）─────────────────────────────────────────
def find_blobs(alpha: np.ndarray, min_area: int = 2000):
    h, w = alpha.shape
    visited = np.zeros((h, w), dtype=bool)
    blobs = []
    solid = alpha > 30
    for sy in range(h):
        for sx in range(w):
            if solid[sy, sx] and not visited[sy, sx]:
                q = deque([(sy, sx)])
                visited[sy, sx] = True
                xs0, ys0, xs1, ys1 = sx, sy, sx, sy
                area = 0
                while q:
                    cy, cx = q.popleft()
                    area += 1
                    xs0 = min(xs0, cx); ys0 = min(ys0, cy)
                    xs1 = max(xs1, cx); ys1 = max(ys1, cy)
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1),
                                   (-1, -1), (-1, 1), (1, -1), (1, 1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not visited[ny, nx]:
                            visited[ny, nx] = True
                            q.append((ny, nx))
                if area >= min_area:
                    blobs.append((xs0, ys0, xs1 + 1, ys1 + 1, area))
    return blobs


def crop_to_base(rgba: Image.Image) -> Image.Image:
    """裁切角色 → letterbox 縮放到 64x64，底部對齊（留 PADDING）"""
    a = np.array(rgba)
    ys = np.where(np.any(a[:, :, 3] > 20, axis=1))[0]
    xs = np.where(np.any(a[:, :, 3] > 20, axis=0))[0]
    cropped = rgba.crop((int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1))
    cw, ch = cropped.size
    scale = min((FRAME - PADDING * 2) / cw, TARGET_H / ch)
    sw, sh = max(1, round(cw * scale)), max(1, round(ch * scale))
    scaled = cropped.resize((sw, sh), Image.LANCZOS)
    base = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    x_off = (FRAME - sw) // 2
    y_off = FRAME - PADDING - sh  # 底部對齊
    base.paste(scaled, (x_off, y_off), scaled)
    return base


def make_walk_frames(base: Image.Image, axis: str) -> list[Image.Image]:
    """從單一 base pose 產 4 帳走路：
    f0 接觸(中立), f1 抬起+踏步A, f2 中立, f3 抬起+踏步B
    axis='vert' 用於正/背面（腳左右分開位移），'side' 用於側面（腳前後位移）。
    """
    arr = np.array(base)
    leg_top = FRAME - PADDING - 18  # 下半身（腿）區域起點

    def shift_legs(a: np.ndarray, dx: int, lift: int) -> Image.Image:
        out = np.zeros_like(a)
        # 整體抬起 lift（上半身與腿一起，模擬重心起伏）
        body = a[:leg_top]
        legs = a[leg_top:]
        # 上半身往上 lift
        if lift > 0:
            out[lift:leg_top + lift] = a[:leg_top]
        else:
            out[:leg_top] = a[:leg_top]
        # 腿：水平位移 dx，並跟著上抬 lift
        lh = legs.shape[0]
        dst_y0 = leg_top + lift
        dst_y1 = min(FRAME, dst_y0 + lh)
        src = legs[:dst_y1 - dst_y0]
        if dx != 0:
            src = np.roll(src, dx, axis=1)
            if dx > 0:
                src[:, :dx] = 0
            else:
                src[:, dx:] = 0
        out[dst_y0:dst_y1] = src
        return Image.fromarray(out, 'RGBA')

    neutral = base.copy()
    if axis == 'vert':
        stepA = shift_legs(arr, dx=2, lift=2)
        stepB = shift_legs(arr, dx=-2, lift=2)
    else:  # side：腿前後（水平）位移幅度大一點
        stepA = shift_legs(arr, dx=3, lift=2)
        stepB = shift_legs(arr, dx=-3, lift=2)
    return [neutral, stepA, neutral.copy(), stepB]


def main() -> None:
    img = Image.open(SRC).convert('RGB')
    arr = np.array(img)
    bg = remove_bg(arr)
    rgba_full = np.zeros(arr.shape[:2] + (4,), dtype=np.uint8)
    rgba_full[:, :, :3] = arr
    rgba_full[:, :, 3] = np.where(bg, 0, 255).astype(np.uint8)
    alpha = rgba_full[:, :, 3]

    blobs = find_blobs(alpha)
    blobs.sort(key=lambda b: -b[4])  # 取最大的 4 個
    blobs = blobs[:4]
    blobs.sort(key=lambda b: b[0])   # 由左到右 = down, up, left, right
    assert len(blobs) == 4, f'只找到 {len(blobs)} 個角色區塊'
    print('4 個角色區塊（x0,y0,x1,y1,area）:')
    for b in blobs:
        print('  ', b)

    full_img = Image.fromarray(rgba_full, 'RGBA')
    dirs = ['down', 'up', 'left', 'right']
    axes = {'down': 'vert', 'up': 'vert', 'left': 'side', 'right': 'side'}
    bases = {}
    for d, (x0, y0, x1, y1, _area) in zip(dirs, blobs):
        sub = full_img.crop((x0, y0, x1, y1))
        bases[d] = crop_to_base(sub)

    # 轉身圖的左右側面有時朝向不一致，為確保走路方向正確：
    # right 一律用 left 水平鏡像，保證朝向相反。
    bases['right'] = ImageOps.mirror(bases['left'])

    sheet = Image.new('RGBA', (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))
    for row, d in enumerate(dirs):
        frames = make_walk_frames(bases[d], axes[d])
        for col, fr in enumerate(frames):
            sheet.paste(fr, (col * FRAME, row * FRAME), fr)
    sheet.save(DEST_SHEET)
    print('✓ sheet →', DEST_SHEET, sheet.size)

    # portrait：取正面 base，緊密裁切 letterbox 到 48x48
    front = bases['down']
    fa = np.array(front)
    ys = np.where(np.any(fa[:, :, 3] > 20, axis=1))[0]
    xs = np.where(np.any(fa[:, :, 3] > 20, axis=0))[0]
    tight = front.crop((int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1))
    tw, th = tight.size
    ps = min(46 / tw, 46 / th)
    psw, psh = round(tw * ps), round(th * ps)
    portrait = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
    scaled = tight.resize((psw, psh), Image.NEAREST)
    portrait.paste(scaled, ((48 - psw) // 2, (48 - psh) // 2), scaled)
    portrait.save(DEST_PORTRAIT)
    print('✓ portrait →', DEST_PORTRAIT, portrait.size)


if __name__ == '__main__':
    main()
