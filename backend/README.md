# Backend — API (FastAPI)

## Entrada (ASGI)

| Ficheiro | Função |
|----------|--------|
| **`server.py`** | Único ponto de entrada. Expõe a instância **`app`** (FastAPI) para o Uvicorn. |

Comando equivalente ao que o Render usa (a partir da pasta `backend`):

```bash
uvicorn server:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips=*
```

Se o deploy na raiz do monorepo: `cd backend && uvicorn server:app ...` (ver `Procfile` na raiz do repositório).

**Erro `gunicorn: command not found` ou `gunicorn your_application.wsgi`:** o serviço está com o arranque por defeito (WSGI). Corrige o **Start Command** no Render ou usa o `render.yaml` / `Procfile` deste repo — **não** uses Gunicorn para esta API (é ASGI).

Localmente (lê `HOST`/`PORT` do `.env`):

```bash
python server.py
```

## Dependências

- **`requirements.txt`** — lista usada pelo Render (`pip install -r requirements.txt`).
- **`requirements-run.txt`** — contém `-r requirements.txt` (scripts locais / `run-local.bat`).

## Variáveis de ambiente (produção / Render)

Definir no painel do serviço (não commitar secrets):

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `MONGO_URL` | Sim (API com BD) | URI MongoDB (ex.: Atlas `mongodb+srv://...`). |
| `CORS_ORIGINS` | Recomendado | Origens do frontend, separadas por vírgula (`https://app.exemplo.com`). |
| `DB_NAME` | Opcional | Nome da base (default `test_database`). |
| `ENVIRONMENT` | Recomendado | `production` |
| `BEHIND_PROXY` | Recomendado | `true` atrás do proxy Render. |
| `PORT` | Automático | O Render injeta; não sobrescrever manualmente. |

Ver também `/.env.example`.

## Health check

- **`GET /health`** — na raiz (uso em load balancers / Render).
- **`GET /api/health`** — mesmo tipo de informação sob o prefixo `/api`.

## Python

- **`runtime.txt`** — `python-3.12.8` (alinhado com o [Render](https://render.com/docs/python-version)).
