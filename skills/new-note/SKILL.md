---
name: new-note
description: Create a new Obsidian note in the vault with YAML frontmatter and proper directory placement. Trigger when the user wants to "create a note", "add a note", "jot something down", "document X", or "make a note about Y". Use even when the user doesn't say "note" explicitly but clearly wants to capture information in the vault.
---

Create a new Obsidian note. Use $ARGUMENTS as the note title/topic if provided; otherwise ask the user.

## Choose directory

Infer the best directory from the topic:
- `Frontend/` — React, Vue, JS, CSS, TypeScript, browser APIs, frontend tools
- `FleetNote/` — quick dev references, CLI snippets, tool setups, short how-tos
- `AI/` — AI/ML concepts, models, APIs, prompting techniques
- `Work@IIIDevops/` — work architecture, internal systems, processes

If the topic could fit multiple directories, pick the best fit and mention it to the user — they can always move it later.

## Check for duplicates

Before creating, check if a file with the same name already exists in the vault. If it does, ask the user: open the existing note, or create a new one with a different name?

## File path

`<directory>/<Note Title>.md`

Obsidian handles spaces and Chinese characters in filenames. Avoid only these Windows-illegal characters: `\ / : * ? " < > |`

## Frontmatter

```yaml
---
title: <Note Title>
tags: [<1-3 relevant tags>]
date: <YYYY-MM-DD>
---
```

Suggest 1–3 tags based on the topic. Examples:
- React hooks → `[react, hooks, frontend]`
- Claude API → `[ai, claude, api]`
- Git tips → `[git, workflow, devops]`

## Note body

```markdown
## Overview

## Notes

## References
```

Tell the user the full file path after creating it.
