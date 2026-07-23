param(
  [int]$ApiPort = 8088,
  [int]$WebPort = 5173
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Starting AgentScope Sidekick local demo..." -ForegroundColor Cyan
Write-Host "API: http://127.0.0.1:$ApiPort"
Write-Host "Web: http://127.0.0.1:$WebPort"
Write-Host "Press Enter to stop both services."

$apiJob = Start-Job -Name "agentscope-api" -ScriptBlock {
  param($Root)
  Set-Location $Root
  python -m apps.api.main
} -ArgumentList $root

$webJob = Start-Job -Name "agentscope-web" -ScriptBlock {
  param($Root, $Port)
  Set-Location $Root
  npm.cmd run dev -- --host 127.0.0.1 --port $Port
} -ArgumentList $root, $WebPort

try {
  Start-Sleep -Seconds 3
  try {
    $status = (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$ApiPort/incidents" -TimeoutSec 5).StatusCode
    Write-Host "API health: $status" -ForegroundColor Green
  } catch {
    Write-Host "API health check pending: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  Write-Host "Open http://127.0.0.1:$WebPort" -ForegroundColor Green
  Read-Host | Out-Null
}
finally {
  Stop-Job $apiJob,$webJob -ErrorAction SilentlyContinue
  Receive-Job $apiJob,$webJob -ErrorAction SilentlyContinue | Select-Object -Last 40
  Remove-Job $apiJob,$webJob -ErrorAction SilentlyContinue
  Write-Host "Stopped AgentScope Sidekick demo." -ForegroundColor Cyan
}
