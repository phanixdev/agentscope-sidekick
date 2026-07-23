param(
  [switch]$SkipFrontendBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($name) {
  Write-Host "`n==> $name" -ForegroundColor Cyan
}

Step "Checking required Track 1 artifacts"
$required = @(
  "infra/casting.yaml",
  "infra/casting.yaml.lock",
  "infra/docker-compose.yml",
  "infra/otel/collector-config.yaml",
  "infra/signoz/dashboards.json",
  "infra/signoz/alerts.json",
  "infra/signoz/alerts.tf",
  "infra/signoz/.terraform.lock.hcl",
  "infra/signoz/README.md",
  "apps/agent/demo_agent.py",
  "apps/api/Dockerfile",
  "apps/web/Dockerfile",
  "infra/pours/deployment/compose.yaml",
  "apps/api/main.py",
  "apps/web/src/main.jsx",
  "scripts/start_demo.ps1",
  "docs/submission.md",
  "docs/demo-script.md",
  "docs/judging-checklist.md"
)
foreach ($path in $required) {
  if (-not (Test-Path $path)) { throw "Missing required artifact: $path" }
  Write-Host "ok $path"
}

Step "Validating typed SigNoz alert rules"
$terraformCommand = Get-Command terraform -ErrorAction SilentlyContinue
$terraformPath = if ($terraformCommand) {
  $terraformCommand.Source
}
elseif ($env:TERRAFORM_BIN -and (Test-Path $env:TERRAFORM_BIN)) {
  (Resolve-Path $env:TERRAFORM_BIN).Path
}
if ($terraformPath) {
  & $terraformPath -chdir=infra/signoz fmt -check
  if ($LASTEXITCODE -ne 0) { throw "Terraform formatting check failed" }
  & $terraformPath -chdir=infra/signoz validate
  if ($LASTEXITCODE -ne 0) { throw "Terraform validation failed" }
  Write-Host "ok typed SigNoz v2 alert rules validated"
}
else {
  Write-Host "skip Terraform validation (set TERRAFORM_BIN or install Terraform)"
}

Step "Checking OpenTelemetry SDK availability"
python -c "import opentelemetry.sdk.trace, opentelemetry.exporter.otlp.proto.http.trace_exporter; print('ok OpenTelemetry SDK available')"

Step "Running Python tests"
python -m unittest discover -s tests

if (-not $SkipFrontendBuild) {
  Step "Building frontend"
  npm.cmd run build
}

Step "Starting API smoke server"
$job = Start-Job -ScriptBlock {
  Set-Location $using:root
  python -m apps.api.main
}
try {
  Start-Sleep -Seconds 2
  $incidents = Invoke-RestMethod -Uri "http://127.0.0.1:8088/incidents"
  if ($incidents.Count -lt 3) { throw "Expected at least 3 incidents" }
  Write-Host "ok GET /incidents returned $($incidents.Count) runs"

  $explanation = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8088/incidents/run_7f3a1c9d/explain"
  if ($explanation.evidence -notcontains "trace_id=a1b2c3d") { throw "Explanation did not include trace evidence" }
  Write-Host "ok explain endpoint cites trace evidence"

  $beforeCount = $incidents.Count
  $body = @{ scenario = "token_spike" } | ConvertTo-Json
  $demo = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8088/demo/run" -ContentType "application/json" -Body $body
  if ($demo.created.tokens -lt 10000) { throw "Token spike demo did not exceed budget" }
  if (-not $demo.created.id) { throw "Demo run did not return an incident id" }
  $afterIncidents = Invoke-RestMethod -Uri "http://127.0.0.1:8088/incidents"
  if ($afterIncidents.Count -le $beforeCount) { throw "Demo run was not added to incident list" }
  if ($afterIncidents[0].id -ne $demo.created.id) { throw "Created demo run is not first in incident list" }
  Write-Host "ok demo run emitted and stored token spike scenario"
}
finally {
  Stop-Job $job -ErrorAction SilentlyContinue
  Remove-Job $job -ErrorAction SilentlyContinue
}

Step "Capturing correlated OpenTelemetry traces, metrics, and logs"
New-Item -ItemType Directory -Force -Path output/telemetry | Out-Null
python -m apps.agent.demo_agent *> output/telemetry/otel-all-signals.txt
$spanEvidence = Get-Content -LiteralPath output/telemetry/otel-all-signals.txt -Raw
if (-not ($spanEvidence -match '"telemetry.sdk.name": "opentelemetry"')) { throw "OpenTelemetry SDK span evidence missing" }
if (-not ($spanEvidence -match '"status_code": "ERROR"')) { throw "Error span status evidence missing" }
if ($spanEvidence -match 'agentscope_status_override') { throw "Internal status override leaked into span attributes" }
if (-not ($spanEvidence -match '"name": "agentscope.agent.runs"')) { throw "OpenTelemetry metrics evidence missing" }
if (-not ($spanEvidence -match '"body": "search_docs returned HTTP 500"')) { throw "Correlated OpenTelemetry log evidence missing" }
Write-Host "ok correlated OpenTelemetry traces, metrics, and logs captured"

Step "Running demo agent scenarios"
$output = python -m apps.agent.demo_agent
if (-not ($output -match "tool_status': 'error'")) { throw "Tool failure scenario did not emit error status" }
if (-not ($output -match "token_spike")) { throw "Token spike scenario missing" }
Write-Host "ok demo agent emitted Track 1 scenarios"

Step "Verification complete"
Write-Host "AgentScope Sidekick is ready for local Track 1 demo review." -ForegroundColor Green



