---
name: "e2e:analyze"
description: "Analyze page structure and build Semantic Element Table for E2E testing"
category: E2E Testing
tags: [e2e, playwright, analyze, semantic-analysis]
args: "page_path"
context: fork
skills:
  - e2e-testing
---

# E2E Analyze — Page Structure Analysis

Analyze the target page and produce a Semantic Element Table (SET) artifact.

All output must be in **繁體中文**.

## Input

- `$ARGUMENTS` — path to the page component (e.g., `src/views/projects/ProjectList.vue`)
- If no argument provided, ask the user for the target page path.

## Step 1: Validate Target

Confirm the page file exists. If not, suggest similar files and ask the user to clarify.

## Step 2: Load References (MANDATORY — do not skip)

Read these files before proceeding:
- `references/semantic-analysis.md` — analysis methodology and SET format

Do NOT proceed to Step 3 without reading this file.

## Step 3: Local Analysis (MANDATORY)

Perform full local analysis of the target page:

1. **Read component tree** — Follow all import statements from the page component, recursively trace child components
2. **Analyze templates** — Identify all interactive elements, `v-if`/`v-for` conditionals, slots
3. **Trace event handlers** — Map `@click`, `@submit`, etc. to their handler functions → API calls
4. **Build Semantic Element Table (SET)** — List every testable element with:
   - Element type (button, input, table, dialog, tab, select, etc.)
   - Current selector (existing `data-testid` or suggested injection point)
   - Parent component file path
   - Interaction type (click, fill, assert, etc.)
5. **Identify `data-testid` injection points** — Mark elements that need `data-testid` attributes

## Step 4: MCP Verification (OPTIONAL)

IF the dev server is running AND MCP Playwright tools are available:

Read `references/mcp-discovery.md` first, then:

1. `browser_navigate` → target page
2. `browser_snapshot` → get ARIA tree
3. Compare ARIA tree against Phase 1 SET, supplement missing runtime elements
4. Click open each dialog/tab → snapshot → verify content matches code analysis
5. Form dry-run → record actual validation behavior and toast text
6. Update SET with runtime discoveries

IF dev server NOT running OR MCP NOT available:
→ Skip this step. Phase 1 results alone produce a complete analysis.

## Step 5: Generate Analysis Artifact

Write the analysis to `playwright/{page-name}/analysis.md` containing:
- Component tree diagram
- Complete Semantic Element Table
- `data-testid` injection plan (which files, which elements)
- Identified user flows (happy path + edge cases)
- Runtime discoveries (if MCP verification was performed)

## Step 6: Next Step Prompt

Tell the user:

```
✅ 分析完成。
📄 產出：playwright/{page-name}/analysis.md
👉 下一步：使用 /e2e:plan 產生覆蓋計畫，或先檢視分析報告再繼續。
💡 快捷流程：直接使用 e2e-runner agent 一次跑完 analyze → plan → create → run
```
