from fastapi import APIRouter, Depends, HTTPException

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


# ── Super-admin endpoints ────────────────────────────────────────────────────

@router.get("/super-admin/overview")
async def super_admin_overview(user: dict = Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin access required")
    return await analytics_service.get_all_clients_usage()


@router.get("/super-admin/clients/{client_id}")
async def super_admin_client_detail(
    client_id: str,
    page: int = 1,
    page_size: int = 20,
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin access required")
    return await analytics_service.get_client_detail_usage(client_id, page, page_size)
