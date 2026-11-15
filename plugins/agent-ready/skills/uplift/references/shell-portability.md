# Shell Portability for Uplift Probes

Probes run on macOS (zsh by default, BSD userland) and Linux (bash or dash, GNU userland). Write them as POSIX `sh`; a bash-only or GNU-only construct fails silently on the other platform.

## Avoid

| Construct | Why | Use instead |
|-----------|-----|-------------|
| `${!var}` | bash-only indirect expansion; zsh: "bad substitution" | `printenv "$var"` |
| `[[ ... ]]` | bash extended test | POSIX `[ ... ]` |
| `<<<` here-string | bash-only | `echo "..." \| ` |
| `${var^^}` / `${var,,}` | bash case modifiers | `tr '[:lower:]' '[:upper:]'` (or lower) |
| `read -p` | bash prompt flag | `printf '...'; read` |
| `&>` redirect | bash; older zsh rejects | `>file 2>&1` |
| `function foo()` | non-POSIX function syntax | `foo() { ... }` |
| Bare `(...)` arrays inside `sh -c` | bash/zsh-only | repeat flags inline OR wrap in `bash -c` |

When you genuinely need a bash-only feature, wrap explicitly: `bash -c '...'`. Never assume `sh` is bash.

## Env-var presence (portable)

```bash
for v in GITHUB_TOKEN NPM_TOKEN AWS_PROFILE KUBECONFIG; do
  if [ -n "$(printenv "$v")" ]; then echo "$v: set"; else echo "$v: <unset>"; fi
done
```

Never print the value -- presence only.

## base64 decode

`base64 -D` is macOS; `base64 -d` is linux. If a probe runs in a CI job, container, or any non-macOS runner, the flag must be `-d`. To stay portable: `base64 -d 2>/dev/null || base64 -D`.

## Parallel-probe block exit codes

After running a parallel-probe block (`for ... do ... done`), do not mark the whole block failed because the *last* sub-command exited non-zero. Iterate per-probe, capture each result independently, and report each row independently. The uplift verdict-counting logic depends on per-row status, not on the block-level exit code.

## BSD vs GNU flags

| Need | Portable form |
|------|---------------|
| file mtime | `stat -c %Y f 2>/dev/null \|\| stat -f %m f` (GNU first: GNU `stat -f` prints filesystem info before failing) |
| in-place edit | probes never edit; Phase 4 edits use the Edit tool, never `sed -i` |
| temp dir | `mktemp -d "${TMPDIR:-/tmp}/uplift.XXXXXX"` (the template form works on both) |

## Probe timeout

Cap any single probe at 5 seconds. Pick the first wrapper that exists; none needs an install:

```sh
if command -v timeout >/dev/null; then to="timeout 5"        # Linux (GNU coreutils)
elif command -v gtimeout >/dev/null; then to="gtimeout 5"    # macOS with coreutils
else to="perl -e 'alarm 5; exec @ARGV' --"; fi                # macOS default
eval "$to gh auth status"
```

The `perl alarm` form kills the probe itself, so nothing is left running in the background. If the probe times out, status is `UNKNOWN`, not `OK` and not `MISSING`.
