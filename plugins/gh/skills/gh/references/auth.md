# Non-interactive authentication

Before any of this: run `gh auth status` (add `-h "$GH_HOST"` for GitHub Enterprise). Already logged in? Nothing here applies — do not mint a PAT and do not generate an App installation token.

For CI jobs and automated contexts where browser login isn't possible, two options exist:

| Method | Recommended for | Token lifetime | Identity |
|--------|----------------|----------------|----------|
| **GitHub App** | Pipelines, bots, shared automation | 1 hour (re-mintable) | App bot account (e.g. "my-bot[bot]") |
| **Personal Access Token (PAT)** | Manually provisioned tokens stored in a secret manager or CI secret | Until expiry or revoked | Your user account |

Use a GitHub App when you want a stable bot identity that authors PRs and commits as the App. PATs work but tie every action to the user that minted them. Prefer fine-grained PATs with an expiry over classic PATs.

Inside GitHub Actions, the job's `GITHUB_TOKEN` is already available; pass it as `GH_TOKEN` and skip both flows.

## Agent rule: the token must never enter your context

Pipe a token straight into `gh auth login --with-token` or export it from a file — it must never land in a tool result. Echoing a token, printing it with `gh auth token`, or writing it to a file you then `cat` leaks it into the conversation log, where it stays.

## PAT authentication

Pipe a classic or fine-grained Personal Access Token via `--with-token`:

```bash
# From a file
gh auth login --with-token < /path/to/token.txt

# From an environment variable
echo "$GH_PAT" | gh auth login --with-token

# GitHub Enterprise Server
echo "$GH_PAT" | gh auth login --with-token --hostname "$GH_HOST"
```

**Minimum scopes (classic PAT):** `repo`, `read:org`

Alternatively, skip `gh auth login` entirely and let `gh` read the token from the environment. For github.com (and `*.ghe.com`), the variable is `GH_TOKEN` (or `GITHUB_TOKEN`). For GitHub Enterprise Server hosts, it is `GH_ENTERPRISE_TOKEN` (or `GITHUB_ENTERPRISE_TOKEN`) — *not* `GH_TOKEN`. `gh` ignores `GH_TOKEN` on a GHES host, so a token that returns 200 from `curl` will still give `gh` a 401. Set `GH_HOST` too:

```bash
export GH_ENTERPRISE_TOKEN="ghp_..."
export GH_HOST="github.example.com"
gh pr list  # gh reads GH_ENTERPRISE_TOKEN for the GHES host
```

This env-var approach is preferred for fine-grained PATs, which can behave unexpectedly with `--with-token` due to their resource scoping.

### Gotcha: `GH_TOKEN` blocks `gh auth login --with-token`

If `GH_TOKEN` or `GH_ENTERPRISE_TOKEN` is set in the environment, `gh auth login --with-token` refuses to persist anything to its credential store and exits with this message on stderr:

> The value of the GH_TOKEN environment variable is being used for authentication.
> To have GitHub CLI store credentials instead, first clear the value from the environment.

Subsequent `gh` calls then use whatever stale value the env var holds, which makes the pipe look broken. Unset both before piping:

```bash
unset GH_TOKEN GH_ENTERPRISE_TOKEN
gh auth login --with-token < /path/to/token.txt
```

(Source: [`pkg/cmd/auth/login/login.go:189-193`](https://github.com/cli/cli/blob/v2.92.0/pkg/cmd/auth/login/login.go#L189-L193).)

### Multiple hosts

`gh` stores one credential per host. To route a single command to another host, set the pair inline:

```bash
GH_ENTERPRISE_TOKEN="$OTHER_TOKEN" GH_HOST="github.other.example.com" gh pr list
```

## GitHub App authentication

Pick App auth when you want a stable bot identity that authors PRs and commits as the App rather than the user that minted the token. The App's private key is exchanged for a short-lived installation token via an RS256 JWT.

### Registering the App (one-time per host)

1. Go to **Settings → Developer settings → GitHub Apps → New GitHub App** (on the org for an org-owned App).
2. Set any homepage URL, uncheck **Active** under "Webhook" unless you need webhooks, and select the permissions needed (e.g. **Contents: Read & write**, **Pull requests: Read & write**).
3. Click **Create GitHub App**, generate a **private key**, and download the `.pem` file.
4. **Install** the App on the org/repo you want it to act on. The URL after installation is `…/installations/<INSTALL_ID>` — that integer is your installation ID.
5. Store the `.pem` content in your secret manager or CI secrets.

### Mint an installation token

In GitHub Actions, use [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token). Elsewhere, mint it inline (`pip install pyjwt cryptography`):

```bash
python3 -c "
import jwt, time, json, urllib.request, os

private_key = open(os.environ['GH_APP_KEY_FILE']).read()
api = os.environ.get('GH_API_URL', 'https://api.github.com')  # GHES: https://<host>/api/v3

# RS256 JWT (10-minute lifetime, backdated 60s for clock skew)
now = int(time.time())
payload = {'iat': now - 60, 'exp': now + 600, 'iss': '<APP_ID>'}
token = jwt.encode(payload, private_key, algorithm='RS256')

req = urllib.request.Request(
    f'{api}/app/installations/<INSTALL_ID>/access_tokens',
    method='POST',
    headers={
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    },
)
print(json.loads(urllib.request.urlopen(req).read())['token'])
" | gh auth login --with-token
```

Replace `<APP_ID>` and `<INSTALL_ID>` with your App's values. On GHES, set `GH_API_URL` and add `--hostname "$GH_HOST"` to the login.

### Verify

```bash
gh auth status
# expected: "Logged in to <host> as <app-name>[bot]"
```

If `gh` reports your user account instead of the bot, you're using a PAT — re-mint via the App flow.

### Token lifetime

Installation tokens expire 1 hour after mint. If a long-running job gets a 401 mid-session, re-mint. You do not need to revoke them; they expire on their own.

### Common pitfalls

- **Wrong API base in the exchange URL.** github.com uses `https://api.github.com`; GHES uses `https://<host>/api/v3`. An App registered on one host cannot install on another.
- **App not installed on the target org/repo.** A registered App with no installation has no `installation_id`. The `/access_tokens` endpoint will 404.
- **Insufficient permissions.** The App's permissions are set at registration. A 403 from an API call usually means the App is missing the matching permission.
- **`GH_TOKEN` shadowing.** `gh auth login --with-token` refuses to persist if `GH_TOKEN`/`GH_ENTERPRISE_TOKEN` is set. `unset` both first.
- **Clock skew.** The JWT `iat` is backdated 60s and `exp` is 10 minutes ahead. If the host clock is far off, GitHub rejects the JWT — fix NTP rather than widening the window.
