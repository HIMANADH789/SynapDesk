"""
Semantic query cache backed by MongoDB.

Stores query embeddings + responses. On each new query the embedding is
compared via cosine similarity against all cached entries for the same client
within the TTL window. If the best match exceeds CACHE_SIMILARITY_THRESHOLD
the cached answer is returned, saving an LLM call.

Near-duplicate matching:
  - Threshold 0.85 catches paraphrases, synonyms, minor word-order changes.
  - Raw query text is stored for debugging only; matching is purely vector-based.
  - Cache is invalidated per-client on every document upload or delete.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.db.mongodb import get_db
from app.db.collections import QUERY_CACHE
from app.config import settings

# Maximum entries to scan per client per request (performance guard)
_MAX_SCAN = 500


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


async def check_cache(
    client_id: str,
    query_embedding: list[float],
) -> Optional[dict]:
    """
    Return {response, sources} if a semantically similar cached entry exists,
    otherwise None.  Scans the most-recently-hit entries first so frequent
    queries are found quickly.
    """
    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.CACHE_TTL_HOURS)

    cursor = db[QUERY_CACHE].find(
        {"client_id": client_id, "created_at": {"$gte": cutoff}},
        {"_id": 1, "query_embedding": 1, "response": 1, "sources": 1},
    ).sort("hit_count", -1).limit(_MAX_SCAN)

    entries = await cursor.to_list(length=_MAX_SCAN)

    best_score = 0.0
    best_entry = None
    for entry in entries:
        sim = _cosine_similarity(query_embedding, entry["query_embedding"])
        if sim > best_score:
            best_score = sim
            best_entry = entry

    if best_score >= settings.CACHE_SIMILARITY_THRESHOLD and best_entry:
        await db[QUERY_CACHE].update_one(
            {"_id": best_entry["_id"]},
            {"$inc": {"hit_count": 1}, "$set": {"last_hit_at": datetime.now(timezone.utc)}},
        )
        return {"response": best_entry["response"], "sources": best_entry["sources"]}

    return None


async def store_cache(
    client_id: str,
    query_text: str,
    query_embedding: list[float],
    response: str,
    sources: list,
) -> None:
    db = get_db()
    await db[QUERY_CACHE].insert_one({
        "client_id": client_id,
        "query_text": query_text,
        "query_embedding": query_embedding,
        "response": response,
        "sources": sources,
        "created_at": datetime.now(timezone.utc),
        "hit_count": 0,
        "last_hit_at": None,
    })


async def invalidate_client_cache(client_id: str) -> None:
    """Call this whenever documents are added, updated, or removed for a client."""
    db = get_db()
    result = await db[QUERY_CACHE].delete_many({"client_id": client_id})
    return result.deleted_count
