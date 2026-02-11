#!/usr/bin/env node
/**
 * Strategic Compact Suggester
 * Cross-platform (Windows, macOS, Linux)
 *
 * Suggests manual compaction at logical intervals.
 * Threshold configurable via COMPACT_THRESHOLD env var (default: 50).
 */

const path = require('path');
const { getTempDir, readFile, writeFile, log } = require('../lib/utils');

async function main() {
  const sessionId = process.env.CLAUDE_SESSION_ID || process.ppid || 'default';
  const counterFile = path.join(getTempDir(), `claude-tool-count-${sessionId}`);
  const threshold = parseInt(process.env.COMPACT_THRESHOLD || '50', 10);

  let count = 1;
  const existing = readFile(counterFile);
  if (existing) {
    count = parseInt(existing.trim(), 10) + 1;
  }

  writeFile(counterFile, String(count));

  if (count === threshold) {
    log(`[StrategicCompact] ${threshold} tool calls reached - consider /compact if transitioning phases`);
  }

  if (count > threshold && count % 25 === 0) {
    log(`[StrategicCompact] ${count} tool calls - good checkpoint for /compact if context is stale`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[StrategicCompact] Error:', err.message);
  process.exit(0);
});
