from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, HTTPException, Depends, Header
from passlib.hash import bcrypt as passlib_bcrypt

from app.models.auth import RegisterRequest, LoginRequest, TokenResponse
from app.services import auth_service
from app.config import settings
from app.db.mongodb import get_db
from app.db.collections import USERS, CLIENTS, PLATFORM_CONFIG

router = APIRouter(prefix="/auth", tags=["auth"])


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = auth_service.decode_token(token)
        return payload
    except Exception:
        raise HTTPException(401, "Invalid or expired token")


@router.post("/register")
async def register(request: RegisterRequest):
    # Super admin creation requires the PLATFORM_SETUP_KEY
    if request.role == "super_admin":
        if not settings.PLATFORM_SETUP_KEY:
            raise HTTPException(403, "Super admin registration is disabled on this platform.")
        provided = (request.setup_key or "").strip()
        if provided != settings.PLATFORM_SETUP_KEY:
            raise HTTPException(403, "Invalid setup key.")
        # Only allow one super admin
        db = get_db()
        existing_sa = await db[USERS].find_one({"role": "super_admin"})
        if existing_sa:
            raise HTTPException(400, "A super admin account already exists.")
    try:
        user = await auth_service.register_user(
            email=request.email,
            password=request.password,
            client_id=request.client_id,
            role=request.role,
        )
        return {"message": "User registered successfully", "user": user}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/setup-status")
async def setup_status():
    """Returns whether a super_admin account exists. Used by the setup page."""
    db = get_db()
    exists = await db[USERS].find_one({"role": "super_admin"})
    return {"setup_required": exists is None}


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = await auth_service.authenticate(request.email, request.password)
    if not user:
        raise HTTPException(401, "Invalid email or password")
    token = auth_service.create_token(user["email"], user["client_id"], user["role"])
    return TokenResponse(access_token=token)


# ── Named Master Keys ────────────────────────────────────────────────────────
# Multiple named keys can exist. Any valid key allows impersonation.
# Values are bcrypt-hashed and never returned after creation.

import uuid as _uuid


@router.get("/master-keys")
async def list_master_keys(user: dict = Depends(get_current_user)):
    """List all named master keys (name + id only, no hashes). Super admin only."""
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    db = get_db()
    cursor = db[PLATFORM_CONFIG].find(
        {"type": "master_key"},
        {"_id": 0, "key_id": 1, "name": 1, "created_at": 1},
    )
    keys = await cursor.to_list(length=100)
    return {"keys": keys}


@router.post("/master-keys")
async def create_master_key(body: dict, user: dict = Depends(get_current_user)):
    """Create a named master key. Value is shown ONCE and never again. Super admin only."""
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    name = body.get("name", "").strip()
    value = body.get("value", "").strip()
    if not name:
        raise HTTPException(400, "Key name is required")
    if len(value) < 8:
        raise HTTPException(400, "Key value must be at least 8 characters")
    key_id = str(_uuid.uuid4())
    hashed = passlib_bcrypt.hash(value)
    db = get_db()
    await db[PLATFORM_CONFIG].insert_one({
        "type": "master_key",
        "key_id": key_id,
        "name": name,
        "hash": hashed,
        "created_at": datetime.now(timezone.utc),
    })
    # Return the value ONCE — it is not stored in plain text
    return {"key_id": key_id, "name": name, "value": value}


@router.delete("/master-keys/{key_id}")
async def delete_master_key(key_id: str, user: dict = Depends(get_current_user)):
    """Delete a named master key by its ID. Super admin only."""
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")
    db = get_db()
    result = await db[PLATFORM_CONFIG].delete_one({"type": "master_key", "key_id": key_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Master key not found")
    return {"message": "Master key deleted"}


@router.post("/impersonate/{client_id}")
async def impersonate(client_id: str, body: dict, user: dict = Depends(get_current_user)):
    """Issue a short-lived admin JWT for a target institution. Requires any valid master key."""
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super admin only")

    provided_key = body.get("master_key", "").strip()
    if not provided_key:
        raise HTTPException(400, "Master key required")

    db = get_db()

    # Check provided value against ALL active master keys
    cursor = db[PLATFORM_CONFIG].find({"type": "master_key"}, {"hash": 1})
    all_keys = await cursor.to_list(length=100)
    if not all_keys:
        raise HTTPException(400, "No master keys configured. Create one in Super Admin > Settings first.")

    valid = any(passlib_bcrypt.verify(provided_key, k["hash"]) for k in all_keys)
    if not valid:
        raise HTTPException(401, "Incorrect master key")

    # Verify institution exists
    client = await db[CLIENTS].find_one({"client_id": client_id})
    if not client:
        raise HTTPException(404, "Institution not found")

    admin_user = await db[USERS].find_one({"client_id": client_id, "role": "admin"})
    admin_email = admin_user["email"] if admin_user else f"admin@{client_id}"

    payload = {
        "sub": admin_email,
        "role": "admin",
        "client_id": client_id,
        "impersonated_by": user.get("sub"),
        "impersonating": True,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    return {
        "access_token": token,
        "institution_name": client.get("name", client_id),
        "client_id": client_id,
    }


