# OSTI — Vistoria de imóvel

Monorepo com **backend** (FastAPI + MongoDB) e **frontend** (React + Electron).

## Git e GitHub

Repositório inicializado na branch `main`.

### Enviar tudo para o GitHub (recomendado)

1. Autenticar **uma vez** (browser):
   ```powershell
   gh auth login -h github.com -p https -w
   ```
2. Na pasta do projeto, executar:
   ```powershell
   .\push-github.bat
   ```
   ou:
   ```powershell
   .\scripts\github-connect-and-push.ps1
   ```
   Por defeito o repositório remoto chama-se `osti-vistoria`. Para outro nome:
   ```powershell
   $env:GITHUB_REPO = "meu-nome-repo"; .\scripts\github-connect-and-push.ps1
   ```

**Com Personal Access Token (sem browser):** crie um [classic PAT](https://github.com/settings/tokens) com scope `repo`, depois:
```powershell
$env:GITHUB_TOKEN = "ghp_xxxxxxxx"
echo $env:GITHUB_TOKEN | gh auth login --hostname github.com --with-token
.\scripts\github-connect-and-push.ps1
```

**Manual:** repositório vazio em [github.com/new](https://github.com/new), depois `git remote add origin …` e `git push -u origin main`.

### Ajustar autor dos commits (recomendado)

```bash
git config --local user.name "Seu Nome"
git config --local user.email "seu-email@exemplo.com"
```

## Arranque local

- `start.bat` — backend + frontend (Electron).
- Backend: `backend/run-local.bat` ou `python server.py` dentro de `backend/`.
- Frontend: `frontend/run-desktop.bat` ou `npm run desktop` em `frontend/`.

Ficheiros `.env` não são versionados; use `backend/.env.example` como modelo.
