@echo off
chcp 65001 >nul 2>&1
title AI Workbench - 一键启动
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   AI Workbench 一键启动                  ║
echo  ║   双击即可运行，无需任何配置               ║
echo  ╚══════════════════════════════════════════╝
echo.

:: 切换到脚本所在目录 (项目根目录)
cd /d "%~dp0"

:: ── 修复 PATH ──
set "PATH=C:\Program Files\nodejs;%USERPROFILE%\.cargo\bin;%APPDATA%\npm;C:\Program Files\PowerShell\7;%PATH%"

:: ── 检查 PowerShell 7 ──
where pwsh >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  使用 PowerShell 7 启动...
    echo.
    pwsh -ExecutionPolicy Bypass -File "%~dp0scripts\dev.ps1"
    goto :end
)

:: ── 回退到 PowerShell 5.1 ──
where powershell >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  使用 PowerShell 5.1 启动...
    echo.
    powershell -ExecutionPolicy Bypass -File "%~dp0scripts\dev.ps1"
    goto :end
)

:: ── 直接尝试 npm ──
echo  PowerShell 不可用，尝试直接启动...
echo.
where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    if not exist node_modules (
        echo  安装依赖...
        call npm install
    )
    echo  启动开发服务器...
    call npm run tauri dev
    goto :end
)

echo.
echo  ❌ 无法启动：未找到 Node.js
echo.
echo  请安装以下工具后重试:
echo    1. Node.js: https://nodejs.org
echo    2. Rust:    https://rustup.rs
echo.
echo  或运行 PowerShell 脚本:
echo    powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
echo.

:end
echo.
echo  按任意键关闭...
pause >nul
