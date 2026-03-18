#!/usr/bin/env node
/**
 * Cross-platform notification module for Claude Code hooks.
 * Provides sound playback and desktop Toast notifications.
 * Pure Node.js stdlib — no external npm packages.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const isWindows = process.platform === 'win32';
const isMacOS = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

const CONFIG_DIR = path.join(os.homedir(), '.claude', 'homunculus');
const CONFIG_FILE = path.join(CONFIG_DIR, 'notify-config.json');
const DISABLED_FLAG = path.join(CONFIG_DIR, 'notify-disabled');

/** Default sound files per platform */
const DEFAULT_SOUNDS = {
  win32: 'C:\\Windows\\Media\\Windows Notify.wav',
  darwin: '/System/Library/Sounds/Ping.aiff',
  linux: '/usr/share/sounds/freedesktop/stereo/complete.oga'
};

/**
 * Load notification config from ~/.claude/homunculus/notify-config.json
 * Returns merged config with defaults.
 */
function loadConfig() {
  const defaults = {
    enabled: true,
    sound: true,
    toast: true,
    soundFile: null
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const userConfig = JSON.parse(raw);
      return { ...defaults, ...userConfig };
    }
  } catch (_e) {
    // Ignore parse errors, use defaults
  }

  return defaults;
}

/**
 * Save notification config to ~/.claude/homunculus/notify-config.json
 */
function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
  } catch (_e) {
    // Silently ignore write errors
  }
}

/**
 * Spawn a background process.
 * On macOS/Linux: detached + unref (child survives parent exit).
 * On Windows: non-detached (detached children get killed when parent
 * exits in some terminal environments). The caller must wait for
 * completion — use async hook to avoid blocking Claude Code.
 * @returns {ChildProcess|null}
 */
function spawnBackground(cmd, args) {
  try {
    if (isWindows) {
      const child = spawn(cmd, args, {
        stdio: 'ignore',
        windowsHide: true
      });
      return child;
    } else {
      const child = spawn(cmd, args, {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return null;
    }
  } catch (_e) {
    return null;
  }
}

/**
 * Play a notification sound.
 * @param {string} [soundFile] - Path to sound file. Uses platform default if omitted.
 */
function playSound(soundFile) {
  const file = soundFile || DEFAULT_SOUNDS[process.platform];
  if (!file) return;

  try {
    if (!fs.existsSync(file)) return;
  } catch (_e) {
    return;
  }

  if (isWindows) {
    // Forward slashes prevent backslash consumption in spawn → PowerShell
    const safePath = file.replace(/\\/g, '/');
    spawnBackground('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `(New-Object Media.SoundPlayer '${safePath}').PlaySync()`
    ]);
  } else if (isMacOS) {
    spawnBackground('afplay', [file]);
  } else if (isLinux) {
    // Try paplay first (PulseAudio), fallback to aplay (ALSA)
    spawnBackground('paplay', [file]);
  }
}

/**
 * Show a desktop Toast notification.
 * @param {string} title - Notification title
 * @param {string} message - Notification body
 */
function showToast(title, message) {
  // Sanitize inputs for shell safety
  const safeTitle = String(title).replace(/'/g, "''").slice(0, 200);
  const safeMessage = String(message).replace(/'/g, "''").slice(0, 500);

  if (isWindows) {
    const psScript = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$n = New-Object System.Windows.Forms.NotifyIcon',
      '$n.Icon = [System.Drawing.SystemIcons]::Information',
      '$n.Visible = $true',
      `$n.ShowBalloonTip(5000, '${safeTitle}', '${safeMessage}', 'Info')`,
      'Start-Sleep -Seconds 6',
      '$n.Dispose()'
    ].join('; ');

    spawnBackground('powershell', [
      '-NoProfile', '-NonInteractive', '-Command', psScript
    ]);
  } else if (isMacOS) {
    spawnBackground('osascript', [
      '-e', `display notification "${safeMessage}" with title "${safeTitle}"`
    ]);
  } else if (isLinux) {
    spawnBackground('notify-send', [safeTitle, safeMessage]);
  }
}

/**
 * Send both sound and Toast notification based on config.
 * @param {string} title - Notification title
 * @param {string} message - Notification body
 * @param {object} [options] - Override config options
 * @param {boolean} [options.sound] - Override sound setting
 * @param {boolean} [options.toast] - Override toast setting
 * @param {string} [options.soundFile] - Override sound file path
 */
function notify(title, message, options) {
  const config = loadConfig();

  // Check disabled flag
  if (fs.existsSync(DISABLED_FLAG)) return;

  // Check master switch
  if (!config.enabled) return;

  const shouldSound = options?.sound ?? config.sound;
  const shouldToast = options?.toast ?? config.toast;
  const soundFile = options?.soundFile ?? config.soundFile;

  if (shouldSound) {
    playSound(soundFile);
  }

  if (shouldToast) {
    showToast(title, message);
  }
}

module.exports = {
  playSound,
  showToast,
  notify,
  loadConfig,
  saveConfig,
  CONFIG_FILE,
  CONFIG_DIR,
  DISABLED_FLAG
};
