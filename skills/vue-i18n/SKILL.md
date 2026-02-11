---
name: vue-i18n
description: "Vue I18n internationalization guide. Use when adding translations, using useI18n composable, t/d/n functions, pluralization, datetime/number formatting, managing locale files, or refactoring i18n keys. Triggers: i18n, translation, multilingual, locale, useI18n, t function, internationalization."
metadata:
  author: claylee
  framework: vue-i18n
---

# Vue I18n Skill

Guide for Vue I18n internationalization in Vue 3 projects with Composition API.

## Key Naming Convention

### Pattern: `namespace.context.element`

| Namespace        | Purpose                                            | Examples                                        |
| ---------------- | -------------------------------------------------- | ----------------------------------------------- |
| `common.action`  | Button/action text                                 | `save`, `cancel`, `delete`, `enable`            |
| `common.status`  | Status descriptions                                | `loading`, `submitting`                         |
| `common.label`   | **Universal labels** (table headers + form labels) | `name`, `status`, `actions`, `type`             |
| `common.form`    | Form placeholders & patterns only                  | `pleaseSelect`, `isRequired`                    |
| `common.message` | Shared messages                                    | `noData`, `copySuccess`                         |
| `validation`     | Form validation                                    | `nameRequired`, `idFormat`                      |
| `{feature}.*`    | Feature-specific keys                              | `issue.filter.*`, `milestone.columns.doneRatio` |

### Rules

1. **Use camelCase** for key segments
2. **Maximum depth: 3 levels**
3. **Use semantic naming**, not literal translations
4. **Keep keys alphabetically sorted** in JSON files

---

## Unified Label Strategy

### Use `common.label.*` for Both Table Headers and Form Labels

```typescript
// Table column header
{ header: t('common.label.name'), ... }
{ header: t('common.label.status'), ... }

// Form field label
<FieldLabel>{{ t('common.label.name') }}</FieldLabel>

// Form placeholder (use common.form.*)
<Input :placeholder="t('common.form.namePlaceholder')" />

// Dynamic placeholder
<Input :placeholder="t('common.form.pleaseInput', { label: t('common.label.name') })" />
```

### Decision Rules

| Scenario                                | Namespace                  |
| --------------------------------------- | -------------------------- |
| Label text (table header or form label) | `common.label.*`           |
| Placeholder text                        | `common.form.*Placeholder` |
| Validation with interpolation           | `common.form.isRequired`   |
| Feature-specific terminology            | `{feature}.*`              |

---

## Modification Sync Protocol

### Workflow When Modifying Keys

1. Modify locale JSON file
2. Search all component references: `t('old.key')` / `$t('old.key')`
3. Update all components using the key
4. Sync both locale files (en.json & zh-TW.json)
5. Verify: run type checking

### Modification Types

| Type                 | Actions                                                         |
| -------------------- | --------------------------------------------------------------- |
| **Rename Key**       | Modify JSON → Search references → Replace all                   |
| **Delete Key**       | Search references → Confirm none exist → Delete from both files |
| **Merge Duplicates** | Keep one key → Update references → Delete duplicate             |
| **Add New Key**      | Add to both en.json and zh-TW.json                              |

---

## Best Practices

### Avoid Dynamic Keys

```typescript
// Bad: Cannot be statically analyzed
t(`issue.status.${status}`);

// Good: Use mapping
const statusMap = {
  active: t("issue.status.active"),
  closed: t("issue.status.closed"),
};
```

### Keep Locale Files in Sync

- Both files must have identical key structure
- Interpolation parameter names must match across locales

### When to Share vs Separate

| Scenario                     | Action                   |
| ---------------------------- | ------------------------ |
| Same semantic meaning        | Use `common.*`           |
| Feature-specific context     | Create `{feature}.*` key |
| Different meaning, same text | Create separate keys     |

---

## Common API Usage

```typescript
import { useI18n } from "vue-i18n";
const { t, d, n } = useI18n();

// Translation
t("common.action.save");
t("greeting", { name: "John" });

// Date formatting
d(new Date(), "long");

// Number formatting
n(1234.56, "currency");

// Pluralization (JSON: "car": "car | cars")
t("car", 2); // "cars"
```

---

## Project Conventions

### File Locations

```
src/locales/
├── en.json      # English
└── zh-TW.json   # Traditional Chinese
```

### Error Handling Integration

```typescript
import { getApiErrorMessage } from "@/lib/error-handler";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

try {
  await apiCall();
} catch (error) {
  toast.error(
    t("errorMessage.apiError", { message: getApiErrorMessage(error) }),
  );
}
```

### Checklist Before Committing

- [ ] Both locale files updated with identical structure
- [ ] Interpolation parameters match across locales
- [ ] Component references updated (if key renamed)
- [ ] No duplicates that should use `common.*`
- [ ] Type checking passes
