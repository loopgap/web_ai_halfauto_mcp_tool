@echo off
chcp 65001 >nul 2>&1
title AI Workbench CLI
cd /d %~dp0

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo   [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b
)

:menu
cls
echo.
echo   AI WORKBENCH
echo   --------------------------------------------------
echo   Tauri 2.x / Rust / React     Status: Ready
echo   --------------------------------------------------
echo.
echo   Build ^& Dev
echo     1  Start Fullstack Dev       Rust + React
echo     2  Start Frontend Sandbox    UI Dev Only
echo     3  Build Release             Current Platform
echo.
echo   CI / CD
echo     4  Install Git Hooks         Enable local gates
echo     5  Local Fast Gate           Pre-commit grade checks
echo     6  Local CI Gate             TS + Rust + Governance + Clippy
echo     7  Linux Preflight           Static parity with Linux workflows
echo     8  Release Preflight         Local CI + Tauri Bundle
echo.
echo   Operations
echo     9  System Doctor             Diagnostic
echo     A  Clean Cache               Target / Dist
echo     B  Reset Workspace           Reinstall deps
echo.
echo     0  Exit
echo   --------------------------------------------------
echo.
set /p choice="  Select [0-9,A-B]: "

if "%choice%"=="1" goto start_dev
if "%choice%"=="2" goto start_fe
if "%choice%"=="3" goto build_release
if "%choice%"=="4" goto install_hooks
if "%choice%"=="5" goto fast_gate
if "%choice%"=="6" goto code_review
if "%choice%"=="7" goto linux_preflight
if "%choice%"=="8" goto ci_pipeline
if "%choice%"=="9" goto doctor
if /I "%choice%"=="A" goto clean_cache
if /I "%choice%"=="B" goto reset_deps
if "%choice%"=="0" goto quit
goto menu


:start_dev
cls
echo.
echo   [*] Starting Fullstack Dev Server...
echo.
call node scripts\dev.mjs
pause
goto menu


:start_fe
cls
echo.
echo   [*] Starting Frontend Sandbox...
echo.
call node scripts\dev.mjs --frontend
pause
goto menu


:build_release
cls
echo.
echo   [*] Building Current Platform Release...
echo.
call node scripts\build.mjs
if %ERRORLEVEL% equ 0 (
    echo.
    echo   [OK] Build successful.
) else (
    echo.
    echo   [FAIL] Build failed.
)
pause
goto menu


:install_hooks
cls
echo.
echo   [*] Installing Git Hooks...
echo.
call node scripts\install-hooks.mjs
pause
goto menu


:fast_gate
cls
echo.
echo   [*] Running Local Fast Gate...
echo.
call node scripts\ci-local.mjs --fast
if %ERRORLEVEL% equ 0 (
    echo.
    echo   [OK] Local fast gate passed.
) else (
    echo.
    echo   [FAIL] Local fast gate failed.
)
pause
goto menu


:code_review
cls
echo.
echo   [*] Running Local CI Gate...
echo.
call node scripts\ci-local.mjs
if %ERRORLEVEL% equ 0 (
    echo.
    echo   [OK] Local CI gate passed.
) else (
    echo.
    echo   [FAIL] Local CI gate failed.
)
pause
goto menu


:linux_preflight
cls
echo.
echo   [*] Running Linux Preflight...
echo.
call node scripts\ci-linux.mjs
if %ERRORLEVEL% equ 0 (
    echo.
    echo   [OK] Linux preflight passed.
) else (
    echo.
    echo   [FAIL] Linux preflight failed.
)
pause
goto menu


:ci_pipeline
cls
echo.
echo   [*] Running Release Preflight...
echo.
call node scripts\release-preflight.mjs
if %ERRORLEVEL% equ 0 (
    echo.
    echo   [OK] Release preflight passed.
) else (
    echo.
    echo   [FAIL] Release preflight failed.
)
pause
goto menu


:doctor
cls
echo.
echo   [*] Running System Doctor...
echo.
call node scripts\doctor.mjs --fix
pause
goto menu


:clean_cache
cls
echo.
echo   [*] Cleaning caches...
echo.
call node scripts\clean.mjs hard
if %ERRORLEVEL% equ 0 (
    echo   [OK] Cleaned.
) else (
    echo   [FAIL] Clean failed.
)
pause
goto menu


:reset_deps
cls
echo.
echo   [*] Resetting workspace...
echo.
call node scripts\clean.mjs full
if %ERRORLEVEL% neq 0 (
    echo   [FAIL] Clean failed.
    pause
    goto menu
)
call node scripts\bootstrap.mjs --skip-ci
if %ERRORLEVEL% neq 0 (
    echo   [FAIL] Bootstrap failed.
    pause
    goto menu
)
echo   [OK] Reset complete.
pause
goto menu


:quit
echo.
echo   Session ended.
timeout /t 1 >nul
