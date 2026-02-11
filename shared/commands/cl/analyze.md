---
name: "CL: Analyze"
description: "Manually trigger observation analysis to extract instincts"
category: Learning
tags: [continuous-learning, observer, analyze]
---

Run observer analysis in foreground:

```bash
node .claude/scripts/hooks/start-observer.js analyze
```

After completion, also run the instinct status to show results:

```bash
python .claude/skills/continuous-learning-v2/scripts/instinct-cli.py status
```

Display all output to the user as-is.
