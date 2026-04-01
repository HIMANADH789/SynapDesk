from datetime import datetime, timezone

from app.db.mongodb import get_db
from app.db.collections import QUERY_LOGS, CLIENTS, DOCUMENTS
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


async def get_all_clients_usage() -> dict:
    db = get_db()

    # All clients
    clients = await db[CLIENTS].find({}, {"_id": 0, "client_id": 1, "name": 1, "created_at": 1}).to_list(length=200)

    # Aggregate query stats per client in one pass
    stats_pipeline = [
        {"$group": {
            "_id": "$client_id",
            "total_queries": {"$sum": 1},
            "avg_response_time_ms": {"$avg": "$response_time_ms"},
            "total_input_tokens": {"$sum": "$tokens_used.input_tokens"},
            "total_output_tokens": {"$sum": "$tokens_used.output_tokens"},
        }},
    ]
    stats_list = await db[QUERY_LOGS].aggregate(stats_pipeline).to_list(length=200)
    stats_by_client = {s["_id"]: s for s in stats_list}

    # Queries this month per client
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_pipeline = [
        {"$match": {"created_at": {"$gte": month_start}}},
        {"$group": {"_id": "$client_id", "queries_this_month": {"$sum": 1}}},
    ]
    month_list = await db[QUERY_LOGS].aggregate(month_pipeline).to_list(length=200)
    month_by_client = {m["_id"]: m["queries_this_month"] for m in month_list}

    # Queries today per client
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": "$client_id", "queries_today": {"$sum": 1}}},
    ]
    today_list = await db[QUERY_LOGS].aggregate(today_pipeline).to_list(length=200)
    today_by_client = {t["_id"]: t["queries_today"] for t in today_list}

    # Document count per client
    doc_pipeline = [
        {"$group": {"_id": "$client_id", "document_count": {"$sum": 1}}},
    ]
    doc_list = await db[DOCUMENTS].aggregate(doc_pipeline).to_list(length=200)
    docs_by_client = {d["_id"]: d["document_count"] for d in doc_list}

    result = []
    for client in clients:
        cid = client["client_id"]
        s = stats_by_client.get(cid, {})
        result.append({
            "client_id": cid,
            "name": client.get("name", cid),
            "created_at": client.get("created_at"),
            "total_queries": s.get("total_queries", 0),
            "queries_this_month": month_by_client.get(cid, 0),
            "queries_today": today_by_client.get(cid, 0),
            "avg_response_time_ms": round(s.get("avg_response_time_ms") or 0, 1),
            "total_input_tokens": s.get("total_input_tokens") or 0,
            "total_output_tokens": s.get("total_output_tokens") or 0,
            "document_count": docs_by_client.get(cid, 0),
        })

    total_queries = sum(r["total_queries"] for r in result)
    total_input_tokens = sum(r["total_input_tokens"] for r in result)
    total_output_tokens = sum(r["total_output_tokens"] for r in result)

    return {
        "clients": result,
        "total_clients": len(result),
        "platform_total_queries": total_queries,
        "platform_total_input_tokens": total_input_tokens,
        "platform_total_output_tokens": total_output_tokens,
    }


async def get_client_detail_usage(client_id: str, page: int = 1, page_size: int = 20) -> dict:
    """Full usage detail for one client — used by super-admin drill-down."""
    usage = await get_usage_stats(client_id)

    db = get_db()

    # LLM provider breakdown
    provider_pipeline = [
        {"$match": {"client_id": client_id}},
        {"$group": {"_id": "$llm_provider", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    providers = await db[QUERY_LOGS].aggregate(provider_pipeline).to_list(length=20)
    provider_breakdown = [{"provider": p["_id"], "count": p["count"]} for p in providers]

    # Token totals
    token_pipeline = [
        {"$match": {"client_id": client_id}},
        {"$group": {
            "_id": None,
            "total_input": {"$sum": "$tokens_used.input_tokens"},
            "total_output": {"$sum": "$tokens_used.output_tokens"},
        }},
    ]
    token_result = await db[QUERY_LOGS].aggregate(token_pipeline).to_list(length=1)
    tokens = token_result[0] if token_result else {}

    # Document count
    doc_count = await db[DOCUMENTS].count_documents({"client_id": client_id})

    # Paginated query logs
    logs_data = await get_query_logs(client_id, page, page_size)

    return {
        **usage,
        "provider_breakdown": provider_breakdown,
        "total_input_tokens": tokens.get("total_input") or 0,
        "total_output_tokens": tokens.get("total_output") or 0,
        "document_count": doc_count,
        "logs": logs_data["logs"],
        "logs_total": logs_data["total"],
        "logs_page": logs_data["page"],
        "logs_page_size": logs_data["page_size"],
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
