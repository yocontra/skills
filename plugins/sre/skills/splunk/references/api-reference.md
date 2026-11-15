# Splunk REST API reference

The search API listens on the management port, `https://$SPLUNK_HOST:8089`. Splunk Cloud exposes it at `https://<stack>.splunkcloud.com:8089` once the stack's REST access is enabled for your IP. HEC ingestion uses port 8088 and its own tokens; see the skill body.

## Authentication

Prefer a Splunk authentication token (Settings → Tokens), sent as a bearer token:

```bash
export SPLUNK_HOST=splunk.example.com
export SPLUNK_TOKEN=<token>
curl -sS "https://$SPLUNK_HOST:8089/services/authentication/current-context?output_mode=json" \
  -H "Authorization: Bearer $SPLUNK_TOKEN" | jq '.entry[0].content.username'
```

Basic auth (`-u user:password`) also works where token auth is disabled. A session key from `POST /services/auth/login` is sent as `Authorization: Splunk <sessionKey>`.

Self-signed management certificates are common on on-prem installs. Point `--cacert` at the CA instead of passing `-k`.

## Synchronous search (`/export`)

Streams results as they are found; best for bounded searches. Results are newline-delimited JSON.

```bash
curl -sS -X POST "https://$SPLUNK_HOST:8089/services/search/v2/jobs/export" \
  -H "Authorization: Bearer $SPLUNK_TOKEN" \
  --data-urlencode "search=search index=web earliest=-15m status=500 | head 50" \
  -d output_mode=json -d preview=false
```

The SPL must start with `search` (or another generating command such as `| tstats`). Older Splunk versions use `/services/search/jobs/export` without `v2`.

## Async job polling (long queries)

For searches that may outlast an HTTP read timeout: create the job, poll `dispatchState`, fetch a bounded page of results, then delete the job.

```python
import json, os, time, urllib.parse, urllib.request

BASE = f"https://{os.environ['SPLUNK_HOST']}:8089"
HDRS = {"Authorization": f"Bearer {os.environ['SPLUNK_TOKEN']}"}

def _call(path: str, data: dict | None = None, method: str | None = None) -> dict:
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers=HDRS, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}

def splunk_search_async(spl: str, earliest="-15m", latest="now", count=50, timeout=300) -> list[dict]:
    # Accept "index=x ...", "search index=x ...", or a generating command such as "| tstats ...".
    if not spl.lstrip().startswith(("search ", "|")):
        spl = f"search {spl}"
    sid = _call("/services/search/v2/jobs", {
        "search": spl, "earliest_time": earliest, "latest_time": latest,
        "output_mode": "json",
    })["sid"]
    try:
        deadline = time.time() + timeout
        while time.time() < deadline:
            state = _call(f"/services/search/v2/jobs/{sid}?output_mode=json")["entry"][0]["content"]
            if state["dispatchState"] == "DONE":
                break
            if state["dispatchState"] == "FAILED":
                raise RuntimeError(state.get("messages"))
            time.sleep(1)
        else:
            raise TimeoutError(f"Splunk job {sid} timed out after {timeout}s")
        return _call(f"/services/search/v2/jobs/{sid}/results?output_mode=json&count={count}")["results"]
    finally:
        # Cancel and delete the job either way, so it stops running and frees the user's disk quota.
        _call(f"/services/search/v2/jobs/{sid}?output_mode=json", method="DELETE")
```

## Useful endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/services/data/indexes?output_mode=json&count=0` | Indexes you can see |
| `GET` | `/services/search/v2/jobs?output_mode=json` | Your search jobs |
| `POST` | `/services/search/v2/jobs/{sid}/control` | `action=cancel` / `pause` / `finalize` |
| `DELETE` | `/services/search/v2/jobs/{sid}` | Cancel and delete a job you started |
| `GET` | `/services/saved/searches?output_mode=json` | Saved searches and alerts |
| `GET` | `/services/authentication/current-context` | Who am I, roles, capabilities |

Discover sourcetypes for an index with SPL rather than REST: `| metadata type=sourcetypes index=<name>`.
