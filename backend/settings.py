"""
Configuração central: mesmas variáveis em local e produção (Render, Fly, Railway, etc.).
Defina secrets e URLs no painel do provedor ou no .env — sem alterar código.
"""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent
_ENV_PATH = _BACKEND_DIR / ".env"

# No Render não existe .env no disco: só variáveis do painel (evita erro de ficheiro em falta).
_settings_config = dict(
    env_file_encoding="utf-8",
    extra="ignore",
    case_sensitive=False,
)
if _ENV_PATH.is_file():
    _settings_config["env_file"] = str(_ENV_PATH)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(**_settings_config)

    # development | production | staging
    environment: str = Field(
        default="development",
        validation_alias=AliasChoices("ENVIRONMENT", "APP_ENV", "ENV"),
    )

    host: str = Field(default="0.0.0.0", validation_alias="HOST")
    port: int = Field(default=5000, validation_alias=AliasChoices("PORT", "WEB_PORT"))

    mongo_url: str = Field(
        default="mongodb://127.0.0.1:27017",
        validation_alias="MONGO_URL",
    )
    db_name: str = Field(default="test_database", validation_alias="DB_NAME")
    mongo_server_selection_timeout_ms: int = Field(
        default=5000,
        validation_alias="MONGO_SERVER_SELECTION_TIMEOUT_MS",
    )

    # Lista separada por vírgula; "*" = qualquer origem (sem credentials CORS)
    cors_origins: str = Field(default="*", validation_alias="CORS_ORIGINS")

    # Ex.: api.meudominio.com,*.onrender.com — vazio = middleware desligado
    trusted_hosts: str = Field(default="", validation_alias="TRUSTED_HOSTS")

    # Atrás de nginx/Render/Fly/Cloudflare (X-Forwarded-*)
    behind_proxy: bool = Field(default=False, validation_alias="BEHIND_PROXY")

    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    # Em produção, documentação Swagger fica desligada salvo DEBUG_API_DOCS=true
    debug_api_docs: bool = Field(default=False, validation_alias="DEBUG_API_DOCS")

    # Geração de legendas/observação (checklist) — opcional
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    openai_model: str = Field(
        default="gpt-4o-mini",
        validation_alias="OPENAI_MODEL",
    )

    @field_validator("environment", mode="before")
    @classmethod
    def _norm_env(cls, v: object) -> str:
        if v is None:
            return "development"
        return str(v).strip().lower() or "development"

    @field_validator("mongo_url", "db_name", mode="before")
    @classmethod
    def _strip_quotes(cls, v: object) -> str:
        if v is None:
            return ""
        s = str(v).strip()
        return s.strip('"').strip("'")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def cors_origins_list(self) -> List[str]:
        raw = self.cors_origins.strip()
        if not raw or raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    def trusted_hosts_list(self) -> List[str]:
        raw = self.trusted_hosts.strip()
        if not raw:
            return []
        return [h.strip() for h in raw.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
