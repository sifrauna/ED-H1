# ED-H1 first-run setup. Safe to run again: it only installs what is missing.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$Root    = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$VenvDir = Join-Path $Backend ".venv"
$VenvPy  = Join-Path $VenvDir "Scripts\python.exe"
$Marker  = Join-Path $PSScriptRoot ".setup_done"

Say "Setting up ED-H1. This needs an internet connection and may take several minutes."

# ---------- 1. Python ----------
$py = Get-PythonExe
if (-not $py) {
    Say "Installing Python..."
    $ok = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install -e --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
        $ok = ($LASTEXITCODE -eq 0)
    }
    if (-not $ok) {
        $installer = Join-Path $env:TEMP "python-3.12.8-amd64.exe"
        Invoke-WebRequest "https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe" -OutFile $installer
        Start-Process $installer -ArgumentList "/quiet", "InstallAllUsers=0", "PrependPath=1", "Include_launcher=1" -Wait
    }
    Refresh-Path
    $py = Get-PythonExe
    if (-not $py) { throw "Python was installed but could not be found. Close this window and run Start ED-H1.bat again." }
}
Say "Python ready: $py"

# ---------- 2. Ollama ----------
if (-not (Get-OllamaExe)) {
    Say "Installing Ollama (the local AI engine)..."
    $ok = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install -e --id Ollama.Ollama --silent --accept-package-agreements --accept-source-agreements
        $ok = ($LASTEXITCODE -eq 0)
    }
    if (-not $ok) {
        $installer = Join-Path $env:TEMP "OllamaSetup.exe"
        Invoke-WebRequest "https://ollama.com/download/OllamaSetup.exe" -OutFile $installer
        Start-Process $installer -ArgumentList "/SILENT" -Wait
    }
    Refresh-Path
    if (-not (Get-OllamaExe)) { throw "Ollama was installed but could not be found. Close this window and run Start ED-H1.bat again." }
}
Say "Ollama ready: $(Get-OllamaExe)"

# ---------- 3. Backend environment ----------
if (-not (Test-Path $VenvPy)) {
    Say "Creating the backend environment..."
    & $py -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) { throw "Could not create the Python environment." }
}
Say "Installing backend packages..."
& $VenvPy -m pip install --upgrade pip --quiet
& $VenvPy -m pip install -r (Join-Path $Backend "requirements.txt") --quiet
if ($LASTEXITCODE -ne 0) { throw "Installing the backend packages failed. Check your internet connection and try again." }

# ---------- 4. Desktop shortcut ----------
try {
    $desktop = [Environment]::GetFolderPath("Desktop")
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut((Join-Path $desktop "ED-H1.lnk"))
    $lnk.TargetPath = Join-Path $Root "Start ED-H1.bat"
    $lnk.WorkingDirectory = $Root
    $lnk.Description = "Start ED-H1"
    $ico = Join-Path $PSScriptRoot "ED-H1.ico"
    if (Test-Path $ico) { $lnk.IconLocation = $ico }
    $lnk.Save()
} catch {
    Warn "Could not create the desktop shortcut (not important)."
}

Set-Content -Path $Marker -Value (Get-Date).ToString("s")
Say "Setup finished."
