# UI Pattern Testing Examples

Core code patterns for common UI interactions. Each section corresponds to a behavior from the Behavior Taxonomy in `semantic-analysis.md` or the Interaction Depth Checklist in `coverage-checklist.md`.

For specialized patterns (sortable columns, tabs, accordion, popover, date picker, rich text editor, file upload, drag and drop), see **`ui-patterns-extended.md`**.

## Table of Contents

- [Table Display & Row Assertions](#table-display--row-assertions) (row count, column content, action buttons)
- [Select / Dropdown (Portaled Content)](#select--dropdown-portaled-content) (handling portaled dropdowns from UI libraries)
- [Form Fill + Submit + Feedback](#form-fill--submit--feedback) (serial create + cleanup with API wait and feedback)
- [Form Submit with API Interception](#form-submit-with-api-interception) (interceptApi for precise error classification)
- [Form Validation (Empty / Invalid Fields)](#form-validation-empty--invalid-fields) (inline error, cancel reset)
- [Edit Flow (Read → Modify → Save → Restore)](#edit-flow-read--modify--save--restore) (record original, edit via UI, restore)
- [Pagination](#pagination) (page info display, next page navigation)
- [Search / Filter](#search--filter) (keyword filtering, empty state)
- [Toggle / Switch](#toggle--switch) (toggle state, API wait, restore)
- [Delete with Confirmation Dialog](#delete-with-confirmation-dialog) (serial create target + delete with confirm input)
- [Nested Spec Structure (Tabbed Dialog)](#nested-spec-structure-tabbed-dialog) (mirroring component hierarchy with test.describe)

---

## Table Display & Row Assertions

```typescript
test.describe('Table Display', () => {
  test('should display table with data', async () => {
    const rows = listPage.tableRows
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThan(0)
  })

  test('should display correct column content', async () => {
    const firstRow = listPage.tableRows.first()
    // Pure text
    await expect(firstRow.locator('td').nth(0)).not.toHaveText('')
    // Badge/Status
    await expect(firstRow.locator('td').nth(1)).toHaveText(/Active|Inactive|啟用|停用/i)
    // Date
    await expect(firstRow.locator('td').nth(2)).toHaveText(/\d{4}[-/]\d{2}/)
    // Action buttons
    const actionCell = firstRow.locator('td').last()
    await expect(actionCell.locator('[data-testid="edit-btn"]')).toBeVisible()
    await expect(actionCell.locator('[data-testid="delete-btn"]')).toBeVisible()
  })
})
```

## Select / Dropdown (Portaled Content)

Many UI libraries (shadcn, shadcn-vue, Radix, Headless UI, MUI, etc.) portal dropdown content outside the parent container. Target the portal content directly:

```typescript
test('should select role from dropdown', async () => {
  // Click trigger to open
  await page.locator('[data-testid="role-select-trigger"]').click()
  // Wait for portaled content
  const content = page.locator('[data-testid="role-select-content"]')
  await expect(content).toBeVisible()
  // Select option
  await content.locator('text=Admin').click()
  // Verify selected value on trigger
  await expect(page.locator('[data-testid="role-select-trigger"]')).toHaveText(/Admin/)
})
```

## Form Fill + Submit + Feedback

```typescript
test.describe.serial('Create Item → Cleanup', () => {
  const TEST_NAME = `[E2E] Test ${Date.now().toString(36)}`

  test('should create item via form', async () => {
    await listPage.addButton.click()
    await expect(listPage.createDialog.container).toBeVisible()

    await listPage.createDialog.nameInput.fill(TEST_NAME)
    // For select fields — click trigger → select option
    await listPage.createDialog.roleSelect.click()
    await page.locator('[data-testid="role-select-content"]').locator('text=Engineer').click()

    const apiPromise = listPage.waitForApi('/v3/items')
    await listPage.createDialog.submitBtn.click()
    await apiPromise

    const feedback = await listPage.getSuccessFeedback()
    expect(feedback).toContain('成功')
  })

  test('should clean up created item via UI', async () => {
    await listPage.goto()
    await listPage.searchInput.fill('[E2E]')
    await listPage.page.waitForResponse(resp => resp.url().includes('/v3/items'))

    const deleteBtn = listPage.tableRows.first()
      .locator('[data-testid="item-delete-btn"]')
    await deleteBtn.click()

    // Confirm delete dialog
    await listPage.deleteDialog.confirmInput.fill(TEST_NAME)
    const apiPromise = listPage.waitForApi('/v3/items/')
    await listPage.deleteDialog.submitBtn.click()
    await apiPromise

    expect(await listPage.getSuccessFeedback()).toContain('成功')
  })
})
```

## Form Submit with API Interception

Use `interceptApi` for precise error classification instead of relying on UI feedback alone. See `error-discrimination.md` for the full classification framework.

```typescript
test('should create item with API verification', async () => {
  await listPage.addButton.click()
  await expect(listPage.createDialog.container).toBeVisible()

  await listPage.createDialog.nameInput.fill(`[E2E] Test ${Date.now().toString(36)}`)

  // interceptApi: capture HTTP status + response body
  const { ok, status, body } = await listPage.interceptApi(
    '/v3/items',
    () => listPage.createDialog.submitBtn.click()
  )

  expect(ok).toBe(true)
  expect(status).toBe(200)

  // Auxiliary: verify UI feedback rendered correctly
  if (listPage.feedbackSuccess) {
    await expect(listPage.feedbackSuccess).toBeVisible()
  }
})

test('should handle duplicate name error via API response', async () => {
  await listPage.addButton.click()
  await listPage.createDialog.nameInput.fill('existing-item-name')

  const { ok, status, body } = await listPage.interceptApi(
    '/v3/items',
    () => listPage.createDialog.submitBtn.click()
  )

  expect(ok).toBe(false)
  expect(status).toBe(409)
  // Structured API response provides field-level detail
  expect(body.field).toBe('name')

  // Auxiliary: verify error feedback shown to user
  if (listPage.feedbackError) {
    await expect(listPage.feedbackError).toBeVisible()
  }
})
```

## Form Validation (Empty / Invalid Fields)

```typescript
test('should show error when submitting empty required field', async () => {
  await listPage.addButton.click()
  await expect(listPage.createDialog.container).toBeVisible()

  // Leave required fields empty, click submit
  await listPage.createDialog.submitBtn.click()

  // Assert inline error OR disabled submit
  const errorMsg = listPage.createDialog.container.locator('.text-destructive')
  await expect(errorMsg).toBeVisible()
})

test('should reset form on cancel', async () => {
  await listPage.addButton.click()
  await listPage.createDialog.nameInput.fill('partial input')
  // Close dialog
  await listPage.createDialog.container.locator('[data-testid="cancel-btn"]').click()
  // Reopen — form should be empty
  await listPage.addButton.click()
  await expect(listPage.createDialog.nameInput).toHaveValue('')
})
```

## Edit Flow (Read → Modify → Save → Restore)

Edit uses existing data — do NOT create via API. Record original values, edit through UI, assert success, then restore.

```typescript
test.describe('Edit Item', () => {
  let originalName: string

  test('should edit name and save', async () => {
    // Open edit dialog for first row
    await listPage.tableRows.first().locator('[data-testid="edit-btn"]').click()
    await expect(listPage.editDialog.container).toBeVisible()

    // Record original value
    originalName = await listPage.editDialog.nameInput.inputValue()

    // Modify
    const newName = `${originalName} [EDITED]`
    await listPage.editDialog.nameInput.clear()
    await listPage.editDialog.nameInput.fill(newName)

    // Submit and verify
    const { ok } = await listPage.interceptApi(
      '/v3/items/',
      () => listPage.editDialog.submitBtn.click()
    )
    expect(ok).toBe(true)

    if (listPage.feedbackSuccess) {
      await expect(listPage.feedbackSuccess).toBeVisible()
    }

    // Verify the change is reflected in the table
    await expect(listPage.tableRows.first()).toContainText(newName)
  })

  test('should restore original name', async () => {
    await listPage.tableRows.first().locator('[data-testid="edit-btn"]').click()
    await expect(listPage.editDialog.container).toBeVisible()

    await listPage.editDialog.nameInput.clear()
    await listPage.editDialog.nameInput.fill(originalName)

    const { ok } = await listPage.interceptApi(
      '/v3/items/',
      () => listPage.editDialog.submitBtn.click()
    )
    expect(ok).toBe(true)

    await expect(listPage.tableRows.first()).toContainText(originalName)
  })
})
```

## Pagination

```typescript
test.describe('Pagination', () => {
  test('should display page info', async () => {
    const pageInfo = page.locator('[data-testid="pagination-info"]')
    await expect(pageInfo).toHaveText(/\d+/)
  })

  test('should navigate to next page', async () => {
    const firstRowText = await listPage.tableRows.first().locator('td').first().textContent()
    const nextBtn = page.locator('[data-testid="pagination-next"]')
    const apiPromise = listPage.waitForApi('/v3/items')
    await nextBtn.click()
    await apiPromise
    const newFirstRowText = await listPage.tableRows.first().locator('td').first().textContent()
    expect(newFirstRowText).not.toBe(firstRowText)
  })
})
```

## Search / Filter

```typescript
test.describe('Search Filter', () => {
  test('should filter by keyword', async () => {
    await listPage.searchInput.fill('test')
    await page.waitForResponse(resp => resp.url().includes('/v3/items'))
    const count = await listPage.tableRows.count()
    expect(count).toBeGreaterThan(0)
    // Verify each visible row contains the keyword
    for (let i = 0; i < Math.min(count, 3); i++) {
      await expect(listPage.tableRows.nth(i)).toContainText(/test/i)
    }
  })

  test('should show empty state for no results', async () => {
    await listPage.searchInput.fill('xyznonexistent123')
    await page.waitForResponse(resp => resp.url().includes('/v3/items'))
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible()
  })
})
```

## Toggle / Switch

```typescript
test('should toggle status and restore', async () => {
  const toggle = listPage.tableRows.first().locator('[data-testid="status-toggle"]')
  const originalState = await toggle.getAttribute('data-state')

  const apiPromise = listPage.waitForApi('/v3/items/')
  await toggle.click()
  await apiPromise

  const newState = await toggle.getAttribute('data-state')
  expect(newState).not.toBe(originalState)

  // Restore original state
  const restorePromise = listPage.waitForApi('/v3/items/')
  await toggle.click()
  await restorePromise
  expect(await toggle.getAttribute('data-state')).toBe(originalState)
})
```

## Delete with Confirmation Dialog

```typescript
test.describe.serial('Create Target → Delete', () => {
  const DELETE_TARGET = `[E2E] Delete Target ${Date.now().toString(36)}`

  test('should create delete target via UI', async () => {
    test.setTimeout(60000)
    await listPage.addButton.click()
    await listPage.createDialog.nameInput.fill(DELETE_TARGET)
    const apiPromise = listPage.waitForApi('/v3/items')
    await listPage.createDialog.submitBtn.click()
    await apiPromise
    expect(await listPage.getSuccessFeedback()).toContain('成功')
  })

  test('should delete with confirmation', async () => {
    await listPage.goto()
    await listPage.searchInput.fill(DELETE_TARGET)
    await page.waitForResponse(resp => resp.url().includes('/v3/items'))

    const deleteBtn = listPage.tableRows.first()
      .locator('[data-testid="item-delete-btn"]')
    await deleteBtn.click()
    await expect(listPage.deleteDialog.container).toBeVisible()

    await listPage.deleteDialog.confirmInput.fill(DELETE_TARGET)
    const apiPromise = listPage.waitForApi('/v3/items/')
    await listPage.deleteDialog.submitBtn.click()
    await apiPromise
    expect(await listPage.getSuccessFeedback()).toContain('成功')
  })
})
```

## Nested Spec Structure (Tabbed Dialog)

Mirror the component hierarchy with `test.describe` nesting. Each tab panel gets its own block:

```typescript
test.describe('Project List Page', () => {
  test.describe('Table Display', () => { /* row count + per-column assertions */ })
  test.describe('Table Sorting', () => { /* click header → verify order */ })
  test.describe('Search', () => { /* keyword + empty state */ })

  test.describe('Create Project Dialog', () => {
    test.describe.serial('Create → Cleanup', () => { /* fill + submit + UI delete */ })
    test('should validate required fields', async () => { /* empty submit → error */ })
    test('should reset form on cancel', async () => { /* cancel → reopen → empty */ })
  })

  test.describe('Edit Project Dialog', () => {
    test.describe('Info Tab', () => {
      test('should display prefilled fields', async () => { /* open → check values */ })
      test('should edit and save', async () => { /* change → submit → verify → restore */ })
    })

    test.describe('Members Tab', () => {
      test('should display members table', async () => { /* row count + columns */ })
      test.describe.serial('Add Member → Remove', () => {
        test('should add member via form', async () => { /* fill → submit → feedback */ })
        test('should remove added member', async () => { /* click delete → confirm → removal */ })
      })
    })

    test.describe('Settings Tab', () => {
      test('should toggle feature flag', async () => { /* toggle → restore */ })
      test('should save settings', async () => { /* change → submit → feedback */ })
    })
  })

  test.describe('Delete Project', () => {
    test.describe.serial('Create Target → Delete', () => { /* UI create → UI delete */ })
  })
})
```
