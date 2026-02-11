#!/usr/bin/env node
/**
 * SessionStart Hook - Load previous context on new session
 * Cross-platform (Windows, macOS, Linux)
 *
 * !! DISABLED: Set ENABLED = true below to activate this hook.
 * !! Known issue: SessionStart hook may have bugs in some environments.
 */

const ENABLED = false;

if (!ENABLED) {
  process.exit(0);
}

const {
  getSessionsDir,
  findFiles, ensureDir, log
} = require('../lib/utils');
const { getPackageManager, getSelectionPrompt } = require('../lib/package-manager');
const { listAliases } = require('../lib/session-aliases');

async function main() {
  const sessionsDir = getSessionsDir();

  ensureDir(sessionsDir);

  const recentSessions = findFiles(sessionsDir, '*-session.tmp', { maxAge: 7 });
  if (recentSessions.length > 0) {
    const latest = recentSessions[0];
    log(`[SessionStart] Found ${recentSessions.length} recent session(s)`);
    log(`[SessionStart] Latest: ${latest.path}`);

    // Load and output the latest session summary
    try {
      const fs = require('fs');
      const content = fs.readFileSync(latest.path, 'utf8');
      // Only output if it has real content (not just the empty template)
      if (content.includes('## Current State') && !content.includes('[Session context goes here]')) {
        log('[SessionStart] === Previous Session Summary ===');
        // Extract content after the --- separator
        const parts = content.split(/^---$/m);
        const summary = parts.length >= 2 ? parts.slice(1).join('---').trim() : content;
        log(summary);
        log('[SessionStart] === End Previous Session ===');
      }
    } catch {}
  }

  const aliases = listAliases({ limit: 5 });
  if (aliases.length > 0) {
    const aliasNames = aliases.map(a => a.name).join(', ');
    log(`[SessionStart] ${aliases.length} session alias(es) available: ${aliasNames}`);
    log(`[SessionStart] Use /sessions load <alias> to continue a previous session`);
  }

  const pm = getPackageManager();
  log(`[SessionStart] Package manager: ${pm.name} (${pm.source})`);

  if (pm.source === 'fallback' || pm.source === 'default') {
    log('[SessionStart] No package manager preference found.');
    log(getSelectionPrompt());
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[SessionStart] Error:', err.message);
  process.exit(0);
});
