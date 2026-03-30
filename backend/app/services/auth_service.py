from datetime import datetime, timedelta, timezone

import jwt
from passlib.hash import bcrypt

from app.config import settings
from app.db.mongodb import get_db
from app.db.collections import USERS


async def register_user(email: str, password: str, client_id: str, role: str = "admin") -> dict:
    db = get_db()

    existing = await db[USERS].find_one({"email": email})
    if existing:
        raise ValueError("Email already registered")

    user = {
        "email": email,
        "password_hash": bcrypt.hash(password),
        "client_id": client_id,
        "role": role,
        "created_at": datetime.now(timezone.utc),
    }
    await db[USERS].insert_one(user)
    return {"email": email, "client_id": client_id, "role": role}


async def authenticate(email: str, password: str) -> dict | None:
    db = get_db()
    user = await db[USERS].find_one({"email": email})
    if not user or not bcrypt.verify(password, user["password_hash"]):
        return None
    return {
        "email": user["email"],
        "client_id": user["client_id"],
        "role": user["role"],
    }


def create_token(email: str, client_id: str, role: str) -> str:
    payload = {
        "sub": email,
        "client_id": client_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
