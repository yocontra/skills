---
name: splunk
effort: low
description: Splunk log search and ingestion — write SPL and run it over the REST API (Enterprise or Cloud), send events via HEC, set up forwarder sidecars or Vector/OTel sinks. Always scope by `index=` and set a time bound; `earliest=-30m` is the cap for live triage.
---

$ARGUMENTS

# Splunk

Search a Splunk Enterprise or Splunk Cloud deployment with SPL, and get logs into it.

- **Search:** REST API on the management port, `https://<search-head>:8089`, with a Splunk authentication token. Async jobs and endpoints: [api-reference.md](references/api-reference.md).
- **Ingest:** HEC, Vector, OpenTelemetry, Python: [ingest.md](references/ingest.md). Universal Forwarder sidecar on Kubernetes: [forwarder-setup.md](references/forwarder-setup.md).

## Discover config before asking

Check, in order, and use the first that answers:

1. Environment: `SPLUNK_HOST` (or `SPLUNK_URL`), `SPLUNK_TOKEN`, `SPLUNK_HEC_URL`, `SPLUNK_HEC_TOKEN`.
2. `~/.splunkrc` (the Splunk SDK's file: `host=`, `port=`, `token=` or `username=`).
3. The repo: an optional `.claude/config/splunk.yaml` (`host`, `index`, `sourcetype`, `earliest`, `hec_endpoint`), and index or sourcetype names in logging config, Vector/OTel config, `inputs.conf`, or Helm values. These usually name the index to search.
4. A local install: `command -v splunk` or `$SPLUNK_HOME/bin/splunk` can run searches itself.

Ask the user only for what is still missing: usually the search-head host, a token (Splunk Web → Settings → Tokens), and the index. On Splunk Cloud the REST port is `https://<stack>.splunkcloud.com:8089` and only answers once the stack's admin allows your IP; if it times out, give the user a Splunk Web link instead (below).

Check the connection and what you can see:

```bash
spl_rest() { curl -sS -H "Authorization: Bearer $SPLUNK_TOKEN" "https://$SPLUNK_HOST:8089$1"; }
spl_rest '/services/authentication/current-context?output_mode=json' | jq -r '.entry[0].content | "\(.username) roles=\(.roles|join(","))"'
```

The token carries the user's roles and sees only the indexes they allow. Never echo or log it. On-prem management certs are often self-signed: point `--cacert` at the CA rather than passing `-k`.

## Run a search

```bash
spl() {
  curl -sS -X POST "https://$SPLUNK_HOST:8089/services/search/v2/jobs/export" \
    -H "Authorization: Bearer $SPLUNK_TOKEN" \
    --data-urlencode "search=$1" -d output_mode=json -d preview=false \
  | jq -c 'select(.result) | .result'
}

spl 'search index=checkout earliest=-15m level=ERROR | head 50'
spl 'search index=checkout earliest=-1h "connection refused" | stats count by host | sort -count | head 20'
spl '| eventcount summarize=false index=* | table index count'      # indexes you can see
spl '| metadata type=sourcetypes index=checkout | table sourcetype totalCount lastTime'
```

`/export` streams and suits bounded searches. A search that may run for minutes goes through the async-job pattern in [api-reference.md](references/api-reference.md); that pattern deletes its job when done. Older Splunk versions use `/services/search/jobs/export` without `v2`.

With a local install: `splunk search '<spl>' -earliest_time -15m -maxout 50`.

## Query rules

- **Scope by index first:** `search index=<name> ...`. On shared indexes also filter `sourcetype=` or `source=`.
- **Always set a time bound that fits the question.** Live triage: `earliest=-15m` by default, `earliest=-30m` at most. A question about a named period gets that period: yesterday is `earliest=-1d@d latest=@d`, "between 2 and 3 this afternoon" is `earliest=@d+14h latest=@d+15h` (or absolute `earliest="10/28/2026:14:00:00" latest="10/28/2026:15:00:00"`), last week is `earliest=-7d@d latest=@d`.
- **Bound the result:** end with `| head 50`, `| top limit=20 ...`, or a `stats` that aggregates.
- **Prefer `stats` and `eval`** over `join`, `transaction`, and unbounded subsearches (subsearches cap at 10,000 rows and 60 s).
- Kubernetes logs from the Splunk OTel Collector carry `k8s.namespace.name`, `k8s.pod.name`, `k8s.container.name` (older collectors: `namespace`, `pod`, `container_name`). `host` is the node, not the pod.

## SPL quick reference

```spl
index=checkout (error OR fail*) NOT debug             # AND implicit; precedence () > NOT > OR > AND
index=checkout level=ERROR service=api-gateway        # field names case-sensitive, values not
index=checkout status>=500 | stats count by status, uri_path | sort -count
index=payments | timechart span=5m count by level
index=auth | spath input=message | search name="my-plugin"   # JSON inside a string field
index=checkout | rex field=message "user=(?<username>\w+)" | top limit=10 username
index=checkout | eval ok=if(status<500,1,0) | stats avg(ok) as success_rate by host
index=checkout earliest=-1h [search index=checkout earliest=-1h | top limit=1 host | fields host] | stats count by source
```

Relative time units: `s`, `m`, `h`, `d`, `w`, `mon`; `@` snaps to a boundary (`-1d@d` = start of yesterday).

## Splunk Web link

When the REST port is unreachable, or for the user to explore further:

```
https://<splunk-web-host>/en-US/app/search/search?q=<url-encoded SPL>&earliest=-1h&latest=now
```

Splunk Web listens on 8000 on a default on-prem install and on 443 for Splunk Cloud.

## Writes

Creating indexes, HEC tokens, saved searches, or alerts changes shared config; sending events writes data that most users cannot delete. When the task calls for it, make the change or send the event and report what was created or sent, where, and its name or marker. Test events go to a test index with a unique marker field; see [ingest.md](references/ingest.md#testing-a-hec-path-without-leaving-junk). Deleting an index, token, or saved search the session did not create destroys data: ask before that unless the user named it.

## Clean up

Remove what this session created, and nothing else:

- **Search jobs:** `DELETE /services/search/v2/jobs/<sid>` for every async job you started; finished jobs otherwise hold the user's disk quota for their TTL.
- **Temp files:** keep downloaded results in `D=$(mktemp -d); trap 'rm -rf "$D"' EXIT`.
- **Test index or HEC token** created for a test: delete exactly that one.
- **Port-forwards or `kubectl exec` sessions** opened to debug a forwarder: stop them (`kill %1` or the saved PID).

## Exit checklist

- [ ] Every search scoped by `index=` with a time bound that fits the question, and a bounded result
- [ ] The report lists every write and sent event, with index, name, and marker; nothing the session did not create was deleted unasked
- [ ] Async jobs deleted, temp files removed
- [ ] Test indexes, test tokens, and port-forwards this session created are removed
