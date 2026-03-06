# UI-Only Test Data Policy

All test data manipulation MUST go through the UI. Tests behave exactly like a real user.

## Forbidden

- `request.post()` / `request.get()` / `request.delete()` — for ANY purpose
- `fetch()` in `browser_run_code` for data manipulation
- Reading auth tokens from storage state files to build API headers
- Any `test.beforeEach` or `test.afterEach` that calls APIs directly
- Helper functions like `getAuthToken()` or `authHeaders()`

## Naming Convention

Use `[E2E]` prefix for test-created data: `[E2E] Create Test`, `[E2E] Delete Target`.

## Lifecycle Patterns

### Create Tests

1. Open dialog/form through UI (click add button)
2. Fill all required fields through UI interactions
3. Submit → wait for API response → assert success toast + list update
4. **Clean up through UI** — search `[E2E]` data → delete via UI. If no delete UI exists, accept persistence (document in comment)

### Edit Tests

1. Use existing data on the page (first row) — do NOT create via API
2. Record original values before editing
3. Edit through UI → assert success
4. **Restore original values through UI** to leave data unchanged

### Delete Tests

1. **Create the delete target through UI first** — open create dialog → fill `[E2E] Delete Target` → submit
2. Search for the created data
3. Delete through UI → confirm → assert removal

## Test Ordering for CRUD

Use `test.describe.serial` to chain create → verify → delete:

```typescript
test.describe.serial('Create → Verify → Delete', () => {
  const TEST_NAME = `[E2E] Test ${Date.now().toString(36)}`

  test('should create item via UI form', async ({ page }) => {
    // open dialog → fill → submit → assert toast
  })
  test('should verify created item in list', async ({ page }) => {
    // search → assert visible
  })
  test('should delete created item via UI', async ({ page }) => {
    // search → click delete → confirm → assert removed
  })
})
```

## Create with UI Cleanup — Full Example

```typescript
test.describe('Create Project', () => {
  test.describe.serial('Create → Cleanup', () => {
    const TEST_NAME = `[E2E] Create Test ${Date.now().toString(36)}`

    test('should create project and show success toast', async ({ page }) => {
      const listPage = new ProjectListPage(page)
      await listPage.goto()
      await listPage.addButton.click()
      await listPage.createDialog.nameInput.fill(TEST_NAME)
      const apiPromise = listPage.waitForApi('/v3/projects')
      await listPage.createDialog.submitBtn.click()
      await apiPromise
      const toast = await listPage.getSuccessToast()
      expect(toast).toContain('成功')
    })

    test('should clean up via UI delete', async ({ page }) => {
      const listPage = new ProjectListPage(page)
      await listPage.goto()
      await listPage.search('[E2E]')
      const deleteBtn = listPage.tableRows.first()
        .locator('[data-testid="project-list-row-delete-btn"]')
      await deleteBtn.click()
      const name = await listPage.tableRows.first().locator('td').first().textContent()
      await listPage.deleteDialog.confirmInput.fill(name?.trim() ?? '')
      await listPage.deleteDialog.submitBtn.click()
      const toast = await listPage.getSuccessToast()
      expect(toast).toContain('成功')
    })
  })
})
```

## Delete with UI Setup — Full Example

```typescript
test.describe('Delete Project', () => {
  test.describe.serial('Create Target → Delete', () => {
    const DELETE_TARGET = `[E2E] Delete Target ${Date.now().toString(36)}`

    test('should create target via UI', async ({ page }) => {
      test.setTimeout(60000)
      const listPage = new ProjectListPage(page)
      await listPage.goto()
      await listPage.addButton.click()
      await listPage.createDialog.nameInput.fill(DELETE_TARGET)
      const apiPromise = listPage.waitForApi('/v3/projects')
      await listPage.createDialog.submitBtn.click()
      await apiPromise
      expect(await listPage.getSuccessToast()).toContain('成功')
    })

    test('should delete after confirmation', async ({ page }) => {
      const listPage = new ProjectListPage(page)
      await listPage.goto()
      await listPage.search(DELETE_TARGET)
      const deleteBtn = listPage.tableRows.first()
        .locator('[data-testid="project-list-row-delete-btn"]')
      await deleteBtn.click()
      await expect(listPage.deleteDialog.container).toBeVisible()
      await listPage.deleteDialog.confirmInput.fill(DELETE_TARGET)
      const apiPromise = listPage.waitForApi('/v3/projects/')
      await listPage.deleteDialog.submitBtn.click()
      await apiPromise
      expect(await listPage.getSuccessToast()).toContain('成功')
    })
  })
})
```

## When UI Cleanup Is Not Possible

- Document it: `// Note: [E2E] test data persists — no UI delete available`
- Use unique identifiers per run (timestamp suffix) to avoid collisions
- Do NOT fall back to API cleanup — accept the limitation
