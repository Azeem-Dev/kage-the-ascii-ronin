<#
  Launch the KAGE agent work streams in opencode, one window per agent.

  Usage (from the project folder):
    powershell -ExecutionPolicy Bypass -File scripts\run-agents.ps1
    powershell -ExecutionPolicy Bypass -File scripts\run-agents.ps1 -Agents A,D
    powershell -ExecutionPolicy Bypass -File scripts\run-agents.ps1 -Model "provider/model-id"

  Each agent's output is also written to artifacts\agents\logs\<letter>.log so
  Claude can follow progress and review.
#>
param(
  [string[]]$Agents = @('A', 'B', 'C', 'D'),
  [string]$Model = ''
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
  Write-Host 'opencode is not on PATH. Install it or open this from a shell where `opencode` works.' -ForegroundColor Red
  exit 1
}

if (-not $Model) {
  # Find DeepSeek Flash among the models opencode can use.
  $all = @(opencode models 2>$null)
  $deepseek = @($all | Where-Object { $_ -match 'deepseek' })
  $Model = $deepseek | Where-Object { $_ -match 'flash' -and $_ -match '4\.?1' } | Select-Object -First 1
  if (-not $Model) { $Model = $deepseek | Where-Object { $_ -match 'flash' } | Select-Object -First 1 }
  if (-not $Model) {
    Write-Host 'Could not find a DeepSeek Flash model. DeepSeek models available:' -ForegroundColor Yellow
    $deepseek | ForEach-Object { Write-Host "  $_" }
    $Model = Read-Host 'Type the model id to use (provider/model)'
  }
}
$Model = "$Model".Trim()
Write-Host "Model: $Model" -ForegroundColor Cyan

$briefs = @{ A = 'A-people.md'; B = 'B-buildings.md'; C = 'C-world.md'; D = 'D-physics.md' }
$logs = Join-Path $root 'artifacts\agents\logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

foreach ($agent in $Agents) {
  $brief = $briefs[$agent.ToUpper()]
  if (-not $brief) { Write-Host "Unknown agent $agent (use A, B, C, D)" -ForegroundColor Red; continue }
  $letter = $agent.ToUpper()
  $prompt = "You are Agent $letter on the KAGE project. Read artifacts/agents/README.md and artifacts/agents/$brief completely, then do that task end to end. " +
            "Edit only the files your brief allows. Run npm test and npx tsc --noEmit -p . until both pass. " +
            "Finish by writing artifacts/agents/$letter-handoff.md as the brief describes. Do not commit; Claude reviews first."
  $log = Join-Path $logs "$letter.log"
  $command = "Set-Location '$root'; `$host.UI.RawUI.WindowTitle = 'KAGE Agent $letter'; " +
             "opencode run --model '$Model' '$($prompt -replace "'", "''")' 2>&1 | Tee-Object -FilePath '$log'; " +
             "Write-Host ''; Write-Host 'Agent $letter finished.' -ForegroundColor Green"
  Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-Command', $command
  Write-Host "Started Agent $letter ($brief) -> $log"
}
