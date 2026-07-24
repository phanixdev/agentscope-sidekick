# SigNoz Configuration

dashboards.json is a native SigNoz v5 dashboard export. In SigNoz, open
Dashboards, choose New dashboard, select Import JSON, and upload the file.

alerts.tf provisions four typed v2alpha1 Track 1 alert rules with the official SigNoz
Terraform provider. Create a SigNoz service-account API key, then run:

    cd infra/signoz
    $env:SIGNOZ_ENDPOINT = "http://127.0.0.1:8080"
    $env:SIGNOZ_ACCESS_TOKEN = "<service-account-api-key>"
    terraform init
    terraform validate
    terraform plan
    terraform apply

The dashboard intentionally mixes all three signals: OpenTelemetry metrics for
runs, tokens, and tool failures; per-run token maxima; root-span p95 latency from traces; and
correlated WARN/ERROR volume from logs.

alerts.json is the compact judge-readable catalog and runbook companion to the
deployable Terraform rules.
