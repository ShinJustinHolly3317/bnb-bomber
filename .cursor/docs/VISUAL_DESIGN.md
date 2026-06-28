# 視覺設計元素對照表

> 開發時對照本表與 `design-references/pixel-*.png`，避免 UI 疊層破壞概念圖。

## Design Read

復古像素遊戲 UI（爆爆王致敬），16:9 視窗 960×540。大廳用 **fit_contain** 完整保留概念圖（含頂欄／底欄，左右 letterbox）。

---

## 畫面 → 素材 → 概念圖

| 畫面 | 執行時素材 | 概念圖 | 實作要點 |
|------|-----------|--------|----------|
| 主選單 | `menu_bg.png` | `pixel-characters-ref.png` | 置中 16:9 裁切；底部木框標題，不蓋住四角色 |
| 遊戲大廳 | `lobby_bg.png` | `pixel-lobby-ref.png` | fit_contain（scale≈0.527，offsetX=75）；slot 1-3 不疊頭像 |
| 對戰 | tile + 角色 sheet | `pixel-tiles-ref.png`、`pixel-characters-ref.png` | 40px integer tile；layout 見 GAME_DESIGN.md |
| 大廳 slot 1 | `portrait_*` | 1 號位 | **本地選角** overlay（覆蓋背景白寶） |
| 大廳 slot 2-3 | 無 overlay | 概念圖已有角色 | 快速加入 bot 佔位但不疊頭像 |
| 大廳 slot 4-6 | `portrait_*.png` | 空椅格 | 動態加入的玩家顯示頭像 |
| 大廳按鈕 | 透明 hit zone | 底欄三顆 | 開啟新局 / 快速加入 / 練習模式 |

---

## 大廳互動座標（960×540）

```
Slot 1-3（靜態）: (576,237) (666,237) (755,237)
Slot 4-6（可 overlay）: (576,327) (666,327) (755,327)
按鈕: 開啟新局 (260,508) | 快速加入 (469,516) | 練習模式 (713,512)
```

---

## 大廳 UX（2026-06-13）

| 操作 | 行為 |
|------|------|
| `1-4` | 選本地角色（1 號位） |
| 點 1 號位 | 輪換角色 |
| 點 4-6 號位 | 加入/離開 mock 玩家 |
| `Q` | 快速加入 bot |
| `Enter` / 練習模式 | 至少 2 人後開始對戰 |
| `S` | 快速加入（若需要）+ 開始（相容舊 QA） |
| `Esc` | 回主選單 |

回饋：slot/button hover 金色光暈+描邊、按下 scale、選角 pop、木框 toast（在按鈕上方）、進對戰 fade。

---

## 禁止事項（視覺 QA）

1. 勿在 `lobby_bg` 上常駐 status 文字（會擋房間列表／等待區）
2. slot 2-3 勿疊 portrait（概念圖已有角色）；slot 1 僅本地選角 overlay
3. 勿用非等比 resize 概念圖（會拉扁按鈕與 slot）
4. 地圖 layout 變更須走 GAME_DESIGN.md 版本流程

---

## 驗證

```bash
npm run assets:design
npm run dev
npm run qa:visual
```

截圖輸出：`.cursor/qa-screenshots/`  
手動對照：`01-menu` vs characters-ref、`02-lobby-idle` vs lobby-ref
