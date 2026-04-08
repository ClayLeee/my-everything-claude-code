---
name: backup
description: Commit and push all vault changes to GitHub. Trigger when the user says "save", "backup", "commit", "push", "sync", "push my notes", or "back up the vault". Also suggest proactively after a session of adding or editing notes.
---

Commit and push all current changes in the vault to GitHub.

1. Run `git status` to see what changed. If there are no changes, tell the user the vault is already up to date and stop.
2. Stage all changes: `git add -A`
3. Commit with a timestamped message: `git commit -m "vault backup: $(date '+%Y-%m-%d %H:%M:%S')"`
4. Push: `git push`
5. Confirm with a short summary (e.g., "Backed up — 3 files changed").

If `git push` fails, show the error message and tell the user to fix any auth or network issues, then run `/backup` again.
