# OSTI — Vistoria de imóvel

Monorepo com **backend** (FastAPI + MongoDB) e **frontend** (React + Electron).

## Git e GitHub

Repositório já inicializado na pasta do projeto (`main`).

1. **Autenticar no GitHub (CLI)** — num terminal na pasta do projeto:
   ```bash
   gh auth login
   ```
   Escolha *GitHub.com* → *HTTPS* → autenticação por browser.

2. **Criar o repositório remoto e enviar o código**:
   ```bash
   gh repo create NOME-DO-REPO --public --source=. --remote=origin --push
   ```
   Substitua `NOME-DO-REPO` pelo nome desejado (ex.: `osti-vistoria`).

**Sem a CLI:** crie um repositório vazio em [github.com/new](https://github.com/new), depois:
```bash
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
git push -u origin main
```

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
