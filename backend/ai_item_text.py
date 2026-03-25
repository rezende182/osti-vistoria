"""
Geração de legendas técnicas e observação consolidada para itens do checklist (OpenAI).
Requer OPENAI_API_KEY no ambiente.
"""

from __future__ import annotations

import json
import logging

import httpx
from fastapi import HTTPException

from settings import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é um engenheiro civil especialista em inspeções prediais.

Processa UM item vistoriado com N fotos na ordem indicada. O utilizador deu uma descrição informal do que viu.

Tarefas:
1. Produzir exatamente N strings em "legendas" — legenda técnica curta por foto, mesma ordem (índice 0 = primeira foto).
2. Produzir "observacao_tecnica": um único parágrafo contínuo, sem listas nem tópicos, integrando o contexto.

Regras obrigatórias:
- Linguagem técnica, objetiva e impessoal (3ª pessoa / registo factual).
- Não pedir mais dados nem explicar o raciocínio.
- Não incluir recomendações, soluções, classificações ou notas de reparo.
- Não repetir literalmente o texto do utilizador.
- Responder apenas com JSON válido no formato:
{"legendas": ["...", "..."], "observacao_tecnica": "..."}
- O array "legendas" deve ter exatamente N elementos."""


async def generate_item_checklist_text(
    *,
    room_name: str,
    item_name: str,
    descricao: str,
    num_fotos: int,
) -> dict:
    settings = get_settings()
    key = (settings.openai_api_key or "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Geração por IA não configurada (defina OPENAI_API_KEY no servidor).",
        )

    user_msg = (
        f"Cômodo: {room_name}\n"
        f"Item vistoriado: {item_name}\n"
        f"Descrição do que foi observado (informal): {descricao}\n"
        f"Número de fotos (gerar uma legenda por foto, nesta ordem): {num_fotos}\n"
    )

    payload = {
        "model": settings.openai_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.25,
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if r.status_code != 200:
                logger.error(
                    "OpenAI HTTP %s: %s", r.status_code, (r.text or "")[:800]
                )
                raise HTTPException(
                    status_code=502,
                    detail="Resposta inválida do serviço de IA.",
                )
            data = r.json()
            raw = data["choices"][0]["message"]["content"]
            parsed = json.loads(raw)
    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.exception("JSON da IA inválido: %s", e)
        raise HTTPException(
            status_code=502, detail="Formato de resposta da IA inválido."
        ) from e
    except Exception as e:
        logger.exception("Erro ao chamar OpenAI: %s", e)
        raise HTTPException(
            status_code=502, detail="Falha ao contactar o serviço de IA."
        ) from e

    legendas = parsed.get("legendas")
    if not isinstance(legendas, list):
        legendas = []
    legendas = [str(x).strip() if x is not None else "" for x in legendas]

    obs = parsed.get("observacao_tecnica")
    if obs is None:
        obs = ""
    obs = str(obs).strip()

    if len(legendas) < num_fotos:
        legendas.extend([""] * (num_fotos - len(legendas)))
    elif len(legendas) > num_fotos:
        legendas = legendas[:num_fotos]

    return {"legendas": legendas, "observacao_tecnica": obs}
