# Stop only the process started by this project's run_demo.ps1.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$pidFile = Join-Path $root 'runtime\server.pid'
$portFile = Join-Path $root 'runtime\server.port'
$port = 8137
if (Test-Path -LiteralPath $portFile) {
  $savedPort = Get-Content -LiteralPath $portFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($savedPort -match '^\d+$') { $port = [int]$savedPort }
}

function Test-Health {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
    return [bool]$response.ok
  } catch {
    return $false
  }
}

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Host 'Demo service is not running (no PID file).'
  exit 0
}

$processId = (Get-Content -LiteralPath $pidFile | Select-Object -First 1)
if ($processId -notmatch '^\d+$') {
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  Write-Host 'Invalid PID file removed. No process was stopped.'
  exit 0
}

$process = Get-Process -Id ([int]$processId) -ErrorAction SilentlyContinue
if ($process -and $process.Path -like '*python*.exe' -and (Test-Health)) {
  Stop-Process -Id ([int]$processId) -Force -ErrorAction SilentlyContinue
  Write-Host 'Demo service stopped.'
} else {
  Write-Host 'PID could not be verified as this demo service. No process was stopped.'
}
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $portFile -Force -ErrorAction SilentlyContinue
