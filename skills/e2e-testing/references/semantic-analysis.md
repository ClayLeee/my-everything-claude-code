# Semantic Analysis Reference

## Table of Contents

- [Definitions](#definitions) (interactive elements, leaf nodes, stop-recursion rules)
- [Recursive Procedure](#recursive-procedure) (component tree discovery, split points, analysis depth, per-component extraction)
- [Semantic Element Table (SET)](#semantic-element-table-set) (row structure with Container column for depth tracking)
- [Extraction Rules](#extraction-rules) (source clue to extraction mapping for handlers, icons, i18n, API calls)
- [Behavior Taxonomy](#behavior-taxonomy) (minimum test steps and required error/boundary scenarios per behavior)
- [Table Column Assertion Rules](#table-column-assertion-rules) (per-column-type assertion patterns)
- [Worked Examples](#worked-examples) (Members Page simple example, Project Settings nested tabs + dialog example)

## Definitions

### Interactive Elements

Elements that a user can interact with — the building blocks of your Semantic Element Table.

**Include:**
- button, link (`<a>`), input, select, textarea
- switch/toggle, checkbox, radio
- tab trigger
- icon-button (e.g., edit, delete, expand icons wrapped in a clickable element)
- dropdown menu trigger (kebab "⋯", context menu, action menu)
- accordion / collapsible trigger
- drag handle
- file upload, drag-and-drop zone
- rich text editor
- slider / range input
- date/time picker
- breadcrumb link (navigational + interactive)
- command palette trigger (often keyboard-shortcut only, e.g., `Cmd+K`)

**Exclude:**
- decorative icons (no click/change handler)
- layout wrappers (`<div>`, `<section>`, grid containers)
- headings, static labels, static paragraphs
- display-only badges/tags (no interaction)

**Borderline rule:** If the element has an event binding (click, change, submit, etc.) or a two-way state binding (model binding, controlled input), it is interactive → **include**.

### Leaf Nodes (Stop Recursion)

Stop recursing into a component when it is:

1. **UI library primitive** — components from shadcn, shadcn-vue, MUI, Ant Design, Chakra UI, Headless UI, daisyUI, Radix, PrimeVue, Element Plus, Vuetify, etc.
2. **HTML native element** — `<button>`, `<input>`, `<a>`, `<select>`, etc.
3. **Third-party component with no importable children** — chart libraries, map widgets, WYSIWYG editors, etc.

If you cannot open and read the component's source in the project, it is a leaf node.

## Recursive Procedure

```
For each component in the tree:
  1. Read render output → list interactive elements
  2. If component imports child components → recurse into each (stop at leaf nodes)
  3. Split at split points (see below) → each split = SEPARATE analysis target
  4. Produce SET rows for THIS component
  5. Merge all child SETs into the parent SET
```

### Component Tree Discovery

Framework-agnostic steps to build the component tree:

1. **Read component file → find imported child components**
   - Vue: `import XxxDialog from './XxxDialog.vue'` in `<script setup>`
   - React/Next.js: `import XxxDialog from './XxxDialog'` in JSX/TSX files
   - Svelte: `import XxxDialog from './XxxDialog.svelte'` in `<script>`
   - Angular: component imports in `@Component` decorator or module imports

2. **Match imports to render output usage** — confirm each imported component actually appears in the template/JSX/markup

3. **Mark conditionally rendered components**
   - Vue: `v-if`, `v-show`
   - React: `{condition && <Xxx/>}`, ternary `{cond ? <A/> : <B/>}`
   - Svelte: `{#if condition}<Xxx/>{/if}`
   - Angular: `*ngIf`, `@if`

4. **Slot/children content** — analysis responsibility belongs to the component that **defines** the content, not the one that **receives** it. If `ParentPage` passes `<Button>Delete</Button>` as a child to `<Card>`, the button is analyzed under `ParentPage`.

5. **Stop at leaf nodes** (see Definitions above)

### Split Points

When the analysis encounters these patterns, treat each branch as a **separate analysis target**:

| Pattern | Split Strategy |
|---|---|
| **Tabs** | Each tab panel = separate target |
| **Dialog/Modal with form** | Form component = separate target |
| **Conditional rendering blocks** showing different UI states | Each branch = separate target |
| **Nested routes** (Vue: `<RouterView>`, React: `<Outlet>`, Svelte: `+page.svelte`, Angular: `<router-outlet>`) | Each route = separate target |
| **Dynamic components** (Vue: `<component :is>`, React: lazy/dynamic imports, Svelte: `<svelte:component>`) | Each possible component = separate target |

### Analysis Depth

| Component Size | Approach |
|---|---|
| < 50 lines, no logic | Skim render output only — list visible interactive elements |
| 50–200 lines | Read render output + list all event handlers |
| > 200 lines | Full extraction: handlers → API calls → validation → state |
| Shared/reusable component | Analyze **once**, then reference by name in other pages |

### Per-Component Extraction

For each non-trivial component:

1. List all state variables, derived/computed values, and handler functions
2. For each event handler bound in the render output (click, submit, change, etc.):
   - Read the handler implementation
   - Trace to the API function it calls → extract HTTP method + endpoint
3. Find validation schemas (Zod, Yup, Joi, Valibot, etc.) → identify required fields and validation rules

## Semantic Element Table (SET)

Each interactive element = one row. Include a `Container` column to track depth:

| # | Container | Element | Type | Semantic | Handler/Event | API Call | Behavior | Test Strategy |
|---|-----------|---------|------|----------|---------------|----------|----------|---------------|
| 1 | Page | Add button | button | add-project | `openCreateDialog` | — | navigation | click → dialog visible |
| 2 | Edit > Members Tab | Add Member btn | button | add-member | `handleAddMember` | `POST /members` | form-submit | open → fill → submit → feedback |
| 3 | Edit > Members Tab | Delete icon | icon-button | delete-member | `handleRemove` | `DELETE /members/:id` | delete-confirm | click → confirm → removal |

## Extraction Rules

| Source Clue | Extraction |
|---|---|
| Click handler (Vue: `@click`, React: `onClick`, Svelte: `on:click`, Angular: `(click)`) | handler name → semantic |
| Trash/Delete icon inside button | icon name → semantic `delete` |
| Pencil/Edit icon | icon name → semantic `edit` |
| Plus icon | icon name → semantic `add/create` |
| i18n function (`t()`, `$t()`, `useTranslation()`, `intl.formatMessage()`) | key → semantic |
| Event emitter / callback prop (Vue: `emit()`, React: `onXxx` prop, Svelte: `dispatch()`, Angular: `@Output()`) | event name → semantic |
| API call (`api.post()`, `fetch()`, `axios.post()`, `useMutation()`, `$http.post()`) | HTTP method + path → API Call |
| Confirmation wrapper (AlertDialog, Modal with confirm button) | behavior `delete-confirm` |
| Dialog/Modal containing form | behavior `form-submit` |
| Switch/Toggle component | behavior `toggle` |
| Navigation call (`router.push()`, `navigate()`, `goto()`, `Router.navigate()`) | behavior `navigation` |
| Badge in table cell | column type `badge/status` |
| Progress bar in table cell | column type `progress` |
| Date formatting (`formatDate()`, `dayjs()`, `format()`) | column type `date` |
| Disabled condition (Vue: `:disabled`, React: `disabled={...}`, Svelte: `disabled={...}`) | error scenario source |
| Validation rule (`z.string()`, `yup.string()`, `Joi.string()`, `v.string()`) | required field + error scenario |
| Clipboard API (`navigator.clipboard.writeText()`, `execCommand('copy')`, copy utility) | behavior `copy-to-clipboard` |
| File input / drop zone (`<input type="file">`, `onDrop`, `dragover`, `useDropzone()`) | behavior `upload` |
| Keyboard handler (`onKeyDown`, `@keydown`, `on:keydown`, `(keydown)`, `useHotkeys()`) | keyboard shortcut → test via `page.keyboard.press()` |
| Bulk selection state (`selectedIds`, `selectAll`, `checkedRows`, checkbox column) | behavior `bulk-action` |
| Download trigger (`window.open()`, `<a download>`, Blob URL, `saveAs()`) | behavior `download/export` |
| Accordion / Disclosure (`<Collapsible>`, `<Accordion>`, `<details>`, `<Disclosure>`) | behavior `expand-collapse` |
| Combobox / Autocomplete (`<Combobox>`, `<Autocomplete>`, debounced input + suggestion dropdown) | behavior `autocomplete` |
| Dropdown menu (`<DropdownMenu>`, `<Menu>`, `<Popover>` with action list) | behavior `dropdown-menu` — each menu item = separate action |
| Stepper / Wizard (`<Stepper>`, step state, `currentStep`, `nextStep()`) | behavior `multi-step-form` |
| Infinite scroll / Load more (Intersection Observer, `onEndReached`, "Load more" button) | behavior `infinite-scroll` |

## Behavior Taxonomy

| Behavior | Minimum Test Steps |
|----------|-------------------|
| **form-submit** | open → fill ALL required fields via UI → submit → `waitForResponse` → assert feedback → assert data update |
| **delete-confirm** | click trigger → assert AlertDialog → fill confirm input → confirm → `waitForResponse` → assert removal |
| **toggle** | record state → click → `waitForResponse` → assert state flipped → restore |
| **inline-edit** | click to enter edit → change value → save → assert API + display |
| **navigation** | click → `waitForURL` → assert destination loaded |
| **sort** | record first row → click header → `waitForResponse` → assert order changed |
| **filter** | type/select value → `waitForResponse` → assert rows match |
| **pagination** | assert info text → click next → `waitForResponse` → assert content changed |
| **drag-reorder** | record order → `dragTo` → `waitForResponse` → assert order changed |
| **bulk-action** | select checkbox(es) → assert toolbar/action bar visible → click action → `waitForResponse` → assert action applied to all selected |
| **copy-to-clipboard** | click copy trigger → assert success feedback (checkmark icon, "Copied!" text, or toast) |
| **upload** | click input or drag file to drop zone → assert preview/progress → `waitForResponse` → assert upload complete |
| **expand-collapse** | click trigger → assert content visible → click again → assert content hidden |
| **autocomplete** | type query → `waitForResponse` → assert suggestion dropdown → select item → assert input populated + dropdown closed |
| **multi-step-form** | fill step 1 → next → fill step 2 → ... → submit → `waitForResponse` → assert completion |
| **dropdown-menu** | click menu trigger → assert menu visible → click menu item → assert action executed → menu closed |
| **infinite-scroll** | scroll to bottom / click "Load more" → `waitForResponse` → assert new items appended + count increased |
| **download/export** | click trigger → `waitForEvent('download')` → assert file downloaded (filename, non-empty) |
| **keyboard-shortcut** | `page.keyboard.press('Control+K')` → assert expected action (palette open, save, etc.) |
| **static-display** | per column type assertions (see below) |

### Required Error/Boundary Scenarios

| Behavior | Error Scenarios |
|----------|----------------|
| **form-submit** | (1) Empty required field → inline error (2) Invalid value → error feedback (3) Submit disabled during submission |
| **delete-confirm** | (1) Confirm mismatch → button disabled (2) Cancel → dialog close + data unchanged |
| **toggle** | (1) Disabled state → not clickable |
| **filter** | (1) No match → empty state visible |
| **form-submit (dialog)** | (1) Cancel/close → reopen shows empty form |
| **bulk-action** | (1) No items selected → action button disabled/hidden (2) Partial failure → error summary with failed items (3) Select all + deselect individual → count updated |
| **upload** | (1) File too large → error message (2) Invalid file type → rejection message (3) Upload network failure → retry option (4) Multiple files → all listed |
| **autocomplete** | (1) No match → "no results" message or empty dropdown (2) Network error → fallback/retry (3) Clear input → suggestions hidden |
| **multi-step-form** | (1) Step validation failure → cannot proceed to next step (2) Back button → previous data preserved (3) Direct step navigation (if allowed) → skipped steps show validation |
| **expand-collapse** | (1) Default state correct (expanded vs collapsed on load) (2) Nested accordion → only one open at a time (if single-expand mode) |
| **dropdown-menu** | (1) Click outside → menu closes (2) Disabled menu items → not clickable (3) Keyboard navigation → arrow keys + Enter |
| **download/export** | (1) Empty data → button disabled or warning message (2) Large export → loading indicator |
| **infinite-scroll** | (1) No more items → "end of list" indicator or load-more button hidden (2) Loading state → spinner visible during fetch |
| **keyboard-shortcut** | (1) Shortcut conflict with browser → handled gracefully (2) Shortcut disabled when input focused (if applicable) |

Derive specific scenarios from the component's validation schema, disabled conditions, and error handling code.

## Table Column Assertion Rules

```typescript
// Pure text
await expect(rows.first().locator('td').nth(0)).not.toHaveText('')

// Badge/Status
await expect(rows.first().locator('td').nth(1)).toHaveText(/Active|Inactive|啟用|停用/i)

// Date
await expect(rows.first().locator('td').nth(2)).toHaveText(/\d{4}[-/]\d{2}/)

// Progress
await expect(rows.first().locator('td').nth(3)).toHaveText(/\d+\/\d+/)

// Action column
await expect(actionCell.locator('[data-testid="edit-btn"]')).toBeVisible()
await expect(actionCell.locator('[data-testid="delete-btn"]')).toBeVisible()
```

Detect column type from the component render output (Badge, Progress, date formatting, etc.) and apply matching assertion.

## Worked Examples

### Example 1 — Members Page (Simple)

#### 1. Component Tree

```
MembersPage
├── MembersToolbar (search input, add member button)
├── MembersTable (table: name, role[badge], joined[date], actions[edit/delete])
├── AddMemberDialog (form: name input, role select, submit/cancel)
└── DeleteMemberDialog (AlertDialog with confirm input)
```

#### 2. SET

| # | Container | Element | Type | Semantic | Handler | API Call | Behavior | Test Strategy |
|---|-----------|---------|------|----------|---------|----------|----------|---------------|
| 1 | Page | Search input | input | search | `handleSearch` | `GET /members?keyword=` | filter | type → waitForResponse → assert rows |
| 2 | Page | Add Member btn | button | add-member | `openAddDialog` | — | navigation | click → dialog visible |
| 3 | Page | Name column | td | display-name | — | — | static-display | `not.toHaveText('')` |
| 4 | Page | Role column | td+Badge | display-role | — | — | static-display | `toHaveText(/Admin\|Engineer/i)` |
| 5 | Page | Joined column | td+date | display-date | — | — | static-display | `toHaveText(/\d{4}[-/]\d{2}/)` |
| 6 | Page | Delete button | icon-btn | delete | `handleDelete` | `DELETE /members/:id` | delete-confirm | click → confirm → removal |
| 7 | Add Dialog | Form | dialog+form | create | `handleSubmit` | `POST /members` | form-submit | fill → submit → feedback → table update |
| 8 | Delete Dialog | AlertDialog | AlertDialog | confirm-delete | `handleConfirm` | `DELETE /members/:id` | delete-confirm | fill confirm → submit → removal |

#### 3. Coverage Plan

| Container | Component | Interactive Elements | Test Scenarios |
|-----------|-----------|---------------------|----------------|
| Page | index + Toolbar + Table | search, table (4 cols), add btn | table display (per-column), search, empty state |
| Add Dialog | AddMemberDialog | name input, role select, submit, cancel | fill + submit + toast, empty field validation, cancel resets, **UI cleanup** |
| Delete Dialog | DeleteMemberDialog | confirm input, confirm btn, cancel | **UI create target** + confirm + delete, mismatch disabled, cancel |

#### 4. test.describe Blocks

```typescript
test.describe('Members Page', () => {
  test.describe('Table Display', () => { /* per-column assertions */ })
  test.describe('Search Filter', () => { /* keyword + empty state */ })
  test.describe('Add Member Dialog', () => {
    test.describe.serial('Create → Cleanup', () => { /* UI create + UI delete */ })
    // validation error, cancel resets form
  })
  test.describe('Delete Member', () => {
    test.describe.serial('Create Target → Delete', () => { /* UI create + UI delete */ })
    // mismatch disabled, cancel
  })
})
```

### Example 2 — Project Settings Page (Nested Tabs + Dialog)

This example demonstrates 3 levels of recursion and Container column tracking through depth.

#### 1. Component Tree

```
ProjectSettingsPage
├── SettingsTabs
│   ├── [Tab: Info] InfoTab
│   │   ├── ProjectNameInput (text input + save button)
│   │   └── ProjectDescriptionTextarea (textarea + save button)
│   ├── [Tab: Members] MembersTab
│   │   ├── MembersTable (table: name, role[badge], actions[remove])
│   │   ├── AddMemberButton → opens AddMemberDialog
│   │   └── AddMemberDialog (form: email input, role select, submit/cancel)  ← SPLIT: dialog with form
│   └── [Tab: Danger Zone] DangerTab
│       ├── TransferOwnershipButton → opens TransferDialog
│       └── DeleteProjectButton → opens DeleteConfirmDialog  ← SPLIT: confirmation dialog
```

**Split points identified:**
1. SettingsTabs → 3 tab panels (Info, Members, Danger Zone)
2. AddMemberDialog → dialog with form
3. DeleteConfirmDialog → confirmation dialog

#### 2. SET

| # | Container | Element | Type | Semantic | Handler | API Call | Behavior | Test Strategy |
|---|-----------|---------|------|----------|---------|----------|----------|---------------|
| 1 | Settings > Info Tab | Project name input | input | edit-name | `handleSaveName` | `PATCH /projects/:id` | inline-edit | change → save → assert API + display |
| 2 | Settings > Info Tab | Description textarea | textarea | edit-desc | `handleSaveDesc` | `PATCH /projects/:id` | inline-edit | change → save → assert API + display |
| 3 | Settings > Members Tab | Add Member btn | button | add-member | `openDialog` | — | navigation | click → dialog visible |
| 4 | Settings > Members Tab | Name column | td | display-name | — | — | static-display | `not.toHaveText('')` |
| 5 | Settings > Members Tab | Role column | td+Badge | display-role | — | — | static-display | `toHaveText(/Owner\|Admin\|Member/i)` |
| 6 | Settings > Members Tab | Remove button | icon-btn | remove-member | `handleRemove` | `DELETE /projects/:id/members/:mid` | delete-confirm | click → confirm → removal |
| 7 | Settings > Members Tab > Add Dialog | Email input | input | member-email | — | — | form-submit | part of form flow |
| 8 | Settings > Members Tab > Add Dialog | Role select | select | member-role | — | — | form-submit | part of form flow |
| 9 | Settings > Members Tab > Add Dialog | Submit btn | button | submit-member | `handleSubmit` | `POST /projects/:id/members` | form-submit | fill → submit → feedback → table update |
| 10 | Settings > Danger Zone Tab | Transfer btn | button | transfer | `openTransferDialog` | — | navigation | click → dialog visible |
| 11 | Settings > Danger Zone Tab | Delete Project btn | button | delete-project | `openDeleteDialog` | — | navigation | click → dialog visible |
| 12 | Settings > Danger Zone Tab > Delete Dialog | Confirm input | input | confirm-name | — | — | delete-confirm | type project name |
| 13 | Settings > Danger Zone Tab > Delete Dialog | Confirm btn | button | confirm-delete | `handleDelete` | `DELETE /projects/:id` | delete-confirm | confirm → redirect to project list |

**Container column tracks depth:** `Settings > Members Tab > Add Dialog` shows 3 levels of nesting (Page → Tab → Dialog).

#### 3. Coverage Plan

| Container | Component | Interactive Elements | Test Scenarios |
|-----------|-----------|---------------------|----------------|
| Settings > Info Tab | InfoTab | name input, desc textarea, 2 save buttons | edit name, edit description, empty name validation |
| Settings > Members Tab | MembersTab + Table | add btn, table (2 cols), remove btn | table display, remove member |
| Settings > Members Tab > Add Dialog | AddMemberDialog | email input, role select, submit, cancel | fill + submit + toast, empty email validation, cancel resets |
| Settings > Danger Zone Tab | DangerTab | transfer btn, delete btn | button visibility, permission check |
| Settings > Danger Zone Tab > Delete Dialog | DeleteConfirmDialog | confirm input, confirm btn, cancel | type name + confirm + redirect, mismatch disabled, cancel |
