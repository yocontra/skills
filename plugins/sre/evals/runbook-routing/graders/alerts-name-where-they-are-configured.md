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

An alert table that lists what fires and what to do about it goes stale the first time
somebody changes a threshold, because nothing in it says where the threshold lives.

PASS if the alert section of the structure it proposes records, for each alert, where that
alert is configured — the trigger, the chart values, the probe in the deployment manifest, the
alerting rule file — and how a change to it gets made, not only its meaning and its
response.

FAIL if the alert coverage is limited to name, severity, symptom and playbook, with no
pointer to the system of record for the alert's own configuration.
