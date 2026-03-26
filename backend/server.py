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

from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
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
from firebase_auth import get_current_uid, init_firebase_admin
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


class InspectionCreateIn(BaseModel):
    """Payload de criação (sem userId — vem do token Firebase)."""

    model_config = ConfigDict(extra="ignore")

    cliente: str = Field(..., min_length=1)
    data: str = Field(..., min_length=1)
    endereco: str = Field(..., min_length=1)
    cidade: str = Field(..., min_length=1)
    uf: str = Field(..., min_length=1)
    responsavel_tecnico: str = Field(..., min_length=1)
    crea: str = Field(..., min_length=1)
    unidade: str = ""
    empreendimento: str = ""
    construtora: str = ""
    horario_inicio: str = ""
    horario_termino: str = ""
    tipo_imovel: Literal["novo", "usado", "reformado"] = "novo"
    energia_disponivel: Literal["sim", "nao"] = "sim"
    imovel_tipologia: Literal["terreo", "sobrado"] = "terreo"
    imovel_numero_pavimentos: str = ""
    documentos_recebidos: List[str] = []
    tipo_vistoria_fluxo: Optional[Literal["apartamento", "casa"]] = None
    pdf_logo_data_url: Optional[str] = Field(
        default=None,
        max_length=2_500_000,
        description="data:image/png ou data:image/jpeg;base64,... para o cabeçalho do PDF",
    )
    pdf_empresa_nome: Optional[str] = Field(
        default=None,
        max_length=300,
        description="Nome da empresa (rodapé do PDF; opcional)",
    )
    pdf_empresa_cnpj: Optional[str] = Field(
        default=None,
        max_length=32,
        description="CNPJ da empresa (rodapé do PDF; opcional)",
    )

    @field_validator("pdf_logo_data_url", mode="before")
    @classmethod
    def _empty_logo_create(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("pdf_logo_data_url")
    @classmethod
    def _logo_must_be_data_image(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        if not s.startswith("data:image/"):
            raise ValueError("Logótipo: envie uma data URL de imagem (PNG ou JPEG).")
        return s

    @field_validator("pdf_empresa_nome", "pdf_empresa_cnpj", mode="before")
    @classmethod
    def _empty_empresa_create(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v


class InspectionUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    rooms_checklist: Optional[List[RoomChecklist]] = None
    classificacao_final: Optional[
        Literal["aprovado", "aprovado_com_ressalvas", "reprovado", "outro"]
    ] = None
    conclusao: Optional[str] = None
    assinatura: Optional[str] = None
    responsavel_final: Optional[str] = None
    crea_final: Optional[str] = None
    data_final: Optional[str] = None
    local_assinatura_responsavel: Optional[str] = None
    horario_termino: Optional[str] = None
    outro_somente_conclusao: Optional[bool] = None
    classificacao_escolha_rotulo: Optional[str] = None
    pdf_logo_data_url: Optional[str] = Field(default=None, max_length=2_500_000)
    pdf_empresa_nome: Optional[str] = Field(default=None, max_length=300)
    pdf_empresa_cnpj: Optional[str] = Field(default=None, max_length=32)

    @field_validator("pdf_logo_data_url", mode="before")
    @classmethod
    def _empty_logo_update(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("pdf_logo_data_url")
    @classmethod
    def _logo_update_data_image(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        if not s.startswith("data:image/"):
            raise ValueError("Logótipo: envie uma data URL de imagem (PNG ou JPEG).")
        return s

    @field_validator("pdf_empresa_nome", "pdf_empresa_cnpj", mode="before")
    @classmethod
    def _empty_empresa_update(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v


class Inspection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: Optional[str] = None
    cliente: str
    data: str
    endereco: str
    cidade: str = ""
    uf: str = ""
    unidade: str = ""
    empreendimento: str = ""
    construtora: str = ""
    responsavel_tecnico: str = ""
    crea: str = ""
    horario_inicio: str = ""
    horario_termino: str = ""
    tipo_imovel: Literal["novo", "usado", "reformado"]
    energia_disponivel: Literal["sim", "nao"]
    imovel_tipologia: Literal["terreo", "sobrado"] = "terreo"
    imovel_numero_pavimentos: str = ""
    documentos_recebidos: List[str] = []
    rooms_checklist: List[RoomChecklist] = []
    classificacao_final: Optional[
        Literal["aprovado", "aprovado_com_ressalvas", "reprovado", "outro"]
    ] = None
    conclusao: Optional[str] = None
    assinatura: Optional[str] = None
    responsavel_final: Optional[str] = None
    crea_final: Optional[str] = None
    data_final: Optional[str] = None
    local_assinatura_responsavel: Optional[str] = None
    outro_somente_conclusao: bool = False
    classificacao_escolha_rotulo: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: Literal["em_andamento", "concluida"] = "em_andamento"
    pdf_logo_data_url: Optional[str] = Field(default=None, max_length=2_500_000)
    pdf_empresa_nome: Optional[str] = Field(default=None, max_length=300)
    pdf_empresa_cnpj: Optional[str] = Field(default=None, max_length=32)
    tipo_vistoria_fluxo: Optional[Literal["apartamento", "casa"]] = None


class UserRegisterBody(BaseModel):
    """Perfil após cadastro no Firebase Auth — uid vem só do token."""

    model_config = ConfigDict(extra="ignore")

    nome: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=320)
    telefone: Optional[str] = None

    @field_validator("nome")
    @classmethod
    def strip_nome(cls, v: str) -> str:
        return v.strip()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("telefone", mode="before")
    @classmethod
    def normalize_phone(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v


class IdentificationUpdate(BaseModel):
    cliente: Optional[str] = None
    data: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    unidade: Optional[str] = None
    empreendimento: Optional[str] = None
    construtora: Optional[str] = None
    responsavel_tecnico: Optional[str] = None
    crea: Optional[str] = None
    horario_inicio: Optional[str] = None
    tipo_imovel: Optional[Literal["novo", "usado", "reformado"]] = None
    energia_disponivel: Optional[Literal["sim", "nao"]] = None
    documentos_recebidos: Optional[List[str]] = None
    pdf_logo_data_url: Optional[str] = Field(default=None, max_length=2_500_000)
    pdf_empresa_nome: Optional[str] = Field(default=None, max_length=300)
    pdf_empresa_cnpj: Optional[str] = Field(default=None, max_length=32)
    tipo_vistoria_fluxo: Optional[Literal["apartamento", "casa"]] = None
    imovel_tipologia: Optional[Literal["terreo", "sobrado"]] = None
    imovel_numero_pavimentos: Optional[str] = None

    @field_validator("pdf_logo_data_url", mode="before")
    @classmethod
    def _empty_logo_ident(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("pdf_logo_data_url")
    @classmethod
    def _logo_ident_data_image(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        if not s.startswith("data:image/"):
            raise ValueError("Logótipo: envie uma data URL de imagem (PNG ou JPEG).")
        return s

    @field_validator("pdf_empresa_nome", "pdf_empresa_cnpj", mode="before")
    @classmethod
    def _empty_empresa_ident(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v


# --- Rotas /api ---


def _assert_inspection_owner(inspection: dict, user_id: str) -> None:
    """Garante que a vistoria pertence ao utilizador (Firebase uid)."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticação necessária")
    doc_uid = inspection.get("userId")
    if doc_uid != user_id:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")


@api_router.get("/")
async def root():
    return {"message": "OSTI Engenharia - Vistoria de Recebimento de Imóvel API"}


@api_router.post("/users/register")
async def register_user_profile(
    body: UserRegisterBody,
    uid: str = Depends(get_current_uid),
):
    """Guarda perfil no Mongo após signUp Firebase — idempotente (mesmo userId atualiza)."""
    database = require_database()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "userId": uid,
        "nome": body.nome,
        "email": body.email,
        "telefone": body.telefone,
        "updated_at": now,
    }
    await database.user_profiles.update_one(
        {"userId": uid},
        {
            "$set": doc,
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/health")
async def health():
    return {
        "api": "ok",
        "mongodb": is_mongo_ready(),
        "environment": get_settings().environment,
    }


@api_router.post("/inspections", response_model=Inspection)
async def create_inspection(
    input: InspectionCreateIn,
    uid: str = Depends(get_current_uid),
):
    database = require_database()
    inspection_dict = {**input.model_dump(), "userId": uid}
    inspection_obj = Inspection(**inspection_dict)

    doc = inspection_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()

    await database.inspections.insert_one(doc)
    return inspection_obj


@api_router.get("/inspections", response_model=List[Inspection])
async def get_inspections(uid: str = Depends(get_current_uid)):
    database = require_database()
    inspections = (
        await database.inspections.find({"userId": uid}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(1000)
    )

    for inspection in inspections:
        if isinstance(inspection["created_at"], str):
            inspection["created_at"] = datetime.fromisoformat(inspection["created_at"])

    return inspections


@api_router.get("/inspections/{inspection_id}", response_model=Inspection)
async def get_inspection(
    inspection_id: str,
    uid: str = Depends(get_current_uid),
):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    _assert_inspection_owner(inspection, uid)

    if isinstance(inspection["created_at"], str):
        inspection["created_at"] = datetime.fromisoformat(inspection["created_at"])

    return inspection


@api_router.put("/inspections/{inspection_id}", response_model=Inspection)
async def update_inspection(
    inspection_id: str,
    update_data: InspectionUpdate,
    uid: str = Depends(get_current_uid),
):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    _assert_inspection_owner(inspection, uid)

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
    inspection_id: str,
    update_data: IdentificationUpdate,
    uid: str = Depends(get_current_uid),
):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    _assert_inspection_owner(inspection, uid)

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
async def delete_inspection(
    inspection_id: str,
    uid: str = Depends(get_current_uid),
):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    _assert_inspection_owner(inspection, uid)

    await database.inspections.delete_one({"id": inspection_id})

    return {"message": "Vistoria excluída com sucesso"}


@api_router.post("/inspections/{inspection_id}/upload-photo")
async def upload_photo(
    inspection_id: str,
    file: UploadFile = File(...),
    uid: str = Depends(get_current_uid),
):
    database = require_database()
    inspection = await database.inspections.find_one({"id": inspection_id}, {"_id": 0})

    if not inspection:
        raise HTTPException(status_code=404, detail="Vistoria não encontrada")

    _assert_inspection_owner(inspection, uid)

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
        init_firebase_admin()
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
