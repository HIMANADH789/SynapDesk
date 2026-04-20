from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

# ── Setup registry ─────────────────────────────────────────────────────────────

ALL_SETUPS = ["widget", "web_api", "whatsapp", "facebook", "telegram", "slack"]

SETUP_META = {
    "widget":   {"label": "Website Widget",      "emoji": "🌐", "always_available": True},
    "web_api":  {"label": "REST API",            "emoji": "⚡", "always_available": True},
    "whatsapp": {"label": "WhatsApp Business",   "emoji": "💬", "always_available": False},
    "facebook": {"label": "Facebook Messenger",  "emoji": "💙", "always_available": False},
    "telegram": {"label": "Telegram Bot",        "emoji": "✈️", "always_available": False},
    "slack":    {"label": "Slack Bot",           "emoji": "🟣", "always_available": False},
}


def setup_defaults(channel: str) -> dict:
    """Return the default config dict for a channel setup."""
    base: dict = {
        "enabled": channel in ("widget", "web_api"),
        "rate_limit_rpm": 20,
        "rate_limit_rpd": 200,
        "max_queries_per_session": 50,
    }
    if channel == "widget":
        base.update({"allowed_origins": []})   # secured by Origin header, no token needed
    elif channel == "web_api":
        base.update({"token": ""})             # secured by API key (token), no Origin (server-side)
    elif channel == "whatsapp":
        base.update({
            "phone_number_id": "", "access_token": "",
            "app_secret": "", "verify_token": "",
        })
    elif channel == "facebook":
        base.update({
            "page_id": "", "page_access_token": "",
            "app_secret": "", "verify_token": "",
        })
    elif channel == "telegram":
        base.update({"bot_token": "", "secret_token": ""})
    elif channel == "slack":
        base.update({"bot_token": "", "signing_secret": ""})
    return base


def default_setups() -> dict:
    return {ch: setup_defaults(ch) for ch in ALL_SETUPS}


def get_setup(settings: dict, channel: str) -> dict:
    """
    Read a setup config from the settings dict, filling any missing keys
    with defaults. Works for both new (setups-based) and legacy documents.
    """
    setups = settings.get("setups") or {}
    cfg = dict(setups.get(channel, {}))

    # Fill missing keys from defaults
    defaults = setup_defaults(channel)
    for k, v in defaults.items():
        if k not in cfg:
            cfg[k] = v

    # Legacy migration: pull old top-level fields if setups not present
    if not setups:
        if channel == "widget":
            cfg["token"] = settings.get("widget_token", "")
            cfg["allowed_origins"] = settings.get("allowed_origins", [])
            cfg["rate_limit_rpm"] = settings.get("ip_rate_limit_rpm", 20)
            cfg["rate_limit_rpd"] = settings.get("ip_rate_limit_rpd", 200)
            cfg["max_queries_per_session"] = settings.get("max_queries_per_session", 50)
            cfg["enabled"] = True
        elif channel == "web_api":
            cfg["rate_limit_rpm"] = settings.get("ip_rate_limit_rpm", 20)
            cfg["rate_limit_rpd"] = settings.get("ip_rate_limit_rpd", 200)
            cfg["max_queries_per_session"] = settings.get("max_queries_per_session", 50)
            cfg["enabled"] = True
        elif channel == "whatsapp":
            old = settings.get("whatsapp_config") or {}
            cfg.update({k: old.get(k, "") for k in ("phone_number_id", "access_token", "app_secret", "verify_token")})
        elif channel == "facebook":
            old = settings.get("facebook_config") or {}
            cfg.update({k: old.get(k, "") for k in ("page_id", "page_access_token", "app_secret", "verify_token")})
        elif channel == "telegram":
            old = settings.get("telegram_config") or {}
            cfg.update({k: old.get(k, "") for k in ("bot_token", "secret_token")})
        elif channel == "slack":
            old = settings.get("slack_config") or {}
            cfg.update({k: old.get(k, "") for k in ("bot_token", "signing_secret")})

    return cfg


# ── Pydantic models ────────────────────────────────────────────────────────────

class ClientSettings(BaseModel):
    # Global chat behaviour
    welcome_message: str = "Hello! How can I help you today?"
    system_prompt: Optional[str] = None
    max_history_turns: int = 5
    theme_color: str = "#1E40AF"

    # Per-setup configs (widget, web_api, whatsapp, facebook, telegram, slack)
    setups: Dict[str, Any] = Field(default_factory=default_setups)


class ClientCreate(BaseModel):
    client_id: str
    name: str
    domain: str = ""
    settings: ClientSettings = Field(default_factory=ClientSettings)


class ClientResponse(BaseModel):
    client_id: str
    name: str
    domain: str
    settings: ClientSettings
