"""
API FastAPI — mesma base em desenvolvimento e produção.
Configure HOST, PORT, MONGO_URL, CORS_ORIGINS etc. via variáveis de ambiente ou .env.
"""

from contextlib import asynccontextmanager
import base64
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from database import (
    close_mongodb,
    connect_mongodb,
    is_mongo_ready,
    require_database,
)
from settings import get_settings

logger = logging.getLogger(__name__)

api_router = APIRouter(prefix="/api")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if get_settings().is_production:
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("X-Frame-Options", "DENY")
            response.headers.setdefault(
                "Referrer-Policy", "strict-origin-when-cross-origin"
            )
        return response


def _configure_logging() -> None:
    s = get_settings()
    level = getattr(logging, s.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        force=True,
    )


# --- Models ---


class PhotoData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    url: str
    caption: str = ""
    number: int = 1


class ChecklistItemData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    exists: Optional[Literal["sim", "nao"]] = None
    condition: Optional[Literal["aprovado", "reprovado"]] = None
    observations: str = ""
    photos: List[PhotoData] = []


class RoomChecklist(BaseModel):
    model_config = ConfigDict(extra="ignore")

    room_id: str
    room_name: str
    room_type: Optional[str] = None
    items: List[ChecklistItemData]


class InspectionCreate(BaseModel):
    cliente: str
    data: str
    endereco: str
    unidade: str
    empreendimento: str
    construtora: str
    responsavel_tecnico: str
    crea: str
    horario_inicio: str
    horario_termino: str = ""
    tipo_imovel: Literal["novo", "usado", "reformado"]
    energia_disponivel: Literal["sim", "nao"]
    documentos_recebidos: List[str] = []


class InspectionUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    rooms_checklist: Optional[List[RoomChecklist]] = None
    classificacao_final: Optional[
        Literal["aprovado", "aprovado_com_ressalvas", "reprovado"]
    ] = None
    conclusao: Optional[str] = None
    assinatura: Optional[str] = None
    responsavel_final: Optional[str] = None
    crea_final: Optional[str] = None
    data_final: Optional[str] = None
    local_assinatura_responsavel: Optional[str] = None
    horario_termino: Optional[str] = None


class Inspection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cliente: str
    data: str
    endereco: str
    unidade: str
    empreendimento: str
    construtora: str
    responsavel_tecnico: str
    crea: str
    horario_inicio: str
    horario_termino: str
    tipo_imovel: Literal["novo", "usado", "reformado"]
    energia_disponivel: Literal["sim", "nao"]
    documentos_recebidos: List[str] = []
    rooms_checklist: List[RoomChecklist] = []
    classificacao_final: Optional[
        Literal["aprovado", "aprovado_com_ressalvas", "reprovado"]
    ] = None
    conclusao: Optional[str] = None
    assinatura: Optional[str] = None
    responsavel_final: Optional[str] = None
    crea_final: Optional[str] = None
    data_final: Optional[str] = None
    local_assinatura_responsavel: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: Literal["em_andamento", "concluida"] = "em_andamento"


class IdentificationUpdate(BaseModel):
    cliente: Optional[str] = None
    data: Optional[str] = None
    endereco: Optional[str] = None
    unidade: Optional[str] = None
    empreendimento: Optional[str] = None
    construtora: Optional[str] = None
    responsavel_tecnico: Optional[str] = None
    crea: Optional[str] = None
    horario_inicio: Optional[str] = None
    tipo_imovel: Optional[Literal["novo", "usado", "reformado"]] = None
    energia_disponivel: Optional[Literal["sim", "nao"]] = None
    documentos_recebidos: Optional[List[str]] = None


# --- Rotas /api ---


@api_router.get("/")
async def root():
    return {"message": "OSTI Engenharia - Vistoria de Recebimento de Imóvel API"}


@api_router.get("/health")
async def health():
    return {
        "api": "ok",
        "mongodb": is_mongo_ready(),
        "environment": get_settings().environment,
    }


@api_router.post("/inspections", response_model=Inspection)
async def create_inspection(input: InspectionCreate):
    database = require_database()
    inspection_dict = input.model_dump()
    inspection_obj = Inspection(**inspection_dict)

    doc = inspection_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()

    await database.inspections.insert_one(doc)
    return inspection_obj


@api_router.get("/inspections", response_model=List[Inspection])
async def get_inspections():
    database = require_database()
    inspections = (
        await database.inspections.find({}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(1000)
    )

    for inspection in inspections:
        if isinstance(inspection["created_at"], str):
            inspection["created_at"] = datetime.fromisoformat(inspection["created_at"])

    return inspections


@api_router.get("/inspections/{inspection_id}", response_model=Inspection)
async def get_inspection(inspection_id: str):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    if isinstance(inspection["created_at"], str):
        inspection["created_at"] = datetime.fromisoformat(inspection["created_at"])

    return inspection


@api_router.put("/inspections/{inspection_id}", response_model=Inspection)
async def update_inspection(inspection_id: str, update_data: InspectionUpdate):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    update_dict = update_data.model_dump(exclude_unset=True)

    if update_dict:
        if "classificacao_final" in update_dict and update_dict["classificacao_final"]:
            update_dict["status"] = "concluida"

        await database.inspections.update_one(
            {"id": inspection_id},
            {"$set": update_dict},
        )

    updated_inspection = await database.inspections.find_one(
        {"id": inspection_id}, {"_id": 0}
    )

    if isinstance(updated_inspection["created_at"], str):
        updated_inspection["created_at"] = datetime.fromisoformat(
            updated_inspection["created_at"]
        )

    return updated_inspection


@api_router.put("/inspections/{inspection_id}/identification", response_model=Inspection)
async def update_identification(
    inspection_id: str, update_data: IdentificationUpdate
):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    update_dict = update_data.model_dump(exclude_unset=True)

    if update_dict:
        await database.inspections.update_one(
            {"id": inspection_id},
            {"$set": update_dict},
        )

    updated_inspection = await database.inspections.find_one(
        {"id": inspection_id}, {"_id": 0}
    )

    if isinstance(updated_inspection["created_at"], str):
        updated_inspection["created_at"] = datetime.fromisoformat(
            updated_inspection["created_at"]
        )

    return updated_inspection


@api_router.delete("/inspections/{inspection_id}")
async def delete_inspection(inspection_id: str):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    await database.inspections.delete_one({"id": inspection_id})

    return {"message": "Vistoria excluída com sucesso"}


@api_router.post("/inspections/{inspection_id}/upload-photo")
async def upload_photo(inspection_id: str, file: UploadFile = File(...)):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    contents = await file.read()
    base64_image = base64.b64encode(contents).decode("utf-8")
    image_url = f"data:{file.content_type};base64,{base64_image}"

    return {"url": image_url}


def create_app() -> FastAPI:
    _configure_logging()
    settings = get_settings()
    logger.info(
        "Iniciando API (environment=%s, host=%s, port=%s)",
        settings.environment,
        settings.host,
        settings.port,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await connect_mongodb()
        yield
        close_mongodb()

    docs_url = "/docs"
    if settings.is_production and not settings.debug_api_docs:
        docs_url = None

    app = FastAPI(
        title="OSTI — Vistoria de Imóvel",
        description="API de vistorias — desenvolvimento e produção.",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url="/redoc" if docs_url else None,
        openapi_url="/openapi.json" if docs_url else None,
    )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Erro não tratado: %s", exc)
        if get_settings().is_production:
            return JSONResponse(
                status_code=500,
                content={"detail": "Erro interno do servidor."},
            )
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    @app.get("/health")
    async def health_root():
        return {
            "status": "degraded" if not is_mongo_ready() else "ok",
            "api": "ok",
            "mongodb": is_mongo_ready(),
            "environment": settings.environment,
        }

    origins = settings.cors_origins_list()
    allow_credentials = True
    if origins == ["*"]:
        allow_credentials = False

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=512)
    hosts = settings.trusted_hosts_list()
    if hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.is_production and origins == ["*"]:
        logger.warning(
            "CORS_ORIGINS=* em produção: defina origens explícitas (ex.: https://app.seudominio.com)."
        )

    app.include_router(api_router)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    s = get_settings()
    uvicorn.run(
        app,
        host=s.host,
        port=s.port,
        log_level=s.log_level.lower(),
        proxy_headers=s.behind_proxy,
        forwarded_allow_ips="*" if s.behind_proxy else None,
    )
