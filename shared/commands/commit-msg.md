---
name: "Commit Message"
description: "Generate a Conventional Commits message from current git changes"
category: Git
tags: [git, commit, conventional-commits]
---

Generate a commit message based on current git changes following the **conventional-commits** skill.

## Steps

1. Run `git diff --cached` to get staged changes and `git diff` to get unstaged changes.

2. If both diffs are empty, tell the user:
   > No changes detected. Stage or modify files first, then run `/commit-msg` again.
   Then stop.

3. Analyze the diff content and determine:
   - The appropriate **type** (feat, fix, refactor, etc.)
   - A concise **description** (imperative mood, lowercase, no period, under 50 chars total)
   - Bullet-point **details** explaining the key changes (focus on why, not what)

4. Output the result in this exact format:

   ````
   **Commit Title:**
   ```
   <type>: <description>
   ```

   **Commit Details:**
   ```
   - <detail 1>
   - <detail 2>
   - ...
   ```
   ````

5. If there are both staged and unstaged changes, note which changes are staged vs unstaged so the user knows what will be included in the commit.

6. **Do NOT run `git commit`.** The user will copy the message and commit manually.
