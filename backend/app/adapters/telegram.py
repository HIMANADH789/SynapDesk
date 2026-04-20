"""
Telegram adapter — Official Telegram Bot API (webhook mode).

Incoming: POST JSON from Telegram.
Outgoing: POST https://api.telegram.org/bot{TOKEN}/sendMessage
         OR inline JSON response (saves a round trip).

Config keys in institution settings.telegram_config:
  bot_token    — Token from @BotFather
  secret_token — Optional; set via setWebhook to validate X-Telegram-Bot-Api-Secret-Token header
"""
from __future__ import annotations
import logging
from typing import Optional

import httpx

from app.adapters.base import ChannelAdapter
from app.core.message import NormalizedMessage, CHANNEL_TELEGRAM

logger = logging.getLogger(__name__)


class TelegramAdapter(ChannelAdapter):
    channel_name = CHANNEL_TELEGRAM

    async def parse_incoming(
        self,
        raw_data: dict,
        client_id: str,
    ) -> Optional[NormalizedMessage]:
        """
        Parse Telegram Update object.

        {
          "update_id": 123,
          "message": {
            "message_id": 42,
            "from": {"id": 999, "first_name": "John"},
            "chat": {"id": 999, "type": "private"},
            "text": "Hello bot"
          }
        }
        """
        message = raw_data.get("message", {})
        text = message.get("text", "").strip()
        chat_id = message.get("chat", {}).get("id")

        if not text or not chat_id:
            return None

        return NormalizedMessage(
            user_id=str(chat_id),
            message=text,
            channel=CHANNEL_TELEGRAM,
            client_id=client_id,
            metadata={
                "chat_id": chat_id,
                "chat_type": message.get("chat", {}).get("type", "private"),
                "from_user": message.get("from", {}),
                "message_id": message.get("message_id"),
            },
        )

    async def send_response(
        self,
        msg: NormalizedMessage,
        response_text: str,
        config: dict,
    ) -> None:
        """Send via Telegram Bot API."""
        bot_token = config.get("bot_token", "")
        if not bot_token:
            logger.error("Telegram send failed: missing bot_token for %s", msg.client_id)
            return

        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": msg.user_id, "text": response_text},
            )
            if not resp.is_success:
                logger.error("Telegram API error %s: %s", resp.status_code, resp.text)
