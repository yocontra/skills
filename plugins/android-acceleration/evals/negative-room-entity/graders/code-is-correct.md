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

PASS if it gives a Kotlin @Entity data class for Note with a primary key and the four fields, and a @Dao with a @Query ordering by updatedAt descending that returns Flow<List<Note>>.

FAIL if the entity or DAO is missing, or the query does not order newest first or does not return a Flow.
