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
│   └── cl/                        # Continuous Learning (status, analyze, log, sync)
├── skills/
│   ├── continuous-learning-v2/    # Instinct-based learning system
│   └── vue-i18n/                  # Vue I18n guide
├── agents/
│   └── code-review.md             # Code review agent
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
| SessionStart | load context | Load previous session summary |
| Stop | global console.log check | Scan all git-changed files |
| SessionEnd | session record | Save session metadata |
| SessionEnd | evaluate session | Log session length |
| SessionEnd | auto-analyze | Extract instincts from observations |
| SessionEnd | auto-summarize | Generate session summary |

### Skills

- **continuous-learning-v2** — Instinct-based learning from session observations
- **vue-i18n** — Vue I18n internationalization guide

### Commands

- `/cl:status` — Show learned instincts with confidence scores
- `/cl:analyze` — Manually trigger observation analysis
- `/cl:log` — Show recent observer log entries
- `/cl:sync` — Update instincts.md from current instincts

## Credits

Hooks system adapted from [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License).
