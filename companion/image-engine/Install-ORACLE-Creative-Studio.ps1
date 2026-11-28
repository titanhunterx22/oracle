$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "  ORACLE CREATIVE STUDIO - LOCAL IMAGE ENGINE" -ForegroundColor Cyan
Write-Host "  OpenVINO GenAI / Intel GPU + CPU fallback" -ForegroundColor DarkCyan
Write-Host ""

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Python was not found. Install 64-bit Python 3.11 or 3.12 from https://www.python.org/downloads/windows/ and enable the Python Launcher, then run this installer again."
}
$PythonVersion = $null
foreach ($Candidate in @("3.11", "3.12")) {
    try {
        $Probe = & py "-$Candidate" -c "import sys, struct; print(sys.version_info.major, sys.version_info.minor, struct.calcsize('P') * 8)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $Probe -match "64$") { $PythonVersion = $Candidate; break }
    } catch {}
}
if (-not $PythonVersion) {
    throw "A 64-bit Python 3.11 or 3.12 installation is required. Install one from https://www.python.org/downloads/windows/ and run this installer again."
}
$InstallRoot = Join-Path $env:LOCALAPPDATA "Programs\ORACLE Creative Studio"
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
Copy-Item -Force (Join-Path $PSScriptRoot "server.py") (Join-Path $InstallRoot "server.py")
Copy-Item -Force (Join-Path $PSScriptRoot "requirements.txt") (Join-Path $InstallRoot "requirements.txt")
Copy-Item -Force (Join-Path $PSScriptRoot "Start-ORACLE-Creative-Studio.ps1") (Join-Path $InstallRoot "Start-ORACLE-Creative-Studio.ps1")
$Venv = Join-Path $InstallRoot ".venv"
$VenvPython = Join-Path $Venv "Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "Creating a private Python environment…" -ForegroundColor Cyan
    & py "-$PythonVersion" -m venv $Venv
    if ($LASTEXITCODE -ne 0) { throw "Could not create the Python environment." }
}
Write-Host "Installing OpenVINO GenAI and image dependencies…" -ForegroundColor Cyan
& $VenvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Could not upgrade pip." }
& $VenvPython -m pip install -r (Join-Path $InstallRoot "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Package installation failed. Check the error above, then run this installer again." }
$ShortcutRoot = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $ShortcutRoot "ORACLE Creative Studio.lnk"))
$Shortcut.TargetPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$Shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $InstallRoot "Start-ORACLE-Creative-Studio.ps1") + '"'
$Shortcut.WorkingDirectory = $InstallRoot
$Shortcut.Description = "Start the private ORACLE local image-generation engine"
$Shortcut.Save()
Write-Host ""
Write-Host "Installation complete." -ForegroundColor Green
Write-Host "The image model has NOT been downloaded yet. ORACLE downloads it only when you choose Prepare local engine in Creative Studio."
Write-Host "Start the service from Start Menu -> ORACLE Creative Studio, then open the ORACLE dashboard in Edge."
Write-Host "Installed to: $InstallRoot"
