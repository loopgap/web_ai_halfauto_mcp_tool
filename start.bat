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
echo     3  Build Release             LTO Optimized
echo.
echo   CI / CD
echo     4  Commit Changes            Husky + Commitizen
echo     5  Code Review               TS + Cargo Check
echo     6  CI Pipeline               Clean + Check + Build
echo.
echo   Operations
echo     7  System Doctor             Diagnostic
echo     8  Clean Cache               Target / Dist
echo     9  Reset Workspace           Prune node_modules
echo.
echo     0  Exit
echo   --------------------------------------------------
echo.
set /p choice="  Select [0-9]: "

if "%choice%"=="1" goto start_dev
if "%choice%"=="2" goto start_fe
if "%choice%"=="3" goto build_release
if "%choice%"=="4" goto git_commit
if "%choice%"=="5" goto code_review
if "%choice%"=="6" goto ci_pipeline
if "%choice%"=="7" goto doctor
if "%choice%"=="8" goto clean_cache
if "%choice%"=="9" goto reset_deps
if "%choice%"=="0" goto quit
goto menu


:start_dev
cls
echo.
echo   [*] Starting Fullstack Dev Server...
echo.
if not exist node_modules (
    echo   [+] Installing dependencies...
    call npm install --no-fund --no-audit
)
set "CARGO_INCREMENTAL=1"
set "RUST_BACKTRACE=0"
set "CARGO_PROFILE_DEV_DEBUG=0"
set "CARGO_PROFILE_DEV_SPLIT_DEBUGINFO=unpacked"
where pwsh >nul 2>&1
if %ERRORLEVEL% equ 0 (
    pwsh -ExecutionPolicy Bypass -NoLogo -NoProfile -File "%~dp0scripts\dev.ps1"
) else (
    powershell -ExecutionPolicy Bypass -NoLogo -NoProfile -File "%~dp0scripts\dev.ps1"
)
goto quit


:start_fe
cls
echo.
echo   [*] Starting Frontend Sandbox...
echo.
call npm run start:fe
pause
goto menu


:build_release
cls
echo.
echo   [*] Building Production Release (LTO)...
echo   [*] This may take several minutes.
echo.
set "CARGO_PROFILE_RELEASE_LTO=true"
set "CARGO_PROFILE_RELEASE_PANIC=abort"
set "CARGO_PROFILE_RELEASE_OPT_LEVEL=s"
set "CARGO_PROFILE_RELEASE_STRIP=debuginfo"
call npm run tauri build
if %ERRORLEVEL% equ 0 (
    echo.
    echo   [OK] Build successful. Output in src-tauri\target\release
) else (
    echo.
    echo   [FAIL] Build failed. Check errors above.
)
pause
goto menu


:git_commit
cls
echo.
echo   [*] Starting Git Commit Flow...
echo.
call npm run git:commit
pause
goto menu


:code_review
cls
echo.
echo   [*] Running Code Review...
echo.
echo   [1/3] TypeScript type check...
call npm run check:ts
if %ERRORLEVEL% neq 0 (
    echo   [FAIL] TypeScript check failed.
    pause
    goto menu
)
echo   [2/3] Cargo check...
cd src-tauri
cargo check
if %ERRORLEVEL% neq 0 (
    cd ..
    echo   [FAIL] Cargo check failed.
    pause
    goto menu
)
cd ..
echo   [3/3] Governance check...
call npm run ci:governance
echo.
echo   [OK] All checks passed.
pause
goto menu


:ci_pipeline
cls
echo.
echo   [*] Running Full CI Pipeline...
echo.
echo   [1/4] Cleaning build artifacts...
if exist "src-tauri\target" rmdir /s /q "src-tauri\target"
if exist "dist" rmdir /s /q "dist"
echo   [2/4] TypeScript check...
call npm run check:ts
if %ERRORLEVEL% neq 0 (
    echo   [FAIL] TypeScript check failed.
    pause
    goto menu
)
echo   [3/4] Cargo check...
cd src-tauri
cargo check
if %ERRORLEVEL% neq 0 (
    cd ..
    echo   [FAIL] Cargo check failed.
    pause
    goto menu
)
cd ..
echo   [4/4] Building release...
set "CARGO_PROFILE_RELEASE_LTO=true"
set "CARGO_PROFILE_RELEASE_OPT_LEVEL=s"
set "CARGO_PROFILE_RELEASE_STRIP=debuginfo"
call npm run tauri build
if %ERRORLEVEL% equ 0 (
    echo.
    echo   [OK] Pipeline completed successfully.
) else (
    echo.
    echo   [FAIL] Build step failed.
)
pause
goto menu


:doctor
cls
echo.
echo   [*] Running System Doctor...
echo.
where pwsh >nul 2>&1
if %ERRORLEVEL% equ 0 (
    pwsh -ExecutionPolicy Bypass -NoLogo -NoProfile -File "%~dp0scripts\doctor.ps1" -Fix
) else (
    powershell -ExecutionPolicy Bypass -NoLogo -NoProfile -File "%~dp0scripts\doctor.ps1" -Fix
)
pause
goto menu


:clean_cache
cls
echo.
echo   [*] Cleaning caches...
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"
if exist "dist" rmdir /s /q "dist"
if exist "src-tauri\target" rmdir /s /q "src-tauri\target"
call npm run clean:all 2>nul
echo   [OK] Cleaned.
pause
goto menu


:reset_deps
cls
echo.
echo   [*] Resetting workspace...
echo   [1/3] Removing node_modules...
if exist "node_modules" rmdir /s /q node_modules
echo   [2/3] Removing package-lock.json...
if exist "package-lock.json" del /q package-lock.json
echo   [3/3] Reinstalling...
call npm install
call npm run hooks:install 2>nul
echo   [OK] Reset complete.
pause
goto menu


:quit
echo.
echo   Session ended.
timeout /t 1 >nul
