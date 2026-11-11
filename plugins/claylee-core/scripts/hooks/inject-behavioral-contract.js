#!/usr/bin/env node
/**
 * SessionStart hook: inject rules/behavioral-contract.md as additionalContext.
 *
 * Claude Code loads no `rules/` component from a plugin, so the contract has
 * to reach the model through a hook. Startup, resume, clear and compact all
 * fire SessionStart, so the contract is present once in every context window.
 *
 * Claude Code caps a hook's additionalContext at 10,000 characters and hands
 * the model only a 2,000-character preview of anything longer; the contract
 * is ~1.5 KB, and the script warns on stderr if it ever grows past the cap.
 *
 * Never throws: on any error the stdin JSON is echoed back unchanged.
 */

const fs = require('fs');
const path = require('path');

const CONTRACT_FILE = path.resolve(__dirname, '..', '..', 'rules', 'behavioral-contract.md');
const CONTEXT_CAP = 10000;

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    if (!fs.existsSync(CONTRACT_FILE)) {
      console.log(data);
      return;
    }

    const content = fs.readFileSync(CONTRACT_FILE, 'utf8').trim();

    if (!content) {
      console.log(data);
      return;
    }

    if (content.length > CONTEXT_CAP) {
      process.stderr.write(`inject-behavioral-contract: contract is ${content.length} chars; Claude Code truncates additionalContext over ${CONTEXT_CAP}\n`);
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
