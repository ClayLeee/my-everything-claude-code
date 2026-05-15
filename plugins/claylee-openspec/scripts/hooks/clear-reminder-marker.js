#!/usr/bin/env node
/**
 * PreCompact hook — clears the OpenSpec reminder dedup marker so the next
 * UserPromptSubmit after compaction re-injects the compressed workflow reminder.
 *
 * Necessary because auto-compact does not always trigger SessionStart, and the
 * reminder marker is keyed by session_id which does not change on compaction.
 *
 * Pairs with scripts/hooks/inject-openspec.js (reminder mode).
 * Always pass-through stdin to stdout — never block compaction.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MARKER_DIR = path.join(os.homedir(), '.claude', 'cache', 'openspec-reminder');

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data || '{}');
    const sessionId = input.session_id || '';
    if (sessionId) {
      try { fs.unlinkSync(path.join(MARKER_DIR, `${sessionId}.flag`)); } catch (_e) { /* ignore */ }
    }
  } catch (_e) { /* ignore */ }
  console.log(data);
});
