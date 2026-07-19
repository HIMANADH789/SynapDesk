import asyncio
import os
from passlib.hash import bcrypt
from app.db.mongodb import connect_db, close_db, get_db
from app.db.collections import CLIENTS, USERS
from datetime import datetime, timezone

async def main():
    await connect_db()
    db = get_db()
    
    client_id = "sv_professional"
    email = "admin@svprofessional.com"
    
    # 1. Create client with WhatsApp config structure
    client_doc = {
        "client_id": client_id,
        "name": "SV Professional",
        "domain": "svprofessional.com",
        "settings": {
            "welcome_message": "Hello! Welcome to SV Professional. How can we help you today?",
            "setups": {
                "whatsapp": {
                    "enabled": True,
                    "phone_number_id": "REPLACE_WITH_YOUR_PHONE_NUMBER_ID", 
                    "access_token": "REPLACE_WITH_YOUR_ACCESS_TOKEN",
                    "app_secret": "", 
                    "verify_token": "SynapDeskSecretToken123"
                }
            }
        }
    }
    await db[CLIENTS].update_one(
        {"client_id": client_id},
        {"$set": client_doc},
        upsert=True
    )
    print(f"Created/Updated client: {client_id}")
    
    # 2. Create admin user for this client
    user_doc = {
        "email": email,
        "password_hash": bcrypt.hash("pass123"),
        "client_id": client_id,
        "role": "admin",
        "created_at": datetime.now(timezone.utc)
    }
    await db[USERS].update_one(
        {"email": email},
        {"$set": user_doc},
        upsert=True
    )
    print(f"Created/Updated user: {email} with password 'pass123'")
    
    await close_db()

if __name__ == "__main__":
    asyncio.run(main())
