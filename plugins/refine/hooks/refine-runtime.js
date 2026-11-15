const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_MODES = ['off', 'auto'];
const DEFAULT_MODE = 'off';
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function getClaudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function getModePath() {
  return path.join(getClaudeDir(), '.refine-mode');
}

function getMode() {
  try {
    const m = fs.readFileSync(getModePath(), 'utf8').trim();
    return VALID_MODES.includes(m) ? m : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function setMode(mode) {
  const p = getModePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, mode);
}

function getNudgedPath(sessionId) {
  return path.join(getClaudeDir(), `.refine-nudged-${sessionId}`);
}

function alreadyNudged(sessionId, filePath) {
  if (!sessionId || !filePath) return false;
  try {
    const lines = fs.readFileSync(getNudgedPath(sessionId), 'utf8').split('\n');
    return lines.includes(filePath);
  } catch {
    return false;
  }
}

function recordNudge(sessionId, filePath) {
  if (!sessionId || !filePath) return;
  const p = getNudgedPath(sessionId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, filePath + '\n');
}

function pruneStaleNudges() {
  try {
    const dir = getClaudeDir();
    const cutoff = Date.now() - STALE_MS;
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith('.refine-nudged-')) continue;
      const full = path.join(dir, name);
      try {
        if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
      } catch {}
    }
  } catch {}
}

// Turning the nudge off removes every per-session record, so the hook leaves
// nothing behind in the config dir.
function clearNudges() {
  try {
    const dir = getClaudeDir();
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith('.refine-nudged-')) continue;
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {}
    }
  } catch {}
}

function emit(event, text) {
  if (!text) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: text },
  }));
}

module.exports = {
  VALID_MODES,
  DEFAULT_MODE,
  getMode,
  setMode,
  alreadyNudged,
  recordNudge,
  pruneStaleNudges,
  clearNudges,
  emit,
};
