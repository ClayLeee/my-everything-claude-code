---
name: conventional-commits
description: Conventional Commits specification. Defines commit message format, type prefixes, and conventions for generating consistent commit messages.
version: 1.0.0
---

# Conventional Commits

## Commit Title Format

```
<type>: <description>
```

- All lowercase
- No period at the end
- Max 50 characters total
- Description uses imperative mood ("add", "fix", "update", not "added", "fixes")

## Type Prefixes

| Type       | When to use                                      |
|------------|--------------------------------------------------|
| `feat`     | A new feature or capability                      |
| `fix`      | A bug fix                                        |
| `docs`     | Documentation only changes                       |
| `style`    | Formatting, white-space, missing semi-colons etc |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                          |
| `test`     | Adding or updating tests                         |
| `build`    | Build system or external dependencies            |
| `ci`       | CI/CD configuration changes                      |
| `chore`    | Maintenance tasks, dependency bumps              |
| `revert`   | Revert a previous commit                         |

## Commit Body (Details)

- Use `-` bullet points to list changes
- Focus on **why** the change was made, not just what changed
- Each bullet should be a concise, complete thought
- Write in English

Example:

```
- correct API endpoint path for parameter settings
- previous path returned 404 after backend route update
```

## Breaking Changes

For breaking changes, either:
1. Add `!` after type: `feat!: redesign auth endpoints`
2. Add `BREAKING CHANGE:` footer in the body
