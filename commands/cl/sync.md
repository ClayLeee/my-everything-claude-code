---
name: "CL: Sync"
description: "Update .claude/instincts.md from current instincts without re-analyzing"
category: Learning
tags: [continuous-learning, instincts, sync]
---

Sync current instincts to the project CLAUDE.md-referenced file:

```bash
node .claude/scripts/hooks/start-observer.js sync
```

Display the output to the user as-is. Do not summarize or reformat.
