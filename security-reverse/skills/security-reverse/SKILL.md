---
name: security-reverse
description: Decompile binaries (ELF, PE, Mach-O, firmware) to C using Ghidra headless analysis for security auditing.
user-invocable: true
argument-hint: "[path to binary file]"
allowed-tools: Agent, Read, Glob, Grep, Write, Bash
---

$ARGUMENTS

# Security Reverse

Decompile binaries to C using Ghidra's headless analyzer, then hand off to `security-audit` for adversarial vulnerability research.

## Supported Formats

ELF (Linux), PE (Windows), Mach-O (macOS/iOS), APK (Android — extract native libs first), firmware blobs.

## Pipeline

### Step 1: Set up environment

```bash
GHIDRA_HOME=/opt/homebrew/Cellar/ghidra/$(ls /opt/homebrew/Cellar/ghidra/)/libexec
JAVA_HOME=/opt/homebrew/Cellar/openjdk@21/$(ls /opt/homebrew/Cellar/openjdk@21/)/libexec/openjdk.jdk/Contents/Home
```

If Ghidra isn't installed: `brew install ghidra`

### Step 2: Import and analyze

```bash
JAVA_HOME=$JAVA_HOME $GHIDRA_HOME/support/analyzeHeadless /tmp/ghidra_project ProjectName \
  -import /path/to/binary \
  -overwrite
```

### Step 3: Decompile all functions to C

```bash
JAVA_HOME=$JAVA_HOME $GHIDRA_HOME/support/analyzeHeadless /tmp/ghidra_project ProjectName \
  -process binary_name \
  -noanalysis \
  -scriptPath $(dirname $0)/scripts \
  -postScript DecompileAll.java /tmp/decompiled_output.c
```

The `scripts/DecompileAll.java` script iterates all non-external functions, decompiles each with a 30-second timeout, and writes the C output to the specified path.

### Step 4: Hand off to security-audit

Read `/tmp/decompiled_output.c` and run `security-audit` against it — the adversarial trio (finders, disprovers, referees) works on decompiled C the same way it works on source code.

## What to Look For in Decompiled Code

Everything in the `security-audit` attack surface applies, plus:

- **Stripped symbols** — `FUN_00401234` names mean you infer purpose from behavior
- **Inlined functions** — decompiler may not reconstruct original boundaries
- **Optimized-out checks** — compiler can remove bounds checks that existed in source
- **Stack buffer sizes** — decompiler shows exact sizes; check every `memcpy`, `strcpy`, `sprintf`
- **Virtual function tables** — vtable corruption = type confusion / use-after-free
- **GOT/PLT entries** — overwriting these is a common exploitation primitive
- **Custom allocators** — look for use-after-free and double-free
- **Hardcoded strings** — search for passwords, API keys, crypto constants

## pyghidra (Python Alternative)

```bash
GHIDRA_INSTALL_DIR=$GHIDRA_HOME uvx pyghidra /path/to/binary script.py
```

pyghidra gives Python 3 access to Ghidra's Java APIs via JPype. The headless Java approach above is more reliable for batch decompilation.

## MCP Servers for Interactive Analysis

For deeper analysis where you want to query functions, trace xrefs, and rename symbols during the audit. See `reference/ghidra-mcp-servers.md` for options.

## Install Requirements

- `brew install ghidra` — installs Ghidra + OpenJDK 21
- Ghidra installs to `/opt/homebrew/Cellar/ghidra/VERSION/libexec/`
- JAVA_HOME must point to JDK 21 (not the system default)
