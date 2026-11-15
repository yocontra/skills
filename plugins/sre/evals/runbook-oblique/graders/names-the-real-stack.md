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

A runbook handed to a new joiner in placeholder form is a template, not a document — the
first thing they hit at 3am is `[PAGING TOOL]`.

PASS if the runbook is grounded in the tooling this team actually runs on, naming the real
systems for paging, for metrics and traces, for errors, and for declaring an outage and
communicating it, rather than leaving those as bracketed blanks for the user to fill in.
Asking the user to confirm one or two of them is fine; the document has to arrive with the
stack named.

Team-specific values that cannot be known without the real project, such as URLs, service
and channel names, log indices, contacts, and thresholds, may stay as placeholders. What
fails is a placeholder where the system itself belongs: `[PAGING TOOL]`, `[metrics
dashboard]`, `[incident process]`.

FAIL if the access checklist, the alert sources and the incident-management steps are
generic placeholders throughout.
