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


async def _build_providers():
    """Instantiate LLM/embedding/vectordb providers from settings."""
    from app.config import settings as app_settings
    from app.providers.vectordb.chromadb import ChromaDBProvider

    llm = None
    # Flexible LLM selection based on .env and available keys
    if app_settings.LLM_PROVIDER.lower() == "gemini" and app_settings.GEMINI_API_KEY:
        from app.providers.llm.gemini import GeminiProvider
        llm = GeminiProvider(api_key=app_settings.GEMINI_API_KEY, model=app_settings.GEMINI_MODEL)
    elif app_settings.LLM_PROVIDER.lower() == "groq" and app_settings.GROQ_API_KEY:
        from app.providers.llm.groq import GroqProvider
        llm = GroqProvider(api_key=app_settings.GROQ_API_KEY, model=app_settings.GROQ_MODEL)
    elif app_settings.LLM_PROVIDER.lower() == "ollama":
        from app.providers.llm.ollama import OllamaProvider
        llm = OllamaProvider(base_url=app_settings.OLLAMA_URL)

    # Fallback order if primary is missing
    if not llm and app_settings.GEMINI_API_KEY:
        from app.providers.llm.gemini import GeminiProvider
        llm = GeminiProvider(api_key=app_settings.GEMINI_API_KEY, model=app_settings.GEMINI_MODEL)
    if not llm and app_settings.GROQ_API_KEY:
        from app.providers.llm.groq import GroqProvider
        llm = GroqProvider(api_key=app_settings.GROQ_API_KEY, model=app_settings.GROQ_MODEL)
    if not llm:
        from app.providers.llm.ollama import OllamaProvider
        llm = OllamaProvider(base_url=app_settings.OLLAMA_URL)

    vectordb = ChromaDBProvider()

    # Try to import Google embedding provider; fall back gracefully
    try:
        from app.providers.embeddings.google import GoogleEmbeddingProvider
        embeddings = GoogleEmbeddingProvider(api_key=app_settings.GEMINI_API_KEY)
    except ImportError:
        from app.providers.embeddings.gemini import GeminiEmbeddingProvider
        embeddings = GeminiEmbeddingProvider(api_key=app_settings.GEMINI_API_KEY)

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

    All error handling is done here so individual adapters stay clean.
    """
    from app.services import rag_service

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
        logger.exception("RAG pipeline failed for %s / %s: %s", msg.client_id, msg.channel, exc)
        response_text = "Sorry, I'm having trouble right now. Please try again later."

    try:
        config = await get_client_platform_config(msg.client_id, msg.channel)
        await adapter.send_response(msg, response_text, config)
    except Exception as exc:
        logger.exception("Failed to send response via %s: %s", msg.channel, exc)

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
