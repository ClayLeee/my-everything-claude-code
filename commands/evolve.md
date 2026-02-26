---
name: evolve
description: Cluster related instincts into skills, commands, or agents
command: true
---

# Evolve Command

Analyzes instincts and clusters related ones into higher-level structures:
- **Commands**: When instincts describe user-invoked actions
- **Skills**: When instincts describe auto-triggered behaviors
- **Agents**: When instincts describe complex, multi-step processes

## Usage

```
/evolve                    # Analyze all instincts and suggest evolutions
/evolve --domain testing   # Only evolve instincts in testing domain
/evolve --dry-run          # Show what would be created without creating
/evolve --threshold 5      # Require 5+ related instincts to cluster
```

## Evolution Rules

### → Command (User-Invoked)
When instincts describe actions a user would explicitly request:
- Multiple instincts about "when user asks to..."
- Instincts with triggers like "when creating a new X"
- Instincts that follow a repeatable sequence

Example:
- `new-component-step1`: "when adding a Vue component, create file"
- `new-component-step2`: "when adding a Vue component, add i18n keys"
- `new-component-step3`: "when adding a Vue component, register route"

→ Creates: **new-component** command

### → Skill (Auto-Triggered)
When instincts describe behaviors that should happen automatically:
- Pattern-matching triggers
- Error handling responses
- Code style enforcement

Example:
- `type-check-after-edit`: "after editing .ts/.vue files, run pnpm check:types"
- `code-quality-check`: "after edits, run pnpm fix"
- `full-check-before-commit`: "before completing, run pnpm before-commit"

→ Creates: `quality-check-workflow` skill

### → Agent (Needs Depth/Isolation)
When instincts describe complex, multi-step processes that benefit from isolation:
- Debugging workflows
- Refactoring sequences
- Research tasks

Example:
- `debug-step1`: "when debugging, first check logs"
- `debug-step2`: "when debugging, isolate the failing component"
- `debug-step3`: "when debugging, create minimal reproduction"
- `debug-step4`: "when debugging, verify fix with test"

→ Creates: **debugger** agent

## What to Do

1. Read all instincts from `~/.claude/homunculus/instincts/`
2. Group instincts by:
   - Domain similarity
   - Trigger pattern overlap
   - Action sequence relationship
3. For each cluster of 3+ related instincts:
   - Determine evolution type (command/skill/agent)
   - Generate the appropriate file
   - Save to `~/.claude/homunculus/evolved/{commands,skills,agents}/`
4. Link evolved structure back to source instincts

## Output Format

```
🧬 Evolve Analysis
==================

Found N clusters ready for evolution:

## Cluster 1: [Name]
Instincts: instinct-a, instinct-b, instinct-c
Type: Command | Skill | Agent
Confidence: N% (based on M observations)

Would create: [filename]
Files:
  - ~/.claude/homunculus/evolved/{type}/{filename}.md

---
Run `/evolve --execute` to create these files.
```

## Flags

- `--execute`: Actually create the evolved structures (default is preview)
- `--dry-run`: Preview without creating
- `--domain <name>`: Only evolve instincts in specified domain
- `--threshold <n>`: Minimum instincts required to form cluster (default: 3)
- `--type <command|skill|agent>`: Only create specified type
