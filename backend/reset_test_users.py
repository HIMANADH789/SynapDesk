import asyncio
from datetime import datetime, timezone
from passlib.hash import bcrypt
from app.db.mongodb import connect_db, get_db, close_db
from app.db.collections import USERS

async def main():
    print("Connecting to DB...")
    await connect_db()
    db = get_db()
    
    print("Deleting all existing users...")
    delete_result = await db[USERS].delete_many({})
    print(f"Deleted {delete_result.deleted_count} users.")
    
    print("Hashing password 'pass123'...")
    password_hash = bcrypt.hash("pass123")
    
    users = [
        {
            "email": "admin1@example.com",
            "password_hash": password_hash,
            "client_id": "default",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "email": "admin2@example.com",
            "password_hash": password_hash,
            "client_id": "default",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        }
    ]
    
    print("Inserting admin1@example.com and admin2@example.com...")
    await db[USERS].insert_many(users)
    print("Test users successfully updated.")
    
    await close_db()

if __name__ == "__main__":
    asyncio.run(main())
