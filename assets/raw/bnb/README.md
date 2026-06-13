# 爆爆王私人素材（本機用，勿 commit PNG）

重新產生遊戲素材（優先 raw/bnb，否則 **bnb-style 手繪 homage**，非截圖）：

```bash
npm run assets          # 預設：generate-bnb-style-assets.py
npm run assets:style    # 同上
npm run assets:reference  # 僅 debug：從截圖裁切（不建議）
npm run dev
```

瀏覽器請 **硬重新整理**（Cmd+Shift+R）。

## 目錄結構

```
assets/raw/bnb/
├── manifest.json          ← 格數、路徑設定（可改 walkFramesPerDirection、characterFrameSize）
├── tiles/
│   ├── grass.png          ← 草地（Lego 凸點綠地）
│   ├── road.png           ← 馬路
│   ├── wall.png           ← 不可破壞牆
│   ├── tree.png           ← 樹
│   ├── crate.png          ← 木箱（可炸）
│   ├── house_red.png      ← 紅/橘屋頂房子
│   └── house_blue.png     ← 藍屋頂房子
├── characters/
│   ├── blue/              ← P1 藍寶（或任意角色）
│   │   ├── walk_down/     ← 00.png, 01.png … 朝下走步
│   │   ├── walk_up/
│   │   ├── walk_left/
│   │   └── walk_right/
│   └── red/               ← P2
│       └── …同上
├── effects/
│   ├── bubble.png         ← 水球
│   └── explosion/         ← 01.png … 爆炸動畫（至少 1 張）
└── items/
    ├── speed.png
    ├── power.png
    └── bubble.png
```

每個 `walk_*` 資料夾放 **同一方向** 的連續影格，檔名排序後取前 N 格（N = `walkFramesPerDirection`，預設 4）。
影格不足時會重複最後一格補滿。

## 從遊戲 client 解包（2026/8/13 關服前）

1. 安裝台版或韓版《爆爆王 / Crazy Arcade》client。
2. 用 **GAME RIPPER** 或社群工具解 `.bfz` / `.pkn`（常見輸出在 `Images/` 底下）。
3. 地圖磚：找村莊 map 的 tile / object 圖。
4. 角色：找 `walk` / `move` 四方向序列（檔名常含 `down` `up` `left` `right` 或 `0~3`）。
5. 複製到上表對應資料夾，跑 `prepare-bnb-assets.py`。

## 備註

- 此目錄已在 `.gitignore`，PNG **不會** 被 git 追蹤。
- 若尚未放素材，腳本會沿用 `public/assets/` 現有 Kenney 圖並寫入 manifest。
- 對照版型：`reference-village10.png`（專案根目錄）。
