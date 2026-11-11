#!/usr/bin/env node
/**
 * SessionStart hook: inject the OpenSpec + Superpowers workflow summary.
 * Startup, resume, clear and compact all fire SessionStart, so the summary is
 * present once in every context window.
 *
 * Claude Code caps a hook's additionalContext at 10,000 characters; anything
 * longer is written to a file and the model only sees a 2,000-character
 * preview. The full workflow doc is ~29 KB, so the hook injects the summary
 * (well under the cap) and ends it with the absolute path of the full doc for
 * the model to read when a phase's details matter.
 *
 * Only injects when the current project uses OpenSpec:
 *   - project root has an `openspec/` directory, OR
 *   - project root has `.claude/openspec-enabled` marker file
 * Silently skips otherwise.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_DIR = path.resolve(__dirname, '..', '..', 'config');
const SUMMARY_FILE = path.join(CONFIG_DIR, 'openspec-superpowers-workflow.summary.md');
const FULL_DOC = path.join(CONFIG_DIR, 'openspec-superpowers-workflow.md');
const CONTEXT_CAP = 10000;

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

    if (!fs.existsSync(SUMMARY_FILE)) {
      console.log(data);
      return;
    }

    const summary = fs.readFileSync(SUMMARY_FILE, 'utf8').trim();

    if (!summary) {
      console.log(data);
      return;
    }

    const pointer = fs.existsSync(FULL_DOC)
      ? `\n\nThe full workflow doc (phase tables, Phase 2 mapping, Phase 5/6 checklists, retro-doc flow) is at ${FULL_DOC.replace(/\\/g, '/')} — read it when a phase's details matter.`
      : '';
    const content = summary + pointer;

    if (content.length > CONTEXT_CAP) {
      process.stderr.write(`inject-openspec: summary is ${content.length} chars; Claude Code truncates additionalContext over ${CONTEXT_CAP}\n`);
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
