from pydantic import BaseModel


class UsageStats(BaseModel):
    total_queries: int
    queries_today: int
    avg_response_time_ms: float
    top_queries: list[dict]
    remaining_llm_quota: int
