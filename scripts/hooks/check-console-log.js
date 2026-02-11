#!/usr/bin/env node
/**
 * Stop Hook: Check for console.log statements in modified files
 * Cross-platform (Windows, macOS, Linux)
 */

const { execSync } = require('child_process');
const fs = require('fs');

let data = '';

process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    } catch {
      console.log(data);
      process.exit(0);
    }

    const files = execSync('git diff --name-only HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
      .split('\n')
      .filter(f => /\.(ts|tsx|js|jsx|vue)$/.test(f) && fs.existsSync(f));

    let hasConsole = false;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('console.log')) {
        console.error(`[Hook] WARNING: console.log found in ${file}`);
        hasConsole = true;
      }
    }

    if (hasConsole) {
      console.error('[Hook] Remove console.log statements before committing');
    }
  } catch (_error) {
    // Silently ignore errors
  }

  console.log(data);
});
