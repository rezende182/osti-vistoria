@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Gerando instalador e .exe portatil (pode levar alguns minutos)...
call npm run electron:pack
echo.
echo Saida em: %CD%\dist-electron
dir /b "dist-electron\*.exe" 2>nul
pause
