# Security Scan (Single-Pass)

Audit the changed code for exploitable security vulnerabilities in a single pass. This is a lightweight check inside the workflow — for full adversarial depth (finder / disprover / referee), `/audit:security` is run separately.

## Scope

Review **only** the files changed in the working tree. Enumerate the changeset with `git status --porcelain` (or use the `CHANGED_FILES` list the orchestrator provides) — this **includes newly created (untracked) files** that `git diff` alone omits. Inspect modified files with `git diff`; **read newly created files directly** (they won't appear in `git diff`).

## What to look for

Concentrate on classes of bugs an attacker could actually exploit, not theoretical risks.

- **Injection** — SQL, command, template, LDAP, XPath, header — any place untrusted input flows into an interpreter.
- **Authentication & authorization** — missing checks, broken role boundaries, predictable tokens, session fixation, missing CSRF where it matters.
- **Secrets and credentials** — secrets in code, logs, error messages, or VCS; weak crypto; hardcoded keys.
- **Deserialization & parser abuse** — untrusted YAML/pickle/Java-serialized/etc., XXE, zip-slip, path traversal.
- **SSRF / open redirect** — fetches or redirects whose target is influenced by untrusted input.
- **Resource exhaustion at attacker control** — unbounded loops, regex catastrophic backtracking, billion-laughs, recursive parsing.
- **Insecure defaults** — TLS verification disabled, permissive CORS, world-readable files, debug endpoints exposed.

## Standard

Every finding must include a **traced input → impact path**: what untrusted source the data comes from, how it flows through the changed code, and what an attacker can do with it. "This looks risky" is not a finding. "User-controlled `name` from the HTTP body is concatenated into the SQL string at line 87, allowing arbitrary SELECT statements" is a finding.

## Verdict

- `approved: true` only when no exploitable vulnerabilities were found in the changed code.
- `approved: false` with `issues` as a list of `{file, detail, severity}`. `detail` must describe the input source, the sink, and the impact. Severity should reflect exploitability and blast radius (auth bypass / RCE = high; weak headers in non-sensitive endpoints = low).
