#!/usr/bin/env node
/**
 * Dual-mode injector for OpenSpec + Superpowers workflow.
 *
 * Modes (CLI arg):
 *   full      — SessionStart hook: inject the full compressed workflow doc once per session.
 *   reminder  — UserPromptSubmit hook (default): inject safety-critical core every prompt.
 *
 * Only injects when the current project uses OpenSpec:
 *   - project root has an `openspec/` directory, OR
 *   - project root has `.claude/openspec-enabled` marker file
 * Silently skips otherwise.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MODE = process.argv[2] === 'full' ? 'full' : 'reminder';

const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');
const FULL_FILE = path.join(CONFIG_DIR, 'openspec-superpowers-workflow.md');
const REMINDER_FILE = path.join(CONFIG_DIR, 'openspec-superpowers-workflow.reminder.md');

const WORKFLOW_FILE = MODE === 'full' ? FULL_FILE : REMINDER_FILE;
const HOOK_EVENT = MODE === 'full' ? 'SessionStart' : 'UserPromptSubmit';

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
        hookEventName: HOOK_EVENT,
        additionalContext: content
      }
    }));
  } catch (_e) {
    console.log(data);
  }
});
