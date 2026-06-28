# bnb-bomber — Agent Handoff

> 最後更新：2026-06-13（OG 房間大廳 UI 重設計）  
> 目的：讓新 session 的 agent 能無縫接續，復刻台灣線上遊戲「爆爆王」村10 地圖 + 本地雙人 1v1 對戰。

---

## 專案摘要

**bnb-bomber** 是瀏覽器端的爆爆王 homage：Phaser 3 + Vite + TypeScript。MVP：**村10、大廳 mock 配對（6 人）、本地 1v1 對戰、四 OG 角色、像素美術**。

| 項目 | 決策 |
|------|------|
| 平台 | Web（Vite dev server） |
| 引擎 | Phaser 3 + Arcade Physics |
| 模式 | 本地 hotseat 1v1（大廳可 mock 6 人，對戰仍 2 人） |
| 地圖 | 村10 layout **v1 凍結**（`src/data/village10-layout-v1.ts`） |
| 操作 | P1 WASD+Space；P2 方向鍵+Enter；大廳 `1-4` 選角、`Q`/邀請電腦、`Enter`/準備 開始 |
| 道具 | S 加速、P 威力、B 水球+ |
| 美術 | 預設 **pixel** 程式像素風（`generate-pixel-assets.py`） |
| 角色 | 藍寶、睏寶、紅寶、囡囡（四方向 walk） |
| 流程 | Menu → **Lobby**（6 人 mock）→ Duel → GameOver |

設計階段用 `/grill-me` 收斂過需求；細節不再重複，見下方引用。

---

## 目前狀態（可玩）

- Menu → Lobby → Duel → GameOver → Rematch 完整
- 四角色像素 spritesheet + 村10 重排版
- 美術 pipeline 預設 `generate-pixel-assets.py`（`source: pixel`）
- QA health check PASS

**尚未做 / 已知缺口：**

- 非 git repo
- 真實 WebSocket 多人配對 / 6 人同場對戰
- 音效、商城等完整大廳功能
- 像素角色仍可再貼近官方（目前為 homage 程式像素）

---

## 快速啟動

```bash
cd /Users/justinkao/projects/bnb-bomber
npm install          # 若 node_modules 不存在
npm run assets       # 生成 public/assets（預設 bnb-style）
npm run dev          # http://localhost:5173
```

驗收：

```bash
npm run qa:health    # build + assets + 基本流程
npm run qa           # 四方向、放球、對戰
node scripts/qa-center-duel.mjs   # P1/P2 到中央 → P1 轟贏 P2
```

---

## 目錄結構（重點）

```
bnb-bomber/
├── src/
│   ├── main.ts
│   ├── data/village10-map.ts      # 村10 格子 + spawn
│   └── game/
│       ├── scenes/                # Boot, Menu, Duel, GameOver
│       ├── entities/              # Fighter, WaterBubble, ItemPickup
│       ├── debug/bnbState.ts      # window.bnbState（QA 用）
│       └── constants.ts
├── scripts/
│   ├── prepare-bnb-assets.py      # 素材 orchestrator（fallback chain）
│   ├── generate-bnb-style-assets.py  # 預設美術來源
│   ├── prepare-reference-assets.py   # 從截圖 crop（fallback）
│   ├── prepare-kenney-assets.py      # placeholder（最後 fallback）
│   ├── qa-gameplay.mjs
│   ├── qa-center-duel.mjs
│   ├── qa-duel.mjs
│   └── health-check.mjs
├── public/assets/                 # 遊戲實際載入的 sprite + manifest
├── design-references/             # 視覺參考（非 runtime 素材）
├── assets/raw/bnb/                # 若有官方 PNG 放這，優先於 fallback
└── .cursor/agent-changelog/CHANGELOG.md  # 最近 bug fix 紀錄
```

---

## 素材 Fallback Chain

`npm run assets` → `prepare-bnb-assets.py`：

1. `assets/raw/bnb/` 有 PNG → 用 raw
2. 否則 → `generate-bnb-style-assets.py`（**目前預設**）
3. 否則 → `prepare-reference-assets.py`（截圖 crop）
4. 否則 → Kenney placeholder

Manifest：`public/assets/sprite-manifest.json`（目前 `source: "bnb-style"`）

---

## 重要實作細節（接手的坑）

詳細 bug 與修法見 [`.cursor/agent-changelog/CHANGELOG.md`](./agent-changelog/CHANGELOG.md)，這裡只列 agent 必記規則：

1. **StaticGroup 碰撞體尺寸** — `create()` 後若貼圖 ≠ 格子，必須 `setDisplaySize(TILE_SIZE, TILE_SIZE)` 再 `refreshBody()`，否則 64×64 溢出夾死走道。
2. **自己放的泡泡** — Fighter 不與自己的 bubble 加 collider（`DuelScene.tryPlaceBubble`）。
3. **Spawn 點** — P1 `(2,10)`、P2 `(12,1)`，避開 world boundary。
4. **Double-KO** — `alive.length === 0` 時 `endMatch('平手')`。
5. **Camera** — 地圖小於 viewport，固定 `centerOn`，不要 setBounds clamp。
6. **Playwright + Phaser JustDown** — 放球按鍵需 hold ~150ms；移動用短 tap，測試前 `reloadDuel` 隔離狀態；測方向前先對齊格心。

Debug：`window.bnbState` 暴露 scene、fighters（hp/x/y/vx/vy/trapped/dead）、winner。

---

## 使用者最後意圖

1.  gameplay QA 已完成並修 bug — **暫無 pending QA 任務**
2.  要求關掉所有 background work — **不要自動起 dev server / 背景 agent**
3.  問「你能做美術設計嗎」— 尚未選下一步，可能方向：
    - 微調 `bnb-style` 程式美術（角色/地磚/爆炸）
    - 協助 `assets/raw/bnb/` 資料夾結構，接入真 PNG
    - 生成 concept image（例如角色 turnaround）

---

## 建議下一步（優先序）

1. **美術** — 若使用者要更像官方：改 `generate-bnb-style-assets.py` 或接 raw PNG pipeline
2. **Polish** — UI、音效、爆炸/受傷 feedback
3. **內容** — 其餘 2 角色、更多地圖
4. **工程** — 初始化 git repo（使用者未要求，先問）

---

## Suggested Skills

接下一輪工作時，依任務選 skill：

| Skill | 何時用 |
|-------|--------|
| [`qa-inspector`](/Users/justinkao/.cursor/skills-cursor/qa-inspector/SKILL.md) | 改 gameplay / physics / UI 後跑完整驗收 |
| [`diagnose`](/Users/justinkao/.agents/skills/diagnose/SKILL.md) | 使用者回報卡死、爆炸異常、狀態機卡住 |
| [`grill-me`](/Users/justinkao/.agents/skills/grill-me/SKILL.md) | 擴 scope（線上對戰、AI、新地圖）前先對齊需求 |
| [`prototype`](/Users/justinkao/.agents/skills/prototype/SKILL.md) | 快速試美術方向或新 UI layout |
| [`grill-with-docs`](/Users/justinkao/.agents/skills/grill-with-docs/SKILL.md) | 若開始寫 CONTEXT.md / ADR 記設計決策 |

美術 concept 可搭配 `GenerateImage` tool（使用者明確要圖時）。

---

## 引用（勿在此重複全文）

- 設計紀錄：`.cursor/docs/GAME_DESIGN.md`（**layout 凍結、開發必讀**）
- Agent 變更紀錄：`.cursor/agent-changelog/CHANGELOG.md`
- 人物參考說明：`design-references/characters/README.md`
- Raw 素材放置：`assets/raw/bnb/README.md`
- 對話 transcript：`~/.cursor/projects/Users-justinkao-projects-bnb-bomber/agent-transcripts/30e6425a-a1cb-4837-b6e6-13bec8fbdb4d.jsonl`

---

## 環境備註

- OS: darwin 25.3.0
- Node + Python3（PIL/Pillow 用於 asset scripts）
- Playwright 已裝在 devDependencies；QA 腳本會自行起 vite preview 或 dev
- **Not a git repository**（截至 handoff 時）
