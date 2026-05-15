#!/usr/bin/env node
/**
 * PostToolUse hook — detect console.log in edited source files.
 * Scans the file after Edit and warns via stderr if console.log is found.
 * Always passes through stdin data to stdout.
 */

const fs = require('fs');

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    // Always pass through
    console.log(data);

    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path;

    if (filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const matches = [];

      lines.forEach((line, idx) => {
        if (/console\.log/.test(line)) {
          matches.push((idx + 1) + ': ' + line.trim());
        }
      });

      if (matches.length) {
        console.error('[Hook] WARNING: console.log found in ' + filePath);
        matches.slice(0, 5).forEach(m => console.error(m));
        console.error('[Hook] Remove console.log before committing');
      }
    }
  } catch (_e) {
    // Silently ignore errors
    if (!data.endsWith('\n')) console.log(data);
  }
});
