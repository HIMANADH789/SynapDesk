from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user
from app.db.mongodb import get_db
from app.db.collections import CLIENTS
from app.models.client import ClientCreate

router = APIRouter(prefix="/clients", tags=["clients"])


@router.post("")
async def create_client(
    request: ClientCreate,
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Only super admins can create clients")

    db = get_db()
    existing = await db[CLIENTS].find_one({"client_id": request.client_id})
    if existing:
        raise HTTPException(400, "Client ID already exists")

    client = {
        "client_id": request.client_id,
        "name": request.name,
        "domain": request.domain,
        "settings": request.settings.model_dump(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db[CLIENTS].insert_one(client)
    return {"message": "Client created", "client_id": request.client_id}


@router.get("")
async def list_clients(user: dict = Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Only super admins can list clients")

    db = get_db()
    cursor = db[CLIENTS].find({}, {"_id": 0})
    clients = await cursor.to_list(length=100)
    return {"clients": clients, "total": len(clients)}


# Must be before /{client_id} to avoid "me" being matched as a client_id
@router.get("/me/profile")
async def get_my_profile(user: dict = Depends(get_current_user)):
    db = get_db()
    client_id = user["client_id"]
    client = await db[CLIENTS].find_one({"client_id": client_id}, {"_id": 0})
    return {
        "email": user["sub"],
        "client_id": client_id,
        "role": user["role"],
        "client": client,
    }


@router.get("/{client_id}")
async def get_client(client_id: str):
    # Public endpoint — only exposes non-sensitive settings (welcome message, theme, etc.)
    db = get_db()
    client = await db[CLIENTS].find_one(
        {"client_id": client_id},
        {"_id": 0, "settings.welcome_message": 1, "settings.theme_color": 1, "name": 1},
    )
    if not client:
        raise HTTPException(404, "Client not found")
    return client


@router.patch("/{client_id}/settings")
async def update_client_settings(
    client_id: str,
    settings: dict,
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "super_admin" and user.get("client_id") != client_id:
        raise HTTPException(403, "Access denied")

    db = get_db()
    allowed_keys = {"welcome_message", "system_prompt", "theme_color", "max_history_turns"}
    update_fields = {
        f"settings.{k}": v for k, v in settings.items() if k in allowed_keys
    }
    if not update_fields:
        raise HTTPException(400, "No valid settings fields provided")

    update_fields["updated_at"] = datetime.now(timezone.utc)

    await db[CLIENTS].update_one(
        {"client_id": client_id},
        {"$set": update_fields},
        upsert=True,
    )
    return {"message": "Settings updated"}
