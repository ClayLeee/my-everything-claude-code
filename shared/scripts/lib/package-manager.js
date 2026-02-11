/**
 * Package Manager Detection and Selection
 * Supports: npm, pnpm, yarn, bun
 */

const fs = require('fs');
const path = require('path');
const { commandExists, getClaudeDir, readFile, writeFile } = require('./utils');

const PACKAGE_MANAGERS = {
  npm: { name: 'npm', lockFile: 'package-lock.json', installCmd: 'npm install', runCmd: 'npm run', execCmd: 'npx', testCmd: 'npm test', buildCmd: 'npm run build', devCmd: 'npm run dev' },
  pnpm: { name: 'pnpm', lockFile: 'pnpm-lock.yaml', installCmd: 'pnpm install', runCmd: 'pnpm', execCmd: 'pnpm dlx', testCmd: 'pnpm test', buildCmd: 'pnpm build', devCmd: 'pnpm dev' },
  yarn: { name: 'yarn', lockFile: 'yarn.lock', installCmd: 'yarn', runCmd: 'yarn', execCmd: 'yarn dlx', testCmd: 'yarn test', buildCmd: 'yarn build', devCmd: 'yarn dev' },
  bun: { name: 'bun', lockFile: 'bun.lockb', installCmd: 'bun install', runCmd: 'bun run', execCmd: 'bunx', testCmd: 'bun test', buildCmd: 'bun run build', devCmd: 'bun run dev' }
};

const DETECTION_PRIORITY = ['pnpm', 'bun', 'yarn', 'npm'];

function getConfigPath() { return path.join(getClaudeDir(), 'package-manager.json'); }

function loadConfig() {
  const content = readFile(getConfigPath());
  if (content) { try { return JSON.parse(content); } catch { return null; } }
  return null;
}

function saveConfig(config) { writeFile(getConfigPath(), JSON.stringify(config, null, 2)); }

function detectFromLockFile(projectDir = process.cwd()) {
  for (const pmName of DETECTION_PRIORITY) {
    if (fs.existsSync(path.join(projectDir, PACKAGE_MANAGERS[pmName].lockFile))) return pmName;
  }
  return null;
}

function detectFromPackageJson(projectDir = process.cwd()) {
  const content = readFile(path.join(projectDir, 'package.json'));
  if (content) {
    try {
      const pkg = JSON.parse(content);
      if (pkg.packageManager) {
        const pmName = pkg.packageManager.split('@')[0];
        if (PACKAGE_MANAGERS[pmName]) return pmName;
      }
    } catch {}
  }
  return null;
}

function getAvailablePackageManagers() {
  return Object.keys(PACKAGE_MANAGERS).filter(pm => commandExists(pm));
}

function getPackageManager(options = {}) {
  const { projectDir = process.cwd(), fallbackOrder = DETECTION_PRIORITY } = options;

  const envPm = process.env.CLAUDE_PACKAGE_MANAGER;
  if (envPm && PACKAGE_MANAGERS[envPm]) return { name: envPm, config: PACKAGE_MANAGERS[envPm], source: 'environment' };

  const projectConfigPath = path.join(projectDir, '.claude', 'package-manager.json');
  const projectConfig = readFile(projectConfigPath);
  if (projectConfig) {
    try {
      const config = JSON.parse(projectConfig);
      if (config.packageManager && PACKAGE_MANAGERS[config.packageManager]) return { name: config.packageManager, config: PACKAGE_MANAGERS[config.packageManager], source: 'project-config' };
    } catch {}
  }

  const fromPackageJson = detectFromPackageJson(projectDir);
  if (fromPackageJson) return { name: fromPackageJson, config: PACKAGE_MANAGERS[fromPackageJson], source: 'package.json' };

  const fromLockFile = detectFromLockFile(projectDir);
  if (fromLockFile) return { name: fromLockFile, config: PACKAGE_MANAGERS[fromLockFile], source: 'lock-file' };

  const globalConfig = loadConfig();
  if (globalConfig && globalConfig.packageManager && PACKAGE_MANAGERS[globalConfig.packageManager]) return { name: globalConfig.packageManager, config: PACKAGE_MANAGERS[globalConfig.packageManager], source: 'global-config' };

  const available = getAvailablePackageManagers();
  for (const pmName of fallbackOrder) {
    if (available.includes(pmName)) return { name: pmName, config: PACKAGE_MANAGERS[pmName], source: 'fallback' };
  }

  return { name: 'npm', config: PACKAGE_MANAGERS.npm, source: 'default' };
}

function setPreferredPackageManager(pmName) {
  if (!PACKAGE_MANAGERS[pmName]) throw new Error(`Unknown package manager: ${pmName}`);
  const config = loadConfig() || {};
  config.packageManager = pmName;
  config.setAt = new Date().toISOString();
  saveConfig(config);
  return config;
}

function setProjectPackageManager(pmName, projectDir = process.cwd()) {
  if (!PACKAGE_MANAGERS[pmName]) throw new Error(`Unknown package manager: ${pmName}`);
  const config = { packageManager: pmName, setAt: new Date().toISOString() };
  writeFile(path.join(projectDir, '.claude', 'package-manager.json'), JSON.stringify(config, null, 2));
  return config;
}

function getRunCommand(script, options = {}) {
  const pm = getPackageManager(options);
  switch (script) {
    case 'install': return pm.config.installCmd;
    case 'test': return pm.config.testCmd;
    case 'build': return pm.config.buildCmd;
    case 'dev': return pm.config.devCmd;
    default: return `${pm.config.runCmd} ${script}`;
  }
}

function getExecCommand(binary, args = '', options = {}) {
  const pm = getPackageManager(options);
  return `${pm.config.execCmd} ${binary}${args ? ' ' + args : ''}`;
}

function getSelectionPrompt() {
  const available = getAvailablePackageManagers();
  const current = getPackageManager();
  let message = '[PackageManager] Available package managers:\n';
  for (const pmName of available) {
    const indicator = pmName === current.name ? ' (current)' : '';
    message += `  - ${pmName}${indicator}\n`;
  }
  message += '\nTo set your preferred package manager:\n';
  message += '  - Global: Set CLAUDE_PACKAGE_MANAGER environment variable\n';
  message += '  - Or add to ~/.claude/package-manager.json: {"packageManager": "pnpm"}\n';
  message += '  - Or add to package.json: {"packageManager": "pnpm@8"}\n';
  return message;
}

function getCommandPattern(action) {
  const patterns = [];
  if (action === 'dev') { patterns.push('npm run dev', 'pnpm( run)? dev', 'yarn dev', 'bun run dev'); }
  else if (action === 'install') { patterns.push('npm install', 'pnpm install', 'yarn( install)?', 'bun install'); }
  else if (action === 'test') { patterns.push('npm test', 'pnpm test', 'yarn test', 'bun test'); }
  else if (action === 'build') { patterns.push('npm run build', 'pnpm( run)? build', 'yarn build', 'bun run build'); }
  else { patterns.push(`npm run ${action}`, `pnpm( run)? ${action}`, `yarn ${action}`, `bun run ${action}`); }
  return `(${patterns.join('|')})`;
}

module.exports = {
  PACKAGE_MANAGERS, DETECTION_PRIORITY,
  getPackageManager, setPreferredPackageManager, setProjectPackageManager, getAvailablePackageManagers,
  detectFromLockFile, detectFromPackageJson, getRunCommand, getExecCommand, getSelectionPrompt, getCommandPattern
};
