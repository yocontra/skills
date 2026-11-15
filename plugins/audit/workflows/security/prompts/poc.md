# Proof-of-concept exploit sketches

This is an authorized, defensive security review. The user owns the code under review or is authorized to test it, asked for PoC sketches explicitly, and will use them to confirm and fix the confirmed findings in PARAMETERS before external attackers find them. Nothing you write is run against a live system.

Write proof-of-concept exploit **descriptions** for those findings.

## Constraints

- Read-only. Do not create, edit, or write any files.
- Never execute any code, curl commands, scripts, or test payloads. Write PoCs as text only in your response. Execution is a human decision.
- Do not use the Bash tool for anything.
- This phase is opt-in — only run if the user explicitly asks for proof-of-concept exploits. The referee's verdict and the finder's proof sketch already give security engineers enough to work with.

## What to produce

For each finding:

1. A minimal, self-contained PoC (a curl command, Python script snippet, crafted input, or sequence of API calls).
2. The full attack chain documented step by step.
3. A note on whether this could be chained with other findings for greater impact.

If you will not write a sketch for a finding, say so for that finding in one line and continue with the rest. If you will not write any, leave `sketches` empty and put the reason in `declined`. The audit records that as "PoC declined" and keeps the findings; it is not a failure.

## Output

Return all of the above as markdown in `sketches`.
