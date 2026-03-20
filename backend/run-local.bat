@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [Backend] Pasta: %CD%

where python >nul 2>&1
if %ERRORLEVEL% equ 0 (set "PY=python") else (set "PY=py -3")

echo [Backend] Instalando dependencias: requirements-run.txt
%PY% -m pip install -r requirements-run.txt -q
if errorlevel 1 (
  echo ERRO: pip falhou. Verifique Python instalado e no PATH.
  pause
  exit /b 1
)

echo [Backend] HOST/PORT e demais opcoes vêm de backend\.env ^(ou variáveis de ambiente^)
echo [Backend] Requer MongoDB acessível em MONGO_URL
%PY% server.py
pause
