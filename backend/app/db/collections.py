from app.db.mongodb import get_db

CLIENTS = "clients"
USERS = "users"
DOCUMENTS = "documents"
QUERY_LOGS = "query_logs"
CHAT_SESSIONS = "chat_sessions"
QUERY_CACHE = "query_cache"
IP_RATE_LIMITS_MIN = "ip_rate_limits_min"   # per-minute windows, TTL 120s
IP_RATE_LIMITS_DAY = "ip_rate_limits_day"   # per-day windows, TTL 172800s
PLATFORM_CONFIG = "platform_config"


async def create_indexes() -> None:
    db = get_db()

    await db[CLIENTS].create_index("client_id", unique=True)
    await db[USERS].create_index("email", unique=True)
    await db[USERS].create_index("client_id")
    await db[DOCUMENTS].create_index("doc_id", unique=True)
    await db[DOCUMENTS].create_index("client_id")
    await db[QUERY_LOGS].create_index([("client_id", 1), ("created_at", -1)])
    await db[QUERY_LOGS].create_index("session_id")
    await db[CHAT_SESSIONS].create_index("session_id", unique=True)
    await db[CHAT_SESSIONS].create_index("client_id")
    await db[QUERY_CACHE].create_index([("client_id", 1), ("created_at", -1)])
    await db[QUERY_CACHE].create_index([("client_id", 1), ("hit_count", -1)])
    # TTL: auto-expire cache entries after CACHE_TTL_HOURS (default 24h)
    try:
        from app.config import settings as _s
        await db[QUERY_CACHE].create_index(
            "created_at", expireAfterSeconds=int(_s.CACHE_TTL_HOURS * 3600), name="cache_ttl"
        )
    except Exception:
        pass
    await db[PLATFORM_CONFIG].create_index("key", unique=True)

    # Per-minute rate limit windows — keyed by (client_id, ip, channel, window)
    # Drop old index (without channel) if it exists, then create new one
    for col, ttl in [(IP_RATE_LIMITS_MIN, 120), (IP_RATE_LIMITS_DAY, 172800)]:
        try:
            await db[col].create_index(
                [("client_id", 1), ("ip", 1), ("channel", 1), ("window", 1)],
                unique=True,
                name="client_ip_channel_window",
            )
        except Exception:
            # Index likely exists with old schema (no channel). Drop all and recreate.
            try:
                await db[col].drop_indexes()
                await db[col].create_index(
                    [("client_id", 1), ("ip", 1), ("channel", 1), ("window", 1)],
                    unique=True,
                    name="client_ip_channel_window",
                )
            except Exception:
                pass
        try:
            await db[col].create_index("created_at", expireAfterSeconds=ttl, name=f"ttl_{ttl}")
        except Exception:
            pass
