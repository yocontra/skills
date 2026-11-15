---
type: llm
---
This environment has no shell and its working directory is empty scaffolding, so no
response can run commands, read the real project, or report real results here. Do not
fail a response for not executing, for declining to invent results, or for offering to
finish against the real project; ignore any preamble about missing tools or files, which
is an artifact of the sandbox, not the behavior under test. Grade only the process the
response describes.

The response explains that p99 is the value below which 99% of requests fall and p99.9 the
value below which 99.9% fall, so p99.9 sits further out in the tail and is the slower number,
and that tail latency matters because those rare slow requests still hit real users and
compound across fan-out calls.

PASS if that is the substance of the answer. Further statistics on percentiles and tail
latency (sample size, histograms, why percentiles cannot be averaged, fan-out math) is on
topic and does not count against it.

FAIL if the explanation is wrong, or if the answer turns into incident-management process or
a walkthrough of specific tools (PagerDuty, Honeycomb, Splunk, Sentry, dashboards or alert
setup) the question did not ask for.
