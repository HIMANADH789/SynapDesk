import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.hash import bcrypt
import os
from dotenv import load_dotenv

async def main():
    load_dotenv()
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["ChatBot"]
    user = await db["users"].find_one({"client_id": "vnr"})
    if user:
        print(f"Username for vnr: {user.get('email')}")
        new_hash = bcrypt.hash("pass123")
        await db["users"].update_one({"_id": user["_id"]}, {"$set": {"password_hash": new_hash}})
        print("Password successfully updated to pass123")
    else:
        print("User with client_id 'vnr' not found.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
