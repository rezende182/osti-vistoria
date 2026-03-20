@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [Frontend] Pasta: %CD%
where yarn >nul 2>&1
if %ERRORLEVEL% equ 0 (
  echo [Frontend] yarn install...
  call yarn install
  echo [Frontend] http://127.0.0.1:3000
  call yarn start
) else (
  echo [Frontend] npm install...
  call npm install
  echo [Frontend] http://127.0.0.1:3000
  call npm start
)
pause
