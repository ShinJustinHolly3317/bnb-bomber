# Agent Changelog（最新在最上面）

## 2026-06-13 — 美術重做 + 中央對決 QA + 三個遊戲 bug 修復

### 變更
- `scripts/generate-bnb-style-assets.py` 全面重畫：2x2 大顆樂高凸點草地、灰路白虛線、X 木箱、蓬鬆三層樹、樂高磚房、光澤水球、紅閃+水圈爆炸、藍寶/睏寶 chibi 四方向走路。
- `scripts/qa-center-duel.mjs`：完整場景驗收（雙方走到中央 → P1 轟炸 P2 獲勝 → rematch），含舊夾點回歸檢查。

### 修復的遊戲 bug
1. **阻擋碰撞體 64×64 溢出**（DuelScene `buildTilemap`/`rebuildTileAt`）：貼圖原始 64px，`refreshBody()` 用原始尺寸，物理體向四周溢出 12px，走道被夾死（P2 永遠到不了中央）。修法：`setDisplaySize(TILE_SIZE, TILE_SIZE)` 再 `refreshBody()`。
2. **double-KO 卡死**：雙方同時陣亡時 `alive.length === 0`，`endMatch` 永不觸發。修法：0 人存活時以「平手」結束。
3. **Camera 釘在左上**：地圖（600×520）小於視窗（960×540），bounds clamp 導致右側大片空地。修法：移除 camera bounds，固定置中整張地圖。

### Agent 規則
- Phaser StaticGroup `create()` 後若貼圖尺寸 ≠ 格子尺寸，必須先 `setDisplaySize` 再 `refreshBody`，否則碰撞體用貼圖原始大小。
- Playwright 對 Phaser `JustDown` 的按鍵必須按住 ~150ms，瞬間 `press()` 會漏觸發。
- 勝負判定要涵蓋「同時死亡」分支，不能只檢查 `alive.length === 1`。
- QA 移動測試要先對齊格心再測方向，跨格被鄰格阻擋物擋住是正常物理，不是卡死。

### QA 腳本一覽
- `npm run qa` → `scripts/qa-gameplay.mjs`（四方向 + 放球後移動 + 對戰）
- `node scripts/qa-center-duel.mjs`（中央對決完整場景）
- `npm run qa:duel`、`npm run qa:health`
