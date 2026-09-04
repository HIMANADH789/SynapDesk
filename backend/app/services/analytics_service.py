from datetime import datetime, timezone

from app.db.mongodb import get_db
from app.db.collections import QUERY_LOGS, CLIENTS, DOCUMENTS
from app.services.rag_service import get_remaining_quota

ALL_CHANNELS = ["widget", "web_api", "whatsapp", "facebook", "telegram", "slack"]


async def _channel_breakdown(client_id: str) -> list:
    """Aggregate query count + avg response time per channel for one institution."""
    db = get_db()
    match = {"client_id": client_id}
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$ifNull": ["$channel", "widget"]},
            "total": {"$sum": 1},
            "avg_ms": {"$avg": "$response_time_ms"},
            "input_tokens": {"$sum": "$tokens_used.input_tokens"},
            "output_tokens": {"$sum": "$tokens_used.output_tokens"},
        }},
    ]
    rows = await db[QUERY_LOGS].aggregate(pipeline).to_list(length=20)
    by_ch = {r["_id"]: r for r in rows}
    result = []
    for ch in ALL_CHANNELS:
        r = by_ch.get(ch, {})
        result.append({
            "channel": ch,
            "total_queries": r.get("total", 0),
            "avg_response_time_ms": round(r.get("avg_ms") or 0, 1),
            "input_tokens": r.get("input_tokens") or 0,
            "output_tokens": r.get("output_tokens") or 0,
        })
    return result


async def _daily_trend(client_id: str, days: int = 7) -> list:
    """Last N days of query counts (all channels combined)."""
    db = get_db()
    match = {"client_id": client_id}
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": -1}},
        {"$limit": days},
    ]
    rows = await db[QUERY_LOGS].aggregate(pipeline).to_list(length=days)
    return [{"date": r["_id"], "count": r["count"]} for r in reversed(rows)]


async def get_usage_stats(client_id: str) -> dict:
    db = get_db()

    match = {"client_id": client_id}

    total_queries = await db[QUERY_LOGS].count_documents(match)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    queries_today = await db[QUERY_LOGS].count_documents({
        **match,
        "created_at": {"$gte": today_start},
    })

    pipeline = [
        {"$match": match},
        {"$group": {"_id": None, "avg_time": {"$avg": "$response_time_ms"}}},
    ]
    avg_result = await db[QUERY_LOGS].aggregate(pipeline).to_list(length=1)
    avg_response_time = avg_result[0]["avg_time"] if avg_result else 0

    top_pipeline = [
        {"$match": match},
        {"$group": {"_id": "$query", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_queries = await db[QUERY_LOGS].aggregate(top_pipeline).to_list(length=10)
    top_queries = [{"query": q["_id"], "count": q["count"]} for q in top_queries]

    channel_breakdown = await _channel_breakdown(client_id)
    daily_trend = await _daily_trend(client_id, 7)

    return {
        "total_queries": total_queries,
        "queries_today": queries_today,
        "avg_response_time_ms": round(avg_response_time, 1),
        "top_queries": top_queries,
        "channel_breakdown": channel_breakdown,
        "daily_trend": daily_trend,
        "remaining_llm_quota": get_remaining_quota(),
    }


async def get_channel_stats(client_id: str, channel: str) -> dict:
    """Detailed stats for one specific channel."""
    db = get_db()

    match = {"client_id": client_id, "channel": channel}
    # Legacy logs may have channel=None — treat them as "widget"
    if channel == "widget":
        match = {"client_id": client_id, "$or": [{"channel": "widget"}, {"channel": None}, {"channel": {"$exists": False}}]}

    total = await db[QUERY_LOGS].count_documents(match)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today = await db[QUERY_LOGS].count_documents({**match, "created_at": {"$gte": today_start}})

    agg = [
        {"$match": match},
        {"$group": {
            "_id": None,
            "avg_ms": {"$avg": "$response_time_ms"},
            "input_tokens": {"$sum": "$tokens_used.input_tokens"},
            "output_tokens": {"$sum": "$tokens_used.output_tokens"},
            "cache_hits": {"$sum": {"$cond": [{"$eq": ["$cache_hit", True]}, 1, 0]}},
        }},
    ]
    agg_result = await db[QUERY_LOGS].aggregate(agg).to_list(length=1)
    stats = agg_result[0] if agg_result else {}

    top_pipeline = [
        {"$match": match},
        {"$group": {"_id": "$query", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_queries = await db[QUERY_LOGS].aggregate(top_pipeline).to_list(length=10)

    daily_pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 14},
    ]
    daily = await db[QUERY_LOGS].aggregate(daily_pipeline).to_list(length=14)

    return {
        "channel": channel,
        "total_queries": total,
        "queries_today": today,
        "avg_response_time_ms": round(stats.get("avg_ms") or 0, 1),
        "input_tokens": stats.get("input_tokens") or 0,
        "output_tokens": stats.get("output_tokens") or 0,
        "cache_hits": stats.get("cache_hits") or 0,
        "top_queries": [{"query": q["_id"], "count": q["count"]} for q in top_queries],
        "daily_trend": [{"date": d["_id"], "count": d["count"]} for d in reversed(daily)],
    }


async def get_all_clients_usage() -> dict:
    db = get_db()
    clients = await db[CLIENTS].find({}, {"_id": 0, "client_id": 1, "name": 1, "created_at": 1}).to_list(200)

    stats_pipeline = [
        {"$group": {
            "_id": "$client_id",
            "total_queries": {"$sum": 1},
            "avg_response_time_ms": {"$avg": "$response_time_ms"},
            "total_input_tokens": {"$sum": "$tokens_used.input_tokens"},
            "total_output_tokens": {"$sum": "$tokens_used.output_tokens"},
        }},
    ]
    stats_list = await db[QUERY_LOGS].aggregate(stats_pipeline).to_list(200)
    stats_by_client = {s["_id"]: s for s in stats_list}

    # Per-channel totals across all clients
    channel_pipeline = [
        {"$group": {
            "_id": {"$ifNull": ["$channel", "widget"]},
            "count": {"$sum": 1},
        }},
    ]
    ch_rows = await db[QUERY_LOGS].aggregate(channel_pipeline).to_list(20)
    platform_channel_breakdown = {r["_id"]: r["count"] for r in ch_rows}

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": "$client_id", "queries_today": {"$sum": 1}}},
    ]
    today_by_client = {t["_id"]: t["queries_today"] for t in await db[QUERY_LOGS].aggregate(today_pipeline).to_list(200)}

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_pipeline = [
        {"$match": {"created_at": {"$gte": month_start}}},
        {"$group": {"_id": "$client_id", "queries_this_month": {"$sum": 1}}},
    ]
    month_by_client = {m["_id"]: m["queries_this_month"] for m in await db[QUERY_LOGS].aggregate(month_pipeline).to_list(200)}

    doc_pipeline = [{"$group": {"_id": "$client_id", "document_count": {"$sum": 1}}}]
    docs_by_client = {d["_id"]: d["document_count"] for d in await db[DOCUMENTS].aggregate(doc_pipeline).to_list(200)}

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

    return {
        "clients": result,
        "total_clients": len(result),
        "platform_total_queries": sum(r["total_queries"] for r in result),
        "platform_total_input_tokens": sum(r["total_input_tokens"] for r in result),
        "platform_total_output_tokens": sum(r["total_output_tokens"] for r in result),
        "platform_channel_breakdown": platform_channel_breakdown,
    }


async def get_client_detail_usage(client_id: str, page: int = 1, page_size: int = 20) -> dict:
    usage = await get_usage_stats(client_id)
    db = get_db()

    token_pipeline = [
        {"$match": {"client_id": client_id}},
        {"$group": {
            "_id": None,
            "total_input": {"$sum": "$tokens_used.input_tokens"},
            "total_output": {"$sum": "$tokens_used.output_tokens"},
        }},
    ]
    token_result = await db[QUERY_LOGS].aggregate(token_pipeline).to_list(1)
    tokens = token_result[0] if token_result else {}

    doc_count = await db[DOCUMENTS].count_documents({"client_id": client_id})
    logs_data = await get_query_logs(client_id, page, page_size)

    return {
        **usage,
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
    match = {"client_id": client_id}
    cursor = db[QUERY_LOGS].find(match, {"_id": 0}).sort("created_at", -1).skip(skip).limit(page_size)
    logs = await cursor.to_list(length=page_size)
    total = await db[QUERY_LOGS].count_documents(match)
    return {"logs": logs, "total": total, "page": page, "page_size": page_size}


async def get_webhook_logs(
    client_id: str,
    channel: str | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    """
    Retrieve comprehensive request, webhook, and response logs for monitoring.
    Includes full raw incoming payload, outgoing payload, Meta API responses, and errors.
    """
    db = get_db()
    skip = (page - 1) * page_size
    match: dict = {"client_id": client_id}

    if channel and channel != "all":
        match["channel"] = channel

    if status and status != "all":
        if status == "errors":
            match["status"] = {"$in": ["rag_error", "adapter_send_error", "meta_api_error", "signature_failed", "invalid_json"]}
        elif status == "messages":
            match["status"] = {"$in": ["response_sent", "message_received", "delivered", "ok"]}
        elif status == "receipts":
            match["status"] = {"$regex": "^receipt_"}
        else:
            match["status"] = status

    if search and search.strip():
        s = search.strip()
        regex = {"$regex": s, "$options": "i"}
        match["$or"] = [
            {"message_in": regex},
            {"response_out": regex},
            {"sender_id": regex},
            {"sender_name": regex},
            {"status": regex},
            {"error": regex},
        ]

    cursor = db["webhook_logs"].find(match).sort("timestamp", -1).skip(skip).limit(page_size)
    logs = await cursor.to_list(length=page_size)
    total = await db["webhook_logs"].count_documents(match)

    serialized_logs = []
    for log in logs:
        item = dict(log)
        if "_id" in item:
            item["id"] = str(item.pop("_id"))
        if item.get("timestamp") and hasattr(item["timestamp"], "isoformat"):
            item["timestamp"] = item["timestamp"].isoformat()
        serialized_logs.append(item)

    return {
        "logs": serialized_logs,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
