"""
Semantic query cache backed by MongoDB.
Stores query embeddings and exact responses. On each new query, computes
cosine similarity against cached entries for the same client. If a match
exceeds the threshold the cached answer is returned, saving an LLM call.

Cache is invalidated per-client whenever a document is uploaded or deleted.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.db.mongodb import get_db
from app.db.collections import QUERY_CACHE
from app.config import settings


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
    Return a cached result dict {response, sources} if a semantically similar
    query exists, otherwise None.
    """
    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.CACHE_TTL_HOURS)

    # Load all cached entries for this client within TTL window
    cursor = db[QUERY_CACHE].find(
        {"client_id": client_id, "created_at": {"$gte": cutoff}},
        {"_id": 1, "query_embedding": 1, "response": 1, "sources": 1},
    )
    entries = await cursor.to_list(length=2000)

    best_score = 0.0
    best_entry = None
    for entry in entries:
        sim = _cosine_similarity(query_embedding, entry["query_embedding"])
        if sim > best_score:
            best_score = sim
            best_entry = entry

    if best_score >= settings.CACHE_SIMILARITY_THRESHOLD and best_entry:
        # Increment hit counter asynchronously (fire-and-forget)
        await db[QUERY_CACHE].update_one(
            {"_id": best_entry["_id"]},
            {"$inc": {"hit_count": 1}},
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
    })


async def invalidate_client_cache(client_id: str) -> None:
    """Call this whenever documents are added or removed for a client."""
    db = get_db()
    await db[QUERY_CACHE].delete_many({"client_id": client_id})
