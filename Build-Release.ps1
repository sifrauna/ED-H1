# Run this on YOUR machine when you want to make a zip to share:
#   cd D:\ED-H1
#   powershell -ExecutionPolicy Bypass -File .\Build-Release.ps1
#
# It builds the web interface, then copies only what a new user needs into
# release\ED-H1 and zips it. Your .venv, your conversation database, your models
# and backup files are NOT included.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Building the web interface..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "frontend")
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed. Fix the errors above, then run this again." }
} finally { Pop-Location }

$Out = Join-Path $Root "release\ED-H1"
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $Out "backend"), (Join-Path $Out "launcher"), (Join-Path $Out "frontend") | Out-Null

# backend (code only)
foreach ($f in "main.py", "music.py", "agents_core.py", "characters.py", "games_core.py", "files_core.py", "extras.py") {
    Copy-Item (Join-Path $Root "backend\$f") (Join-Path $Out "backend")
}
Copy-Item (Join-Path $Root "backend\requirements.txt") (Join-Path $Out "backend")

# web interface (built files only)
Copy-Item (Join-Path $Root "frontend\dist") (Join-Path $Out "frontend\dist") -Recurse

# launcher
Get-ChildItem (Join-Path $Root "launcher") -Include *.ps1, model.txt, *.ico -Recurse |
    ForEach-Object { Copy-Item $_.FullName (Join-Path $Out "launcher") }
Copy-Item (Join-Path $Root "Start ED-H1.bat") $Out
Copy-Item (Join-Path $Root "README.txt")      $Out

$Zip = Join-Path $Root "release\ED-H1-Setup.zip"
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path $Out -DestinationPath $Zip -Force

$mb = [math]::Round((Get-Item $Zip).Length / 1MB, 1)
Write-Host ""
Write-Host "Done. Share this file: $Zip ($mb MB)" -ForegroundColor Green
