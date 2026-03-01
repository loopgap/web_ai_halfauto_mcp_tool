@echo off
chcp 65001 >nul 2>&1
title AI Workbench - 环境诊断
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%USERPROFILE%\.cargo\bin;%APPDATA%\npm;C:\Program Files\PowerShell\7;%PATH%"

where pwsh >nul 2>&1
if %ERRORLEVEL% equ 0 (
    pwsh -ExecutionPolicy Bypass -File "%~dp0scripts\doctor.ps1" %*
) else (
    powershell -ExecutionPolicy Bypass -File "%~dp0scripts\doctor.ps1" %*
)
echo.
pause
