from fastapi import APIRouter, Depends

from app.api.auth import get_current_user
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/usage")
async def get_usage(user: dict = Depends(get_current_user)):
    return await analytics_service.get_usage_stats(user["client_id"])


@router.get("/queries")
async def get_queries(
    page: int = 1,
    page_size: int = 20,
    user: dict = Depends(get_current_user),
):
    return await analytics_service.get_query_logs(user["client_id"], page, page_size)
