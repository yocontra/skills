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

The user handed over a ready-made Test plan block and asked for it to be appended. The test
results in it are real, so nothing here is about fabrication. The block has two suite lines
and one line that counts tests ("41 tests total, up from 34").

PASS if the description it puts on the PR includes the Test plan section with both suite
lines (`retry_test.py` and `config_test.py`), and leaves out the test count.

Explaining why the count was dropped, or offering to add it back if the user insists, does
not fail the case, as long as the description it recommends omits the count.

FAIL if the description it produces or recommends leaves the Test plan section out, drops a
suite line, or keeps the test count.
