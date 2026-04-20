"""
Channel authentication.

┌─────────────┬──────────────────────────────┬─────────────────────────────────┐
│ Channel     │ Security mechanism           │ Why                             │
├─────────────┼──────────────────────────────┼─────────────────────────────────┤
│ widget      │ allowed_origins (Origin hdr) │ Browser always sends Origin.    │
│             │                              │ Copying the <script> tag to     │
│             │                              │ another domain → server rejects.│
│             │                              │ No secret needed in HTML.       │
├─────────────┼──────────────────────────────┼─────────────────────────────────┤
│ web_api     │ X-API-Key token              │ Server-side callers never send  │
│             │                              │ Origin. Token = API key kept    │
│             │                              │ secret in the institution's     │
│             │                              │ backend env vars.               │
└─────────────┴──────────────────────────────┴─────────────────────────────────┘

Tokens for widget are intentionally NOT supported — a token in a <script> tag
is visible to anyone who views page source, giving zero security benefit once
origin enforcement is in place.
"""
from fastapi import HTTPException, Request

from app.db.mongodb import get_db
from app.db.collections import CLIENTS
from app.models.client import get_setup

_DEV_ORIGINS = {"localhost", "127.0.0.1", "::1"}


def _origin_allowed(origin: str, allowed: list[str]) -> bool:
    host = origin.split("://")[-1].split(":")[0].split("/")[0]
    if host in _DEV_ORIGINS:
        return True
    return origin in allowed


async def check_widget_auth(request: Request, client_id: str, channel: str = "widget") -> None:
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id}, {"settings": 1})
    if not client:
        raise HTTPException(404, "Institution not found")

    cfg = get_setup(client.get("settings", {}), channel)

    if not cfg.get("enabled", True):
        raise HTTPException(403, f"The {channel} channel is not enabled for this institution.")

    # ── Widget: Origin-based enforcement ─────────────────────────────────────
    if channel == "widget":
        allowed_origins: list = cfg.get("allowed_origins", []) or []
        if allowed_origins:
            origin = request.headers.get("origin", "").strip().rstrip("/")
            if not origin:
                raise HTTPException(
                    403,
                    "Origin header missing. The widget must be embedded in a browser page on an allowed domain.",
                )
            if not _origin_allowed(origin, allowed_origins):
                raise HTTPException(
                    403,
                    f"Domain '{origin}' is not authorised for this widget.",
                )
        return  # widget has no token check

    # ── web_api: Token (API key) enforcement ─────────────────────────────────
    if channel == "web_api":
        token: str = cfg.get("token", "") or ""
        if token:
            provided = request.headers.get("x-api-key", "") or request.headers.get("x-widget-token", "")
            if provided != token:
                raise HTTPException(
                    401,
                    "Invalid or missing API key. Include it as X-Api-Key header.",
                )
