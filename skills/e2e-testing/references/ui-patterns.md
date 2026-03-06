# UI Pattern Testing Examples

Runnable code patterns for common UI interactions. Each section corresponds to a behavior from the Behavior Taxonomy in `semantic-analysis.md`.

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

## Select / Dropdown (shadcn-vue)

shadcn-vue portals dropdown content outside the parent container. Target the portal content directly:

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

## Form Fill + Submit + Toast

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

    const toast = await listPage.getSuccessToast()
    expect(toast).toContain('成功')
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

    expect(await listPage.getSuccessToast()).toContain('成功')
  })
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
    expect(await listPage.getSuccessToast()).toContain('成功')
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
    expect(await listPage.getSuccessToast()).toContain('成功')
  })
})
```

## Nested Spec Structure (Tabbed Dialog)

Mirror the component hierarchy with `test.describe` nesting. Each tab panel gets its own block:

```typescript
test.describe('Project List Page', () => {
  test.describe('Table Display', () => { /* row count + per-column assertions */ })
  test.describe('Search', () => { /* keyword + empty state */ })

  test.describe('Create Project Dialog', () => {
    test.describe.serial('Create → Cleanup', () => { /* fill + submit + UI delete */ })
    test('should validate required fields', async () => { /* empty submit → error */ })
    test('should reset form on cancel', async () => { /* cancel → reopen → empty */ })
  })

  test.describe('Edit Project Dialog', () => {
    test.describe('Info Tab', () => {
      test('should display prefilled fields', async () => { /* open → check values */ })
      test('should edit and save', async () => { /* change → submit → toast → restore */ })
    })

    test.describe('Members Tab', () => {
      test('should display members table', async () => { /* row count + columns */ })
      test.describe.serial('Add Member → Remove', () => {
        test('should add member via form', async () => { /* fill → submit → toast */ })
        test('should remove added member', async () => { /* click delete → confirm → removal */ })
      })
    })

    test.describe('Settings Tab', () => {
      test('should toggle feature flag', async () => { /* toggle → restore */ })
      test('should save settings', async () => { /* change → submit → toast */ })
    })
  })

  test.describe('Delete Project', () => {
    test.describe.serial('Create Target → Delete', () => { /* UI create → UI delete */ })
  })
})
```
