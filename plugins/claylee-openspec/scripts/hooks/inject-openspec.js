#!/usr/bin/env node
/**
 * Dual-mode injector for OpenSpec + Superpowers workflow.
 *
 * Modes (CLI arg):
 *   full      — SessionStart hook: inject the full workflow doc once per session.
 *   reminder  — UserPromptSubmit hook (default): inject compressed reminder ONCE per
 *               session (session-marker dedup). Subsequent prompts pass through silently.
 *
 * Reminder dedup uses ~/.claude/cache/openspec-reminder/<session_id>.flag.
 * Markers older than 24h are cleaned up on next reminder invocation.
 *
 * Only injects when the current project uses OpenSpec:
 *   - project root has an `openspec/` directory, OR
 *   - project root has `.claude/openspec-enabled` marker file
 * Silently skips otherwise.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const MODE = process.argv[2] === 'full' ? 'full' : 'reminder';

const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');
const FULL_FILE = path.join(CONFIG_DIR, 'openspec-superpowers-workflow.md');
const REMINDER_FILE = path.join(CONFIG_DIR, 'openspec-superpowers-workflow.reminder.md');

const WORKFLOW_FILE = MODE === 'full' ? FULL_FILE : REMINDER_FILE;
const HOOK_EVENT = MODE === 'full' ? 'SessionStart' : 'UserPromptSubmit';

const MARKER_DIR = path.join(os.homedir(), '.claude', 'cache', 'openspec-reminder');
const MARKER_TTL_MS = 24 * 60 * 60 * 1000;

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

function cleanupExpiredMarkers() {
  try {
    if (!fs.existsSync(MARKER_DIR)) return;
    const now = Date.now();
    for (const name of fs.readdirSync(MARKER_DIR)) {
      const full = path.join(MARKER_DIR, name);
      try {
        const stat = fs.statSync(full);
        if (now - stat.mtimeMs > MARKER_TTL_MS) fs.unlinkSync(full);
      } catch (_e) { /* ignore */ }
    }
  } catch (_e) { /* ignore */ }
}

function reminderAlreadyInjected(sessionId) {
  if (!sessionId) return false;
  return fs.existsSync(path.join(MARKER_DIR, `${sessionId}.flag`));
}

function markReminderInjected(sessionId) {
  if (!sessionId) return;
  try {
    fs.mkdirSync(MARKER_DIR, { recursive: true });
    fs.writeFileSync(path.join(MARKER_DIR, `${sessionId}.flag`), String(Date.now()));
  } catch (_e) { /* ignore */ }
}

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

function clearReminderMarker(sessionId) {
  if (!sessionId) return;
  try { fs.unlinkSync(path.join(MARKER_DIR, `${sessionId}.flag`)); } catch (_e) { /* ignore */ }
}

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

    const input = (() => { try { return JSON.parse(data || '{}'); } catch (_e) { return {}; } })();
    const sessionId = input.session_id || '';

    if (MODE === 'full') {
      // SessionStart fires for startup/resume/clear/compact. Reset reminder
      // dedup so the next UserPromptSubmit re-injects the compressed reminder.
      clearReminderMarker(sessionId);
    } else {
      cleanupExpiredMarkers();
      if (reminderAlreadyInjected(sessionId)) {
        console.log(data);
        return;
      }
      markReminderInjected(sessionId);
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
