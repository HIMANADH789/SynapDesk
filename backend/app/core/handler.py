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
      3. Log complete end-to-end metadata and JSON payloads for monitoring
      4. Return the response text
    """
    import time
    import traceback
    from datetime import datetime, timezone
    from app.services import rag_service
    db = get_db()

    start_time = time.time()
    response_text = ""
    status = "processing"
    error_msg = None
    tb_str = None
    send_info = {}

    try:
        llm, embeddings, vectordb = await _build_providers()

        result = await rag_service.query(
            client_id=msg.client_id,
            message=msg.message,
            session_id=msg.session_id,
            llm=llm,
            embeddings=embeddings,
            vectordb=vectordb,
            channel=msg.channel,
        )
        response_text = result.get("response", "Sorry, I could not process your request.")

    except Exception as exc:
        tb_str = traceback.format_exc()
        error_msg = str(exc)
        status = "rag_error"
        logger.exception("RAG pipeline failed for %s / %s: %s", msg.client_id, msg.channel, exc)
        response_text = "Sorry, I'm having trouble right now. Please try again in a moment."

    try:
        config = await get_client_platform_config(msg.client_id, msg.channel)
        res = await adapter.send_response(msg, response_text, config)
        if isinstance(res, dict):
            send_info = res
            status = res.get("status", "response_sent")
        else:
            status = "response_sent"
    except Exception as exc:
        tb_str = traceback.format_exc()
        error_msg = str(exc)
        status = "adapter_send_error"
        logger.exception("Failed to send response via %s: %s", msg.channel, exc)

    elapsed_ms = int((time.time() - start_time) * 1000)

    try:
        await db["webhook_logs"].insert_one({
            "client_id": msg.client_id,
            "channel": msg.channel,
            "timestamp": datetime.now(timezone.utc),
            "sender_id": msg.user_id,
            "sender_name": msg.metadata.get("contact_name", ""),
            "message_in": msg.message,
            "response_out": response_text,
            "response_time_ms": elapsed_ms,
            "status": status,
            "outgoing_payload": send_info.get("payload"),
            "meta_status": send_info.get("meta_status"),
            "meta_response": send_info.get("meta_response"),
            "metadata": msg.metadata,
            "error": error_msg,
            "traceback": tb_str,
        })
    except Exception as log_exc:
        logger.warning("Failed to record webhook log: %s", log_exc)

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
