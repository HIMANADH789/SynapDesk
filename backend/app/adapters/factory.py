"""
Adapter registry — maps channel names to their ChannelAdapter instances.
Import and call register() once at startup; then use get() anywhere.
"""
from __future__ import annotations
from typing import Optional
from app.adapters.base import ChannelAdapter

_registry: dict[str, ChannelAdapter] = {}


def register(adapter: ChannelAdapter) -> None:
    """Register a channel adapter under its channel_name."""
    _registry[adapter.channel_name] = adapter


def get(channel_name: str) -> Optional[ChannelAdapter]:
    """Return the adapter for channel_name, or None if not registered."""
    return _registry.get(channel_name)


def all_channels() -> list[str]:
    return list(_registry.keys())
