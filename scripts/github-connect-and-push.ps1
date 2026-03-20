# Connects project to GitHub and pushes branch main.
# Prerequisite: gh auth login   OR   GITHUB_TOKEN + gh auth login --with-token

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $RepoRoot

$RepoName = if ($env:GITHUB_REPO) { $env:GITHUB_REPO } else { "osti-vistoria" }

$authOk = $false
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    $authOk = $true
}
elseif ($env:GITHUB_TOKEN) {
    Write-Host "Using GITHUB_TOKEN for gh auth..."
    $env:GITHUB_TOKEN | gh auth login --hostname github.com --with-token 2>$null
    gh auth status 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $authOk = $true }
}

if (-not $authOk) {
    Write-Host ""
    Write-Host "=== GitHub: not logged in ===" -ForegroundColor Yellow
    Write-Host "Option A (browser):"
    Write-Host "  gh auth login -h github.com -p https -w"
    Write-Host ""
    Write-Host "Option B (classic PAT with repo scope):"
    Write-Host '  $env:GITHUB_TOKEN = "ghp_xxxxxxxx"'
    Write-Host '  echo $env:GITHUB_TOKEN | gh auth login --hostname github.com --with-token'
    Write-Host ""
    Write-Host "Then run again:"
    Write-Host "  .\scripts\github-connect-and-push.ps1"
    Write-Host ""
    exit 1
}

$login = (gh api user -q .login).Trim()
if (-not $login) {
    Write-Error "Could not get GitHub user (gh api user)."
}

$fullName = "$login/$RepoName"
$exists = $false
gh repo view $fullName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $exists = $true }

git branch -M main
git remote remove origin 2>$null

if (-not $exists) {
    Write-Host "Creating public repo $fullName and pushing..."
    gh repo create $RepoName --public --description "OSTI vistoria - FastAPI + React" --source=. --remote=origin --push
} else {
    Write-Host "Remote repo exists; setting origin and push..."
    git remote remove origin 2>$null
    $remoteUrl = "https://github.com/$fullName.git"
    git remote add origin $remoteUrl
    Write-Host "Remote origin -> $remoteUrl"
    git push -u origin main
}

Write-Host ""
Write-Host "Done: https://github.com/$fullName" -ForegroundColor Green
