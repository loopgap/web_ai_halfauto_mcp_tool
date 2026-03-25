@echo off
chcp 65001 >nul 2>&1
title AI Workbench - 环境配置
cd /d "%~dp0"
node scripts\bootstrap.mjs %*
echo.
pause
