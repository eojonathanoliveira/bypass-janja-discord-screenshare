@echo off
title Instalador - Discord WireGuard Call Router
cd /d "%~dp0"
echo ========================================================
echo   Instalador - Discord WireGuard Call Router
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
