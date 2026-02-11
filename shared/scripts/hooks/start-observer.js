#!/usr/bin/env node
/**
 * Continuous Learning v2 - Observer Agent Launcher (Node.js)
 * Cross-platform (Windows, macOS, Linux)
 *
 * Starts a background process that periodically analyzes observations
 * and creates instinct files using Claude Haiku.
 *
 * Usage:
 *   node start-observer.js start    # Start observer in background
 *   node start-observer.js stop     # Stop running observer
 *   node start-observer.js status   # Check if observer is running
 *   node start-observer.js analyze  # Run analysis once (foreground)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync, execSync } = require('child_process');

const CONFIG_DIR = path.join(os.homedir(), '.claude', 'homunculus');
const PID_FILE = path.join(CONFIG_DIR, '.observer.pid');
const LOG_FILE = path.join(CONFIG_DIR, 'observer.log');
const OBSERVATIONS_FILE = path.join(CONFIG_DIR, 'observations.jsonl');
const INSTINCTS_DIR = path.join(CONFIG_DIR, 'instincts', 'personal');
const ARCHIVE_DIR = path.join(CONFIG_DIR, 'observations.archive');

// Configurable
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_OBSERVATIONS = 20;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stderr.write(line);
  try {
    ensureDir(path.dirname(LOG_FILE));
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  try {
    const content = fs.readFileSync(PID_FILE, 'utf8').trim();
    return parseInt(content, 10);
  } catch {
    return null;
  }
}

function getObservationCount() {
  if (!fs.existsSync(OBSERVATIONS_FILE)) return 0;
  try {
    const content = fs.readFileSync(OBSERVATIONS_FILE, 'utf8');
    return content.trim().split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function writePromptFile() {
  const promptFile = path.join(CONFIG_DIR, '.analysis-prompt.md');
  const content = `# Instinct Extraction Task

You are an instinct extractor for a Continuous Learning system.

## Step 1: Read Observations

Read the observations file: ${OBSERVATIONS_FILE}

## Step 2: Analyze Patterns

Look for these patterns (need 3+ occurrences each):
1. **Repeated workflows** - same tool sequences used multiple times
2. **Tool preferences** - consistently chosen tools for certain tasks
3. **Error resolutions** - errors followed by fixes
4. **User corrections** - when the user corrects a previous action

## Step 3: Create Instinct Files

For each clear pattern, create a .yaml file in ${INSTINCTS_DIR}/

Filename: \`<kebab-case-id>.yaml\`

Content format:
\`\`\`
---
id: <kebab-case-id>
trigger: "<when this pattern applies>"
confidence: <0.3-0.85 based on frequency>
domain: "<code-style|workflow|testing|git|debugging>"
source: session-observation
observed_count: <number>
last_observed: <date>
---

# <Title>

## Action
<What to do when trigger fires>

## Evidence
- <Summary of observations>
\`\`\`

## Rules
- Only create instincts for patterns with 3+ occurrences
- Be specific: narrow triggers > broad ones
- Never include actual code content, only patterns
- If an instinct already exists, update its confidence instead of duplicating
- Maximum 5 new instincts per run
- If no clear patterns found, say so — do not force instincts
`;
  ensureDir(path.dirname(promptFile));
  fs.writeFileSync(promptFile, content, 'utf8');
  return promptFile;
}

function runAnalysis() {
  const count = getObservationCount();
  if (count < MIN_OBSERVATIONS) {
    log(`Not enough observations (${count}/${MIN_OBSERVATIONS}), skipping analysis`);
    return false;
  }

  log(`Analyzing ${count} observations...`);
  ensureDir(INSTINCTS_DIR);

  try {
    // Write the full prompt to a file so Claude can read it (avoids CLI arg length limits)
    const promptFile = writePromptFile();
    const shortPrompt = `Read ${promptFile} for your full instructions, then execute them.`;

    const result = spawnSync('claude', [
      '--print',
      '--model', 'haiku',
      '--max-turns', '5',
      '--allowedTools', 'Read,Write,Glob,Grep'
    ], {
      input: shortPrompt,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 180000 // 3 minute timeout
    });

    if (result.status === 0) {
      log('Analysis completed successfully');
      if (result.stdout) log(`Output: ${result.stdout.slice(0, 500)}`);

      // Only archive if instincts were actually created
      if (fs.existsSync(INSTINCTS_DIR)) {
        const instincts = fs.readdirSync(INSTINCTS_DIR).filter(f => f.endsWith('.yaml'));
        if (instincts.length > 0) {
          archiveObservations();
          generateInstinctsMd();
          log(`Found ${instincts.length} instinct(s) after analysis`);
        } else {
          log('No instincts created — keeping observations for next run');
        }
      }
      return true;
    } else {
      log(`Analysis failed (exit ${result.status}): ${(result.stderr || '').slice(0, 300)}`);
      return false;
    }
  } catch (err) {
    log(`Analysis error: ${err.message}`);
    return false;
  }
}

function generateInstinctsMd() {
  if (!fs.existsSync(INSTINCTS_DIR)) return;

  const files = fs.readdirSync(INSTINCTS_DIR).filter(f => f.endsWith('.yaml'));
  if (files.length === 0) return;

  const instincts = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(INSTINCTS_DIR, file), 'utf8');
      const meta = {};
      let body = '';
      let inFrontmatter = false;
      let pastFrontmatter = false;

      for (const line of content.split('\n')) {
        if (line.trim() === '---') {
          if (inFrontmatter) { inFrontmatter = false; pastFrontmatter = true; }
          else { inFrontmatter = true; }
          continue;
        }
        if (inFrontmatter && line.includes(':')) {
          const [key, ...rest] = line.split(':');
          const val = rest.join(':').trim().replace(/^["']|["']$/g, '');
          meta[key.trim()] = val;
        }
        if (pastFrontmatter) body += line + '\n';
      }

      if (meta.id) {
        instincts.push({
          ...meta,
          confidence: parseFloat(meta.confidence) || 0.5,
          body: body.trim()
        });
      }
    } catch {}
  }

  if (instincts.length === 0) return;

  // Sort by confidence descending
  instincts.sort((a, b) => b.confidence - a.confidence);

  const AUTO_THRESHOLD = 0.7;
  const lines = [
    '# Learned Instincts',
    '',
    `> Auto-generated by Continuous Learning v2 on ${new Date().toISOString().slice(0, 10)}`,
    `> ${instincts.length} instinct(s) from session observations`,
    ''
  ];

  const high = instincts.filter(i => i.confidence >= AUTO_THRESHOLD);
  const low = instincts.filter(i => i.confidence < AUTO_THRESHOLD);

  if (high.length > 0) {
    lines.push(`## Apply These (confidence >= ${AUTO_THRESHOLD * 100}%)`, '');
    for (const inst of high) {
      lines.push(`### ${inst.id} (${Math.round(inst.confidence * 100)}%)`);
      lines.push(`- **Trigger**: ${inst.trigger || 'unknown'}`);
      // Extract action from body
      const actionMatch = inst.body.match(/## Action\s*\n([\s\S]*?)(?:\n## |\n$|$)/);
      if (actionMatch) {
        lines.push(`- **Action**: ${actionMatch[1].trim()}`);
      }
      lines.push('');
    }
  }

  if (low.length > 0) {
    lines.push(`## Consider These (confidence < ${AUTO_THRESHOLD * 100}%)`, '');
    for (const inst of low) {
      lines.push(`- **${inst.id}** (${Math.round(inst.confidence * 100)}%): ${inst.trigger || ''}`);
    }
    lines.push('');
  }

  // Write to .claude/instincts.md in the project root
  // Detect project root by walking up from this script
  let projectRoot = path.resolve(__dirname, '..', '..', '..');
  const outputFile = path.join(projectRoot, '.claude', 'instincts.md');
  ensureDir(path.dirname(outputFile));
  fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');
  log(`Generated instincts summary: ${outputFile}`);
}

function archiveObservations() {
  if (!fs.existsSync(OBSERVATIONS_FILE)) return;
  try {
    ensureDir(ARCHIVE_DIR);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(ARCHIVE_DIR, `processed-${ts}.jsonl`);
    fs.renameSync(OBSERVATIONS_FILE, dest);
    log(`Archived observations to ${dest}`);
  } catch (err) {
    log(`Archive error: ${err.message}`);
  }
}

// ─── Commands ────────────────────────────────────────────

function cmdStart() {
  ensureDir(CONFIG_DIR);

  // Check if already running
  const existingPid = readPid();
  if (existingPid && isProcessRunning(existingPid)) {
    console.log(`Observer already running (PID: ${existingPid})`);
    return;
  }

  // Clean stale PID file
  if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);

  // Spawn detached background process running "__loop" mode
  const child = spawn(process.execPath, [__filename, '__loop'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });

  child.unref();

  // Wait briefly for PID file
  setTimeout(() => {
    const pid = readPid();
    if (pid) {
      console.log(`Observer started (PID: ${pid})`);
      console.log(`Log: ${LOG_FILE}`);
    } else {
      console.log('Observer may have started, check log for details');
      console.log(`Log: ${LOG_FILE}`);
    }
  }, 1000);
}

function cmdStop() {
  const pid = readPid();
  if (!pid) {
    console.log('Observer not running');
    return;
  }

  if (isProcessRunning(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Stopped observer (PID: ${pid})`);
    } catch (err) {
      console.log(`Failed to stop observer: ${err.message}`);
      // Force kill on Windows
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
          console.log('Force killed via taskkill');
        }
      } catch {}
    }
  } else {
    console.log('Observer not running (stale PID file)');
  }

  try { fs.unlinkSync(PID_FILE); } catch {}
}

function cmdStatus() {
  const pid = readPid();
  const obsCount = getObservationCount();

  if (pid && isProcessRunning(pid)) {
    console.log(`Observer is running (PID: ${pid})`);
  } else {
    console.log('Observer is NOT running');
    if (fs.existsSync(PID_FILE)) {
      try { fs.unlinkSync(PID_FILE); } catch {}
    }
  }

  console.log(`Observations: ${obsCount} events`);
  console.log(`Min for analysis: ${MIN_OBSERVATIONS}`);
  console.log(`Log: ${LOG_FILE}`);
  console.log(`Instincts dir: ${INSTINCTS_DIR}`);

  // Count existing instincts
  if (fs.existsSync(INSTINCTS_DIR)) {
    const instincts = fs.readdirSync(INSTINCTS_DIR).filter(f => f.endsWith('.yaml'));
    console.log(`Instincts: ${instincts.length} learned`);
  }
}

function cmdAnalyze() {
  console.log('Running analysis in foreground...');
  const success = runAnalysis();
  console.log(success ? 'Analysis completed.' : 'Analysis skipped or failed.');
}

function cmdSync() {
  generateInstinctsMd();
  console.log('Instincts synced to .claude/instincts.md');
}

function cmdLoop() {
  // This runs in the detached background process
  ensureDir(CONFIG_DIR);
  fs.writeFileSync(PID_FILE, String(process.pid));

  log(`Observer loop started (PID: ${process.pid})`);

  // Graceful shutdown
  const cleanup = () => {
    log('Observer shutting down');
    try { fs.unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  // Run analysis periodically
  const tick = () => {
    try {
      runAnalysis();
    } catch (err) {
      log(`Loop error: ${err.message}`);
    }
  };

  // First run after 30 seconds (let observations accumulate)
  setTimeout(() => {
    tick();
    // Then every INTERVAL_MS
    setInterval(tick, INTERVAL_MS);
  }, 30000);
}

// ─── Main ────────────────────────────────────────────────

const command = process.argv[2] || 'status';

switch (command) {
  case 'start':   cmdStart(); break;
  case 'stop':    cmdStop(); break;
  case 'status':  cmdStatus(); break;
  case 'analyze': cmdAnalyze(); break;
  case 'sync':    cmdSync(); break;
  case '__loop':  cmdLoop(); break;
  default:
    console.log('Usage: node start-observer.js {start|stop|status|analyze|sync}');
    console.log('  start   - Start observer in background');
    console.log('  stop    - Stop running observer');
    console.log('  status  - Show observer status');
    console.log('  analyze - Run one analysis now (foreground)');
    console.log('  sync    - Update .claude/instincts.md from current instincts');
    process.exit(1);
}
