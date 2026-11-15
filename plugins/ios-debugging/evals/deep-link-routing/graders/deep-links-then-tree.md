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

PASS only if both hold:
1. It reaches the profile screen with a deep link (xcrun simctl openurl booted with an acme:// URL) rather than tapping through tabs.
2. It checks the display name through the accessibility tree (for example idb ui describe-all, or an idb MCP tool such as idb-ui-describe or idb-ui-find-element) and uses a screenshot only for the visual avatar check or as a fallback.

FAIL if it navigates by tapping through the UI, or relies on screenshots alone to find the name.
