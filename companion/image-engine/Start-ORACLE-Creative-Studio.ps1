$ErrorActionPreference = "Stop"
$Python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$Server = Join-Path $PSScriptRoot "server.py"
if (-not (Test-Path $Python) -or -not (Test-Path $Server)) {
    throw "ORACLE Creative Studio is not installed correctly. Run Install-ORACLE-Creative-Studio.ps1 again."
}
Write-Host "Starting ORACLE Creative Studio on 127.0.0.1:8765…" -ForegroundColor Cyan
Write-Host "Keep this window open while generating images. Press Ctrl+C to stop." -ForegroundColor DarkGray
& $Python $Server
