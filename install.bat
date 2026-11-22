@echo off
title Instalador - Bypass Janja Discord Screenshare
cd /d "%~dp0"

:: Verificar se esta executando como Administrador para auto-elevacao
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando privilegios de administrador para configurar o WireGuard...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c `\"%~f0`\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   Bypass Janja Discord Screenshare - Instalador Vencord
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
