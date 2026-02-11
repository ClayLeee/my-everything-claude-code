# Hooks 完整指南

設定檔：`.claude/settings.local.json`

共 **6 個事件**、**11 個 hook**

---

## SessionStart — session 開始（1 個）⚠️ 已停用，待修復

### #1 載入上次 session 上下文 → `session-start.js`

- **觸發**：`*`
- **行為**：
  - 讀取最近 7 天的 session 檔案（`~/.claude/sessions/*-session.tmp`）
  - 如果最近的 session 有摘要，**輸出上次的工作摘要**讓 Claude 知道之前做了什麼
  - 列出 session aliases
  - 偵測 package manager（pnpm/npm/yarn/bun）
- **狀態**：`ENABLED = false`，等 Claude Code 修復 SessionStart bug 後改為 `true`

---

## PreToolUse — 工具執行前（4 個）

### #2 Git Push 提醒（inline）

- **觸發**：`git push` 指令
- **行為**：stderr 印提醒訊息，提醒先 review changes
- **阻斷**：否，僅提醒

### #3 阻擋亂建文件（inline）

- **觸發**：Write `.md`/`.txt`（排除 README/CLAUDE/AGENTS/CONTRIBUTING/SKILL/MEMORY/HOOKS.md）
- **行為**：`exit 1` 阻止建立
- **阻斷**：**是**

### #4 Compact 建議 → `suggest-compact.js`

- **觸發**：Edit 或 Write
- **行為**：追蹤累計次數，50 次建議 `/compact`，之後每 25 次再提醒
- **阻斷**：否

### #5 Observation 收集（pre）→ `observe.js pre`

- **觸發**：所有工具 `*`
- **行為**：記錄工具名稱、輸入參數、時間戳到 `observations.jsonl`，超過 10MB 自動歸檔
- **阻斷**：否

---

## PostToolUse — 工具執行後（2 個）

### #6 console.log 即時警告（inline）

- **觸發**：Edit `.ts/.tsx/.js/.jsx/.vue`
- **行為**：掃描被編輯的檔案，發現 `console.log` 就在 stderr 列出位置（最多 5 行）
- **阻斷**：否，僅警告

### #7 Observation 收集（post）→ `observe.js post`

- **觸發**：所有工具 `*`
- **行為**：記錄工具執行結果到 `observations.jsonl`
- **阻斷**：否

---

## PreCompact — context 壓縮前（1 個）

### #8 Compaction 記錄 → `pre-compact.js`

- **觸發**：`*`
- **行為**：記錄壓縮事件到 `~/.claude/sessions/compaction-log.txt`，標註當前 session 檔案

---

## Stop — Claude 每次回覆結束後（1 個）

### #9 全域 console.log 檢查 → `check-console-log.js`

- **觸發**：`*`
- **行為**：掃描 `git diff --name-only HEAD` 中所有被修改的 `.ts/.tsx/.js/.jsx/.vue`，報告殘留的 `console.log`
- **與 #6 的差異**：#6 只檢查「剛被 Edit 的單一檔案」，#9 檢查「本次所有 git 變更檔案」

---

## SessionEnd — session 結束（4 個）

### #10 Session 記錄 → `session-end.js`（同步）

- **觸發**：`*`
- **行為**：建立/更新 `~/.claude/sessions/{date}-{shortId}-session.tmp`，寫入時間戳 header

### #11 Session 評估 → `evaluate-session.js`（同步）

- **觸發**：`*`
- **行為**：計算 user 訊息數量，>= 10 則印 log 提示值得分析

### #12 自動分析 Observations → `start-observer.js analyze`（async，180s timeout）

- **觸發**：`*`
- **行為**：observations >= 20 筆時呼叫 Haiku 分析，產生 instinct `.yaml`，更新 `.claude/instincts.md`

### #13 自動摘要 Session → `summarize-session.js`（async，120s timeout）

- **觸發**：`*`
- **行為**：user 訊息 >= 5 則時呼叫 Haiku 讀取 transcript，產生結構化摘要寫入 session 檔案

---

## Slash Commands

| Command | 功能 |
|---------|------|
| `/cl:status` | 查看所有 instincts，按 domain 分類，附 confidence 進度條 |
| `/cl:analyze` | 手動觸發 observation 分析 |
| `/cl:log` | 顯示最近 30 行 observer 分析 log |
| `/cl:sync` | 從現有 instincts 更新 `.claude/instincts.md` |

---

## 完整資料流

```
╔══════════════════════════════════════════════════════════════╗
║                     SESSION 開始                             ║
╚══════════════════════════════════════════════════════════════╝
  │
  ├─ SessionStart (#1) ⚠️ 已停用
  │   ├─ 讀取 ~/.claude/sessions/ 最近的 session 檔案
  │   ├─ 輸出上次 session 摘要 → Claude 知道之前做了什麼
  │   ├─ 列出 session aliases
  │   └─ 偵測 package manager
  │
  ├─ CLAUDE.md 自動載入
  │   └─ 引用 .claude/instincts.md → Claude 套用已學到的行為模式
  │
  ▼
╔══════════════════════════════════════════════════════════════╗
║                     互動循環（重複）                          ║
╚══════════════════════════════════════════════════════════════╝
  │
  ├─ PreToolUse
  │   ├─ #2 git push → 提醒 review
  │   ├─ #3 Write .md/.txt → 阻擋亂建文件
  │   ├─ #4 Edit/Write → compact 計數，50 次後提醒
  │   └─ #5 所有工具 → 收集 observation (pre) → observations.jsonl
  │
  ├─ 工具執行
  │
  ├─ PostToolUse
  │   ├─ #6 Edit 程式碼 → console.log 即時警告
  │   └─ #7 所有工具 → 收集 observation (post) → observations.jsonl
  │
  ├─ PreCompact（如果觸發 /compact）
  │   └─ #8 記錄 compaction 事件
  │
  └─ Stop（每次回覆後）
      └─ #9 全域 console.log 掃描 git diff
  │
  ▼
╔══════════════════════════════════════════════════════════════╗
║                     SESSION 結束                             ║
╚══════════════════════════════════════════════════════════════╝
  │
  ├─ #10 session-end.js (同步)
  │   └─ 建立 ~/.claude/sessions/{date}-{id}-session.tmp (header + 時間戳)
  │
  ├─ #11 evaluate-session.js (同步)
  │   └─ 計算訊息數，印 log 評估
  │
  ├─ #12 start-observer.js analyze (async 背景)
  │   │
  │   ├─ observations.jsonl >= 20 筆？
  │   │   ├─ 否 → 跳過
  │   │   └─ 是 → 呼叫 Haiku 分析
  │   │           │
  │   │           ▼
  │   │     instincts/personal/*.yaml (新增/更新)
  │   │           │
  │   │           ▼
  │   │     .claude/instincts.md (自動彙整)
  │   │           │
  │   │           ▼
  │   │     CLAUDE.md 引用 → 下次 session 自動套用
  │   │
  │   └─ observations.jsonl 歸檔到 observations.archive/
  │
  └─ #13 summarize-session.js (async 背景)
      │
      ├─ user 訊息 >= 5？
      │   ├─ 否 → 跳過
      │   └─ 是 → 呼叫 Haiku 讀 transcript
      │           │
      │           ▼
      │     產生結構化摘要 (Completed / In Progress / Notes / Key Files)
      │           │
      │           ▼
      │     寫入 ~/.claude/sessions/{date}-{id}-session.tmp
      │
      ▼
╔══════════════════════════════════════════════════════════════╗
║                   下次 SESSION 開始                           ║
╚══════════════════════════════════════════════════════════════╝
      │
      ├─ SessionStart (#1) 讀取上次摘要
      │   "上次你完成了 X，還在進行 Y，注意 Z..."
      │
      └─ CLAUDE.md → instincts.md
          "寫完腳本要做 syntax check、編輯前先讀檔..."
```

---

## 儲存位置一覽

| 檔案 | 用途 | 生命週期 |
|------|------|---------|
| `~/.claude/homunculus/observations.jsonl` | 原始工具事件記錄 | 分析後歸檔 |
| `~/.claude/homunculus/observations.archive/` | 已處理的 observations | 永久保留 |
| `~/.claude/homunculus/instincts/personal/*.yaml` | 學到的行為模式 | 永久，confidence 會演化 |
| `~/.claude/homunculus/observer.log` | 分析/摘要 log | 持續增長 |
| `~/.claude/sessions/*-session.tmp` | Session 摘要檔案 | 最近 7 天 |
| `.claude/instincts.md` | 高 confidence instincts 彙整 | 每次分析後更新 |
| `CLAUDE.md` | 引用 instincts.md | 永久 |

---

## 腳本位置

| 檔案 | 類型 |
|------|------|
| `.claude/scripts/hooks/observe.js` | Hook 腳本 — observation 收集 |
| `.claude/scripts/hooks/suggest-compact.js` | Hook 腳本 — compact 建議 |
| `.claude/scripts/hooks/pre-compact.js` | Hook 腳本 — compaction 記錄 |
| `.claude/scripts/hooks/session-start.js` | Hook 腳本 — session 開始載入上下文 |
| `.claude/scripts/hooks/session-end.js` | Hook 腳本 — session 結束記錄 |
| `.claude/scripts/hooks/evaluate-session.js` | Hook 腳本 — session 長度評估 |
| `.claude/scripts/hooks/summarize-session.js` | Hook 腳本 — Haiku 自動摘要 |
| `.claude/scripts/hooks/check-console-log.js` | Hook 腳本 — 全域 console.log 檢查 |
| `.claude/scripts/hooks/start-observer.js` | 工具腳本 — observer 分析/sync/status |
| `.claude/scripts/lib/utils.js` | 共用 — 跨平台工具函式庫 |
| `.claude/scripts/lib/session-manager.js` | 共用 — session CRUD |
| `.claude/scripts/lib/session-aliases.js` | 共用 — session alias 管理 |
| `.claude/scripts/lib/package-manager.js` | 共用 — package manager 偵測 |
| `.claude/skills/continuous-learning-v2/` | Skill — CL v2 設定與文件 |
