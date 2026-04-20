"""
Abstract base class for all channel adapters.

To add a new channel:
  1. Subclass ChannelAdapter
  2. Implement parse_incoming() and send_response()
  3. Register the instance in factory.py
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional

from app.core.message import NormalizedMessage


class ChannelAdapter(ABC):
    """
    Bidirectional bridge between a messaging platform and the chatbot core.

    parse_incoming : platform payload → NormalizedMessage
    send_response  : NormalizedMessage + answer text → platform API call
    """

    #: Must be set by every subclass, e.g. "whatsapp", "telegram"
    channel_name: str = ""

    @abstractmethod
    async def parse_incoming(
        self,
        raw_data: dict,
        client_id: str,
    ) -> Optional[NormalizedMessage]:
        """
        Convert a platform-specific payload into a NormalizedMessage.

        Return None if the event should be silently ignored
        (e.g. echo messages, delivery receipts, status updates).
        """

    @abstractmethod
    async def send_response(
        self,
        msg: NormalizedMessage,
        response_text: str,
        config: dict,
    ) -> None:
        """
        Deliver response_text back to the user via this channel's API.

        config: The institution's platform-specific settings dict
                (e.g. access_token, bot_token, page_access_token …)
        """
