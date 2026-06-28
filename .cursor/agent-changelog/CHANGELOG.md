# Agent Changelog（最新在最上面）

## 2026-06-28 — 走路動畫驗收（離線+連線）

### 結論：靜止平移 bug 已修復（綠燈）
- 離線四方向 + idle 全部正常（input 驅動，frames>=4）
- 連線四方向動畫實測 `isPlaying=true`，且「角色真的有位移時」frame 一定更新（left dx45/right dx97/down dy52/up-retry dy52 皆 frames=4）
- 人工雙 client 抽驗：A 按住 left → `dao-walk-left` `isPlaying=true` frame 4→2，有截圖 `anim-online-walk-left.png`

### 🟡 qa:anim 測試本身的問題（非功能 bug，但會誤報）
- 連線走 up 偶爾報 `distinctFrames=1` 🔴，實為「角色被上方箱子/樹擋住沒位移」→ 連線動畫是用 snapshot 位移判斷 moving，沒移動就正確停動畫。這不是靜止平移 bug。
- qa:anim 連線 setup 不穩：B 加入房間 / duel 開賽常因等待時間不足而失敗（3 跑只有 1 跑進到連線動畫驗證）。

### Agent 規則
- 連線動畫由「snapshot 位移」驅動，QA 驗 frame 不更新時必須同時看位置 dx/dy；位置沒動才停動畫是正確行為，別誤判成靜止平移。
- qa:anim 走 up 應先把角色移到上方無障礙處再取樣（spawnP1 col2,row10 上方第二格 row8 是箱子），否則會地形性誤報。
- qa:anim 連線 setup 等待時間要拉長 / 加 waitScene retry，避免 B join、ready、開賽的 race。

---

## 2026-06-14 — 2 人 1v1 多人連線 MVP

### 實作
- Monorepo：`shared/`（protocol + Village10Sim）+ `server/`（WebSocket 權威 tick 20Hz）
- 前端：`GameClient`、Menu C/J 建/join 房、Lobby 線上 sync、OnlineDuelController snapshot 渲染
- 部署：`server/fly.toml` + Dockerfile；`.env.example` `VITE_WS_URL`
- QA：`npm run qa:multiplayer`（`window.__bnbTest` hook）

### Agent 規則
- 線上 Lobby 的 `syncDebugState` 必須走 online 分支，否則 QA 讀不到 `roomCode`
- Vercel 只部署前端；WebSocket 伺服器需 Fly/Railway 常駐 process

---

## 2026-06-13 — 大廳 UX 實作 + QA 修正

### 實作
- 1 號位點擊輪換、Q/Enter/S 鍵位、hover 金色描邊、toast 上移、fade 進出對戰
- `npm run qa:lobby`、`bnbState.lobby` debug 欄位

### QA 後修正（原 🟡）
- hover alpha 0.38–0.42 + 金色 stroke；toast 改 y=height-108
- `VISUAL_DESIGN.md` 更新 slot overlay 規則

---

## 2026-06-13 — 大廳 UX browser QA（LobbyScene 改進後）

### 🟡
- slot/button hover 光暈 alpha 0.18–0.22，截圖幾乎看不出回饋
- 木框 toast（y=height-72）常蓋住「快速加入」按鈕
- `VISUAL_DESIGN.md` 仍寫 slot 1-3 不疊頭像，但 slot0 本地選角 overlay 為新需求，文件未同步

### Agent 規則
- 大廳 hover 回饋需肉眼可辨（提高 stroke/alpha 或改色）
- toast 位置上移或縮短顯示時間，避免遮三顆底欄按鈕

---

## 2026-06-13 — 視覺設計對照 + browser QA

### 問題
- 概念圖 3:2 硬拉成 16:9 → 大廳變形、頂欄被裁切
- 大廳常駐 status / 底部說明文字蓋住設計圖
- slot 1-3 疊 portrait → 雙重角色
- `qa-visual` 固定 5173，canvas timeout

### 修復
- `lobby_bg` 改 `fit_contain`（完整頂欄+底欄，左右 letterbox）
- `menu_bg` 置中 16:9 裁切 + 底部木框標題
- Lobby 僅 slot 4-6 overlay；toast 取代常駐 status
- 重算 SLOT_POS / BTN_ZONES；新增 `.cursor/docs/VISUAL_DESIGN.md`
- `npm run qa:visual` 自動偵測 dev port

### Agent 規則
- 大廳/選單背景禁止非等比 resize；用 fit_contain 或等比裁切
- 概念圖已畫死的 slot 1-3 不可再疊動態頭像

---

## 2026-06-13 — 像素美術 vs 概念圖 QA 驗收

### 🔴
- 程式生成角色/地圖/大廳與 `design-references/pixel-*.png` 差距大（造型、lego 屋頂、大廳場景、Menu 無美術）
- 非整數縮放：portrait 32→48、bubble 32→36、item 32→28、UI panel 任意拉伸 → 像素糊邊
- `qa-center-duel.mjs` 仍假設 P2 spawn `(12,1)`，實際 `village10-map.ts` 為 `(10,1)` → 腳本誤判卡死

### 🟡
- 全場景用 monospace/system-ui，非概念圖像素字型
- Duel HUD 藍底 sans-serif 與像素世界風格割裂
- 大廳第三顆按鈕文案「開始對戰」≠ 概念圖「練習模式」

### Agent 規則
- 驗收像素風必須並排比對 `design-references/` 與 `public/assets/`，不能只跑 gameplay QA
- 顯示尺寸必須整數倍（32→32/64，40→40），禁止 1.5×/1.125×/0.875×
- 改 spawn 後要同步更新 `qa-center-duel.mjs` 路徑起點

---

## 2026-06-13 — 村10 layout v1 凍結 + 遊戲設計文件

### 問題
美術迭代時改 sparse layout，木箱 49→12，地圖「跑版」。

### 修復
- 還原 v1 滿箱 layout → `src/data/village10-layout-v1.ts`
- `village10-map.ts` 只載入 layout，不再內嵌字串
- `.cursor/docs/GAME_DESIGN.md` 定義 layout/美術分離原則
- `npm run validate:map` 強制元素數量

### Agent 規則
- 美術 script 只換貼圖，不改 map layout；改 layout 必須 bump 版本 + validate + 更新 GAME_DESIGN.md

---

## 2026-06-13 — 概念圖 vs 遊戲畫面對齊（design-reference pipeline）

### 問題
GenerateImage 概念圖（pixel-*.png）很棒，但 runtime 用 `generate-pixel-assets.py` 程式簡化圖，視覺落差大。

### 修復
- 新增 `scripts/prepare-design-reference-assets.py`：從 `design-references/pixel-*.png` 裁切角色/地磚/大廳背景
- `prepare-bnb-assets.py` 預設改走 design-reference（無 raw 時）
- `LobbyScene` / `MenuScene` 改用 `lobby_bg.png` / `menu_bg.png` 全屏概念圖 + 透明 hit zone
- 實體 integer scale：bubble 40、item 32、portrait 64
- `qa-center-duel.mjs` P2 路徑從 spawn `(10,1)` 起

### Agent 規則
- 使用者稱讚的概念圖必須進 pipeline 裁切/接入，不能只當 moodboard 另畫簡化版
- 大廳/UI 優先用概念圖背景 + 互動 hit zone，不要 wireframe 蓋住設計

---

## 2026-06-13 — 像素風美術重設計 + 遊戲大廳 + 四角色

### 變更
- 新增 `scripts/generate-pixel-assets.py`（32px 角色 / 40px 地圖，預設素材來源 `source: pixel`）
- 四角色：藍寶、睏寶、紅寶、囡囡 + portrait + Lobby UI chrome
- 新增 `LobbyScene`（6 人 slot、房間列表 mock、快速加入、S 鍵開始對戰）
- 村10 地圖排版重製（中央十字馬路、減少走道夾點）
- 設計紀錄：`.cursor/docs/PIXEL_ART_REDESIGN.md`
- 概念圖：`design-references/pixel-*.png`

### Agent 規則
- 像素素材用整數格 `putpixel`，輸出尺寸對齊 `TILE_SIZE`(40) / 角色 32px，禁止 LANCZOS 縮角色
- QA 進對戰流程改為：Menu Enter → Lobby → `S`（快速加入+開始）
- 大廳 MVP 為本地 mock，真連線另開任務

---

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
