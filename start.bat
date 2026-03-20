@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"
title OSTI - Iniciando app

echo Abrindo backend (nova janela)...
start "OSTI Backend (127.0.0.1:5000)" cmd /k "%ROOT%backend\run-local.bat"

echo Aguardando o backend subir...
timeout /t 4 /nobreak >nul

echo Abrindo frontend + janela Electron (sem navegador)...
start "OSTI Desktop (React + Electron)" cmd /k "%ROOT%frontend\run-desktop.bat"

echo.
echo Pronto. Feche esta janela ou deixe aberta como lembrete.
echo Backend: http://127.0.0.1:5000  ^|  App: Electron em http://127.0.0.1:3000
pause
