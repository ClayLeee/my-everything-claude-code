#!/usr/bin/env node
/**
 * Summarize Session - Generate session summary via Haiku
 * Cross-platform (Windows, macOS, Linux)
 *
 * Reads CLAUDE_TRANSCRIPT_PATH, calls Haiku to summarize,
 * then writes the summary into the session .tmp file.
 *
 * Designed to run as an async SessionEnd hook.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
const LOG_FILE = path.join(os.homedir(), '.claude', 'homunculus', 'observer.log');
const MIN_MESSAGES = 5;

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stderr.write(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

function countUserMessages(transcriptPath) {
  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    return (content.match(/"type":"user"/g) || []).length;
  } catch {
    return 0;
  }
}

function findSessionFile() {
  if (!fs.existsSync(SESSIONS_DIR)) return null;
  try {
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('-session.tmp'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.length > 0 ? path.join(SESSIONS_DIR, files[0].name) : null;
  } catch {
    return null;
  }
}

function main() {
  const transcriptPath = process.env.CLAUDE_TRANSCRIPT_PATH;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    log('[Summarize] No transcript found, skipping');
    return;
  }

  const msgCount = countUserMessages(transcriptPath);
  if (msgCount < MIN_MESSAGES) {
    log(`[Summarize] Session too short (${msgCount} messages), skipping`);
    return;
  }

  const sessionFile = findSessionFile();
  if (!sessionFile) {
    log('[Summarize] No session file found, skipping');
    return;
  }

  log(`[Summarize] Summarizing session (${msgCount} messages)...`);

  const prompt = `You are a session summarizer. Read the transcript file and produce a concise summary.

Transcript file: ${transcriptPath}

Read the transcript, then output ONLY a markdown summary in this exact format (no extra text):

## Current State
<1-2 sentence overview of what was being worked on>

### Completed
- <item 1>
- <item 2>

### In Progress
- <item if any, or "None">

### Notes for Next Session
- <key context or unresolved issues>

### Key Files
- <file paths that were important in this session>

Rules:
- Be concise, each bullet should be one line
- Maximum 5 items per section
- Use actual file paths from the transcript
- Do not include code snippets, only describe what was done`;

  const result = spawnSync('claude', [
    '--print',
    '--model', 'haiku',
    '--max-turns', '3',
    '--allowedTools', 'Read'
  ], {
    input: prompt,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120000
  });

  if (result.status !== 0) {
    log(`[Summarize] Haiku failed (exit ${result.status}): ${(result.stderr || '').slice(0, 200)}`);
    return;
  }

  const summary = (result.stdout || '').trim();
  if (!summary || summary.length < 20) {
    log('[Summarize] Empty or too short summary, skipping');
    return;
  }

  // Extract just the markdown sections from Haiku's output
  const sectionMatch = summary.match(/## Current State[\s\S]*/);
  const cleanSummary = sectionMatch ? sectionMatch[0].trim() : summary;

  try {
    const existing = fs.readFileSync(sessionFile, 'utf8');

    // Replace the placeholder content (everything after the --- separator)
    const parts = existing.split(/^---$/m);
    if (parts.length >= 2) {
      const header = parts[0] + '---\n\n';
      fs.writeFileSync(sessionFile, header + cleanSummary + '\n', 'utf8');
      log(`[Summarize] Written summary to ${sessionFile}`);
    } else {
      // No separator found, append
      fs.writeFileSync(sessionFile, existing + '\n' + cleanSummary + '\n', 'utf8');
      log(`[Summarize] Appended summary to ${sessionFile}`);
    }
  } catch (err) {
    log(`[Summarize] Write error: ${err.message}`);
  }
}

main();
