"""
Facebook Messenger adapter — Meta Messenger Platform.

Incoming: POST JSON from Meta (same GET verification as WhatsApp).
Outgoing: POST https://graph.facebook.com/v20.0/me/messages

Config keys in institution settings.facebook_config:
  page_id           — Facebook Page ID (entry[0].id in webhook payload)
  page_access_token — Page Access Token from Meta
  app_secret        — App Secret for X-Hub-Signature-256 verification
  verify_token      — String you choose; must match what's set in Meta App Dashboard

Multi-tenant routing:
  Identify institution by page_id matched against DB.
"""
from __future__ import annotations
import hashlib
import hmac
import logging
from typing import Optional

import httpx

from app.adapters.base import ChannelAdapter
from app.core.message import NormalizedMessage, CHANNEL_FACEBOOK

logger = logging.getLogger(__name__)

GRAPH_API = "https://graph.facebook.com/v20.0"


def verify_meta_signature(app_secret: str, body_bytes: bytes, signature_header: str) -> bool:
    if not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        app_secret.encode(), body_bytes, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


class FacebookAdapter(ChannelAdapter):
    channel_name = CHANNEL_FACEBOOK

    async def parse_incoming(
        self,
        raw_data: dict,
        client_id: str,
    ) -> Optional[NormalizedMessage]:
        """
        Parse Meta Messenger Platform webhook payload.

        Structure:
        {
          "object": "page",
          "entry": [{
            "id": "PAGE_ID",
            "messaging": [{
              "sender": {"id": "USER_PSID"},
              "recipient": {"id": "PAGE_ID"},
              "message": {"mid": "...", "text": "Hello"}
            }]
          }]
        }
        """
        if raw_data.get("object") != "page":
            return None

        for entry in raw_data.get("entry", []):
            page_id = entry.get("id", "")
            for event in entry.get("messaging", []):
                message = event.get("message", {})

                # Skip echo messages (messages sent BY the page)
                if message.get("is_echo"):
                    continue

                text = message.get("text", "").strip()
                sender_id = event.get("sender", {}).get("id", "")

                if not text or not sender_id:
                    continue

                return NormalizedMessage(
                    user_id=sender_id,
                    message=text,
                    channel=CHANNEL_FACEBOOK,
                    client_id=client_id,
                    metadata={
                        "page_id": page_id,
                        "message_id": message.get("mid", ""),
                    },
                )

        return None

    async def send_response(
        self,
        msg: NormalizedMessage,
        response_text: str,
        config: dict,
    ) -> None:
        """
        Send reply via Meta Graph API.
        messaging_type=RESPONSE is required for replies within 24h window.
        """
        page_access_token = config.get("page_access_token", "")
        if not page_access_token:
            logger.error("Facebook send failed: missing page_access_token for %s", msg.client_id)
            return

        payload = {
            "recipient": {"id": msg.user_id},
            "message": {"text": response_text},
            "messaging_type": "RESPONSE",
        }

        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                f"{GRAPH_API}/me/messages",
                params={"access_token": page_access_token},
                json=payload,
            )
            if not resp.is_success:
                logger.error("Messenger API error %s: %s", resp.status_code, resp.text)
