# Coverage Plan & Coverage Self-Check

## Coverage Plan Rules

### Decomposition Rules

- **Tabbed containers** — Each tab panel gets its own row(s). Tab switching alone is NOT valid. Analyze the component rendered inside each tab and list its interactive elements separately.
- **Dialogs with forms** — List every form's fields. Every form MUST have a "fill + submit + verify feedback" scenario.
- **Nested dialogs** — If a tab/dialog opens another dialog (e.g. "Add Member" inside Members tab), that inner dialog gets its own row.

### Validation Rules

Apply before writing any test code:

1. **Every component found in recursive analysis MUST appear** — if excluded, add a row with reason: `N/A — no interactive elements`
2. **Every tab panel MUST have its own row(s)** with the tab's internal interactive elements — not just "tab switching"
3. **Every form MUST have a "fill + submit + verify feedback" scenario** — never optional
4. **Every table inside a tab MUST have row count + column assertions** — not just "table is visible"
5. **Every CRUD button inside a tab MUST have its own test scenario**
6. **Count check**: `number of Coverage Plan rows` ≥ `number of non-leaf components in tree`. Fewer rows = missed components

## Coverage Self-Check Questions

After planning scenarios using the 3 questions (purpose → errors → confirmation), use these to verify you haven't missed anything:

- [ ] Has every tab panel and dialog been treated as a sub-page with its own scenario analysis?
- [ ] Does every form have both a success path test (fill + submit + verify feedback) and a failure path test (required field empty or invalid → error)?
- [ ] Does every table verify that data exists (row count > 0) and that each column displays the right type of content?
- [ ] Does every data-modifying operation verify that the data actually changed (not just that feedback appeared)?
- [ ] Has every `[E2E]` test record been cleaned up after the test?

### Implementation Notes

These are specific constraints that commonly cause missed coverage or flaky tests if not handled explicitly:

- **Table is empty on arrival**: Do NOT skip or mark `test.skip`. Use the page's create UI to add at least one `[E2E]` record before running display assertions. Chain with `test.describe.serial` and clean up after.
- **Pagination**: Only testable when total records exceed the page size. Create records via `beforeAll` if needed; if no create UI exists, mark `test.skip` with reason: `// No create UI — cannot guarantee enough data for pagination`.
- **Select / Dropdown**: Click trigger → wait for content visible → select → verify displayed value. Many UI libraries (shadcn, Radix, Headless UI, MUI, etc.) portal dropdown content outside the parent container.
- **Rich text editor**: Click editor → type → verify content appears. Do NOT test toolbar formatting unless requested.
- **Form submit success is mandatory**: Extend timeout for slow operations instead of skipping.

If an item cannot be tested without mocking, document with `test.skip` and state the reason.
