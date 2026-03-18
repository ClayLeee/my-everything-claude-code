#!/usr/bin/env node
/**
 * PreToolUse hook — block creation of unnecessary documentation files.
 * Allows: README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md, SKILL.md,
 *         MEMORY.md, HOOKS.md, and any .md files under playwright/ directories.
 * Blocks: all other .md and .txt files.
 */

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || '';

    const isDocFile = /\.(md|txt)$/.test(filePath);
    const isAllowed = /(README|CLAUDE|AGENTS|CONTRIBUTING|SKILL|MEMORY|HOOKS)\.md$/.test(filePath);
    const isPlaywright = /playwright[/\\]/.test(filePath);

    if (isDocFile && !isAllowed && !isPlaywright) {
      console.error('[Hook] BLOCKED: Unnecessary documentation file creation');
      console.error('[Hook] File: ' + filePath);
      console.error('[Hook] Use README.md for documentation instead');
      process.exit(1);
    }

    console.log(data);
  } catch (_e) {
    // On parse error, pass through
    console.log(data);
  }
});
