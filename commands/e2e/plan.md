---
name: "e2e:plan"
description: "Generate coverage plan from page analysis for E2E testing"
category: E2E Testing
tags: [e2e, playwright, plan, coverage]
model: sonnet
context: fork
skills:
  - e2e-testing
---

# E2E Plan — Coverage Plan Generation

Generate a Coverage Plan from the analysis artifact produced by `/e2e:analyze`.

All output must be in **繁體中文**.

## Step 1: Locate Analysis Artifact

Look for `playwright/{page-name}/analysis.md` files (relative to `package.json` directory):
- If exactly one exists, use it
- If multiple exist, ask the user which page to plan for
- If none exist, tell the user to run `/e2e:analyze` first

> **Note:** Legacy flat-file paths (`playwright/{page-name}-analysis.md`) are also accepted for backward compatibility.

## Step 2: Locate Skill Directory & Load References (MANDATORY)

**Step 2a: Find the skill directory**
Locate the e2e-testing skill directory by finding its SKILL.md:
1. `Glob("**/e2e-testing/SKILL.md")` — searches CWD (works during plugin development)
2. If not found: `Glob("**/e2e-testing/SKILL.md", path: "~/.claude/plugins")` — searches plugin cache

Extract the **directory path** from the result (remove `/SKILL.md` suffix). This is `$SKILL_DIR`.

**Step 2b: Read references**
Read the following files using `$SKILL_DIR/references/{filename}`:
- `$SKILL_DIR/references/coverage-checklist.md` — interaction depth checklist and coverage requirements
- `$SKILL_DIR/references/ui-patterns.md` — UI interaction patterns for tables, forms, tabs, selects, pagination

Do NOT proceed without reading all listed files. If both Glob attempts fail, report the error and stop.

## Step 3: Read Analysis Artifact

Read the analysis file and extract:
- Semantic Element Table (SET)
- Component tree
- Identified user flows
- `data-testid` injection plan

## Step 4: Generate Coverage Plan

Produce a Coverage Plan containing:

1. **Test Scenario List** — Each scenario with:
   - Name and description
   - Priority (P0 critical / P1 important / P2 nice-to-have)
   - Elements involved (from SET)
   - Expected assertions

2. **Interaction Depth Checklist** — For each UI pattern found:
   - Tables: row count, cell content, sorting, filtering
   - Forms: fill + validation + submit + error states
   - Tabs: switching + content verification within each tab
   - Selects/Dropdowns: option list, selection, filtering
   - Pagination: navigation, page size, boundary
   - Dialogs: open/close, content, form within dialog

3. **`data-testid` Injection Summary** — Files to modify, elements to tag

4. **Estimated Test Structure** — Nested `test.describe` blocks outline

## Step 5: Write Coverage Plan Artifact

Write to `playwright/{page-name}/coverage-plan.md`.

## Step 6: Next Step Prompt

Tell the user:

```
✅ 覆蓋計畫已產生。
📄 產出：playwright/{page-name}/coverage-plan.md
👉 下一步：使用 /e2e:create 建立測試並執行。
```
