---
name: serena-tool-selection
description: Decision framework for when to use Serena LSP semantic tools vs basic tools (Grep, Read, Glob, Edit). Use when searching for symbol definitions, tracing references, understanding file structure, refactoring, renaming across codebase, or navigating code architecture.
---

# Serena Tool Selection Guide

When Serena MCP plugin is available, use this guide to choose between Serena's semantic tools and basic tools (Grep, Read, Glob, Edit).

## Prerequisites

Before using any Serena tool, ensure the project is activated:

```
mcp__plugin_serena_serena__activate_project  (project: "<project-name-or-path>")
mcp__plugin_serena_serena__check_onboarding_performed
```

If onboarding hasn't been done, call `onboarding` first.

## Decision Matrix

| Task | Use Serena | Use Basic Tools |
|------|-----------|-----------------|
| Find where a function/class is defined | `find_symbol` | - |
| Find all references to a symbol | `find_referencing_symbols` | - |
| Understand file structure (classes, methods) | `get_symbols_overview` | - |
| Rename a symbol across codebase | `rename_symbol` | - |
| Replace an entire function/method body | `replace_symbol_body` | - |
| Insert code after/before a symbol | `insert_after_symbol` / `insert_before_symbol` | - |
| Read a specific known file path | - | `Read` |
| Search for a text pattern (non-code files) | - | `Grep` |
| Find files by glob pattern | - | `Glob` |
| Edit a few lines within a large function | `replace_content` (regex) | `Edit` |
| Read config/JSON/YAML/env files | - | `Read` |
| Quick keyword search across codebase | - | `Grep` |
| Understand type hierarchy / method signatures | `find_symbol` with `include_info` | - |
| Search for pattern in code files only | `search_for_pattern` with `restrict_search_to_code_files` | - |

### Quick Rule

> **If your task involves a code symbol (function, class, method, variable, type) — use Serena.**
> **If your task involves text content, file paths, or config — use basic tools.**

## Core Workflows

### 1. Understanding File Structure

**Serena approach** (preferred for code files):
```
get_symbols_overview(relative_path="src/stores/auth.ts", depth=1)
```
Returns all classes, functions, variables with their hierarchy — no need to read the whole file.

**Basic approach** (for non-code or quick glance):
```
Read the file directly
```

### 2. Tracing Symbol References

**Serena approach** (precise, semantic):
```
find_referencing_symbols(name_path="useAuthStore", relative_path="src/stores/auth.ts")
```
Returns exact references with surrounding code context and symbol metadata.

**Basic approach** (text-based, may include false positives):
```
Grep for "useAuthStore"
```

**When to use Grep instead**: When searching for non-symbol text like error messages, comments, URLs, or strings.

### 3. Refactoring a Function

**Serena approach** (replace entire symbol body):
```
find_symbol(name_path="MyClass/myMethod", relative_path="...", include_body=True)
# Review current body, then:
replace_symbol_body(name_path="MyClass/myMethod", relative_path="...", body="new code")
```

**Serena approach** (surgical edit within a symbol):
```
replace_content(relative_path="...", needle="regex pattern", repl="replacement", mode="regex")
```
Use regex with wildcards like `beginning.*?end` to avoid quoting entire blocks.

**Basic approach** (Edit tool — for small, targeted changes):
```
Edit with old_string / new_string
```

### 4. Renaming Across Codebase

**Serena approach** (semantic, handles all references):
```
rename_symbol(name_path="oldName", relative_path="...", new_name="newName")
```
Automatically updates all references via LSP. One command, done.

**Basic approach** (manual, error-prone):
Multiple Grep + Edit operations, risk missing references or changing wrong text.

### 5. Inserting New Code

**Serena approach** (position-aware):
```
insert_after_symbol(name_path="lastFunction", relative_path="...", body="new function code")
insert_before_symbol(name_path="firstImport", relative_path="...", body="new import")
```

**Basic approach**: Edit tool — works fine for simple insertions where position is clear.

### 6. Pattern Search in Code

**Serena approach** (with file filtering):
```
search_for_pattern(
  substring_pattern="defineStore.*auth",
  restrict_search_to_code_files=True,
  paths_include_glob="**/*.ts"
)
```

**Basic approach**:
```
Grep with pattern and glob filter
```

Both work well. Use Serena's `search_for_pattern` when you need to combine code-file restriction with complex regex, or when you want to chain into symbolic operations next.

## Vue 3 + TypeScript Patterns

### SFC Symbol Paths

In Vue Single File Components, Serena may represent symbols differently:
- Top-level `<script setup>` variables appear as module-level symbols
- Composable return values may require searching by function name
- Props/emits defined via `defineProps`/`defineEmits` may appear as type symbols

### Common Queries

```
# Find a composable definition
find_symbol(name_path="useAuth", relative_path="src/composables/")

# Find all components using a specific store
find_referencing_symbols(name_path="useProjectStore", relative_path="src/stores/project.ts")

# Overview of a Vue component's script
get_symbols_overview(relative_path="src/views/ProjectList.vue", depth=1)

# Find all Pinia stores
search_for_pattern(substring_pattern="defineStore", restrict_search_to_code_files=True, paths_include_glob="**/*.ts")
```

## Anti-Patterns — When NOT to Use Serena

1. **Reading non-code files** (README, .env, JSON config, YAML) — Use `Read`
2. **Searching for text in comments/strings** — Use `Grep` (Serena is symbol-aware, not text-aware)
3. **Finding files by name** — Use `Glob` or `find_file`
4. **Simple single-line edits** where you know the exact text — `Edit` is faster
5. **Exploring directory structure** — Use `ls` via Bash or `list_dir`
6. **When the project is not activated** — Serena tools will fail; activate first
7. **Git operations** — Use Bash with git commands

## Quick Reference Flowchart

```
Is it a code symbol (function, class, method, type, variable)?
├── YES → Is the project activated in Serena?
│   ├── NO → activate_project first, then use Serena
│   └── YES → What do you need?
│       ├── Find definition → find_symbol
│       ├── Find all usages → find_referencing_symbols
│       ├── File overview → get_symbols_overview
│       ├── Rename → rename_symbol
│       ├── Replace entire body → replace_symbol_body
│       ├── Edit few lines → replace_content (regex mode)
│       ├── Insert code → insert_before/after_symbol
│       └── Search pattern → search_for_pattern
└── NO → What do you need?
    ├── Read a file → Read tool
    ├── Search text → Grep tool
    ├── Find files → Glob tool
    └── Edit text → Edit tool
```
