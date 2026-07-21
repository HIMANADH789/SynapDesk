import asyncio
from datetime import datetime, timezone
from passlib.hash import bcrypt
from app.db.mongodb import connect_db, get_db, close_db
from app.db.collections import USERS

async def main():
    print("Connecting to DB...")
    await connect_db()
    db = get_db()
    
    password_hash = bcrypt.hash("pass123")
    user = {
        "email": "superadmin@example.com",
        "password_hash": password_hash,
        "client_id": "default",
        "role": "super_admin",
        "created_at": datetime.now(timezone.utc),
    }
    
    result = await db[USERS].update_one(
        {"email": "superadmin@example.com"},
        {"$set": user},
        upsert=True
    )
    
    if result.upserted_id:
        print("Superadmin created successfully.")
    else:
        print("Superadmin updated successfully.")
        
    await close_db()

if __name__ == "__main__":
    asyncio.run(main())
