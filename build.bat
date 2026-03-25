@echo off
chcp 65001 >nul 2>&1
title AI Workbench - 生产构建
cd /d "%~dp0"
node scripts\build.mjs %*
echo.
pause
