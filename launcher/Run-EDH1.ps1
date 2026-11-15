# ED-H1 launcher. Double-click "Start ED-H1.bat" to run this.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$Root    = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$VenvPy  = Join-Path $Backend ".venv\Scripts\python.exe"
$Marker  = Join-Path $PSScriptRoot ".setup_done"
$Port    = 8000
$Url     = "http://127.0.0.1:$Port"

try {
    Write-Host ""
    Write-Host "  ED-H1 - your personal AI companion" -ForegroundColor Green
    Write-Host "  Keep this window open while you use ED-H1. Close it to stop." -ForegroundColor DarkGray
    Write-Host ""

    # ---------- first-run setup ----------
    if (-not (Test-Path $Marker) -or -not (Test-Path $VenvPy) -or -not (Get-OllamaExe)) {
        & (Join-Path $PSScriptRoot "Setup-EDH1.ps1")
    }

    # ---------- already running? ----------
    $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listening) {
        try {
            $h = Invoke-RestMethod "$Url/api/health" -TimeoutSec 3
            if ($h.engine -eq "ED-H1") {
                Say "ED-H1 is already running. Opening it."
                Open-EdApp $Url
                return
            }
        } catch { }
        throw "Port $Port is used by another program. Close it and start ED-H1 again."
    }

    # ---------- which model ----------
    $Model = "llama3.2:3b"
    $modelFile = Join-Path $PSScriptRoot "model.txt"
    if (Test-Path $modelFile) {
        $line = (Get-Content $modelFile -TotalCount 1)
        if ($line -and $line.Trim()) { $Model = $line.Trim() }
    }

    # ---------- Ollama ----------
    if (-not (Test-Ollama)) {
        Say "Starting the AI engine (Ollama)..."
        Start-OllamaServer
        if (-not (Wait-Ollama 40)) { throw "Ollama did not start. Try restarting your PC, then run ED-H1 again." }
    }

    if (-not (Test-ModelInstalled $Model)) {
        Say "Downloading the AI model $Model. This happens once and can take a while..."
        & (Get-OllamaExe) pull $Model
        if ($LASTEXITCODE -ne 0) { throw "Downloading the model failed. Check your internet connection and try again." }
    }

    Say "Loading the AI model (first reply is slower)..."
    if (-not (Test-ModelGenerates $Model)) {
        Warn "The graphics driver could not run the model. Switching to CPU mode (slower but works)."
        Stop-Ollama
        Start-OllamaServer $true
        if (-not (Wait-Ollama 40)) { throw "Ollama did not restart in CPU mode." }
        if (-not (Test-ModelGenerates $Model)) {
            Warn "The model still could not respond. ED-H1 will open, but replies may fail. Try a smaller model: put llama3.2:1b in launcher\model.txt"
        }
    }

    # ---------- backend + web interface ----------
    [void](Ensure-Frontend $Root)
    Ensure-Words $Backend   # downloads backend\data\words.txt for Scrabble (optional, once)

    # Once a day: keep the backend packages and yt-dlp current (YouTube changes often and breaks old yt-dlp).
    $stamp = Join-Path $PSScriptRoot ".update_stamp"
    $today = (Get-Date).ToString("yyyy-MM-dd")
    if (-not (Test-Path $stamp) -or ((Get-Content $stamp -TotalCount 1) -ne $today)) {
        Say "Checking for updates to the music and document tools..."
        try {
            & $VenvPy -m pip install -r (Join-Path $Backend "requirements.txt") --quiet
            & $VenvPy -m pip install -U yt-dlp --quiet
            Set-Content -Path $stamp -Value $today
        } catch { Warn "Could not check for updates (not important)." }
    }

    $env:OLLAMA_MODEL = $Model
    $env:Path = (Join-Path $Backend ".venv\Scripts") + ";" + $env:Path   # so the music feature finds yt-dlp

    Say "Starting ED-H1..."
    $server = Start-Process -FilePath $VenvPy `
        -ArgumentList @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "$Port") `
        -WorkingDirectory $Backend -NoNewWindow -PassThru

    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        if ($server.HasExited) { throw "The ED-H1 backend stopped unexpectedly. See the messages above." }
        try {
            Invoke-RestMethod "$Url/api/health" -TimeoutSec 2 | Out-Null
            $ready = $true
            break
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw "The ED-H1 backend did not start in time." }

    Say "ED-H1 is ready at $Url"
    Open-EdApp $Url
    $server.WaitForExit()
}
catch {
    Write-Host ""
    Write-Host "[ED-H1] Problem: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
