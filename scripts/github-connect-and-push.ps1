# Conecta o projeto ao GitHub e faz push da branch main.
# Pré-requisito (um dos dois):
#   1) gh auth login
#   2) $env:GITHUB_TOKEN = "ghp_..."  (classic PAT com repo) e depois:
#        echo $env:GITHUB_TOKEN | gh auth login --hostname github.com --with-token

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $RepoRoot

$RepoName = if ($env:GITHUB_REPO) { $env:GITHUB_REPO } else { "osti-vistoria" }

# Autenticação
$authOk = $false
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    $authOk = $true
}
elseif ($env:GITHUB_TOKEN) {
    Write-Host "A usar GITHUB_TOKEN para autenticar o gh..."
    $env:GITHUB_TOKEN | gh auth login --hostname github.com --with-token 2>$null
    gh auth status 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $authOk = $true }
}

if (-not $authOk) {
    Write-Host ""
    Write-Host "=== GitHub: ainda não autenticado ===" -ForegroundColor Yellow
    Write-Host "Opção A — browser (recomendado):"
    Write-Host "  gh auth login -h github.com -p https -w"
    Write-Host ""
    Write-Host "Opção B — token (classic PAT com scope 'repo'):"
    Write-Host '  $env:GITHUB_TOKEN = "ghp_xxxxxxxx"  # PowerShell'
    Write-Host '  echo $env:GITHUB_TOKEN | gh auth login --hostname github.com --with-token'
    Write-Host ""
    Write-Host "Depois execute de novo:"
    Write-Host "  .\scripts\github-connect-and-push.ps1"
    Write-Host ""
    exit 1
}

$login = (gh api user -q .login).Trim()
if (-not $login) {
    Write-Error "Não foi possível obter o utilizador GitHub (gh api user)."
}

$fullName = "$login/$RepoName"
$exists = $false
gh repo view $fullName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $exists = $true }

if (-not $exists) {
    Write-Host "A criar repositório público $fullName ..."
    gh repo create $RepoName --public --description "OSTI — Vistoria de imóvel (FastAPI + React)" --confirm
}

git remote remove origin 2>$null
$remoteUrl = "https://github.com/$fullName.git"
git remote add origin $remoteUrl
Write-Host "Remote origin -> $remoteUrl"

git branch -M main
git push -u origin main

Write-Host ""
Write-Host "Concluído: https://github.com/$fullName" -ForegroundColor Green
