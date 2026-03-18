---
name: notify-config
description: "Interactive notification preferences (sound, toast, sound file path)"
category: Workflow
tags: [notification, sound, toast, config]
---

# 通知設定

讀取並修改 `~/.claude/homunculus/notify-config.json` 中的通知偏好設定。

## 執行步驟

### Step 1: 讀取目前設定

讀取設定檔 `~/.claude/homunculus/notify-config.json`。如果檔案不存在，使用預設值：

```json
{
  "enabled": true,
  "sound": true,
  "toast": true,
  "soundFile": null
}
```

同時檢查哨兵檔案 `~/.claude/homunculus/notify-disabled` 是否存在。

### Step 2: 顯示目前狀態

向使用者展示目前的通知設定狀態，格式如下：

```
🔔 通知設定狀態
─────────────────────────
總開關 (enabled):  ✅ 開啟 / ❌ 關閉
音效 (sound):      ✅ 開啟 / ❌ 關閉
Toast 通知 (toast): ✅ 開啟 / ❌ 關閉
音效檔路徑:        （平台預設）/ 自訂路徑
哨兵檔案:          不存在 / 存在（覆蓋所有設定，通知已停用）
─────────────────────────
```

### Step 3: 詢問使用者

使用 `AskUserQuestion` 詢問使用者想要調整什麼：

- 開啟/關閉所有通知（enabled）
- 開啟/關閉音效（sound）
- 開啟/關閉 Toast 通知（toast）
- 更換音效檔案路徑（soundFile）
- 建立/移除哨兵檔案（notify-disabled）
- 不做任何更改

### Step 4: 寫入更新

根據使用者的選擇，使用 `Write` 工具更新 `~/.claude/homunculus/notify-config.json`。

如果使用者要求建立或移除哨兵檔案，使用 `Bash` 工具執行對應的操作。

### Step 5: 確認

顯示更新後的設定狀態，並提供測試指令：

```bash
node -e "require('./scripts/lib/notifier').notify('Claude Code', '測試通知')"
```
