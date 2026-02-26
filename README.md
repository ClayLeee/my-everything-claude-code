# my-everything-claude-code

Personal Claude Code plugin — shared hooks, skills, commands, and agents for all projects.

## Install

```bash
# Add marketplace
/plugin marketplace add ClayLeee/my-everything-claude-code

# Install plugin
/plugin install my-everything-claude-code@ClayLeee-my-everything-claude-code
```

## Structure

```
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── commands/
│   ├── cl/                        # Continuous Learning (status, analyze, log, sync)
│   ├── evolve.md                  # Cluster instincts into skills/commands/agents
│   ├── instinct-export.md         # Export instincts for sharing
│   ├── instinct-import.md         # Import instincts from others
│   ├── before-commit.md            # Run checks then generate commit message
│   ├── learn-eval.md              # Extract patterns with quality evaluation
│   └── skill-create.md            # Generate SKILL.md from git history
├── skills/
│   └── continuous-learning-v2/    # Instinct-based learning system
├── agents/
│   ├── build-error-resolver.md    # Fix build/type errors with minimal changes
│   ├── code-review.md             # Code review agent
│   ├── refactor-cleaner.md        # Dead code cleanup and duplicate consolidation
│   └── security-reviewer.md       # Frontend security vulnerability detection
├── hooks/
│   └── hooks.json                 # All hook definitions
└── scripts/
    ├── hooks/                     # Hook scripts
    └── lib/                       # Shared utilities
```

## What's Included

### Hooks

| Event | Hook | Description |
|-------|------|-------------|
| PreToolUse | git push reminder | Warn before pushing |
| PreToolUse | block random .md | Prevent unnecessary doc files |
| PreToolUse | suggest compact | Remind `/compact` after 50 edits |
| PreToolUse | observe (pre) | Collect tool usage observations |
| PostToolUse | console.log warning | Flag `console.log` in edited code |
| PostToolUse | observe (post) | Collect tool results |
| PreCompact | compaction log | Record compaction events |
| PreCompact | auto-analyze | Extract instincts from observations |
| SessionStart | load context | Load previous session summary |
| Stop | global console.log check | Scan all git-changed files |
| SessionEnd | session record | Save session metadata |
| SessionEnd | evaluate session | Log session length |
| SessionEnd | auto-analyze | Extract instincts from observations |
| SessionEnd | auto-summarize | Generate session summary |

### Skills

- **continuous-learning-v2** — Instinct-based learning from session observations

### Agents

- **code-review** — Vue 3 + TypeScript code quality review (duplicates, optimization, standards, comments, i18n)
- **build-error-resolver** — Fix build/type errors with minimal changes, no refactoring
- **security-reviewer** — Frontend security audit (XSS, auth, input validation, dependencies, secrets)
- **refactor-cleaner** — Dead code detection, unused dependency removal, duplicate consolidation

### Commands

- `/before-commit` — Run project checks (`pnpm before-commit`), then generate conventional commit message
- `/cl:status` — Show learned instincts with confidence scores
- `/cl:analyze` — Manually trigger observation analysis
- `/cl:log` — Show recent observer log entries
- `/cl:sync` — Update instincts.md from current instincts
- `/evolve` — Cluster related instincts into commands/skills/agents
- `/instinct-export` — Export instincts to shareable YAML format
- `/instinct-import` — Import instincts with conflict detection
- `/learn-eval` — Extract session patterns with quality self-evaluation
- `/skill-create` — Analyze git history to generate SKILL.md files

## Credits

Hooks system adapted from [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License).
