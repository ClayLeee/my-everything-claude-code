#!/usr/bin/env node
/**
 * Continuous Learning v2 - Observation Hook (Node.js cross-platform port)
 * Captures tool use events for pattern analysis.
 *
 * Usage: node observe.js pre|post
 * Claude Code passes hook data via stdin as JSON.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.claude', 'homunculus');
const OBSERVATIONS_FILE = path.join(CONFIG_DIR, 'observations.jsonl');
const MAX_FILE_SIZE_MB = 10;
const DISABLED_FLAG = path.join(CONFIG_DIR, 'disabled');

const hookType = process.argv[2] || 'unknown';

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    // Always pass through original data
    console.log(data);

    // Skip if disabled
    if (fs.existsSync(DISABLED_FLAG)) {
      process.exit(0);
    }

    // Ensure directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    if (!data.trim()) {
      process.exit(0);
    }

    const input = JSON.parse(data);

    const toolName = input.tool_name || input.tool || 'unknown';
    const toolInput = input.tool_input || input.input || {};
    const toolOutput = input.tool_output || input.output || '';
    const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || 'unknown';

    const event = hookType === 'pre' ? 'tool_start' : 'tool_complete';

    const truncate = (val, max = 5000) => {
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return str.length > max ? str.slice(0, max) : str;
    };

    const observation = {
      timestamp: new Date().toISOString(),
      event,
      tool: toolName,
      session: sessionId
    };

    if (event === 'tool_start') {
      observation.input = truncate(toolInput);
    } else {
      observation.output = truncate(toolOutput);
    }

    // Archive if file too large
    if (fs.existsSync(OBSERVATIONS_FILE)) {
      try {
        const stats = fs.statSync(OBSERVATIONS_FILE);
        const sizeMB = stats.size / (1024 * 1024);
        if (sizeMB >= MAX_FILE_SIZE_MB) {
          const archiveDir = path.join(CONFIG_DIR, 'observations.archive');
          if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
          }
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          fs.renameSync(OBSERVATIONS_FILE, path.join(archiveDir, `observations-${ts}.jsonl`));
        }
      } catch (_e) {
        // Ignore archive errors
      }
    }

    fs.appendFileSync(OBSERVATIONS_FILE, JSON.stringify(observation) + '\n');
  } catch (_e) {
    // Silently ignore errors - never block Claude
  }

  process.exit(0);
});
