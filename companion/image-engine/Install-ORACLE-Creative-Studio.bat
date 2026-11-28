@echo off
setlocal
title ORACLE Creative Studio Installer
echo.
echo  ORACLE CREATIVE STUDIO - INSTALLER
echo  Self-contained Windows image engine - Python is not required.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-ORACLE-Creative-Studio.ps1"
set "ORACLE_INSTALL_EXIT=%ERRORLEVEL%"
echo.
if not "%ORACLE_INSTALL_EXIT%"=="0" (
  echo Installation did not complete. Read the error above.
  pause
  exit /b %ORACLE_INSTALL_EXIT%
)
echo Installation completed. You can now open ORACLE Creative Studio from the Windows Start Menu.
pause
exit /b 0
