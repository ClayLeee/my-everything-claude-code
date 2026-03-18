#!/usr/bin/env node
/**
 * PreToolUse hook — warn before git push.
 * Logs a reminder to stderr, then passes through stdin data.
 */

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    console.error('[Hook] Review changes before push...');
    console.error('[Hook] Continuing with push (remove this hook to add interactive review)');
    console.log(data);
  } catch (_e) {
    console.log(data);
  }
});
