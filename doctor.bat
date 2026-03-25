@echo off
chcp 65001 >nul 2>&1
title AI Workbench - 环境诊断
cd /d "%~dp0"
node scripts\doctor.mjs %*
echo.
pause
