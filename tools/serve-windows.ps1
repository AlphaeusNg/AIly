# Run AIly locally on Windows (PowerShell) and open in browser / PWA install.
# Usage: right-click → Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File tools\serve-windows.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Web = Join-Path $Root "apps\web"
Set-Location $Web

$port = 8765
Write-Host "AIly — Your AI Ally"
Write-Host "Serving $Web on http://127.0.0.1:$port/"
Write-Host "Install as app: Edge/Chrome → Install AIly / App available icon"
Write-Host "Ctrl+C to stop."
Write-Host ""

# Prefer Python
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if ($py) {
  Start-Process "http://127.0.0.1:$port/"
  & $py.Source -m http.server $port
  exit $LASTEXITCODE
}

# Fallback: Node
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  Start-Process "http://127.0.0.1:$port/"
  node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();http.createServer((q,s)=>{let p=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(p.endsWith(path.sep)||p.endsWith('/'))p=path.join(p,'index.html');fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);s.end('Not found');return;}const ext=path.extname(p);const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json','.ico':'image/x-icon'};s.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});s.end(d);});}).listen($port,()=>console.log('http://127.0.0.1:$port/'));"
  exit 0
}

Write-Host "Install Python 3 or Node.js, then re-run this script." -ForegroundColor Yellow
exit 1
