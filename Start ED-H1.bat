@echo off
title ED-H1
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\Run-EDH1.ps1"
if errorlevel 1 (
  echo.
  echo ED-H1 stopped because of a problem. Please read the message above.
  pause
)
