"""Conexão MongoDB (Motor): tolerante a falha no startup; estado exposto para /health."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from settings import get_settings

logger = logging.getLogger(__name__)

mongo_client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None
_mongo_ready: bool = False


def is_mongo_ready() -> bool:
    return _mongo_ready


async def connect_mongodb() -> None:
    global mongo_client, db, _mongo_ready

    settings = get_settings()
    tmp: Optional[AsyncIOMotorClient] = None

    try:
        tmp = AsyncIOMotorClient(
            settings.mongo_url,
            serverSelectionTimeoutMS=settings.mongo_server_selection_timeout_ms,
        )
        await tmp.admin.command("ping")
        mongo_client = tmp
        db = mongo_client[settings.db_name]
        _mongo_ready = True
        logger.info(
            "MongoDB conectado (ambiente=%s, banco=%s)",
            settings.environment,
            settings.db_name,
        )
    except Exception as e:
        logger.warning(
            "MongoDB indisponível — API ativa sem persistência até o banco subir: %s",
            e,
        )
        _mongo_ready = False
        mongo_client = None
        db = None
        if tmp is not None:
            tmp.close()


def require_database() -> AsyncIOMotorDatabase:
    if not _mongo_ready or db is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "MongoDB não está disponível. Configure MONGO_URL no ambiente, "
                "confirme que o cluster está acessível e reinicie a API."
            ),
        )
    return db


def close_mongodb() -> None:
    global mongo_client, db, _mongo_ready
    if mongo_client is not None:
        mongo_client.close()
        mongo_client = None
    db = None
    _mongo_ready = False
