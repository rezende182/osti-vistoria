"""
Validação de Firebase ID tokens (firebase-admin).
Configure FIREBASE_ADMIN_CREDENTIALS_JSON (JSON completo da service account, uma linha)
ou GOOGLE_APPLICATION_CREDENTIALS (caminho para o ficheiro JSON).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


def init_firebase_admin() -> bool:
    """Inicializa o SDK uma vez. Retorna False se credenciais em falta."""
    if firebase_admin._apps:
        return True

    raw = os.environ.get("FIREBASE_ADMIN_CREDENTIALS_JSON", "").strip()
    cred: Optional[credentials.Base] = None

    if raw:
        try:
            info = json.loads(raw)
            cred = credentials.Certificate(info)
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            logger.error("FIREBASE_ADMIN_CREDENTIALS_JSON inválido: %s", e)
            return False
    else:
        path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
        if path and os.path.isfile(path):
            cred = credentials.Certificate(path)

    if cred is None:
        logger.warning(
            "Firebase Admin não inicializado: defina FIREBASE_ADMIN_CREDENTIALS_JSON "
            "ou GOOGLE_APPLICATION_CREDENTIALS. Rotas protegidas devolverão 503."
        )
        return False

    firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin SDK inicializado.")
    return True


def firebase_admin_ready() -> bool:
    return bool(firebase_admin._apps)


def verify_id_token_uid(id_token: str) -> str:
    """Valida o JWT e devolve o uid (sub)."""
    decoded = firebase_auth.verify_id_token(id_token, check_revoked=False)
    uid = decoded.get("uid")
    if not uid:
        raise ValueError("Token sem uid")
    return uid


async def get_current_uid(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    """
    Dependência FastAPI: Authorization: Bearer <Firebase ID token>.
    O uid devolvido é o da conta autenticada (não confiar em query/body).
    """
    if not firebase_admin_ready():
        raise HTTPException(
            status_code=503,
            detail="Autenticação no servidor não está configurada (Firebase Admin).",
        )
    if creds is None or (creds.scheme or "").lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Token de autenticação em falta. Envie Authorization: Bearer <token>.",
        )
    token = (creds.credentials or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Token em falta.")
    try:
        return verify_id_token_uid(token)
    except Exception:
        logger.debug("verify_id_token falhou", exc_info=True)
        raise HTTPException(
            status_code=401,
            detail="Token inválido ou expirado.",
        ) from None
