---
name: continuous-learning-v2
description: Instinct-based learning system that observes sessions via hooks, creates atomic instincts with confidence scoring, and evolves them into skills/commands/agents.
version: 2.0.0
---

# Continuous Learning v2 - Instinct-Based Architecture

An advanced learning system that turns your Claude Code sessions into reusable knowledge through atomic "instincts" - small learned behaviors with confidence scoring.

## The Instinct Model

An instinct is a small learned behavior:

```yaml
---
id: prefer-functional-style
trigger: "when writing new functions"
confidence: 0.7
domain: "code-style"
source: "session-observation"
---

# Prefer Functional Style

## Action
Use functional patterns over classes when appropriate.

## Evidence
- Observed 5 instances of functional pattern preference
- User corrected class-based approach to functional
```

**Properties:**
- **Atomic** - one trigger, one action
- **Confidence-weighted** - 0.3 = tentative, 0.9 = near certain
- **Domain-tagged** - code-style, testing, git, debugging, workflow, etc.
- **Evidence-backed** - tracks what observations created it

## How It Works

```
Session Activity
      |
      | Hooks capture prompts + tool use (100% reliable)
      v
  observations.jsonl
      |
      | Observer agent reads (background, Haiku)
      v
  PATTERN DETECTION
      |
      v
  instincts/personal/
      |
      | /evolve clusters
      v
  evolved/ (commands, skills, agents)
```

## File Structure

```
~/.claude/homunculus/
├── observations.jsonl      # Current session observations
├── observations.archive/   # Processed observations
├── instincts/
│   ├── personal/           # Auto-learned instincts
│   └── inherited/          # Imported from others
└── evolved/
    ├── agents/             # Generated specialist agents
    ├── skills/             # Generated skills
    └── commands/           # Generated commands
```

## Confidence Scoring

| Score | Meaning | Behavior |
|-------|---------|----------|
| 0.3 | Tentative | Suggested but not enforced |
| 0.5 | Moderate | Applied when relevant |
| 0.7 | Strong | Auto-approved for application |
| 0.9 | Near-certain | Core behavior |

## Disabling Observation

Create `~/.claude/homunculus/disabled` to stop all observation hooks.
