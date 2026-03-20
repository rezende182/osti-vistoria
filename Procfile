# Raiz do repo: Render usa isto se Root Directory = (vazio).
# FastAPI (ASGI) — NÃO usar gunicorn/wsgi.
web: cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips=*
