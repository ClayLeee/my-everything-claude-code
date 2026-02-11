/**
 * Session Manager Library for Claude Code
 * Provides core session CRUD operations for listing, loading, and managing sessions
 */

const fs = require('fs');
const path = require('path');
const { getSessionsDir, readFile, log } = require('./utils');

const SESSION_FILENAME_REGEX = /^(\d{4}-\d{2}-\d{2})(?:-([a-z0-9]{8,}))?-session\.tmp$/;

function parseSessionFilename(filename) {
  const match = filename.match(SESSION_FILENAME_REGEX);
  if (!match) return null;
  const dateStr = match[1];
  const shortId = match[2] || 'no-id';
  return { filename, shortId, date: dateStr, datetime: new Date(dateStr) };
}

function getSessionPath(filename) {
  return path.join(getSessionsDir(), filename);
}

function getSessionContent(sessionPath) {
  if (!fs.existsSync(sessionPath)) return null;
  return readFile(sessionPath);
}

function parseSessionMetadata(content) {
  const metadata = {
    title: null, date: null, started: null, lastUpdated: null,
    completed: [], inProgress: [], notes: '', context: ''
  };
  if (!content) return metadata;

  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) metadata.title = titleMatch[1].trim();

  const dateMatch = content.match(/\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) metadata.date = dateMatch[1];

  const startedMatch = content.match(/\*\*Started:\*\*\s*([\d:]+)/);
  if (startedMatch) metadata.started = startedMatch[1];

  const updatedMatch = content.match(/\*\*Last Updated:\*\*\s*([\d:]+)/);
  if (updatedMatch) metadata.lastUpdated = updatedMatch[1];

  const completedSection = content.match(/### Completed\s*\n([\s\S]*?)(?=###|\n\n|$)/);
  if (completedSection) {
    const items = completedSection[1].match(/- \[x\]\s*(.+)/g);
    if (items) metadata.completed = items.map(item => item.replace(/- \[x\]\s*/, '').trim());
  }

  const progressSection = content.match(/### In Progress\s*\n([\s\S]*?)(?=###|\n\n|$)/);
  if (progressSection) {
    const items = progressSection[1].match(/- \[ \]\s*(.+)/g);
    if (items) metadata.inProgress = items.map(item => item.replace(/- \[ \]\s*/, '').trim());
  }

  const notesSection = content.match(/### Notes for Next Session\s*\n([\s\S]*?)(?=###|\n\n|$)/);
  if (notesSection) metadata.notes = notesSection[1].trim();

  const contextSection = content.match(/### Context to Load\s*\n```\n([\s\S]*?)```/);
  if (contextSection) metadata.context = contextSection[1].trim();

  return metadata;
}

function getSessionStats(sessionPath) {
  const content = getSessionContent(sessionPath);
  const metadata = parseSessionMetadata(content);
  return {
    totalItems: metadata.completed.length + metadata.inProgress.length,
    completedItems: metadata.completed.length,
    inProgressItems: metadata.inProgress.length,
    lineCount: content ? content.split('\n').length : 0,
    hasNotes: !!metadata.notes,
    hasContext: !!metadata.context
  };
}

function getAllSessions(options = {}) {
  const { limit = 50, offset = 0, date = null, search = null } = options;
  const sessionsDir = getSessionsDir();
  if (!fs.existsSync(sessionsDir)) {
    return { sessions: [], total: 0, offset, limit, hasMore: false };
  }
  const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
  const sessions = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tmp')) continue;
    const metadata = parseSessionFilename(entry.name);
    if (!metadata) continue;
    if (date && metadata.date !== date) continue;
    if (search && !metadata.shortId.includes(search)) continue;
    const sessionPath = path.join(sessionsDir, entry.name);
    const stats = fs.statSync(sessionPath);
    sessions.push({
      ...metadata, sessionPath, hasContent: stats.size > 0,
      size: stats.size, modifiedTime: stats.mtime, createdTime: stats.birthtime
    });
  }
  sessions.sort((a, b) => b.modifiedTime - a.modifiedTime);
  const paginatedSessions = sessions.slice(offset, offset + limit);
  return { sessions: paginatedSessions, total: sessions.length, offset, limit, hasMore: offset + limit < sessions.length };
}

function getSessionById(sessionId, includeContent = false) {
  const sessionsDir = getSessionsDir();
  if (!fs.existsSync(sessionsDir)) return null;
  const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tmp')) continue;
    const metadata = parseSessionFilename(entry.name);
    if (!metadata) continue;
    const shortIdMatch = metadata.shortId !== 'no-id' && metadata.shortId.startsWith(sessionId);
    const filenameMatch = entry.name === sessionId || entry.name === `${sessionId}.tmp`;
    const noIdMatch = metadata.shortId === 'no-id' && entry.name === `${sessionId}-session.tmp`;
    if (!shortIdMatch && !filenameMatch && !noIdMatch) continue;
    const sessionPath = path.join(sessionsDir, entry.name);
    const stats = fs.statSync(sessionPath);
    const session = { ...metadata, sessionPath, size: stats.size, modifiedTime: stats.mtime, createdTime: stats.birthtime };
    if (includeContent) {
      session.content = getSessionContent(sessionPath);
      session.metadata = parseSessionMetadata(session.content);
      session.stats = getSessionStats(sessionPath);
    }
    return session;
  }
  return null;
}

function getSessionTitle(sessionPath) {
  const content = getSessionContent(sessionPath);
  const metadata = parseSessionMetadata(content);
  return metadata.title || 'Untitled Session';
}

function getSessionSize(sessionPath) {
  if (!fs.existsSync(sessionPath)) return '0 B';
  const stats = fs.statSync(sessionPath);
  const size = stats.size;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function writeSessionContent(sessionPath, content) {
  try { fs.writeFileSync(sessionPath, content, 'utf8'); return true; }
  catch (err) { log(`[SessionManager] Error writing session: ${err.message}`); return false; }
}

function appendSessionContent(sessionPath, content) {
  try { fs.appendFileSync(sessionPath, content, 'utf8'); return true; }
  catch (err) { log(`[SessionManager] Error appending to session: ${err.message}`); return false; }
}

function deleteSession(sessionPath) {
  try {
    if (fs.existsSync(sessionPath)) { fs.unlinkSync(sessionPath); return true; }
    return false;
  } catch (err) { log(`[SessionManager] Error deleting session: ${err.message}`); return false; }
}

function sessionExists(sessionPath) {
  return fs.existsSync(sessionPath) && fs.statSync(sessionPath).isFile();
}

module.exports = {
  parseSessionFilename, getSessionPath, getSessionContent, parseSessionMetadata,
  getSessionStats, getSessionTitle, getSessionSize, getAllSessions, getSessionById,
  writeSessionContent, appendSessionContent, deleteSession, sessionExists
};
