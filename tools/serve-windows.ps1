# Run AIly locally on Windows and open it for PWA install.
# Usage: right-click -> Run with PowerShell, or:
#   powershell -ExecutionPolicy Bypass -File tools\serve-windows.ps1
# This is a local preview. It is not a native Windows installer.
# Download AIly-setup.exe from GitHub Releases for the packaged app.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Web = Join-Path $Root "apps\web"
$ServeJs = Join-Path $Root "tools\serve-static.mjs"
Set-Location $Web

$port = 8765
Write-Host "AIly - Your AI Ally"
Write-Host "Serving $Web on http://127.0.0.1:$port/"
Write-Host "This is a browser PWA preview, not a native Windows installer."
Write-Host "Packaged app: download AIly-setup.exe from GitHub Releases (unsigned dogfood)."
Write-Host "Install as PWA: Edge/Chrome -> Install AIly / App available icon"
Write-Host "Ctrl+C to stop."
Write-Host ""

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if ($py) {
  Start-Process "http://127.0.0.1:$port/"
  & $py.Source -m http.server $port --bind 127.0.0.1
  exit $LASTEXITCODE
}

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  Start-Process "http://127.0.0.1:$port/"
  & $node.Source $ServeJs --port $port --root $Web --host 127.0.0.1
  exit $LASTEXITCODE
}

Write-Host "Install Python 3 or Node.js, then re-run this script." -ForegroundColor Yellow
exit 1
