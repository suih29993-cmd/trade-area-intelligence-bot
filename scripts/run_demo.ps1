# Start the local-only District Health Studio demo on port 8137.
param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$server = Join-Path $root 'server.py'
$runtime = Join-Path $root 'runtime'
$pidFile = Join-Path $runtime 'server.pid'
$portFile = Join-Path $runtime 'server.port'
$port = if ($env:PORT) { [int]$env:PORT } else { 8137 }
$url = "http://127.0.0.1:$port/index.html"

New-Item -ItemType Directory -Force -Path $runtime | Out-Null

function Find-Python {
  $candidates = @(
    'python',
    'py',
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
  )
  foreach ($candidate in $candidates) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($command -and $command.Source -notmatch 'WindowsApps') { return $command.Source }
  }
  return $null
}

function Test-Health {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
    return [bool]$response.ok
  } catch {
    return $false
  }
}

if (Test-Path -LiteralPath $pidFile) {
  $existingId = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($existingId -match '^\d+$') {
    $existing = Get-Process -Id ([int]$existingId) -ErrorAction SilentlyContinue
    if ($existing -and $existing.Path -like '*python*.exe') {
      if (Test-Health) {
        Write-Host 'Demo service is already running.'
        if (-not $NoBrowser) { Start-Process $url }
        exit 0
      }
    }
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

$python = Find-Python
if (-not $python) {
  Write-Host 'Python 3 was not found. Install Python 3 and retry.'
  exit 1
}

$process = Start-Process -FilePath $python -ArgumentList @($server, '--port', "$port") -WorkingDirectory $root -WindowStyle Hidden -PassThru
Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii
Set-Content -LiteralPath $portFile -Value $port -Encoding ascii

$ready = $false
for ($attempt = 0; $attempt -lt 35; $attempt++) {
  Start-Sleep -Milliseconds 300
  if ($process.HasExited) { break }
  if (Test-Health) {
    Start-Sleep -Milliseconds 300
    if (-not $process.HasExited) { $ready = $true }
    break
  }
}

if (-not $ready) {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $portFile -Force -ErrorAction SilentlyContinue
  if (Test-Health) {
    Write-Host "Port $port is already serving another instance. No existing process was stopped."
    Write-Host 'Stop that service manually or use a different port, then retry.'
  } else {
    Write-Host 'The demo service did not become ready. Check runtime\server.log.'
  }
  exit 1
}

Write-Host "Demo service ready: $url"
Write-Host 'Stop it with scripts\stop_demo.ps1.'
if (-not $NoBrowser) { Start-Process $url }
