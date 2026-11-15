# Getting logs into Splunk

Read this when the task is ingestion: sending events over HEC, wiring a Vector or OpenTelemetry sink, a Python handler, or keeping a HEC token in Kubernetes. Universal Forwarder sidecars are in [forwarder-setup.md](forwarder-setup.md).

## Before sending anything

The target index and a HEC token scoped to it must exist. An index outside the token's allowed list is rejected up front (HTTP 400, `{"text":"Incorrect index","code":7}`). An index that does not exist on the indexers is worse: without indexer acknowledgment HEC still returns success, and the indexer drops the events with only a warning in its own logs. HEC tokens are created in Settings → Data inputs → HTTP Event Collector (Splunk Cloud: the same page, or the ACS API). A HEC token can only ingest; it cannot search.

HEC endpoints:

| Deployment | Endpoint |
|------------|----------|
| Splunk Enterprise | `https://<hec-host>:8088/services/collector/event` |
| Splunk Cloud | `https://http-inputs-<stack>.splunkcloud.com/services/collector/event` (port 443) |
| Health, no token | `/services/collector/health` |
| Raw lines | `/services/collector/raw?channel=<uuid>&index=<i>&sourcetype=<st>` |

## HEC with curl

```bash
curl -sS "$SPLUNK_HEC_URL/services/collector/event" \
  -H "Authorization: Splunk $SPLUNK_HEC_TOKEN" \
  -d '{"event": {"message": "hello"}, "index": "my_index", "sourcetype": "myapp:json", "source": "myapp", "time": '"$(date +%s)"'}'
```

`{"text":"Success","code":0}` means HEC accepted the event, not that it was indexed. Confirm with a search over `earliest=-5m`.

### Testing a HEC path without leaving junk

A test event cannot be removed later without the `delete_by_keyword` capability, which most users lack. So:

1. Send test events to a test or scratch index the team already uses for this, never to a production index. When the user names none, list indexes (`GET /services/data/indexes?count=0&output_mode=json`, cut with `jq` to names) and pick one named like `test`, `scratch`, or `sandbox`, and say which in the report. If none exists and you cannot create one, stop and report that rather than write into a production index.
2. Mark each with a unique field so it is easy to find and filter: `"fields": {"hec_test_id": "<uuid>"}`, `"source": "hec-test"`.
3. Send one event, search for it, and stop. Do not loop.
4. If the user had you create a test index or a test HEC token for this, delete exactly that index or token at the end. A test index created over REST is removed with `DELETE /services/data/indexes/<name>` on Enterprise; on Splunk Cloud use the ACS API (`DELETE https://admin.splunk.com/<stack>/adminconfig/v2/indexes/<name>` with an ACS token) or Settings → Indexes.

## Vector sink

```yaml
sinks:
  splunk:
    type: splunk_hec_logs
    inputs: [app_logs]
    endpoint: https://splunk-hec.example.com:8088
    default_token: "${SPLUNK_HEC_TOKEN}"
    index: my_index
    sourcetype: myapp:json
    encoding:
      codec: json
    acknowledgements:
      enabled: true          # end-to-end acks back to the source; indexer acks (indexer_acknowledgements_enabled) are on by default and need ack enabled on the token
    buffer:
      type: disk
      max_size: 1073741824
      when_full: block       # drop_newest only when losing logs beats back-pressure
```

## OpenTelemetry Collector

The `splunk_hec` exporter (contrib distribution) takes `token`, `endpoint` (`https://<host>:8088/services/collector`), `index`, `sourcetype`, and `source`. For cluster-wide Kubernetes collection, the `splunk-otel-collector-chart` Helm chart does the same with less config.

## Python

```python
# pip install splunk-handler
import logging, os
from splunk_handler import SplunkHandler

handler = SplunkHandler(
    host="splunk-hec.example.com", port=8088,
    token=os.environ["SPLUNK_HEC_TOKEN"],
    index="my_index", sourcetype="myapp:json",
)
logging.getLogger().addHandler(handler)
```

## HEC token as a Kubernetes Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-service-splunk-hec
type: Opaque
stringData:
  token: <hec-token>
---
# container spec
env:
  - name: SPLUNK_HEC_TOKEN
    valueFrom:
      secretKeyRef: {name: my-service-splunk-hec, key: token}
```

Create the Secret from a file or a secrets manager rather than committing the manifest with the token in it.
