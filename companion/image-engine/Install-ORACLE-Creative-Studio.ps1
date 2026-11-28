$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ORACLE CREATIVE STUDIO - SELF-CONTAINED WINDOWS ENGINE" -ForegroundColor Cyan
Write-Host "  OpenVINO GenAI / Intel GPU with CPU fallback" -ForegroundColor DarkCyan
Write-Host ""

$PayloadEngine = Join-Path $PSScriptRoot "ORACLE-Creative-Studio"
$PayloadExe = Join-Path $PayloadEngine "ORACLE-Creative-Studio.exe"
if (-not (Test-Path $PayloadExe)) {
    throw "The bundled image engine is missing. Extract the complete ORACLE-Creative-Studio-Engine ZIP before running this installer."
}

$InstallRoot = Join-Path $env:LOCALAPPDATA "Programs\ORACLE Creative Studio"
$InstalledEngine = Join-Path $InstallRoot "ORACLE-Creative-Studio"
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

Write-Host "Copying the self-contained image engine…" -ForegroundColor Cyan
if (Test-Path $InstalledEngine) {
    Remove-Item -LiteralPath $InstalledEngine -Recurse -Force
}
Copy-Item -Path $PayloadEngine -Destination $InstallRoot -Recurse -Force
Copy-Item -Force (Join-Path $PSScriptRoot "Start-ORACLE-Creative-Studio.ps1") (Join-Path $InstallRoot "Start-ORACLE-Creative-Studio.ps1")

$ShortcutRoot = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
New-Item -ItemType Directory -Force -Path $ShortcutRoot | Out-Null
$Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $ShortcutRoot "ORACLE Creative Studio.lnk"))
$Shortcut.TargetPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$Shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $InstallRoot "Start-ORACLE-Creative-Studio.ps1") + '"'
$Shortcut.WorkingDirectory = $InstallRoot
$Shortcut.Description = "Start the private ORACLE local image-generation engine"
$Shortcut.Save()

Write-Host ""
Write-Host "Installation complete." -ForegroundColor Green
Write-Host "No Python installation is required. The application includes its own private runtime and OpenVINO libraries."
Write-Host "The image model has NOT been downloaded yet. ORACLE downloads it only when you choose Prepare local engine in Creative Studio."
Write-Host "Start ORACLE Creative Studio from the Windows Start Menu and leave its window open while generating images."
Write-Host "Your model files and generated images are kept separately under %LOCALAPPDATA%\ORACLE\CreativeStudio."
Write-Host "Installed to: $InstallRoot"

$MissingVCRuntime = @(
    (Join-Path $env:WINDIR "System32\vcruntime140.dll"),
    (Join-Path $env:WINDIR "System32\msvcp140.dll")
) | Where-Object { -not (Test-Path $_) }
if ($MissingVCRuntime.Count -gt 0) {
    Write-Warning "The Microsoft Visual C++ x64 runtime may be missing. If the engine does not start, ask your administrator to install the Microsoft Visual C++ 2015-2022 Redistributable: https://aka.ms/vs/17/release/vc_redist.x64.exe"
}
