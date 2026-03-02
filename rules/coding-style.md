---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.vue"
  - "**/*.js"
---

# Coding Style Rules

## Immutability

ALWAYS create new objects, NEVER mutate existing ones.

```typescript
// WRONG: Mutation
function updateItem(list: Item[], id: string, name: string) {
  const item = list.find(i => i.id === id)
  item!.name = name // MUTATION!
  return list
}

// CORRECT: Immutable update
function updateItem(list: Item[], id: string, name: string) {
  return list.map(i => i.id === id ? { ...i, name } : i)
}
```

In Pinia stores, prefer returning new state objects over direct mutation when the operation is non-trivial.

## File Size Limits

- Target: 200-400 lines per file
- Hard limit: 800 lines per file
- If a file exceeds 400 lines, consider splitting by responsibility

## Function Size

- Target: under 50 lines per function/method
- Max nesting depth: 4 levels
- Extract early returns to reduce nesting

```typescript
// WRONG: Deep nesting
function process(data) {
  if (data) {
    if (data.items) {
      if (data.items.length > 0) {
        // logic
      }
    }
  }
}

// CORRECT: Early returns
function process(data) {
  if (!data?.items?.length) return
  // logic
}
```

## TypeScript Strict

- No `any` unless absolutely necessary — use `unknown` + type guards
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use `as const` for literal types instead of type assertions

## Vue Component Style

- `<script setup lang="ts">` — no Options API
- Props: use `defineProps<T>()` with interface extraction for complex props
- Emits: use `defineEmits<T>()` with typed events
- Composables: prefix with `use` — one responsibility per composable

## Naming

- Variables/functions: camelCase
- Types/interfaces/classes: PascalCase
- Constants: UPPER_SNAKE_CASE for true constants, camelCase for derived values
- Files: kebab-case for components, camelCase for utilities
- Boolean variables: prefix with `is`, `has`, `can`, `should`

## Error Handling

- Always handle async errors with try-catch at API boundaries
- Provide user-friendly messages (use i18n keys, not raw strings)
- Log technical details for debugging, show simple messages to users
- Never silently swallow errors

## Code Quality Checklist

Before completing work, verify:
- [ ] Readable naming — no abbreviations
- [ ] Functions under 50 lines
- [ ] Files under 400 lines (hard limit 800)
- [ ] Nesting depth ≤ 4
- [ ] No `any` types
- [ ] No `console.log` in committed code
- [ ] Immutable patterns throughout
- [ ] Error handling at every async boundary
