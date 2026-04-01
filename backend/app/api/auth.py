from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional

from app.models.auth import RegisterRequest, LoginRequest, TokenResponse
from app.services import auth_service
from app.db.mongodb import get_db
from app.db.collections import USERS

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
