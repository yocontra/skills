# Attack Surface Catalog

Finders check all applicable classes, not just the obvious ones.

## Classic Web & API

| Class | What to look for |
|-------|-----------------|
| **SQL injection** | String concatenation in queries, missing parameterization, ORM raw query escape hatches |
| **Command injection** | User input reaching `exec`, `system`, `spawn`, backticks, `os.popen` |
| **SSTI** | User input in template rendering (`{{`, `${`, `<%`) without sandboxing |
| **XSS (reflected/stored/DOM)** | User input rendered in HTML without encoding; `innerHTML`, `dangerouslySetInnerHTML`, `v-html` |
| **Path traversal** | User input in file paths without canonicalization; `../` sequences |
| **SSRF** | User-supplied URLs passed to server-side fetch/curl/HTTP clients |
| **XXE** | XML parsers with external entities enabled (default in many libs) |
| **CSRF** | State-changing endpoints missing CSRF tokens, SameSite cookies |
| **CORS misconfiguration** | Reflecting `Origin` header, `Access-Control-Allow-Origin: *` with credentials |
| **Open redirect** | User input in redirect targets without allowlist validation |
| **HTTP header injection** | User input in response headers (CRLF injection) |
| **Mass assignment** | Binding request bodies directly to models without allowlisting fields |
| **GraphQL introspection** | Introspection enabled in production, exposing schema |
| **ReDoS** | User input matched against regex with catastrophic backtracking |

## Authentication & Authorization

| Class | What to look for |
|-------|-----------------|
| **Auth bypass** | Missing auth checks on endpoints, inconsistent middleware application |
| **IDOR / BOLA** | Direct object references without ownership validation |
| **JWT vulnerabilities** | `alg: none` accepted, weak signing keys, missing expiry validation, key confusion (RS256->HS256) |
| **Privilege escalation** | Role checks that can be bypassed, horizontal/vertical privilege boundaries |
| **Session fixation** | Session ID not rotated after authentication |
| **Timing attacks** | Non-constant-time comparison on secrets, tokens, passwords |
| **OAuth flaws** | Missing `state` parameter, open redirect in callback, token leakage |
| **Broken access control** | Admin functions accessible to regular users, missing multi-tenancy isolation |

## Memory & Binary

| Class | What to look for |
|-------|-----------------|
| **Buffer overflow** | Unchecked bounds on array/buffer writes, `strcpy`, `sprintf`, `gets` |
| **Use-after-free** | Pointer used after `free()`/`delete`, dangling references across async boundaries |
| **Integer overflow** | Arithmetic on user-controlled integers used for allocation sizes, loop bounds |
| **Type confusion** | Unsafe casts, union type misuse, `void*` reinterpretation |
| **Format string** | User input as format string argument (`printf(user_input)`) |
| **Double free** | Same pointer freed twice, often in error-handling paths |
| **Uninitialized memory** | Stack/heap variables read before assignment, especially in error paths |
| **Zeroization failures** | Sensitive data (keys, passwords) not wiped from memory after use; compiler optimizing away `memset` |

## Concurrency

| Class | What to look for |
|-------|-----------------|
| **Race conditions** | TOCTOU (time-of-check-time-of-use), especially on file operations and auth checks |
| **Deadlocks** | Lock ordering violations, missing timeouts |
| **Data races** | Shared mutable state without synchronization |

## Deserialization & Data Handling

| Class | What to look for |
|-------|-----------------|
| **Insecure deserialization** | `pickle.loads`, `unserialize`, `ObjectInputStream`, `yaml.load` (without SafeLoader) on user data |
| **Prototype pollution** | Deep merge/extend of user-controlled objects in JS/TS |
| **XML/JSON bombs** | No limits on nesting depth or entity expansion |

## Cryptography

| Class | What to look for |
|-------|-----------------|
| **Weak algorithms** | MD5/SHA1 for security purposes, DES, RC4, ECB mode |
| **Hardcoded secrets** | API keys, passwords, signing keys in source code |
| **Insufficient randomness** | `Math.random()`, `rand()` for security-sensitive values |
| **Missing encryption** | Sensitive data stored or transmitted in plaintext |
| **Timing side channels** | Branching, division, or table lookups on secret values in crypto code |
| **Insecure defaults / fail-open** | `SECRET = env.get('KEY') or 'default-secret'` — app runs insecurely with missing config instead of crashing |

## AI / LLM / Agent Security

| Class | What to look for |
|-------|-----------------|
| **Prompt injection** | User input concatenated into LLM prompts without sanitization or trust boundaries |
| **Missing trust boundaries** | Trusted instructions mixed with untrusted data without delimiters |
| **Raw tool results in prompts** | MCP/tool responses pasted into prompts without `<dataSource>` tagging |
| **Instructions after data** | Trusted instructions placed after untrusted substitutions (attacker overrides) |
| **Excessive agency** | AI agents with write access, network access, or execution without human approval |
| **System prompt leakage** | System prompts extractable via prompt injection |
| **MCP tool poisoning** | Typosquatted MCP tool names, over-permissioned tools, shadow tool configs |
| **Agent config injection** | Malicious instructions in `.claude/`, `.cursorrules`, `.windsurfrules`, agent memory files |
| **RAG context injection** | Unvalidated embeddings, document poisoning in retrieval-augmented generation |
| **Memory poisoning** | Hidden Unicode payloads, instruction injection in agent memory/context files |
| **Agent-to-subagent handoff** | Parent agents pasting external data directly into subagent prompts |

## Supply Chain & Configuration

| Class | What to look for |
|-------|-----------------|
| **Typosquatting** | Dependencies with names similar to popular packages (Levenshtein distance) |
| **Unpinned dependencies** | Wildcard versions (`*`, `latest`), git URL deps without commit pinning |
| **CI/CD pipeline poisoning** | Unpinned GitHub Actions, script injection via PR titles/branch names, `pull_request_target` misuse |
| **Agentic action injection** | AI actions in CI/CD with env var injection, expression injection, eval of AI output |
| **Docker misconfiguration** | Running as root, `:latest` tags, secrets in build args, exposed ports |
| **Kubernetes misconfiguration** | Privileged containers, missing network policies, default service accounts |
| **Infrastructure-as-code** | Overly permissive IAM policies, public S3 buckets, missing encryption in Terraform/CloudFormation |
| **Firebase/Supabase misconfiguration** | Missing RLS policies, service_role keys in client code, open database rules |

## Mobile

| Class | What to look for |
|-------|-----------------|
| **Insecure data storage** | Sensitive data in SharedPreferences/UserDefaults without encryption |
| **Certificate pinning bypass** | Missing or weak cert pinning, debug trust stores in production |
| **Deep link hijacking** | Unvalidated deep link parameters, intent redirection |
| **Exported components** | Android activities/services/receivers exported without permission checks |

## Business Logic

| Class | What to look for |
|-------|-----------------|
| **Race conditions in transactions** | Double-spend, duplicate operations via rapid concurrent requests |
| **Negative value attacks** | Negative quantities, negative prices, integer underflow in business calculations |
| **Step skipping** | Multi-step flows where intermediate validation can be bypassed |
| **Parameter tampering** | Price, role, or permission fields modifiable by the client |
| **Information disclosure** | Stack traces in errors, verbose API responses leaking internal fields, `.git` exposed |
