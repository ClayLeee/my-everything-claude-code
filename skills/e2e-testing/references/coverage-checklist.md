# Coverage Plan & Interaction Depth Checklist

## Coverage Plan Rules

### Decomposition Rules

- **Tabbed containers** — Each tab panel gets its own row(s). Tab switching alone is NOT valid. Analyze the component rendered inside each tab and list its interactive elements separately.
- **Dialogs with forms** — List every form's fields. Every form MUST have a "fill + submit + verify toast" scenario.
- **Nested dialogs** — If a tab/dialog opens another dialog (e.g. "Add Member" inside Members tab), that inner dialog gets its own row.

### Validation Rules

Apply before writing any test code:

1. **Every component found in recursive analysis MUST appear** — if excluded, add a row with reason: `N/A — no interactive elements`
2. **Every tab panel MUST have its own row(s)** with the tab's internal interactive elements — not just "tab switching"
3. **Every form MUST have a "fill + submit + verify toast" scenario** — never optional
4. **Every table inside a tab MUST have row count + column assertions** — not just "table is visible"
5. **Every CRUD button inside a tab MUST have its own test scenario**
6. **Count check**: `number of Coverage Plan rows` ≥ `number of non-leaf components in tree`. Fewer rows = missed components

## Interaction Depth Checklist

Apply to every container (dialog, tab panel, form) found in the Coverage Plan. All applicable items are required.

### Container Patterns

- **Dialog** — open → verify content visible → close (cancel or X). For AlertDialog, verify confirm action works.
- **Tabs** — switch to each tab → **treat each tab panel as a sub-page**: recursively apply this entire checklist to its content. List each tab's inner components explicitly in the Coverage Plan.
- **Popover / Filter panel** — open → interact with inner controls → verify effect on parent (e.g. table row count changes) → close.
- **Accordion / Collapsible** — expand → verify content → collapse.

### Data Display Patterns

- **Table** — assert row count > 0. For each column, apply assertion matching its type (see `references/semantic-analysis.md` § Table Column Assertion Rules). If sortable: click header, verify order. If expandable: expand row, verify children.
- **Pagination** — verify page info text, click next page, assert content changes. If table above: verify rows update.
- **Empty state** — when no data exists, verify empty state message visible.
- **Skeleton / Loading** — do NOT assert on loading states; wait for them to disappear before asserting content.

### Form Patterns

- **Form fields** — verify all expected fields are present. Fill all required fields with valid data.
- **Required field validation** — submit empty or clear a required field, expect error message or disabled submit.
- **Form submit success** — **MANDATORY.** Fill valid data → submit → verify success toast + data update. Extend timeout for slow operations instead of skipping.
- **Form submit failure** — invalid input that triggers real API error → verify error toast or inline error.
- **Select / Dropdown** — click trigger → wait for content visible → select option → verify trigger displays selected value. Note: shadcn-vue portals dropdown content outside the parent container.
- **Rich text editor (Tiptap)** — click editor → type text → verify content appears. Do NOT test toolbar formatting unless requested.

### Action Patterns

- **Toggle / Switch** — click → verify state change → restore original state.
- **Delete confirmation** — open AlertDialog → fill confirmation input if required → submit → verify item removed.
- **Drag and drop** — use `dragTo()` → verify order changes.
- **Multi-role behavior** — test different roles if applicable.

Cover every applicable item. If an item cannot be tested without mocking, document with `test.skip` and state the reason.
