$ErrorActionPreference = "Stop"
$EngineExe = Join-Path $PSScriptRoot "ORACLE-Creative-Studio\ORACLE-Creative-Studio.exe"
if (-not (Test-Path $EngineExe)) {
    throw "ORACLE Creative Studio is not installed correctly. Run Install-ORACLE-Creative-Studio.ps1 again."
}
Write-Host "Starting ORACLE Creative Studio on 127.0.0.1:8765…" -ForegroundColor Cyan
Write-Host "This is a self-contained application; Python does not need to be installed." -ForegroundColor DarkGray
Write-Host "Keep this window open while using image generation. Press Ctrl+C to stop." -ForegroundColor DarkGray
& $EngineExe
