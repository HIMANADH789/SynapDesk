"""
IP-level rate limiter — enforces per-minute AND per-day limits per (client_id, IP, channel).
Reads limits from the per-setup config (settings.setups.{channel}) with fallback to defaults.
"""
import time
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_db
from app.db.collections import CLIENTS, IP_RATE_LIMITS_MIN, IP_RATE_LIMITS_DAY
from app.models.client import get_setup

DEFAULT_RPM = 20
DEFAULT_RPD = 200


async def _increment_window(collection: str, client_id: str, ip: str, channel: str, window: int) -> int:
    """
    Upsert a window counter keyed by (client_id, ip, channel, window) and return new count.
    Handles DuplicateKeyError (race condition) by falling back to update_one.
    """
    db = get_db()
    filter_q = {"client_id": client_id, "ip": ip, "channel": channel, "window": window}
    try:
        result = await db[collection].find_one_and_update(
            filter_q,
            {
                "$inc": {"count": 1},
                "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
            },
            upsert=True,
            return_document=True,
        )
        return result["count"] if result else 1
    except DuplicateKeyError:
        # Race condition: another request inserted the document between our find and insert.
        # Retry as a simple update (no upsert) and read the result.
        await db[collection].update_one(filter_q, {"$inc": {"count": 1}})
        doc = await db[collection].find_one(filter_q, {"count": 1})
        return doc["count"] if doc else 1


async def check_ip_rate_limit(request: Request, client_id: str, channel: str = "widget") -> None:
    """
    Enforce per-minute and per-day IP rate limits for a specific setup channel.
    Raises HTTP 429 if either limit is exceeded.
    """
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else "unknown"
    )

    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": client_id}, {"settings": 1})
    settings = (client or {}).get("settings", {})
    cfg = get_setup(settings, channel)

    rpm_limit = cfg.get("rate_limit_rpm", DEFAULT_RPM)
    rpd_limit = cfg.get("rate_limit_rpd", DEFAULT_RPD)

    now = int(time.time())

    if rpm_limit > 0:
        minute_window = now // 60
        count = await _increment_window(IP_RATE_LIMITS_MIN, client_id, ip, channel, minute_window)
        if count > rpm_limit:
            raise HTTPException(
                429,
                f"Rate limit exceeded: max {rpm_limit} requests/minute from your IP on {channel}.",
            )

    if rpd_limit > 0:
        day_window = now // 86400
        count = await _increment_window(IP_RATE_LIMITS_DAY, client_id, ip, channel, day_window)
        if count > rpd_limit:
            raise HTTPException(
                429,
                f"Daily limit reached: max {rpd_limit} requests/day from your IP on {channel}.",
            )
