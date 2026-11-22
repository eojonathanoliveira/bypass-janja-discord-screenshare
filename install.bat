@echo off
title Instalador - Bypass Janja Discord Screenshare
cd /d "%~dp0"
echo ========================================================
echo   Bypass Janja Discord Screenshare - Instalador Vencord
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
