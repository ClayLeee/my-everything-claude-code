# my-everything-claude-code

Personal Claude Code configurations organized by frontend framework, with shared hooks system.

## Structure

```
├── vue3/                      # Vue 3 + TypeScript projects
│   └── agents/
│       └── code-review.md
├── shared/                    # Shared across all frameworks
│   ├── scripts/
│   │   ├── hooks/             # Hook scripts (observe, compact, console.log check, etc.)
│   │   └── lib/               # Shared utilities (utils.js, session-manager.js, etc.)
│   ├── commands/
│   │   └── cl/                # Continuous Learning commands (status, analyze, log, sync)
│   ├── skills/
│   │   └── continuous-learning-v2/  # CL v2 skill (linked via Windows junction)
│   ├── settings.local.json    # Hooks config template (no project-specific permissions)
│   └── HOOKS.md               # Complete hooks documentation and data flow
├── setup.sh                   # Deploy configs to a project
└── README.md
```

## Usage

```bash
# Deploy Vue 3 agents + shared hooks to a project
./setup.sh vue3 /c/Users/claylee/Documents/devops-ui-v3

# Deploy only shared hooks (no framework-specific agents)
./setup.sh --hooks-only /c/Users/claylee/Documents/some-project
```

## Notes

- `settings.local.json` will NOT overwrite an existing one (merge manually if needed)
- Hook scripts are generic and work with any project
- Skills are linked via **Windows junction** (`mklink /J`) — editing in any project updates all projects
- The `permissions.allow` array in the template is empty — add project-specific permissions after deploy

## Adding a New Framework

```bash
mkdir -p react/agents
# Create agents in react/agents/
```
