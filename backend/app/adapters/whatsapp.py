"""
WhatsApp adapter — Meta WhatsApp Cloud API (official, no Twilio).

Incoming: POST JSON from Meta (after GET verification handshake).
Outgoing: POST https://graph.facebook.com/v20.0/{phone_number_id}/messages

Config keys expected in institution settings.whatsapp_config:
  phone_number_id  — the Meta-assigned Phone Number ID for this institution's number
  access_token     — System User Token (permanent) from Meta Business Manager
  app_secret       — App Secret for X-Hub-Signature-256 verification
  verify_token     — A string you choose; must match what's set in Meta App Dashboard

Multi-tenant routing:
  Meta sends ALL messages for an App to ONE webhook URL.
  We identify the institution by matching phone_number_id against the DB.
"""
from __future__ import annotations
import hashlib
import hmac
import logging
from typing import Optional

import httpx

from app.adapters.base import ChannelAdapter
from app.core.message import NormalizedMessage, CHANNEL_WHATSAPP

logger = logging.getLogger(__name__)

GRAPH_API = "https://graph.facebook.com/v20.0"


def verify_meta_signature(app_secret: str, body_bytes: bytes, signature_header: str) -> bool:
    """
    Verify X-Hub-Signature-256 sent by Meta on every webhook POST.
    Protects against spoofed requests.
    """
    if not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        app_secret.encode(), body_bytes, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


class WhatsAppAdapter(ChannelAdapter):
    channel_name = CHANNEL_WHATSAPP

    async def parse_incoming(
        self,
        raw_data: dict,
        client_id: str,
    ) -> Optional[NormalizedMessage]:
        """
        Parse Meta WhatsApp Cloud API payload.

        Meta payload structure:
        {
          "object": "whatsapp_business_account",
          "entry": [{
            "changes": [{
              "value": {
                "metadata": {"phone_number_id": "..."},
                "messages": [{"from": "...", "type": "text", "text": {"body": "..."}}],
                "statuses": [...]   # delivery receipts — ignored
              }
            }]
          }]
        }
        """
        if raw_data.get("object") != "whatsapp_business_account":
            return None

        for entry in raw_data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                messages = value.get("messages", [])
                if not messages:
                    continue  # status update / delivery receipt

                msg = messages[0]
                if msg.get("type") != "text":
                    continue  # skip media, location, etc.

                text = msg.get("text", {}).get("body", "").strip()
                sender = msg.get("from", "")
                phone_number_id = value.get("metadata", {}).get("phone_number_id", "")

                if not text or not sender:
                    continue

                return NormalizedMessage(
                    user_id=sender,
                    message=text,
                    channel=CHANNEL_WHATSAPP,
                    client_id=client_id,
                    metadata={
                        "phone_number_id": phone_number_id,
                        "message_id": msg.get("id", ""),
                        "contact_name": (
                            value.get("contacts", [{}])[0]
                            .get("profile", {})
                            .get("name", "")
                        ),
                    },
                )

        return None  # nothing to process

    async def send_response(
        self,
        msg: NormalizedMessage,
        response_text: str,
        config: dict,
    ) -> None:
        """
        Send reply via Meta WhatsApp Cloud API.

        Endpoint: POST /v20.0/{phone_number_id}/messages
        """
        phone_number_id = config.get("phone_number_id") or msg.metadata.get("phone_number_id")
        access_token = config.get("access_token", "")

        if not phone_number_id or not access_token:
            logger.error("WhatsApp send failed: missing phone_number_id or access_token for %s", msg.client_id)
            return

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": msg.user_id,
            "type": "text",
            "text": {"preview_url": False, "body": response_text},
        }

        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                f"{GRAPH_API}/{phone_number_id}/messages",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if not resp.is_success:
                logger.error("WhatsApp API error %s: %s", resp.status_code, resp.text)
