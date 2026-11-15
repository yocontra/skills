#!/usr/bin/env node
// Invoked by the /refine command: `node refine-mode.js [auto|off|status]`.
const { getMode, setMode, clearNudges, VALID_MODES } = require('./refine-runtime');

const arg = (process.argv[2] || 'status').trim().toLowerCase();

if (arg === 'status') {
  console.log('REFINE MODE: ' + getMode());
} else if (VALID_MODES.includes(arg)) {
  setMode(arg);
  if (arg === 'off') clearNudges();
  console.log(
    arg === 'off'
      ? 'REFINE MODE: off — auto-nudges after edits disabled.'
      : 'REFINE MODE: auto — will nudge to run /refine:simplify after each Edit/Write.'
  );
} else {
  console.log('Unknown mode "' + arg + '". Use: ' + VALID_MODES.join(' | ') + ' | status');
  process.exitCode = 1;
}
