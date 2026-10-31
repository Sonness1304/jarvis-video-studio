@echo off
pwsh -NoProfile -WindowStyle Hidden -File "%~dp0scripts\open-studio.ps1"
if errorlevel 1 (
  echo Studio could not start. See the error above or .runtime\studio\launcher logs.
  pause
  exit /b 1
)
exit /b 0
