# Ghidra MCP Servers

For interactive analysis where you want to query functions, trace xrefs, and rename symbols during the audit.

## ghidra-headless-mcp (fully headless, 212 tools)

**Repo:** https://github.com/mrphrazer/ghidra-headless-mcp

```bash
pip install pyghidra
git clone https://github.com/mrphrazer/ghidra-headless-mcp.git
claude mcp add ghidra -- python3 /path/to/ghidra_headless_mcp.py --ghidra-install-dir $GHIDRA_HOME
```

Key tools: `program.open`, `function.list`, `decomp.function`, `search.text`, `search.bytes`, `reference.to`, `reference.from`, `symbol.list`, `graph.cfg.edges`, `graph.call_paths`, `function.rename`, `comment.set`, `layout.struct.get`

## pyghidra-mcp (easiest install)

**Repo:** https://github.com/clearbluejar/pyghidra-mcp

```bash
uvx pyghidra-mcp              # start as stdio MCP server
# or Docker:
docker run -i --rm ghcr.io/clearbluejar/pyghidra-mcp -t stdio
```

Also has semantic code search via ChromaDB embeddings.

## GhidraMCP (GUI-based, 8k+ stars)

**Repo:** https://github.com/LaurieWired/GhidraMCP

Requires Ghidra GUI running with binary loaded. 27 tools.

## kawaiidra-mcp (iOS/Android focused)

**Repo:** https://github.com/wagonbomb/kawaiidra-mcp

60+ tools including iOS-specific (PAC gadget finder, Mach trap analysis, sandbox analysis, IOKit class finder) and Android (JNI methods, hardcoded secrets). Has `detect_vulnerabilities` with CWE mapping.
