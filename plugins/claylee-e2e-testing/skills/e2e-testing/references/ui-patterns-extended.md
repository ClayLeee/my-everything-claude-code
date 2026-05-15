# UI Pattern Testing Examples — Extended

Specialized patterns for less common UI elements. Load this file **only when the coverage plan includes these elements**. For core patterns (table, form, select, pagination, search, toggle, delete, edit), see **`ui-patterns.md`**.

## Table of Contents

- [Sortable Table Columns](#sortable-table-columns)
- [Tab Switching + Panel Content](#tab-switching--panel-content)
- [Accordion / Collapsible](#accordion--collapsible)
- [Popover / Filter Panel](#popover--filter-panel)
- [Date / Time Picker](#date--time-picker)
- [Rich Text Editor](#rich-text-editor)
- [File Upload](#file-upload)
- [Drag and Drop](#drag-and-drop)

---

## Sortable Table Columns

```typescript
test.describe('Table Sorting', () => {
  test('should sort by name column', async () => {
    const nameHeader = page.locator('th', { hasText: 'Name' })
    const firstCell = () => listPage.tableRows.first().locator('td').nth(0)

    const originalText = await firstCell().textContent()

    await nameHeader.click()
    await page.waitForResponse(resp => resp.url().includes('/api/items'))
    const ascText = await firstCell().textContent()

    await nameHeader.click()
    await page.waitForResponse(resp => resp.url().includes('/api/items'))
    const descText = await firstCell().textContent()

    // At least one sort direction should change the first row
    const changed = ascText !== originalText || descText !== originalText
    expect(changed).toBe(true)
  })

  test('should show sort indicator on active column', async () => {
    const nameHeader = page.locator('th', { hasText: 'Name' })
    await nameHeader.click()
    await page.waitForResponse(resp => resp.url().includes('/api/items'))

    // Sort indicator — adapt selector to your UI library
    await expect(nameHeader.locator('[data-testid="sort-indicator"]')).toBeVisible()
  })
})
```

## Tab Switching + Panel Content

Each tab panel is a sub-page — switch to it, then verify its own content (tables, forms, etc.) independently. Do NOT just test that tabs can be clicked.

```typescript
test.describe('Edit Dialog Tabs', () => {
  test.beforeEach(async () => {
    await listPage.tableRows.first().locator('[data-testid="edit-btn"]').click()
    await expect(listPage.editDialog.container).toBeVisible()
  })

  test.describe('Info Tab', () => {
    test('should display prefilled fields', async () => {
      // Info tab is default — no need to click tab trigger
      await expect(listPage.editDialog.nameInput).not.toHaveValue('')
      await expect(listPage.editDialog.descInput).toBeVisible()
    })
  })

  test.describe('Members Tab', () => {
    test.beforeEach(async () => {
      await listPage.editDialog.tabMembers.click()
    })

    test('should display members table', async () => {
      await expect(listPage.editDialog.membersTable).toBeVisible()
      expect(await listPage.editDialog.membersRows.count()).toBeGreaterThan(0)
    })

    test('should show member role in each row', async () => {
      const firstRow = listPage.editDialog.membersRows.first()
      await expect(firstRow.locator('td').nth(1)).toHaveText(/.+/)
    })
  })

  test.describe('Settings Tab', () => {
    test.beforeEach(async () => {
      await listPage.editDialog.tabSettings.click()
    })

    test('should display settings controls', async () => {
      await expect(listPage.editDialog.visibilitySelect).toBeVisible()
    })
  })
})
```

## Accordion / Collapsible

```typescript
test.describe('Accordion', () => {
  test('should expand and show content', async () => {
    const trigger = page.locator('[data-testid="faq-item-1-trigger"]')
    const content = page.locator('[data-testid="faq-item-1-content"]')

    await expect(content).not.toBeVisible()

    await trigger.click()
    await expect(content).toBeVisible()
    await expect(content).toContainText(/.+/)

    await trigger.click()
    await expect(content).not.toBeVisible()
  })

  test('should only allow one expanded at a time (single mode)', async () => {
    const trigger1 = page.locator('[data-testid="faq-item-1-trigger"]')
    const trigger2 = page.locator('[data-testid="faq-item-2-trigger"]')
    const content1 = page.locator('[data-testid="faq-item-1-content"]')
    const content2 = page.locator('[data-testid="faq-item-2-content"]')

    await trigger1.click()
    await expect(content1).toBeVisible()

    await trigger2.click()
    await expect(content2).toBeVisible()
    await expect(content1).not.toBeVisible()
  })
})
```

## Popover / Filter Panel

Open the filter, interact with controls, verify the parent table/list updates.

```typescript
test.describe('Filter Panel', () => {
  test('should filter table by status', async () => {
    const filterBtn = page.locator('[data-testid="filter-btn"]')
    const filterPanel = page.locator('[data-testid="filter-panel"]')

    await filterBtn.click()
    await expect(filterPanel).toBeVisible()

    await filterPanel.locator('[data-testid="status-filter"]').click()
    const content = page.locator('[data-testid="status-filter-content"]')
    await content.locator('text=Active').click()

    await filterPanel.locator('[data-testid="filter-apply-btn"]').click()
    await page.waitForResponse(resp => resp.url().includes('/api/items'))

    const rows = listPage.tableRows
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < Math.min(count, 3); i++) {
      await expect(rows.nth(i)).toContainText(/Active|啟用/i)
    }
  })

  test('should clear filters and restore full list', async () => {
    const originalCount = await listPage.tableRows.count()

    await page.locator('[data-testid="filter-btn"]').click()
    await page.locator('[data-testid="filter-panel"]')
      .locator('[data-testid="filter-clear-btn"]').click()
    await page.waitForResponse(resp => resp.url().includes('/api/items'))

    expect(await listPage.tableRows.count()).toBe(originalCount)
  })
})
```

## Date / Time Picker

Date pickers vary widely across UI libraries. The safest approach is to target the underlying input directly, bypassing the calendar popup.

```typescript
test.describe('Date Picker', () => {
  test('should set date via input', async () => {
    const dateInput = page.locator('[data-testid="start-date-input"]')

    // Most date pickers have an underlying <input> — fill it directly
    await dateInput.fill('2026-03-19')
    await dateInput.press('Enter')

    await expect(dateInput).toHaveValue(/2026-03-19/)
  })

  test('should set date via calendar popup', async () => {
    const trigger = page.locator('[data-testid="start-date-trigger"]')
    await trigger.click()

    // Wait for calendar popup (often portaled)
    const calendar = page.locator('[data-testid="calendar-popup"]')
    await expect(calendar).toBeVisible()

    // Navigate to target month if needed
    await calendar.locator('[data-testid="calendar-next-month"]').click()

    // Select a specific day
    await calendar.getByRole('gridcell', { name: '15' }).click()

    // Calendar should close and trigger should show selected date
    await expect(calendar).not.toBeVisible()
    await expect(trigger).toHaveText(/15/)
  })
})
```

> **Tip:** Native `<input type="date">` → use `page.fill()` with ISO format (`YYYY-MM-DD`). Custom calendar → use `getByRole('gridcell')`.

## Rich Text Editor

Rich text editors (Tiptap, ProseMirror, Slate, Quill, CKEditor, etc.) render content inside a `contenteditable` element. Do NOT test toolbar formatting unless explicitly requested.

```typescript
test.describe('Rich Text Editor', () => {
  test('should type and verify content', async () => {
    // Adapt selector to your editor:
    //   Tiptap:    '.tiptap'
    //   Quill:     '.ql-editor'
    //   CKEditor:  '.ck-editor__editable'
    //   Slate:     '[data-slate-editor]'
    //   Generic:   '[contenteditable="true"]'
    const editor = page.locator('[data-testid="description-editor"] .tiptap')

    await editor.click()
    await editor.fill('')
    await page.keyboard.type('This is test content for the editor')

    await expect(editor).toContainText('This is test content')
  })

  test('should preserve content after form submit', async () => {
    const editor = page.locator('[data-testid="description-editor"] .tiptap')
    await editor.click()
    await page.keyboard.type('Persisted content')

    const { ok } = await listPage.interceptApi(
      '/v3/items/',
      () => listPage.editDialog.submitBtn.click()
    )
    expect(ok).toBe(true)

    // Reopen and verify content persisted
    await listPage.tableRows.first().locator('[data-testid="edit-btn"]').click()
    const reopenedEditor = page.locator('[data-testid="description-editor"] .tiptap')
    await expect(reopenedEditor).toContainText('Persisted content')
  })
})
```

## File Upload

```typescript
test.describe('File Upload', () => {
  test('should upload a file and show preview', async () => {
    const fileInput = page.locator('[data-testid="file-upload-input"]')

    // Playwright's setInputFiles accepts synthetic buffers — no real file needed
    await fileInput.setInputFiles({
      name: 'test-upload.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    })

    await expect(page.locator('[data-testid="file-upload-preview"]')).toBeVisible()
  })

  test('should upload via drag-and-drop zone', async () => {
    const dropZone = page.locator('[data-testid="file-drop-zone"]')

    // For drop zones, look for the hidden file input inside
    const fileInput = dropZone.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake-pdf-content'),
    })

    await expect(dropZone).toContainText(/document\.pdf|上傳成功/i)
  })

  test('should reject invalid file type', async () => {
    const fileInput = page.locator('[data-testid="file-upload-input"]')

    await fileInput.setInputFiles({
      name: 'malicious.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('fake-content'),
    })

    await expect(page.locator('.text-destructive')).toBeVisible()
  })
})
```

> **Note:** `setInputFiles` works on `<input type="file">` elements. For fully custom upload components without a file input, use `page.dispatchEvent` or interact via `interceptApi`.

## Drag and Drop

```typescript
test.describe('Drag and Drop', () => {
  test('should reorder items via drag', async () => {
    const rows = page.locator('[data-testid="sortable-item"]')
    const firstItemText = await rows.nth(0).textContent()
    const secondItemText = await rows.nth(1).textContent()

    await rows.nth(0).dragTo(rows.nth(1))
    await page.waitForResponse(resp => resp.url().includes('/api/reorder'))

    const newFirstText = await rows.nth(0).textContent()
    expect(newFirstText).toBe(secondItemText)

    // Restore: drag back
    await rows.nth(1).dragTo(rows.nth(0))
    await page.waitForResponse(resp => resp.url().includes('/api/reorder'))
  })

  test('should show drag handle cursor', async () => {
    const handle = page.locator('[data-testid="sortable-item"]').first()
      .locator('[data-testid="drag-handle"]')
    await expect(handle).toBeVisible()
    await expect(handle).toHaveCSS('cursor', 'grab')
  })
})
```

> **Note:** `dragTo()` uses Playwright's built-in drag simulation. For libraries that rely on specific HTML5 drag events or pointer sequences, you may need `page.dispatchEvent()` or a more explicit `hover → mouse.down → mouse.move → mouse.up` sequence.
