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
        from app.models.client import get_setup
        from app.services.context_media_service import (
            normalize_menu_tree, find_node_in_tree, is_leaf_node
        )
        from app.services.chat_service import get_or_create_session, add_message

        # Fetch client settings and setup
        client = await db[CLIENTS].find_one({"client_id": msg.client_id})
        cs = (client or {}).get("settings", {})
        setup_cfg = get_setup(cs, msg.channel)
        config = await get_client_platform_config(msg.client_id, msg.channel)
        # Merge setup_cfg credentials if config is empty
        if not config or not config.get("access_token"):
            config = setup_cfg

        menu_tree = normalize_menu_tree(cs, setup_cfg)
        interactive_id = msg.metadata.get("interactive_id", "")
        matched_node = find_node_in_tree(menu_tree, interactive_id) if interactive_id else None
        if not matched_node and msg.message:
            matched_node = find_node_in_tree(menu_tree, msg.message)

        # 1. If user clicked an intermediate menu node (has children), render the sub-menu!
        if matched_node and not is_leaf_node(matched_node) and hasattr(adapter, "send_interactive_menu"):
            children = matched_node.get("children", [])
            body_text = f"You selected: *{matched_node.get('label')}*\nPlease select an option below:"
            res = await adapter.send_interactive_menu(
                msg,
                body_text=body_text,
                options=children,
                config=config,
                header_text=matched_node.get("label"),
            )
            response_text = f"[Interactive Menu: {matched_node.get('label')}]"
            send_info = res if isinstance(res, dict) else {}
            status = send_info.get("status", "menu_sent")
        else:
            # 2. Leaf node or regular text query -> run RAG pipeline
            actual_query = msg.message
            if matched_node and is_leaf_node(matched_node) and matched_node.get("action_question"):
                actual_query = matched_node["action_question"]
                logger.info("Leaf menu option '%s' routed to RAG question: '%s'", matched_node.get('label'), actual_query)

            llm, embeddings, vectordb = await _build_providers()

            result = await rag_service.query(
                client_id=msg.client_id,
                message=actual_query,
                session_id=msg.session_id,
                llm=llm,
                embeddings=embeddings,
                vectordb=vectordb,
                channel=msg.channel,
            )
            response_text = result.get("response", "Sorry, I could not process your request.")

            # Send main text reply
            res = await adapter.send_response(msg, response_text, config)
            if isinstance(res, dict):
                send_info = res
                status = res.get("status", "response_sent")
            else:
                status = "response_sent"

            # 3. Contextual Images Dispatch
            matched_images = result.get("context_images", [])
            if matched_images and hasattr(adapter, "send_image_message"):
                for img in matched_images:
                    img_path = img.get("image_path", "")
                    caption = img.get("caption") or img.get("title")
                    await adapter.send_image_message(msg, img_path, caption, config)

            # 4. Contextual Interactive Menu Dispatch (if triggered by descriptor tag)
            matched_menu = result.get("interactive_menu")
            if matched_menu and hasattr(adapter, "send_interactive_menu"):
                sub_opts = matched_menu.get("children", [])
                if sub_opts:
                    menu_body = f"Here are some options regarding *{matched_menu.get('label')}*:"
                    await adapter.send_interactive_menu(
                        msg,
                        body_text=menu_body,
                        options=sub_opts,
                        config=config,
                        header_text=matched_menu.get("label"),
                    )

    except Exception as exc:
        tb_str = traceback.format_exc()
        error_msg = str(exc)
        status = "error"
        logger.exception("Unified message handler failed for %s / %s: %s", msg.client_id, msg.channel, exc)
        if matched_node and matched_node.get("label"):
            node_lbl = matched_node.get("label")
            response_text = (
                f"Thank you for inquiring about our *{node_lbl}* program! "
                f"We offer comprehensive coaching covering syllabus preparation, experienced faculty guidance, and regular mock exams. "
                f"Our front desk will be delighted to provide full batch timings and details shortly. Please feel free to ask any further questions!"
            )
        else:
            response_text = "Sorry, I'm having trouble right now. Please try again in a moment."
        try:
            config = await get_client_platform_config(msg.client_id, msg.channel)
            await adapter.send_response(msg, response_text, config)
        except Exception:
            pass

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
