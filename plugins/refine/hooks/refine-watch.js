#!/usr/bin/env node
const {
  getMode,
  alreadyNudged,
  recordNudge,
  pruneStaleNudges,
  emit,
} = require('./refine-runtime');

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  try {
    pruneStaleNudges();

    if (getMode() !== 'auto') return;

    const data = JSON.parse(input.replace(/^﻿/, ''));
    const filePath = data.tool_input && data.tool_input.file_path;
    const sessionId = data.session_id;
    if (!filePath) return;
    if (alreadyNudged(sessionId, filePath)) return;
    recordNudge(sessionId, filePath);

    emit(
      'PostToolUse',
      'REFINE AUTO — `' + filePath + '` was just modified. ' +
      'Before reporting this work complete, run `/refine:simplify` ' +
      '(or invoke the simplify skill) on the changed files to review for ' +
      'reuse, quality, and architectural fit. ' +
      'Ignore this nudge if simplify already ran on this file this turn. ' +
      'Disable with `/refine off`.'
    );
  } catch {}
});
