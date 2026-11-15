# Universal Forwarder sidecar (Kubernetes)

A Universal Forwarder (UF) sidecar tails log files from a shared volume and forwards them to your Splunk indexers on port 9997. For cluster-wide collection of container stdout, the Splunk OpenTelemetry Collector Helm chart (`splunk-otel-collector-chart`) is usually the better fit; use a sidecar when one workload needs its own files, sourcetypes, or index.

## Image

Use the official `splunk/universalforwarder` image, pinned to the version your indexers support (e.g. `splunk/universalforwarder:9.4`). It runs as a non-root user, so the app's log files must be readable by the forwarder's UID (41812 in the official image) or world-readable.

## Deployment YAML

```yaml
kind: Deployment
apiVersion: apps/v1
spec:
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: "<YOUR_IMAGE>"
          volumeMounts:
            - name: app-logs
              mountPath: /logs

        - name: splunkforwarder
          image: splunk/universalforwarder:9.4
          env:
            - name: SPLUNK_START_ARGS
              value: "--accept-license"
            - name: SPLUNK_GENERAL_TERMS        # required by 10.x images; harmless on 9.x
              value: "--accept-sgt-current-at-splunk-com"
            - name: SPLUNK_PASSWORD           # local admin password for the UF itself
              valueFrom:
                secretKeyRef: {name: splunk-uf, key: password}
          resources:
            requests: {cpu: 200m, memory: 512Mi}
            limits: {cpu: "1", memory: 1Gi}
          volumeMounts:
            - name: app-logs
              mountPath: /logs
              readOnly: true
            - name: uf-config
              mountPath: /opt/splunkforwarder/etc/apps/my_app_inputs/local
              readOnly: true
            # Keeps the fishbucket (read positions) across sidecar restarts, preventing duplicates
            - name: uf-var
              mountPath: /opt/splunkforwarder/var

      volumes:
        - name: app-logs
          emptyDir: {}
        - name: uf-var
          emptyDir: {}
        - name: uf-config
          configMap:
            name: my-app-splunk-uf
```

## ConfigMap (inputs.conf and outputs.conf)

```yaml
kind: ConfigMap
apiVersion: v1
metadata:
  name: my-app-splunk-uf
data:
  inputs.conf: |
    [monitor:///logs/app.log]
    index = my_index
    sourcetype = myapp_log
    ignoreOlderThan = 3d

    [monitor:///logs/access.log]
    index = my_index
    sourcetype = myapp_access_log
    blacklist = \.(gz|zip)$
  outputs.conf: |
    [tcpout]
    defaultGroup = primary

    [tcpout:primary]
    server = idx1.splunk.example.com:9997, idx2.splunk.example.com:9997
    useACK = true
```

- **index** must already exist on the indexers. Events sent to a missing index are dropped (the indexer logs a warning, the sender sees no error).
- **sourcetype**: prefix with the app name (`myapp_access_log`, not `apache_log`) to avoid colliding with someone else's field extractions.
- Broad wildcards in monitor paths raise forwarder memory use and indexing latency.
- The forwarder does not hot-reload config. A ConfigMap change needs a pod restart.

For Splunk Cloud, replace `outputs.conf` with the forwarder credentials app (`splunkclouduf.spl`) downloaded from the stack.

## Capturing STDOUT/STDERR

A file-tailing sidecar cannot read container stdout. Either collect stdout cluster-wide with the OTel Collector chart, or tee it to files in the entrypoint:

```bash
exec > >(tee -a /logs/stdout.log) 2> >(tee -a /logs/stderr.log >&2)
```

## Network policy

The sidecar needs egress to DNS and to the indexers on 9997 (and to a deployment server on 8089, if you use one):

```yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: splunkforwarder-egress
spec:
  podSelector:
    matchLabels:
      app: my-app
  policyTypes: [Egress]
  egress:
    - ports:
        - {protocol: UDP, port: 53}
    - to:
        - ipBlock: {cidr: "<INDEXER_CIDR>"}
      ports:
        - {protocol: TCP, port: 9997}
```

## Troubleshooting

If events do not appear:

1. **Index exists?** `| eventcount summarize=false index=my_index` in Splunk Web.
2. **Forwarder connected?** `kubectl exec <pod> -c splunkforwarder -- sh -c '/opt/splunkforwarder/bin/splunk list forward-server -auth "admin:$SPLUNK_PASSWORD"'` (single quotes, so the password expands inside the container, not in your shell)
3. **Forwarder's own logs** reach `index=_internal host=<pod-name>` once connected; before that, read `/opt/splunkforwarder/var/log/splunk/splunkd.log` in the container.
4. **File permissions**: the forwarder UID must be able to read the files.
5. **Network policy**: egress to the indexer CIDR on 9997 must be allowed.
