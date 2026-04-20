"""
Slack adapter — Slack Events API.

CRITICAL: Slack requires a response within 3 seconds.
The handler uses FastAPI BackgroundTasks — we return 200 immediately,
then process and reply asynchronously.

Config keys in institution settings.slack_config:
  bot_token      — xoxb-... OAuth Bot Token
  signing_secret — From Slack App > Basic Information (for signature verification)
"""
from __future__ import annotations
import hashlib
import hmac
import logging
import re
import time
from typing import Optional

import httpx

from app.adapters.base import ChannelAdapter
from app.core.message import NormalizedMessage, CHANNEL_SLACK

logger = logging.getLogger(__name__)


def verify_slack_signature(signing_secret: str, body_bytes: bytes, timestamp: str, signature: str) -> bool:
    """
    Verify X-Slack-Signature using HMAC-SHA256.
    Also rejects requests older than 5 minutes (replay attack protection).
    """
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False  # replay attack
    except (ValueError, TypeError):
        return False

    base = f"v0:{timestamp}:{body_bytes.decode('utf-8')}"
    expected = "v0=" + hmac.new(signing_secret.encode(), base.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


class SlackAdapter(ChannelAdapter):
    channel_name = CHANNEL_SLACK

    async def parse_incoming(
        self,
        raw_data: dict,
        client_id: str,
    ) -> Optional[NormalizedMessage]:
        """
        Parse Slack Events API payload.
        Returns None for bot messages, url_verification, and empty text.
        """
        # URL verification is handled at the route level; skip here
        if raw_data.get("type") == "url_verification":
            return None

        if raw_data.get("type") != "event_callback":
            return None

        event = raw_data.get("event", {})
        event_type = event.get("type")

        if event_type not in ("message", "app_mention"):
            return None

        # Ignore bot messages and message subtypes (edits, deletions)
        if event.get("bot_id") or event.get("subtype"):
            return None

        text = event.get("text", "").strip()
        channel = event.get("channel", "")
        user = event.get("user", "")

        if not text or not channel:
            return None

        # Strip @mention prefix (<@BOTID> text → text)
        text = re.sub(r"<@[A-Z0-9]+>\s*", "", text).strip()
        if not text:
            return None

        return NormalizedMessage(
            user_id=f"{user}_{channel}",   # unique per user+channel combo
            message=text,
            channel=CHANNEL_SLACK,
            client_id=client_id,
            metadata={
                "channel": channel,
                "user": user,
                "thread_ts": event.get("thread_ts"),
                "ts": event.get("ts"),
                "event_id": raw_data.get("event_id"),
            },
        )

    async def send_response(
        self,
        msg: NormalizedMessage,
        response_text: str,
        config: dict,
    ) -> None:
        """Post reply to Slack channel."""
        bot_token = config.get("bot_token", "")
        if not bot_token:
            logger.error("Slack send failed: missing bot_token for %s", msg.client_id)
            return

        payload: dict = {
            "channel": msg.metadata.get("channel", msg.user_id),
            "text": response_text,
        }
        # Reply in thread if message was in a thread
        if msg.metadata.get("thread_ts"):
            payload["thread_ts"] = msg.metadata["thread_ts"]

        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {bot_token}"},
                json=payload,
            )
            data = resp.json()
            if not data.get("ok"):
                logger.error("Slack API error: %s", data.get("error"))
