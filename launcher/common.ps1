# ED-H1 shared helpers (ASCII only on purpose: Windows PowerShell 5.1 reads BOM-less files as ANSI)

$ProgressPreference = "SilentlyContinue"   # makes Invoke-WebRequest downloads much faster

function Say([string]$Message)  { Write-Host "[ED-H1] $Message" -ForegroundColor Cyan }
function Warn([string]$Message) { Write-Host "[ED-H1] $Message" -ForegroundColor Yellow }

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Get-PythonExe {
    # Returns the full path of a working Python 3.10+ or $null.
    $candidates = @()
    if (Get-Command py -ErrorAction SilentlyContinue)     { $candidates += ,@("py", "-3") }
    if (Get-Command python -ErrorAction SilentlyContinue) { $candidates += ,@("python") }
    foreach ($c in $candidates) {
        try {
            $extra = @()
            if ($c.Count -gt 1) { $extra = $c[1..($c.Count - 1)] }
            $out = & $c[0] @extra -c "import sys; print(sys.executable if sys.version_info >= (3,10) else '')" 2>$null
            if ($LASTEXITCODE -eq 0 -and $out -and (Test-Path "$out")) { return "$out".Trim() }
        } catch { }
    }
    return $null
}

function Get-OllamaExe {
    $p = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
    if (Test-Path $p) { return $p }
    $c = Get-Command ollama -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    return $null
}

function Test-Ollama {
    try {
        Invoke-RestMethod "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null
        return $true
    } catch { return $false }
}

function Wait-Ollama([int]$Seconds = 40) {
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-Ollama) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-OllamaServer([bool]$CpuOnly = $false) {
    $exe = Get-OllamaExe
    if (-not $exe) { throw "Ollama is not installed." }
    if ($CpuOnly) { $env:CUDA_VISIBLE_DEVICES = "-1" }
    Start-Process -FilePath $exe -ArgumentList "serve" -WindowStyle Hidden
}

function Stop-Ollama {
    Get-Process -Name "ollama*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

function Test-ModelInstalled([string]$Model) {
    try {
        $tags = Invoke-RestMethod "http://127.0.0.1:11434/api/tags" -TimeoutSec 5
        foreach ($m in $tags.models) {
            if ($m.name -eq $Model -or $m.name -eq "$Model`:latest") { return $true }
        }
    } catch { }
    return $false
}

function Test-ModelGenerates([string]$Model) {
    # Loads the model and asks for one token. Fails when the GPU runtime crashes.
    try {
        $body = @{ model = $Model; prompt = "Hi"; stream = $false; options = @{ num_predict = 1 } } | ConvertTo-Json -Depth 5
        Invoke-RestMethod "http://127.0.0.1:11434/api/generate" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 300 | Out-Null
        return $true
    } catch { return $false }
}

function Open-EdApp([string]$Url) {
    # Opens ED-H1 in its own app-style window (no address bar or tabs) using Edge or Chrome.
    $pf86 = ${env:ProgramFiles(x86)}
    $candidates = @(
        (Join-Path $pf86 "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path $pf86 "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
    )
    foreach ($exe in $candidates) {
        if ($exe -and (Test-Path $exe)) {
            Start-Process -FilePath $exe -ArgumentList "--app=$Url"
            return
        }
    }
    Start-Process $Url   # no Edge or Chrome found: normal browser tab
}

function Ensure-Frontend([string]$Root) {
    # Makes sure the web interface (frontend\dist) exists. Release zips already contain it;
    # a source checkout needs Node.js + npm once to build it. Returns $true when it is there.
    $dist = Join-Path $Root "frontend\dist\index.html"
    if (Test-Path $dist) { return $true }
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        Warn "The web interface (frontend\dist) is missing and Node.js is not installed, so the page will show 'Not Found'."
        Warn "Install Node.js LTS from https://nodejs.org, or use the release zip that already contains it."
        return $false
    }
    Say "Building the web interface (first run only, a few minutes)..."
    Push-Location (Join-Path $Root "frontend")
    try {
        if (-not (Test-Path "node_modules")) { & npm install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw "npm install failed." } }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed." }
    } catch {
        Warn "Could not build the web interface: $($_.Exception.Message)"
        return $false
    } finally { Pop-Location }
    return (Test-Path $dist)
}

function Ensure-Words([string]$Backend) {
    # Scrabble word list. Optional: without it the game accepts any 2+ letter word. Needs internet once.
    $dir  = Join-Path $Backend "data"
    $file = Join-Path $dir "words.txt"
    if (Test-Path $file) { return }
    try {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Say "Downloading the Scrabble word list (once)..."
        Invoke-WebRequest "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt" -OutFile $file -TimeoutSec 60
    } catch {
        if (Test-Path $file) { Remove-Item $file -Force -ErrorAction SilentlyContinue }
        Warn "Could not download the word list (not important). Scrabble will accept any word until it is available."
    }
}
