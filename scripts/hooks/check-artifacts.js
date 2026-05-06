#!/usr/bin/env node
/**
 * PreToolUse hook — block production code Edit/Write when OpenSpec change is incomplete.
 *
 * Activates only when:
 *   - project has openspec/ directory
 *   - openspec/changes/<name>/ directories exist (active changes in Phase 2+)
 *   - tool target is production code (not tests/docs/specs/configs)
 *
 * For each active change, verifies all 5 artifacts exist:
 *   - openspec/changes/<name>/{proposal,design,tasks}.md
 *   - docs/superpowers/specs/ has any *.md
 *   - docs/superpowers/plans/ has any *.md
 *
 * Blocks if any active change is incomplete. Path A (no openspec/changes/<name>/
 * created) and Path C1 (only patches existing spec) pass through naturally.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getProjectRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (_e) {
    return process.cwd();
  }
}

function isProductionCodeFile(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();

  if (/[/.](test|spec)\.[a-z]+$/.test(normalized)) return false;
  if (/\/(__tests__|tests?|spec)\//.test(normalized)) return false;
  if (/(^|\/)docs\//.test(normalized)) return false;
  if (/(^|\/)openspec\//.test(normalized)) return false;
  if (/(^|\/)config\//.test(normalized)) return false;
  if (/\.(md|txt|json|yaml|yml|toml|env)$/.test(normalized)) return false;

  return /\.(ts|tsx|js|jsx|vue|py|rb|go|rs|java|cs|cpp|c|h|hpp|kt|swift)$/.test(normalized);
}

function findIncompleteChanges(projectRoot) {
  const changesDir = path.join(projectRoot, 'openspec', 'changes');
  if (!fs.existsSync(changesDir)) return [];

  const changeNames = fs.readdirSync(changesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  if (changeNames.length === 0) return [];

  const supSpecs = path.join(projectRoot, 'docs', 'superpowers', 'specs');
  const supPlans = path.join(projectRoot, 'docs', 'superpowers', 'plans');
  const hasSpecs = fs.existsSync(supSpecs)
    && fs.readdirSync(supSpecs).some(f => f.endsWith('.md'));
  const hasPlans = fs.existsSync(supPlans)
    && fs.readdirSync(supPlans).some(f => f.endsWith('.md'));

  const incomplete = [];
  for (const name of changeNames) {
    const missing = [];
    if (!fs.existsSync(path.join(changesDir, name, 'proposal.md'))) {
      missing.push(`openspec/changes/${name}/proposal.md`);
    }
    if (!fs.existsSync(path.join(changesDir, name, 'design.md'))) {
      missing.push(`openspec/changes/${name}/design.md`);
    }
    if (!fs.existsSync(path.join(changesDir, name, 'tasks.md'))) {
      missing.push(`openspec/changes/${name}/tasks.md`);
    }
    if (!hasSpecs) missing.push('docs/superpowers/specs/*.md (any)');
    if (!hasPlans) missing.push('docs/superpowers/plans/*.md (any)');

    if (missing.length > 0) {
      incomplete.push({ name, missing });
    }
  }
  return incomplete;
}

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data || '{}');
    const filePath = input.tool_input?.file_path || '';
    const projectRoot = getProjectRoot();

    if (!fs.existsSync(path.join(projectRoot, 'openspec'))) {
      console.log(data);
      return;
    }
    if (!isProductionCodeFile(filePath)) {
      console.log(data);
      return;
    }

    const incomplete = findIncompleteChanges(projectRoot);
    if (incomplete.length === 0) {
      console.log(data);
      return;
    }

    const lines = [
      'BLOCKED: Phase 2 Guardrail — production code edit not allowed.',
      `File: ${filePath}`,
      '',
      'Incomplete OpenSpec change(s):',
    ];
    for (const { name, missing } of incomplete) {
      lines.push(`  ${name}: missing ${missing.length} artifact(s)`);
      for (const m of missing) lines.push(`    - ${m}`);
    }
    lines.push('', 'Resolve: complete Phases 1-2 to create artifacts, OR revisit Phase 0 (might be Path A/C1).');
    console.error('[Hook] ' + lines.join('\n[Hook] '));
    process.exit(1);
  } catch (_e) {
    console.log(data);
  }
});
