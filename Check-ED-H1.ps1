# Check-ED-H1.ps1 - checks that an ED-H1 folder (or zip) has every file in the right place and in its latest version.
#
#   powershell -ExecutionPolicy Bypass -File .\Check-ED-H1.ps1                      (checks the folder this script is in)
#   powershell -ExecutionPolicy Bypass -File .\Check-ED-H1.ps1 -Path D:\ED-H1
#   powershell -ExecutionPolicy Bypass -File .\Check-ED-H1.ps1 -Path D:\ED-H1-Setup.zip -ForSharing
#
# -ForSharing treats private or generated files (database, .venv, ...) as problems, for zips you will give to others.
# It only READS your project files. It writes one text report next to this script (and, for a zip, unpacks it to a
# temporary folder that is deleted at the end).
param(
    [string]$Path = $PSScriptRoot,
    [switch]$ForSharing
)
$ErrorActionPreference = "Stop"

# $PSScriptRoot is empty when the script is pasted into a console; fall back to the current folder.
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
if (-not $Path) { $Path = $ScriptDir }

# ---------- find the project root (folder, or zip unpacked to a temp folder) ----------
$temp = $null
try {
if ($Path -like "*.zip") {
    $temp = Join-Path $env:TEMP ("edh1-check-" + [guid]::NewGuid().ToString("N"))
    Expand-Archive -Path $Path -DestinationPath $temp -Force
    $Root = $temp
    $inner = @(Get-ChildItem $temp -Directory)
    if ($inner.Count -eq 1 -and -not (Test-Path (Join-Path $temp "backend"))) { $Root = $inner[0].FullName }
} else {
    $Root = (Resolve-Path $Path).Path
}
$Root = $Root.TrimEnd('\')

# ---------- what must exist, and a piece of text that proves it is the LATEST version ----------
$Required = @(
    @{ P = "Start ED-H1.bat";                  M = @("Run-EDH1.ps1") },
    @{ P = "Build-Release.ps1";                M = @("extras.py", "*.ico") },
    @{ P = "README.txt";                       M = @() },
    @{ P = "launcher\Run-EDH1.ps1";            M = @("Ensure-Frontend", "words.txt", "pip install -U yt-dlp", "Open-EdApp") },
    @{ P = "launcher\Setup-EDH1.ps1";          M = @("IconLocation", "Python.Python.3.12") },
    @{ P = "launcher\common.ps1";              M = @("Open-EdApp", "Ensure-Frontend", "Test-ModelGenerates") },
    @{ P = "launcher\model.txt";               M = @() },
    @{ P = "launcher\ED-H1.ico";               M = @() },
    @{ P = "backend\main.py";                  M = @("music_router", "characters_router", "extras_router", "FRONTEND_DIST") },
    @{ P = "backend\music.py";                 M = @("api/music") },
    @{ P = "backend\agents_core.py";           M = @("appearance_json", "run_group_turns") },
    @{ P = "backend\characters.py";            M = @("appearance: Optional[dict]", "EDH1_MAX_PARALLEL") },
    @{ P = "backend\games_core.py";            M = @("scrabble_ai_move", "sudoku_hint") },
    @{ P = "backend\files_core.py";            M = @("extract_text", "relevant_excerpts") },
    @{ P = "backend\extras.py";                M = @("files_core", "scrabble") },
    @{ P = "backend\requirements.txt";         M = @("fastapi", "uvicorn", "httpx", "yt-dlp", "pypdf") },
    @{ P = "frontend\package.json";            M = @("vite") },
    @{ P = "frontend\vite.config.ts";          M = @() },
    @{ P = "frontend\tsconfig.json";           M = @() },
    @{ P = "frontend\index.html";              M = @("<title>ED-H1</title>", "favicon.ico") },
    @{ P = "frontend\public\favicon.svg";      M = @() },
    @{ P = "frontend\public\favicon.ico";      M = @() },
    @{ P = "frontend\public\icon-192.png";     M = @() },
    @{ P = "frontend\public\icon-512.png";     M = @() },
    @{ P = "frontend\src\main.tsx";            M = @() },
    @{ P = "frontend\src\index.css";           M = @() },
    @{ P = "frontend\src\App.jsx";             M = @("EdhOverlay", "audioRef", "api/music/resolve", "EdhUsers") },
    @{ P = "frontend\src\edh\EdhOverlay.jsx";  M = @("RoomScreen", "GamesScreen", "MediaScreen") },
    @{ P = "frontend\src\edh\RoomScreen.jsx";  M = @("edh-bob", "ENVIRONMENTS") },
    @{ P = "frontend\src\edh\GamesScreen.jsx"; M = @("rootRef", "max-w-[440px]") },
    @{ P = "frontend\src\edh\MediaScreen.jsx"; M = @("mediaErrors", "Documents") },
    @{ P = "frontend\src\edh\MiniAvatar.jsx";  M = @("HEADWEAR", "EYEWEAR") },
    @{ P = "frontend\src\edh\ui.jsx";          M = @("backdrop-blur-md", "makeTheme") },
    @{ P = "frontend\src\edh\api.js";          M = @("window.location.port") },
    @{ P = "frontend\src\edh\voice.js";        M = @("speak", "stopSpeaking") },
    @{ P = "frontend\src\edh\activity.js";     M = @("useActivities") }
)
$Optional = @(
    "backend\tests_agents.py", "backend\tests_games.py", "backend\tests_files.py",
    "patch_characters.py", "patch_extras.py", "patch_frontend.py", "patch_music.py", "patch_serve_frontend.py", "Check-ED-H1.ps1"
)
# present on a working PC, but they must NOT be in a zip you give to someone else
$Private = @(
    "backend\edh1_memory.db", "backend\.venv", "backend\data\words.txt", "backend\uploads",
    "launcher\.setup_done", "launcher\.update_stamp", "frontend\node_modules", "OllamaModels", "release", ".git"
)
$Excluded = @("node_modules", ".venv", "OllamaModels", "release", ".git", "__pycache__", "dist")

$lines = New-Object System.Collections.Generic.List[string]
$problems = 0
function Out-Line([string]$tag, [string]$text, [string]$color = "Gray") {
    $line = ("[{0}] {1}" -f $tag, $text)
    $lines.Add($line)
    Write-Host $line -ForegroundColor $color
}

Write-Host ""
Write-Host "Checking: $Root" -ForegroundColor Cyan
$lines.Add("Checking: $Root")

# ---------- 1. required files: present? latest version? ----------
foreach ($r in $Required) {
    $full = Join-Path $Root $r.P
    if (-not (Test-Path -LiteralPath $full)) {
        Out-Line "MISSING" $r.P "Red"; $problems++; continue
    }
    $old = @()
    foreach ($m in $r.M) {
        if (-not (Select-String -LiteralPath $full -SimpleMatch -Pattern $m -Quiet)) { $old += $m }
    }
    if ($old.Count -gt 0) {
        Out-Line "OLD VERSION" ("{0}  (does not contain: {1})" -f $r.P, ($old -join " | ")) "Red"; $problems++
    } else {
        Out-Line "OK" $r.P "Green"
    }
}

# ---------- 2. misplaced, duplicated and stray files ----------
function Get-Files([string]$dir) {
    foreach ($item in Get-ChildItem -LiteralPath $dir -Force) {
        if ($item.PSIsContainer) { if ($Excluded -notcontains $item.Name) { Get-Files $item.FullName } }
        else { $item }
    }
}
$expected = @{}
foreach ($p in ($Required | ForEach-Object { $_.P }) + $Optional) { $expected[[IO.Path]::GetFileName($p)] = $p }
$seen = @{}
foreach ($f in Get-Files $Root) {
    $rel = $f.FullName.Substring($Root.Length).TrimStart('\')
    if ($f.Name -match '\(\d+\)\.|[ _-]copy|\.bak|\.old$|~$') {
        Out-Line "STRAY" "$rel  (looks like a copy or backup; delete it once you know it is not needed)" "Yellow"; continue
    }
    if ($expected.ContainsKey($f.Name)) {
        if ($rel -ne $expected[$f.Name]) {
            Out-Line "MISPLACED" ("{0}  (belongs in {1})" -f $rel, (Split-Path $expected[$f.Name] -Parent)) "Red"; $problems++
        }
        if (-not $seen.ContainsKey($f.Name)) { $seen[$f.Name] = @() }
        $seen[$f.Name] += $rel
    }
}
foreach ($k in $seen.Keys) {
    if ($seen[$k].Count -gt 1) {
        Out-Line "DUPLICATE" ("{0} exists {1} times: {2}" -f $k, $seen[$k].Count, ($seen[$k] -join " ; ")) "Red"; $problems++
    }
}

# ---------- 3. private or generated files ----------
foreach ($p in $Private) {
    if (Test-Path -LiteralPath (Join-Path $Root $p)) {
        if ($ForSharing) { Out-Line "PRIVATE" "$p is inside this package. Remove it before sharing." "Red"; $problems++ }
        else { Out-Line "INFO" "$p exists (fine on your own PC; never share it)" "DarkGray" }
    }
}

# ---------- summary ----------
Write-Host ""
if ($problems -eq 0) { $summary = "RESULT: everything is in place and up to date." ; $color = "Green" }
else { $summary = "RESULT: $problems problem(s) found. See the red lines above." ; $color = "Red" }
Write-Host $summary -ForegroundColor $color
$lines.Add(""); $lines.Add($summary)
$report = Join-Path $ScriptDir "ED-H1-check-report.txt"
$lines | Out-File -FilePath $report -Encoding utf8
Write-Host "Report saved: $report" -ForegroundColor DarkGray
} finally {
    # always remove the unpacked zip, even if something above failed
    if ($temp) { Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
