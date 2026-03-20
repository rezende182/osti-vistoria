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

## Deploy no Render (backend)

**Não** deixes o comando por defeito `gunicorn your_application.wsgi` — este projeto é **FastAPI (ASGI)** com **Uvicorn**.

1. **Recomendado (monorepo na raiz):** deixa **Root Directory** **vazio** (raiz do repo). O Render usa o `Procfile` e o `render.yaml` na raiz, que fazem `cd backend && uvicorn server:app ...`.
2. **Alternativa:** Root Directory = `backend` e **Start Command** =  
   `uvicorn server:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips=*`

No painel do serviço, em **Settings → Build & Deploy**, confirma que o **Start Command** não está a sobrescrever com Gunicorn. Ficheiros: `render.yaml`, `Procfile`, `nixpacks.toml`, `requirements.txt` (raiz) e `backend/requirements.txt`.

Detalhes: [`backend/README.md`](backend/README.md).
