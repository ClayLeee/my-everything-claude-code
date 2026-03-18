#!/usr/bin/env node
/**
 * Notification Hook for Claude Code
 * Triggered on the "Notification" event — plays a sound and/or shows
 * a desktop Toast when Claude Code needs the user's attention.
 *
 * Follows the same stdin-passthrough pattern as observe.js:
 *   1. Read JSON from stdin
 *   2. Echo it immediately to stdout (never block the pipeline)
 *   3. Fire notification in detached processes
 *   4. Exit
 */

const path = require('path');
const { notify, loadConfig } = require(path.join(__dirname, '..', 'lib', 'notifier'));
const fs = require('fs');
const os = require('os');

const DISABLED_FLAG = path.join(os.homedir(), '.claude', 'homunculus', 'notify-disabled');

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    // Always pass through original data first
    console.log(data);

    // Quick exit if sentinel file exists
    if (fs.existsSync(DISABLED_FLAG)) {
      process.exit(0);
    }

    // Quick exit if disabled in config
    const config = loadConfig();
    if (!config.enabled) {
      process.exit(0);
    }

    // Extract message from hook payload
    let title = 'Claude Code';
    let message = 'Needs your attention';

    if (data.trim()) {
      try {
        const input = JSON.parse(data);
        if (input.title) title = input.title;
        if (input.message) message = input.message;
      } catch (_e) {
        // Non-JSON data — use defaults
      }
    }

    // Fire notification — on Windows children are non-detached,
    // so Node will wait for them to complete before exiting.
    // The hook is registered with async:true to avoid blocking Claude.
    notify(title, message);
  } catch (_e) {
    // Silently ignore all errors — never block Claude
  }
});
