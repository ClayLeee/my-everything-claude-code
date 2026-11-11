#!/usr/bin/env node
/**
 * SessionStart hook: inject the OpenSpec + Superpowers workflow doc. Startup,
 * resume, clear and compact all fire SessionStart, so the doc is present once
 * in every context window; no per-prompt reminder is needed.
 *
 * Only injects when the current project uses OpenSpec:
 *   - project root has an `openspec/` directory, OR
 *   - project root has `.claude/openspec-enabled` marker file
 * Silently skips otherwise.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKFLOW_FILE = path.join(__dirname, '..', '..', 'config', 'openspec-superpowers-workflow.md');

function getProjectRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (_e) {
    return process.cwd();
  }
}

function isOpenSpecEnabled(projectRoot) {
  return (
    fs.existsSync(path.join(projectRoot, 'openspec')) ||
    fs.existsSync(path.join(projectRoot, '.claude', 'openspec-enabled'))
  );
}

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    const projectRoot = getProjectRoot();

    if (!isOpenSpecEnabled(projectRoot)) {
      console.log(data);
      return;
    }

    if (!fs.existsSync(WORKFLOW_FILE)) {
      console.log(data);
      return;
    }

    const content = fs.readFileSync(WORKFLOW_FILE, 'utf8').trim();

    if (!content) {
      console.log(data);
      return;
    }

    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: content
      }
    }));
  } catch (_e) {
    console.log(data);
  }
});
