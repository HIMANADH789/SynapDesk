"""
Normalized message — the single data contract between all channel adapters
and the chatbot core. Every platform's incoming message is converted to this
format before touching the RAG pipeline.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


CHANNEL_WEB = "web"
CHANNEL_WHATSAPP = "whatsapp"
CHANNEL_FACEBOOK = "facebook"
CHANNEL_TELEGRAM = "telegram"
CHANNEL_SLACK = "slack"

ALL_CHANNELS = [CHANNEL_WEB, CHANNEL_WHATSAPP, CHANNEL_FACEBOOK, CHANNEL_TELEGRAM, CHANNEL_SLACK]


@dataclass
class NormalizedMessage:
    """
    Platform-agnostic representation of an incoming user message.

    channel:   "web" | "whatsapp" | "facebook" | "telegram" | "slack"
    user_id:   Opaque identifier for the sender within that channel
               (WhatsApp phone number, Telegram chat_id, Slack user+channel, etc.)
    message:   Plain-text content of the message
    client_id: Institution (tenant) that owns this chatbot instance
    session_id: Stable key used to maintain conversation history.
                Auto-derived from channel + user_id if not provided.
    metadata:  All platform-specific extras (phone_number_id, page_id, etc.)
    """
    user_id: str
    message: str
    channel: str
    client_id: str
    metadata: dict = field(default_factory=dict)
    session_id: Optional[str] = None

    def __post_init__(self) -> None:
        if not self.session_id:
            # Sanitize user_id for use as a MongoDB-safe key
            safe_uid = self.user_id.replace("+", "").replace(":", "_").replace("@", "_")
            self.session_id = f"{self.channel}_{safe_uid}"
