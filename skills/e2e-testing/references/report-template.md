# Dual Test Reports

Every test run produces two reports. The report name is controlled via `E2E_REPORT_NAME` env var (defaults to `latest` if not set).

## Report 1: HTML (Playwright built-in)

Automatically generated at `playwright/reports/{report-name}/`. View with:
```bash
cd app && pnpm test:e2e:report
```

## Report 2: Markdown

Stored at `playwright/{report-name}.md` — **filename has no date** (overwrites on re-run, date is in content).

### Template

```markdown
# {page-name-zh}測試報告

**測試日期**: YYYY-MM-DD
**測試 URL**: http://localhost:5173/{route}
**測試工具**: Playwright
**測試帳號**: {account} ({role} 權限)

---

## 測試摘要

| 項目     | 結果   |
| -------- | ------ |
| 測試狀態 | ✅ 通過 / ❌ 失敗 |
| 總計     | X      |
| 通過     | Y      |
| 失敗     | Z      |
| 跳過     | W      |
| 通過率   | YY%    |

---

## 測試場景

### {describe group name}

| 測試案例 | 狀態 | 說明 |
| -------- | ---- | ---- |
| {test name} | ✅/❌ | {brief description} |

### {next describe group}
...

---

## 失敗詳情

### {failed test name}
- **檔案位置**: `tests/e2e/{file}.spec.ts:{line}`
- **錯誤訊息**: {error message}
- **建議修復**: {fix suggestion}

---

## Artifacts
- HTML Report: `playwright/reports/{report-name}/index.html`
- Failure Screenshots: `playwright/test-results/` (auto-captured)
- Videos: `playwright/test-results/` (auto-captured)
- Traces: `playwright/test-results/` (auto-captured)

---

_報告產生時間: YYYY-MM-DD_
_測試工具: Playwright_
```

### Key Rules

- Use 繁體中文 for report content
- One table per `test.describe` group
- Filename format: `playwright/{report-name}.md` (no date in filename, uses `E2E_REPORT_NAME` env var)
- Always overwrite previous report (no accumulation)
- Reference the style from existing reports in `playwright/` directory
