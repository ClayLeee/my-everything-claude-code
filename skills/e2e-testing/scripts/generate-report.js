#!/usr/bin/env node
/**
 * Report Generator — generates 繁體中文 markdown test report from test results.
 *
 * Usage: echo '{"pageName":"project-list","pageNameZh":"專案列表",...}' | node generate-report.js
 *
 * stdin JSON:
 *   pageName       — kebab-case page name (e.g., "project-list")
 *   pageNameZh     — 繁體中文 page name (e.g., "專案列表")
 *   testDate       — date string (e.g., "2026-03-19")
 *   testUrl        — URL tested (e.g., "http://localhost:5173/projects")
 *   testAccount    — account used (e.g., "sysadmin (系統管理員 權限)")
 *   describeGroups — array of test describe groups with test results
 *   outputDir      — directory to write the report (e.g., "playwright/reports/project-list")
 *
 * stdout JSON: { outputPath: "...", summary: { total, pass, fail, skip, passRate } }
 */

const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function generateReport(input) {
  const {
    pageName,
    pageNameZh,
    testDate,
    testUrl,
    testAccount = 'sysadmin',
    describeGroups = [],
    outputDir,
  } = input;

  // ── Calculate summary stats ────────────────────────────────
  let total = 0;
  let pass = 0;
  let fail = 0;
  let skip = 0;
  const failures = [];

  for (const group of describeGroups) {
    for (const test of (group.tests || [])) {
      total++;
      if (test.status === 'pass') pass++;
      else if (test.status === 'fail') {
        fail++;
        failures.push({ ...test, group: group.name });
      }
      else if (test.status === 'skip') skip++;
    }
  }

  const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;
  const statusEmoji = fail === 0 ? '✅ 通過' : '❌ 失敗';

  // ── Build markdown ─────────────────────────────────────────
  const lines = [];

  // Header
  lines.push(`# ${pageNameZh}測試報告`);
  lines.push('');
  lines.push(`**測試日期**: ${testDate}`);
  lines.push(`**測試 URL**: ${testUrl}`);
  lines.push(`**測試工具**: Playwright`);
  lines.push(`**測試帳號**: ${testAccount}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary table
  lines.push('## 測試摘要');
  lines.push('');
  lines.push('| 項目     | 結果   |');
  lines.push('| -------- | ------ |');
  lines.push(`| 測試狀態 | ${statusEmoji} |`);
  lines.push(`| 總計     | ${total}      |`);
  lines.push(`| 通過     | ${pass}      |`);
  lines.push(`| 失敗     | ${fail}      |`);
  lines.push(`| 跳過     | ${skip}      |`);
  lines.push(`| 通過率   | ${passRate}%    |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Test scenarios
  lines.push('## 測試場景');
  lines.push('');

  for (const group of describeGroups) {
    lines.push(`### ${group.name}`);
    lines.push('');
    lines.push('| 測試案例 | 狀態 | 說明 |');
    lines.push('| -------- | ---- | ---- |');

    for (const test of (group.tests || [])) {
      const statusIcon = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⏭️';
      const description = test.description || '';
      lines.push(`| ${test.name} | ${statusIcon} | ${description} |`);
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Failure details (only if there are failures)
  if (failures.length > 0) {
    lines.push('## 失敗詳情');
    lines.push('');

    for (const f of failures) {
      lines.push(`### ${f.name}`);
      if (f.error) {
        if (f.error.file) {
          lines.push(`- **檔案位置**: \`${f.error.file}${f.error.line ? ':' + f.error.line : ''}\``);
        }
        if (f.error.message) {
          lines.push(`- **錯誤訊息**: ${f.error.message}`);
        }
        if (f.error.classification) {
          lines.push(`- **錯誤分類**: ${f.error.classification}`);
        }
        if (f.error.suggestion) {
          lines.push(`- **建議修復**: ${f.error.suggestion}`);
        }
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Artifacts
  lines.push('## Artifacts');
  lines.push(`- HTML Report: \`playwright/reports/${pageName}/index.html\``);
  lines.push('- Failure Screenshots: `playwright/test-results/` (auto-captured)');
  lines.push('- Videos: `playwright/test-results/` (auto-captured)');
  lines.push('- Traces: `playwright/test-results/` (auto-captured)');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`_報告產生時間: ${testDate}_`);
  lines.push('_測試工具: Playwright_');
  lines.push('');

  return {
    markdown: lines.join('\n'),
    summary: { total, pass, fail, skip, passRate },
  };
}

// ── Main ───────────────────────────────────────────────────────

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const { outputDir } = input;

    if (!outputDir) {
      console.log(JSON.stringify({ error: 'outputDir is required' }));
      return;
    }

    const { markdown, summary } = generateReport(input);

    // Write report
    ensureDir(outputDir);
    const outputPath = path.join(outputDir, 'test-report.md');
    fs.writeFileSync(outputPath, markdown, 'utf8');

    console.log(JSON.stringify({ outputPath, summary }));

  } catch (err) {
    console.log(JSON.stringify({ error: `Report generation failed: ${err.message}` }));
  }
});
