# Stop anything on port 3002, remove .next (fixes file locks / EPERM on trace), start Next dashboard.
$ErrorActionPreference = 'SilentlyContinue'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

Write-Host "Stopping processes listening on port 3002..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

$nextDir = Join-Path $projectRoot '.next'
if (Test-Path $nextDir) {
  Write-Host "Removing .next (clear build cache)..." -ForegroundColor Yellow
  Remove-Item -Recurse -Force $nextDir -ErrorAction SilentlyContinue
}

Write-Host "Starting Next.js on http://localhost:3002 ..." -ForegroundColor Green
Set-Location $projectRoot
npm run next:dev
