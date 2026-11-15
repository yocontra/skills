---
type: llm
---
Judge only the response text.

This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

PASS if the described process checks the recovered JavaScript for Electron-specific risks: at least two of nodeIntegration, contextIsolation, preload scripts, IPC handlers (ipcMain), shell.openExternal, or webSecurity.

FAIL if it audits the code only for generic web bugs with no Electron configuration or IPC checks.
