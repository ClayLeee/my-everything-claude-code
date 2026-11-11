---
name: "e2e:analyze"
description: "Analyze page structure and build Semantic Element Table for E2E testing"
argument-hint: "[page_path]"
context: fork
---

# E2E Analyze — Page Structure Analysis

Analyze the target page and produce a Semantic Element Table (SET) artifact.

All output must be in **繁體中文**. `$SKILL_DIR` below is `${CLAUDE_PLUGIN_ROOT}/skills/e2e-testing`.

## Input

- `$ARGUMENTS` — path to the page component (e.g., `src/views/projects/ProjectList.vue`)
- If no argument provided, ask the user for the target page path.

## Step 1: Validate Target

Confirm the page file exists. If not, suggest similar files and ask the user to clarify.

## Step 2: Local Analysis

Read `$SKILL_DIR/references/semantic-analysis.md` for the analysis method and the SET format, then analyze the page from source:

1. **Read component tree** — Follow all import statements from the page component, recursively trace child components
2. **Analyze templates** — Identify all interactive elements, conditionals and loops (Vue: `v-if`/`v-for`; React/JSX: `cond && …` / `.map()`), slots / children
3. **Trace event handlers** — Map click/submit handlers (Vue: `@click`, `@submit`; React/JSX: `onClick`, `onSubmit`; see `semantic-analysis.md` for other frameworks) to their handler functions → API calls
4. **Build Semantic Element Table (SET)** — List every testable element with:
   - Element type (button, input, table, dialog, tab, select, etc.)
   - Current selector (existing `data-testid` or suggested injection point)
   - Parent component file path
   - Interaction type (click, fill, assert, etc.)
5. **Identify `data-testid` injection points** — Mark elements that need `data-testid` attributes

## Step 3: MCP Verification (optional)

If the dev server is running and MCP Playwright tools are available, read `$SKILL_DIR/references/mcp-discovery.md`, then:

1. `browser_navigate` → target page
2. `browser_snapshot` → get ARIA tree
3. Compare ARIA tree against the SET from Step 2, supplement missing runtime elements
4. Click open each dialog/tab → snapshot → verify content matches code analysis
5. Form dry-run → record actual validation behavior and toast text
6. Update SET with runtime discoveries

Otherwise skip this step; the source analysis alone is a complete result.

## Step 4: Generate Analysis Artifact

Write the analysis to `playwright/{page-name}/analysis.md` (relative to `package.json` directory) containing:
- Component tree diagram
- Complete Semantic Element Table
- `data-testid` injection plan (which files, which elements)
- Identified user flows (happy path + edge cases)
- Runtime discoveries (if MCP verification was performed)

## Step 5: Next Step Prompt

Tell the user:

```
✅ 分析完成。
📄 產出：playwright/{page-name}/analysis.md
👉 下一步：使用 /e2e:plan 產生覆蓋計畫，或先檢視分析報告再繼續。
```
