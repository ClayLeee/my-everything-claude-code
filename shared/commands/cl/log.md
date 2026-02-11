---
name: "CL: Log"
description: "Show recent observer analysis log entries"
category: Learning
tags: [continuous-learning, observer, log, debug]
---

Show the last 30 lines of the observer log:

```bash
tail -30 ~/.claude/homunculus/observer.log
```

If the file does not exist, tell the user no analysis has been run yet.

Display the output to the user as-is. Do not summarize or reformat.
