"""
Platform integration webhooks — channel-agnostic adapter architecture.

Route design:
  Meta (WhatsApp / Facebook): GLOBAL routes (one URL for all institutions).
    Institutions are identified by phone_number_id (WhatsApp) or page_id (Facebook).
    Meta routes all messages for one App to a single webhook URL.

  Telegram / Slack: per-institution routes using {client_id} in the URL.
    Simpler setup; each institution registers its own bot.

URL layout:
  GET  /api/webhook/whatsapp              — Meta verification handshake
  POST /api/webhook/whatsapp              — WhatsApp message events
  GET  /api/webhook/facebook              — Meta verification handshake
  POST /api/webhook/facebook              — Facebook Messenger events
  POST /api/integrations/{client_id}/telegram              — Telegram updates
  POST /api/integrations/{client_id}/telegram/register    — Register Telegram webhook URL
  POST /api/integrations/{client_id}/slack                 — Slack Events API

Security:
  - WhatsApp / Facebook: X-Hub-Signature-256 HMAC-SHA256
  - Slack: X-Slack-Signature HMAC-SHA256 with replay protection
  - Telegram: optional X-Telegram-Bot-Api-Secret-Token header check
"""
from __future__ import annotations

import json
import logging

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from app.adapters import factory as adapter_factory
from app.adapters.facebook import FacebookAdapter, verify_meta_signature as fb_verify
from app.adapters.slack import SlackAdapter, verify_slack_signature
from app.adapters.telegram import TelegramAdapter
from app.adapters.whatsapp import WhatsAppAdapter, verify_meta_signature as wa_verify
from app.core.handler import handle_incoming, lookup_client_by_platform_id
from app.core.message import CHANNEL_FACEBOOK, CHANNEL_SLACK, CHANNEL_TELEGRAM, CHANNEL_WHATSAPP
from app.db.mongodb import get_db
from app.db.collections import CLIENTS

logger = logging.getLogger(__name__)

integrations_router = APIRouter(prefix="/integrations", tags=["integrations"])
router = integrations_router


def _get_adapter(channel: str):
    adapter = adapter_factory.get(channel)
    if adapter is None:
        raise RuntimeError(f"No adapter registered for channel '{channel}'")
    return adapter


# ── WhatsApp (Meta Cloud API) ─────────────────────────────────────────────────

@integrations_router.get("/{client_id}/whatsapp", response_class=PlainTextResponse)
async def whatsapp_verify(
    client_id: str,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification — returns hub.challenge on success."""
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id})
    if not client:
        raise HTTPException(404, "Institution not found")
        
    expected = client.get("settings", {}).get("whatsapp_config", {}).get("verify_token", "")
    if not expected:
        expected = "SynapDeskSecretToken123"
    
    if hub_mode == "subscribe" and hub_verify_token == expected and hub_challenge:
        return hub_challenge
    raise HTTPException(403, "WhatsApp webhook verification failed. Check verify_token.")


@integrations_router.post("/{client_id}/whatsapp")
async def whatsapp_webhook(client_id: str, request: Request):
    """
    Receive WhatsApp messages from Meta Cloud API.
    Multi-tenant: per-client webhook URL.
    """
    body_bytes = await request.body()
    try:
        raw = json.loads(body_bytes)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON")

    # Verify signature using institution's app_secret
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id})
    if not client:
        logger.debug("WhatsApp: no institution found for client_id=%s", client_id)
        return {"status": "ignored"}
        
    app_secret = client.get("settings", {}).get("whatsapp_config", {}).get("app_secret", "")
    sig = request.headers.get("X-Hub-Signature-256", "")
    if app_secret and sig and not wa_verify(app_secret, body_bytes, sig):
        raise HTTPException(403, "Invalid WhatsApp signature")

    adapter = _get_adapter(CHANNEL_WHATSAPP)
    msg = await adapter.parse_incoming(raw, client_id)
    if msg is None:
        return {"status": "ignored"}

    # Fire-and-forget: RAG can take seconds, Meta expects 200 quickly
    import asyncio
    asyncio.create_task(handle_incoming(msg, adapter))
    return {"status": "ok"}


# ── Facebook Messenger (Meta) ─────────────────────────────────────────────────

@integrations_router.get("/{client_id}/facebook", response_class=PlainTextResponse)
async def facebook_verify(
    client_id: str,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification for Facebook Messenger."""
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id})
    if not client:
        raise HTTPException(404, "Institution not found")
        
    expected = client.get("settings", {}).get("facebook_config", {}).get("verify_token", "")
    if not expected:
        expected = "SynapDeskSecretToken123"
        
    if hub_mode == "subscribe" and hub_verify_token == expected and hub_challenge:
        return hub_challenge
    raise HTTPException(403, "Facebook webhook verification failed. Check verify_token.")


@integrations_router.post("/{client_id}/facebook")
async def facebook_webhook(client_id: str, request: Request):
    """
    Receive Facebook Messenger messages from Meta.
    Multi-tenant: per-client webhook URL.
    """
    body_bytes = await request.body()
    try:
        raw = json.loads(body_bytes)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON")

    # Verify signature
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id})
    if not client:
        logger.debug("Facebook: no institution found for client_id=%s", client_id)
        return {"status": "ignored"}
        
    app_secret = client.get("settings", {}).get("facebook_config", {}).get("app_secret", "")
    sig = request.headers.get("X-Hub-Signature-256", "")
    if app_secret and sig and not fb_verify(app_secret, body_bytes, sig):
        raise HTTPException(403, "Invalid Facebook signature")

    adapter = _get_adapter(CHANNEL_FACEBOOK)
    msg = await adapter.parse_incoming(raw, client_id)
    if msg is None:
        return {"status": "ignored"}

    import asyncio
    asyncio.create_task(handle_incoming(msg, adapter))
    return {"status": "ok"}


# ── Telegram ──────────────────────────────────────────────────────────────────

@integrations_router.post("/{client_id}/telegram")
async def telegram_webhook(client_id: str, request: Request):
    """
    Telegram Bot API webhook (POST JSON updates).
    Optional: validate X-Telegram-Bot-Api-Secret-Token if secret_token is configured.
    """
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id})
    if not client:
        raise HTTPException(404, "Institution not found")

    tg_config = client.get("settings", {}).get("telegram_config", {})
    secret_token = tg_config.get("secret_token", "")
    if secret_token:
        provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if provided != secret_token:
            raise HTTPException(403, "Invalid Telegram secret token")

    try:
        raw = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    adapter = _get_adapter(CHANNEL_TELEGRAM)
    msg = await adapter.parse_incoming(raw, client_id)
    if msg is None:
        return {"ok": True}

    import asyncio
    asyncio.create_task(handle_incoming(msg, adapter))
    return {"ok": True}


@integrations_router.post("/{client_id}/telegram/register")
async def register_telegram_webhook(client_id: str, request: Request):
    """
    Register this server as the Telegram webhook for an institution's bot.
    Body: {"webhook_url": "https://your-domain.com"}
    The bot will receive updates at {webhook_url}/api/integrations/{client_id}/telegram
    """
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id})
    if not client:
        raise HTTPException(404, "Institution not found")

    tg_config = client.get("settings", {}).get("telegram_config", {})
    bot_token = tg_config.get("bot_token", "")
    if not bot_token:
        raise HTTPException(400, "Configure telegram_config.bot_token first")

    body = await request.json()
    webhook_url = body.get("webhook_url", "").rstrip("/")
    if not webhook_url:
        raise HTTPException(400, "webhook_url required in body")

    target = f"{webhook_url}/api/integrations/{client_id}/telegram"
    payload: dict = {"url": target}

    # Optionally attach secret_token so Telegram sends it in every request
    secret_token = tg_config.get("secret_token", "")
    if secret_token:
        payload["secret_token"] = secret_token

    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.post(
            f"https://api.telegram.org/bot{bot_token}/setWebhook",
            json=payload,
        )
        data = resp.json()

    if not data.get("ok"):
        raise HTTPException(400, f"Telegram error: {data.get('description', 'Unknown')}")

    return {"message": "Webhook registered", "url": target, "telegram_response": data}


# ── Slack ─────────────────────────────────────────────────────────────────────

@integrations_router.post("/{client_id}/slack")
async def slack_webhook(client_id: str, request: Request, background_tasks: BackgroundTasks):
    """
    Slack Events API webhook.

    CRITICAL: Slack requires a response within 3 seconds.
    We return 200 immediately for real events and use BackgroundTasks for processing.
    URL verification challenge is answered inline (no RAG needed).
    """
    body_bytes = await request.body()

    # Signature verification before parsing body
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id})
    if not client:
        raise HTTPException(404, "Institution not found")

    slack_config = client.get("settings", {}).get("slack_config", {})
    signing_secret = slack_config.get("signing_secret", "")

    if signing_secret:
        timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
        signature = request.headers.get("X-Slack-Signature", "")
        if not verify_slack_signature(signing_secret, body_bytes, timestamp, signature):
            raise HTTPException(403, "Invalid Slack signature")

    try:
        raw = json.loads(body_bytes)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON")

    # URL verification — must respond inline, cannot defer
    if raw.get("type") == "url_verification":
        return JSONResponse({"challenge": raw.get("challenge")})

    adapter = _get_adapter(CHANNEL_SLACK)
    msg = await adapter.parse_incoming(raw, client_id)
    if msg is None:
        return {"status": "ignored"}

    # Use BackgroundTasks — Slack's 3-second window requires immediate 200
    background_tasks.add_task(handle_incoming, msg, adapter)
    return {"status": "ok"}
