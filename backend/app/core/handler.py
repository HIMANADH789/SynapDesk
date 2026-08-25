"""
Unified message handler — the single entry point for every incoming message
regardless of which channel it comes from.

Flow:
  NormalizedMessage
      → RAG pipeline (rag_service.query)
      → adapter.send_response()
      → returns response text (so callers can log / test)
"""
from __future__ import annotations
import logging
from typing import Optional

from app.core.message import NormalizedMessage
from app.adapters.base import ChannelAdapter
from app.db.mongodb import get_db
from app.db.collections import CLIENTS

logger = logging.getLogger(__name__)


# Add logging to debug provider initialization
logger = logging.getLogger("ProviderInitialization")


async def _build_providers():
    """Instantiate LLM/embedding/vectordb providers from registry (matching web chat)."""
    from app.providers.registry import (
        get_llm_provider,
        get_embedding_provider,
        get_vectordb_provider,
    )
    llm = get_llm_provider()
    embeddings = get_embedding_provider()
    vectordb = get_vectordb_provider()
    return llm, embeddings, vectordb


async def get_client_platform_config(client_id: str, platform: str) -> dict:
    """Fetch the platform-specific settings dict for a client."""
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id})
    if not client:
        return {}
    return client.get("settings", {}).get(f"{platform}_config", {})


async def handle_incoming(
    msg: NormalizedMessage,
    adapter: ChannelAdapter,
) -> str:
    """
    Process one normalized message end-to-end:
      1. Run RAG pipeline
      2. Send reply via the appropriate channel adapter
      3. Return the response text
    """
    from app.services import rag_service
    from datetime import datetime, timezone
    db = get_db()

    response_text = ""
    try:
        llm, embeddings, vectordb = await _build_providers()

        result = await rag_service.query(
            client_id=msg.client_id,
            message=msg.message,
            session_id=msg.session_id,
            llm=llm,
            embeddings=embeddings,
            vectordb=vectordb,
            channel=msg.channel,          # passed so query log includes channel
        )
        response_text = result.get("response", "Sorry, I could not process your request.")

    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        logger.exception("RAG pipeline failed for %s / %s: %s", msg.client_id, msg.channel, exc)
        response_text = "Sorry, I'm having trouble right now. Please try again later."
        try:
            await db["webhook_logs"].insert_one({
                "client_id": msg.client_id,
                "channel": msg.channel,
                "timestamp": datetime.now(timezone.utc),
                "status": "rag_error",
                "error": str(exc),
                "traceback": tb,
            })
        except Exception:
            pass

    try:
        config = await get_client_platform_config(msg.client_id, msg.channel)
        await adapter.send_response(msg, response_text, config)
        try:
            await db["webhook_logs"].insert_one({
                "client_id": msg.client_id,
                "channel": msg.channel,
                "timestamp": datetime.now(timezone.utc),
                "status": "response_sent",
                "reply": response_text[:200],
            })
        except Exception:
            pass
    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        logger.exception("Failed to send response via %s: %s", msg.channel, exc)
        try:
            await db["webhook_logs"].insert_one({
                "client_id": msg.client_id,
                "channel": msg.channel,
                "timestamp": datetime.now(timezone.utc),
                "status": "adapter_send_error",
                "error": str(exc),
                "traceback": tb,
            })
        except Exception:
            pass

    return response_text


async def lookup_client_by_platform_id(platform: str, id_field: str, id_value: str) -> Optional[str]:
    """
    Find a client_id by a platform-specific identifier.

    e.g. lookup_client_by_platform_id("whatsapp", "phone_number_id", "12345678")
    Returns the client_id string or None if not found.
    """
    db = get_db()
    client = await db[CLIENTS].find_one(
        {f"settings.{platform}_config.{id_field}": id_value},
        {"client_id": 1},
    )
    return client["client_id"] if client else None
