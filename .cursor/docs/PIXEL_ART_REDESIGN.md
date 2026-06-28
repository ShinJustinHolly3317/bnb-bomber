# 像素風美術重設計 — 討論紀錄與規格

> 建立：2026-06-13  
> 狀態：**進行中**  
> 工作流：image-to-code（先概念圖 → 分析 → 實作）

---

## 1. 使用者需求摘要

從 `/image-to-code` 出發，全面改走 **像素風（pixel art）**，對齊爆爆王 OG 視覺，而非現有平滑 `bnb-style` 程式繪圖。

| # | 需求 | 說明 |
|---|------|------|
| 1 | 重做藍寶、睏寶 | 現有角色太模糊；要更貼近官方像素感 |
| 2 | 新增紅寶、囡囡 | 參照原圖，同樣像素 chibi 四方向走路 |
| 3 | 優化村10 地圖 | 現排版混亂；走道、房屋、木箱節奏要更清楚 |
| 4 | 新增遊戲大廳 | 配對用，最多 **6 人**；參考現行爆爆王大廳做像素版 |

**未改動的共識（沿用 HANDOFF）：**

- Phaser 3 + Vite + TypeScript，瀏覽器本地
- 村10 完整對戰規則（道具、HP、泡泡）
- P1 WASD+Space、P2 方向鍵+Enter（對戰內）
- `pixelArt: true` 已在 `game/config.ts`

---

## 2. 視覺方向（image-first 分析）

概念圖存放：`design-references/pixel-*.png`

### 2.1 角色（`pixel-characters-ref.png`）

| 角色 | 英文名 | OG 特徵（beanfun game2_*.gif） |
|------|--------|--------------------------------|
| 藍寶 | Dao | 藍水滴兜帽 + 側圓耳、粗眉、直向黑眼、白手套 |
| 睏寶 | Bazzi | 紅連帽 + 熊耳、半閉眼、小嘴（無蛙鏡） |
| 紅寶 | Marid | 粉紅蘑菇帽、紅衣、兩顆黃扣（非黃帽） |
| 囡囡 | Uni | 黃衣 + 白兜帽邊、奶嘴、圓黑眼（非粉紅馬尾） |

**技術規格：**

- 色票 / 版型對齊 `design-references/characters/og/*_og_ref.png`
- 48×48 procedural（`scripts/bnb_walk_sheets.py`）
- `python3 scripts/download-og-character-refs.py` 可重新下載官方 GIF

- 原生 **48×48** 像素格繪製（`scripts/bnb_walk_sheets.py`），禁止 anti-aliasing
- 1px 深褐外框 `(24,18,16)`
- 四方向 × 4 walk frame = 16 格/角色 spritesheet
- 頭像 `portrait_*.png` 與 in-game sprite 同源（`portrait_frame()`）
- 概念圖四格由 sprite 回寫（`patch_char_design_ref`）
- 輸出檔：`player_blue.png`（藍寶）、`player_red.png`（睏寶）、`player_yellow.png`（紅寶）、`player_pink.png`（囡囡）

### 2.2 地圖 tile（`pixel-tiles-ref.png`）

- 草地：黃綠 lego 凸點（2×2 stud）
- 馬路：灰底 + 白�虛線
- 牆：深褐磚塊（不可破）
- 樹：三層圓冠 + 樹幹
- 木箱：X 交叉（可破）
- 紅/藍屋：lego 磚屋頂 + 小窗
- 水球、爆炸、道具：同像素語言

**Tile 輸出：40×40**（對齊 `TILE_SIZE`，避免縮放糊掉）

### 2.3 遊戲大廳（`pixel-lobby-ref.png`）

參考 [beanfun 爆爆王大廳說明](https://tw.beanfun.com/bnb/game6_3_2.htm)：

| 區塊 | 功能 |
|------|------|
| 頂欄 | 標題、頻道（自由/新手）、LUCCI 幣 |
| 左側 | 房間列表（房號/地圖/人數/狀態） |
| 右側 | **等待玩家 6 格**（2×3） |
| 底欄 | 開啟新局、快速加入、練習模式 |

MVP 實作：本地 mock 配對（無後端），6 slot 可選角色，2 人即可開局進 Duel。

---

## 3. 村10 地圖排版

**已凍結 — 請讀 `.cursor/docs/GAME_DESIGN.md` §2–§3。**

- Layout 正式版：**v1** → `src/data/village10-layout-v1.ts`（49 木箱、14 樹、13 紅屋…）
- 美術迭代 **不得** 修改 layout 字串；驗證：`npm run validate:map`
- 曾誤用 v2「稀疏排版」導致箱子變少 — 已回退 v1

---

## 4. 素材 Pipeline 變更

```
npm run assets
  └─ prepare-bnb-assets.py
       1. assets/raw/bnb/ 有 PNG → raw
       2. prepare-design-reference-assets.py  ← **目前預設（裁切概念圖）**
       3. generate-pixel-assets.py
       4. generate-bnb-style-assets.py
       5. prepare-reference-assets.py
       6. kenney
```

新增 script：

- `npm run assets:design` → `scripts/prepare-design-reference-assets.py`

Manifest `source: "design-reference"`。

**重要：** 使用者稱讚的 `design-references/pixel-*.png` 必須進 pipeline，不可只用程式簡化版替代。

---

## 5. 場景流程變更

```
BootScene → MenuScene → LobbyScene → DuelScene → GameOverScene
                ↑__________________________|
                         rematch
```

- **MenuScene**：四角色概念圖 + 底部木框「爆爆王 / Enter 進入大廳」
- **LobbyScene**：全螢幕 `lobby_bg`；slot 4-6 才 overlay 頭像；toast 取代常駐 status

---

## 6. 官方參考連結

| 資源 | URL |
|------|-----|
| 大廳功能說明 | https://tw.beanfun.com/bnb/game6_3_2.htm |
| 角色介紹 | https://tw.beanfun.com/bnb/game2.htm |
| 改版新聞（快速配對） | https://brand.gamania.com/gvoice/9818/ |
| 本地角色 README | `design-references/characters/README.md` |

---

## 7. 待辦 / 後續

- [ ] 真實多人連線（WebSocket）— 大廳目前 mock
- [ ] 大廳 BGM / 音效
- [ ] 6 人同場對戰（現 Duel 仍 1v1）
- [ ] 使用者提供 raw 官方 sprite 時接入 `assets/raw/bnb/`
- [ ] QA 腳本更新（Lobby 流程）

---

## 8. 相關文件

- 專案 handoff：`.cursor/HANDOFF.md`
- **視覺對照表**：`.cursor/docs/VISUAL_DESIGN.md`
- Agent changelog：`.cursor/agent-changelog/CHANGELOG.md`
- 概念圖：`design-references/pixel-characters-ref.png`、`pixel-tiles-ref.png`、`pixel-lobby-ref.png`
