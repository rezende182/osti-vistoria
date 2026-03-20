@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [Desktop] React (127.0.0.1:3000) + Electron — sem navegador
where yarn >nul 2>&1
if %ERRORLEVEL% equ 0 (
  call yarn desktop
) else (
  call npm run desktop
)
pause
