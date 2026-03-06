# Semantic Analysis Reference

## Recursive Procedure

```
For each component in the tree:
  1. Read template → list interactive elements
  2. If component imports child components → recurse into each
  3. If component renders tabs → each tab panel content = SEPARATE analysis target
  4. If component renders a dialog with a form → form component = SEPARATE target
  5. Produce SET rows for THIS component
  6. Merge all child SETs into the parent SET
```

### Serena Workflow Per Component

For each non-trivial component (>20 lines of script):

1. `get_symbols_overview(relative_path=file)` → list all functions, refs, computed
2. For each handler found in template `@click` / `@submit`:
   - `find_symbol(name_path=handlerName, include_body=true)` → read implementation
   - `find_referencing_symbols(symbol_name=apiFunctionName)` → trace to API endpoint
3. `search_for_pattern('z\\.', relative_path=dir)` → find Zod validation schemas

**Skip Serena** only for: files < 100 lines (use `Read`), shadcn-vue primitives, pure layout wrappers.

## Semantic Element Table (SET)

Each interactive element = one row. Include a `Container` column:

| # | Container | Element | Type | Semantic | Handler/Event | API Call | Behavior | Test Strategy |
|---|-----------|---------|------|----------|---------------|----------|----------|---------------|
| 1 | Page | Add button | button | add-project | `openCreateDialog` | — | navigation | click → dialog visible |
| 2 | Edit > Members Tab | Add Member btn | button | add-member | `handleAddMember` | `POST /members` | form-submit | open → fill → submit → toast |
| 3 | Edit > Members Tab | Delete icon | icon-button | delete-member | `handleRemove` | `DELETE /members/:id` | delete-confirm | click → confirm → removal |

## Extraction Rules

| Source Clue | Extraction |
|---|---|
| `@click="handleAddMember"` | handler name → semantic `add-member` |
| `<Trash2 />` icon inside button | icon name → semantic `delete` |
| `<Pencil />` or `<Edit />` icon | icon name → semantic `edit` |
| `<Plus />` icon | icon name → semantic `add/create` |
| `t("member.addMember")` | i18n key → semantic `add-member` |
| `emit('toggle-status')` | event name → semantic `toggle-status` |
| `await api.post('/members')` | HTTP method + path → API Call |
| `<AlertDialog>` wrapping button | UI pattern → behavior `delete-confirm` |
| `<Dialog>` with form inside | UI pattern → behavior `form-submit` |
| `<Switch>` or `<Toggle>` | UI pattern → behavior `toggle` |
| `router.push(...)` in handler | navigation call → behavior `navigation` |
| `<Badge>` in table cell | column type `badge/status` |
| `<Progress>` in table cell | column type `progress` |
| `formatDate()` | column type `date` |
| `:disabled="!canSubmit"` | error scenario source |
| `z.string().min(1)` | required field + error scenario |

## Behavior Taxonomy

| Behavior | Minimum Test Steps |
|----------|-------------------|
| **form-submit** | open → fill ALL required fields via UI → submit → `waitForResponse` → assert toast → assert data update |
| **delete-confirm** | click trigger → assert AlertDialog → fill confirm input → confirm → `waitForResponse` → assert removal |
| **toggle** | record state → click → `waitForResponse` → assert state flipped → restore |
| **inline-edit** | click to enter edit → change value → save → assert API + display |
| **navigation** | click → `waitForURL` → assert destination loaded |
| **sort** | record first row → click header → `waitForResponse` → assert order changed |
| **filter** | type/select value → `waitForResponse` → assert rows match |
| **pagination** | assert info text → click next → `waitForResponse` → assert content changed |
| **drag-reorder** | record order → `dragTo` → `waitForResponse` → assert order changed |
| **static-display** | per column type assertions (see below) |

### Required Error/Boundary Scenarios

| Behavior | Error Scenarios |
|----------|----------------|
| **form-submit** | (1) Empty required field → inline error (2) Invalid value → error toast (3) Submit disabled during submission |
| **delete-confirm** | (1) Confirm mismatch → button disabled (2) Cancel → dialog close + data unchanged |
| **toggle** | (1) Disabled state → not clickable |
| **filter** | (1) No match → empty state visible |
| **form-submit (dialog)** | (1) Cancel/close → reopen shows empty form |

Derive specific scenarios from Vue component's Zod schema, disabled computed, and error handling code.

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

Detect column type from Vue template (`<Badge>`, `<Progress>`, `formatDate()`, etc.) and apply matching assertion.

## Worked Example — Members Page

### 1. Component Tree

```
MembersPage/index.vue
├── MembersToolbar.vue (search input, add member button)
├── MembersTable.vue (table: name, role[badge], joined[date], actions[edit/delete])
├── AddMemberDialog.vue (form: name input, role select, submit/cancel)
└── DeleteMemberDialog.vue (AlertDialog with confirm input)
```

### 2. SET

| # | Container | Element | Type | Semantic | Handler | API Call | Behavior | Test Strategy |
|---|-----------|---------|------|----------|---------|----------|----------|---------------|
| 1 | Page | Search input | input | search | `handleSearch` | `GET /members?keyword=` | filter | type → waitForResponse → assert rows |
| 2 | Page | Add Member btn | button | add-member | `openAddDialog` | — | navigation | click → dialog visible |
| 3 | Page | Name column | td | display-name | — | — | static-display | `not.toHaveText('')` |
| 4 | Page | Role column | td+Badge | display-role | — | — | static-display | `toHaveText(/Admin\|Engineer/i)` |
| 5 | Page | Joined column | td+date | display-date | — | — | static-display | `toHaveText(/\d{4}[-/]\d{2}/)` |
| 6 | Page | Delete button | icon-btn | delete | `handleDelete` | `DELETE /members/:id` | delete-confirm | click → confirm → removal |
| 7 | Add Dialog | Form | dialog+form | create | `handleSubmit` | `POST /members` | form-submit | fill → submit → toast → table update |
| 8 | Delete Dialog | AlertDialog | AlertDialog | confirm-delete | `handleConfirm` | `DELETE /members/:id` | delete-confirm | fill confirm → submit → removal |

### 3. Coverage Plan

| Container | Component | Interactive Elements | Test Scenarios |
|-----------|-----------|---------------------|----------------|
| Page | index + Toolbar + Table | search, table (4 cols), add btn | table display (per-column), search, empty state |
| Add Dialog | AddMemberDialog | name input, role select, submit, cancel | fill + submit + toast, empty field validation, cancel resets, **UI cleanup** |
| Delete Dialog | DeleteMemberDialog | confirm input, confirm btn, cancel | **UI create target** + confirm + delete, mismatch disabled, cancel |

### 4. test.describe Blocks

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
