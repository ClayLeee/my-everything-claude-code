---
name: instinct-import
description: Import instincts from teammates, Skill Creator, or other sources
command: true
---

# Instinct Import Command

Import instincts from:
- Teammates' exports
- Skill Creator (repo analysis)
- Community collections
- Previous machine backups

## Usage

```
/instinct-import team-instincts.yaml
/instinct-import https://github.com/org/repo/instincts.yaml
/instinct-import --from-skill-creator acme/webapp
```

## What to Do

1. Fetch the instinct file (local path or URL)
2. Parse and validate the format
3. Check for duplicates with existing instincts
4. Merge or add new instincts
5. Save to `~/.claude/homunculus/instincts/inherited/`

## Import Process

```
📥 Importing instincts from: team-instincts.yaml
================================================

Found N instincts to import.

Analyzing conflicts...

## New Instincts (N)
These will be added:
  ✓ instinct-name (confidence: 0.7)
  ...

## Duplicate Instincts (N)
Already have similar instincts:
  ⚠️ instinct-name
     Local: 0.8 confidence, 12 observations
     Import: 0.7 confidence
     → Keep local (higher confidence)

## Conflicting Instincts (N)
These contradict local instincts:
  ❌ instinct-name
     Conflicts with: other-instinct
     → Skip (requires manual resolution)

---
Import N new, update N, skip N?
```

## Merge Strategies

### For Duplicates
When importing an instinct that matches an existing one:
- **Higher confidence wins**: Keep the one with higher confidence
- **Merge evidence**: Combine observation counts
- **Update timestamp**: Mark as recently validated

### For Conflicts
When importing an instinct that contradicts an existing one:
- **Skip by default**: Don't import conflicting instincts
- **Flag for review**: Mark both as needing attention
- **Manual resolution**: User decides which to keep

## Source Tracking

Imported instincts are marked with:
```yaml
source: "inherited"
imported_from: "team-instincts.yaml"
imported_at: "YYYY-MM-DDTHH:MM:SSZ"
original_source: "session-observation"  # or "repo-analysis"
```

## Flags

- `--dry-run`: Preview without importing
- `--force`: Import even if conflicts exist
- `--merge-strategy <higher|local|import>`: How to handle duplicates
- `--from-skill-creator <owner/repo>`: Import from Skill Creator analysis
- `--min-confidence <n>`: Only import instincts above threshold
