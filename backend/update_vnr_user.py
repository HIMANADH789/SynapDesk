import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.hash import bcrypt
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

async def main():
    load_dotenv()
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["ChatBot"]
    
    # We want to create/update user for client_id 'vnr'
    email = "admin@vnr.edu.in"
    password_hash = bcrypt.hash("pass123")
    
    user_doc = {
        "email": email,
        "password_hash": password_hash,
        "client_id": "vnr",
        "role": "admin",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db["users"].update_one(
        {"client_id": "vnr"},
        {"$set": user_doc},
        upsert=True
    )
    
    print(f"Created/Updated user: {email} for client 'vnr' with password 'pass123'")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
