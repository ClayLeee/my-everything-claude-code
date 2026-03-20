#!/usr/bin/env node
/**
 * Template Scaffolder — reads templates, replaces {{VAR}} placeholders, writes to target paths.
 *
 * Usage: echo '{"targetDir":"app","templates":["BasePage"],"variables":{},"overwrite":false}' | node scaffold.js
 *
 * stdin JSON:
 *   targetDir   — project root relative to CWD (e.g., "app" or ".")
 *   templates   — array of template names (without extension) to scaffold
 *   variables   — object of {{KEY}} → value replacements
 *   overwrite   — boolean, skip existing files if false (default)
 *
 * stdout JSON: { created: [...], skipped: [...], errors: [...] }
 */

const fs = require('fs');
const path = require('path');

// ── Target path mapping ────────────────────────────────────────
const TARGET_MAP = {
  'BasePage':                        'tests/e2e/pages/BasePage.ts',
  'RemoteBasePage':                  'tests/e2e/pages/RemoteBasePage.ts',
  'playwright.config.local':         'playwright.config.ts',
  'playwright.config.local.auth':    'playwright.config.ts',
  'playwright.config.remote':        'playwright.config.ts',
  'auth.setup':                      'tests/e2e/auth/auth.setup.ts',
  'env.test.local':                  '.env.test.local',
  'error-utils':                     'tests/fixtures/error-utils.ts',
};

// ── Template file extension mapping ────────────────────────────
const EXTENSION_MAP = {
  'BasePage':                        '.ts',
  'RemoteBasePage':                  '.ts',
  'playwright.config.local':         '.ts',
  'playwright.config.local.auth':    '.ts',
  'playwright.config.remote':        '.ts',
  'auth.setup':                      '.ts',
  'env.test.local':                  '',       // no extension change
  'error-utils':                     '.ts',
};

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTemplateFileName(name) {
  // Map template name to actual file in templates/
  const ext = EXTENSION_MAP[name];
  if (ext === undefined) return null;
  if (ext === '') return name; // env.test.local has no extension change
  return name + ext;
}

function replaceVariables(content, variables) {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// ── Main ───────────────────────────────────────────────────────

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const { targetDir = '.', templates = [], variables = {}, overwrite = false } = input;

    const created = [];
    const skipped = [];
    const errors = [];

    for (const name of templates) {
      try {
        // Validate template name
        if (!TARGET_MAP[name]) {
          errors.push({ template: name, error: `Unknown template: ${name}` });
          continue;
        }

        // Read template file
        const templateFileName = getTemplateFileName(name);
        if (!templateFileName) {
          errors.push({ template: name, error: `Cannot resolve template filename for: ${name}` });
          continue;
        }

        const templatePath = path.join(TEMPLATES_DIR, templateFileName);
        if (!fs.existsSync(templatePath)) {
          errors.push({ template: name, error: `Template file not found: ${templatePath}` });
          continue;
        }

        const templateContent = fs.readFileSync(templatePath, 'utf8');

        // Replace variables
        const content = replaceVariables(templateContent, variables);

        // Determine target path
        const targetPath = path.join(targetDir, TARGET_MAP[name]);

        // Check if file exists
        if (fs.existsSync(targetPath) && !overwrite) {
          skipped.push({ template: name, path: targetPath, reason: 'exists' });
          continue;
        }

        // Write file
        ensureDir(targetPath);
        fs.writeFileSync(targetPath, content, 'utf8');
        created.push({ template: name, path: targetPath });

      } catch (err) {
        errors.push({ template: name, error: err.message });
      }
    }

    console.log(JSON.stringify({ created, skipped, errors }));

  } catch (err) {
    console.log(JSON.stringify({
      created: [],
      skipped: [],
      errors: [{ template: '*', error: `Invalid input: ${err.message}` }]
    }));
  }
});
