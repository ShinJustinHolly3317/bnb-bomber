# bnb-bomber 遊戲設計文件

> 開發時 **必須參照本文件**。美術、UI、新功能不得擅自改動已凍結的 gameplay 資料。

---

## 1. 產品定位

| 項目 | 內容 |
|------|------|
| 類型 | 爆爆王 homage · 瀏覽器本地對戰 |
| MVP 地圖 | **村莊 10（村10）** |
| 模式 | 大廳 mock 配對（最多 6 人 UI）→ 實際對戰 **1v1** hotseat |
| 引擎 | Phaser 3 + Vite + TypeScript |

相關但分開的文件：

- 美術方向：`.cursor/docs/PIXEL_ART_REDESIGN.md`
- Agent 變更紀錄：`.cursor/agent-changelog/CHANGELOG.md`
- Session handoff：`.cursor/HANDOFF.md`

---

## 2. 地圖 layout 凍結原則（重要）

### 2.1 核心規則

1. **Layout 與美術分離**  
   - **Layout（格子邏輯）**：哪些格是草/路/牆/樹/箱/房 — 存在 `src/data/village10-layout-v*.ts`  
   - **美術（貼圖）**：`public/assets/tile_*.png`、素材 script — **不得** 為了「好看」去改 layout 字串  

2. **版本化**  
   - 目前正式版：**`v1`** → `src/data/village10-layout-v1.ts`  
   - 任何改動箱子/樹/房子**數量或位置**，必須：  
     a. 新建 `village10-layout-v2.ts`（或 bump 版本常數）  
     b. 更新 `VILLAGE10_LAYOUT_V*_COUNTS`  
     c. 更新本文件「§3 村10 v1 基準表」  
     d. 跑 `npm run validate:map` + QA 腳本  

3. **數量一致、盡可能滿**  
   - 開局時可破壞物（木箱）數量固定，**不**因美術迭代而減少。  
   - v1 為 reference-village10 對齊的**滿箱版**（61 木箱），不可再換成「稀疏排版」。  

4. **自動驗證**  
   - `npm run validate:map` 比對 v1 元素數量；CI / `qa:health` 前應通過。  
   - 改 `village10-map.ts` 時只允許：解析 layout、walkability API、**不可**內嵌另一套 `VILLAGE10_CHARS`。  

### 2.2 禁止事項

- ❌ 在美術 PR 裡順手改 `VILLAGE10_LAYOUT_V1` 字串  
- ❌ 在 `generate-*-assets.py` 裡改地圖邏輯  
- ❌ 用「中央馬路更通暢」等理由 silent 減少木箱/樹/房（需走版本 bump）  

### 2.3 允許事項

- ✅ 替換 `tile_grass.png` 等貼圖  
- ✅ 調 spawn **僅當** physics bug 且更新 `VILLAGE10_LAYOUT_V1_SPAWN` + QA  
- ✅ 新增 v2 layout 並在設計文件記錄 diff  

---

## 3. 村10 layout v1 基準表

**來源檔：** `src/data/village10-layout-v1.ts`  
**驗證：** `npm run validate:map`

| 元素 | 字元 | v1 數量 |
|------|------|--------|
| 草地 | `.` | 58 |
| 馬路 | `R` | 37 |
| 牆 | `#` | 8 |
| 樹 | `V` | 14 |
| 木箱 | `Y` | **61** |
| 紅屋 | `T` | 13 |
| 藍屋 | `B` | 4 |
| **總格** | | **195** (15×13) |

**出生點（v1）：**

| 玩家 | 格子 | 備註 |
|------|------|------|
| P1 | (2, 10) | 避開 world 左邊界 |
| P2 | (12, 1) | 右下角區域；QA 路徑以此為準 |

**固定道具（開局）：** `src/game/items/ItemKind.ts` → `VILLAGE10_ITEM_SPAWNS`（改 layout 時需一併檢查格子上是否仍為可 walk 的草/路）

---

## 4. 角色與操作

| 玩家 | 角色預設 | 移動 | 放球 |
|------|----------|------|------|
| P1 | 大廳 slot0 所選（預設藍寶） | WASD | Space |
| P2 | 大廳 slot1 所選（預設睏寶） | 方向鍵 | Enter |

OG 四角色：藍寶、睏寶、紅寶、囡囡 — 見 `src/game/characters/CharacterCatalog.ts`

---

## 5. 對戰規則（村10 MVP）

- HP 100；水球傷害 50  
- 木箱可破，機率掉落道具  
- 牆/樹/房屋不可破（blocking）  
- 勝負：一方 HP ≤ 0；雙方同歸於盡 → 平手  

常數：`src/game/constants.ts`

---

## 6. 場景流程

```
BootScene → MenuScene → LobbyScene → DuelScene → GameOverScene
                ↑______________________________|  (R rematch → Duel)
```

大廳：6 slot UI（mock），至少 2 人可開局。

---

## 7. 素材 pipeline（不影響 layout）

```
npm run assets → prepare-bnb-assets.py
  raw PNG → design-reference 裁切 → pixel 程式 → bnb-style → …
```

Manifest `source` 僅表示貼圖來源，**與** layout 版本無關。

---

## 8. 開發檢查清單

每次 PR / 改動前：

- [ ] 是否動到 `village10-layout-*.ts`？若是，是否 bump 版本並更新 §3？  
- [ ] `npm run validate:map`  
- [ ] `npm run qa:health`  
- [ ] 必要時 `node scripts/qa-center-duel.mjs`  
- [ ] 美術-only 變更確認 **未** 修改 layout 檔  

---

## 9. 修訂紀錄

| 日期 | 版本 | 說明 |
|------|------|------|
| 2026-06-13 | v1 凍結 | 還原滿箱 layout；自 v2「稀疏排版」回退；新增 validate:map |
