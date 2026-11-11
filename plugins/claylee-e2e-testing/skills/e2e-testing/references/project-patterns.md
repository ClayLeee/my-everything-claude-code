# Project-Local Patterns — `playwright/e2e-patterns.md`

A short file in the `package.json` directory that records what this project's UI needed beyond the skill defaults: locator quirks, extra wait conditions, the confirmed feedback selector, and a non-standard API base or auth pattern. Commands read it before writing POM/spec code and write to it only after tests pass, so each run starts from what earlier runs learned instead of rediscovering it.

## Reading it

If the file exists, apply it while building or updating POM and spec code:

- `## Locators` — prefer these selectors over the default `[data-testid]` for the components named
- `## Timing` — add these wait conditions to the relevant POM action methods
- `## Feedback` — pass this confirmed selector pair to `super(page, { success, error })`
- `## API` — use this base URL / auth pattern where the defaults don't apply

If the file is absent, do not create it yet; it is created the first time there is something to record.

## Writing it

Two moments produce entries:

1. **A POM constructor is written with real feedback selectors** (`super(page, { success: ..., error: ... })`): if `## Feedback` is empty or the file is absent, create the file from the skeleton and write the entry. If `## Feedback` already has an entry, trust it and leave it.
2. **All tests pass after a POM or spec file was changed in this session**: for each fix made, add one entry — a selector change goes under `## Locators` as `- {component}: use {actual-selector} not {attempted-selector}`; a wait change goes under `## Timing` as `- {operation}: needs {waitCondition} because {reason}`.

Skip an entry whose pattern is already present (substring match). The file has a hard cap of 50 lines: below it append; at it replace the most similar entry in the same section rather than adding.

## Skeleton (local projects)

```markdown
# E2E Patterns — {project-name}
<!-- Hard cap: 50 lines total. When full, replace similar entries, do NOT add. -->

## Locators
<!-- Quirks where UI library wrappers change the actual DOM element to target -->
<!-- Format: - {component}: use {selector} not {default} -->

## Timing
<!-- Wait conditions this app needs beyond SKILL.md defaults -->
<!-- Format: - {operation}: needs {waitCondition} because {reason} -->

## Feedback
<!-- The ONE confirmed feedback selector for this project -->
<!-- Format: - library: {name} | success: {selector} | error: {selector} -->

## API
<!-- Base URL and auth pattern (only if non-standard) -->
<!-- Format: - baseUrl: {pattern} | auth: {method} -->
```

## Remote variant

Remote testing (`/e2e:remote`, remote-mode `/e2e:record`) uses the same file without the `## Feedback` section, since `RemoteBasePage` has no `FeedbackConfig`. The `## Locators` comment reads `Quirks where remote UI renders differently than expected ARIA roles/text`, and entries name ARIA locators (`getByRole` / `getByText`), not `data-testid`.
