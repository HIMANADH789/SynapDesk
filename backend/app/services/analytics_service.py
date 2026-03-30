from datetime import datetime, timezone

from app.db.mongodb import get_db
from app.db.collections import QUERY_LOGS
from app.services.rag_service import get_remaining_quota


async def get_usage_stats(client_id: str) -> dict:
    db = get_db()

    # Total queries
    total_queries = await db[QUERY_LOGS].count_documents({"client_id": client_id})

    # Queries today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    queries_today = await db[QUERY_LOGS].count_documents({
        "client_id": client_id,
        "created_at": {"$gte": today_start},
    })

    # Average response time
    pipeline = [
        {"$match": {"client_id": client_id}},
        {"$group": {"_id": None, "avg_time": {"$avg": "$response_time_ms"}}},
    ]
    avg_result = await db[QUERY_LOGS].aggregate(pipeline).to_list(length=1)
    avg_response_time = avg_result[0]["avg_time"] if avg_result else 0

    # Top queries (most frequent)
    top_pipeline = [
        {"$match": {"client_id": client_id}},
        {"$group": {"_id": "$query", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_queries = await db[QUERY_LOGS].aggregate(top_pipeline).to_list(length=10)
    top_queries = [{"query": q["_id"], "count": q["count"]} for q in top_queries]

    return {
        "total_queries": total_queries,
        "queries_today": queries_today,
        "avg_response_time_ms": round(avg_response_time, 1),
        "top_queries": top_queries,
        "remaining_llm_quota": get_remaining_quota(),
    }


async def get_query_logs(client_id: str, page: int = 1, page_size: int = 20) -> dict:
    db = get_db()
    skip = (page - 1) * page_size
    cursor = db[QUERY_LOGS].find(
        {"client_id": client_id},
        {"_id": 0},
    ).sort("created_at", -1).skip(skip).limit(page_size)
    logs = await cursor.to_list(length=page_size)
    total = await db[QUERY_LOGS].count_documents({"client_id": client_id})
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
