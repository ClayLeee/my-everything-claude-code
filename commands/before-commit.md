---
name: before-commit
description: "Run project checks (pnpm before-commit), then generate a conventional commit message via git-commit skill"
category: Workflow
tags: [commit, type-check, lint, workflow]
---

# Before Commit Workflow

Execute pre-commit checks and generate a commit message in sequence.

## Step 1: Run Project Checks

```bash
pnpm before-commit
```

- If the command **succeeds** (exit code 0), proceed to Step 2.
- If the command **fails**, stop here. Show the errors and help the user fix them. Do NOT proceed to commit message generation until all checks pass.
- If `before-commit` script does not exist in `package.json`, try fallback commands in order:
  1. `pnpm check:types && pnpm lint`
  2. `pnpm type-check && pnpm lint`
  3. `pnpm vue-tsc --noEmit && pnpm eslint .`

## Step 2: Generate Commit Message

After checks pass, invoke the `git-commit` skill to analyze the diff and generate a conventional commit message.
