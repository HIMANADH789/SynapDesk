import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def main():
    load_dotenv()
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["ChatBot"]
    
    print("--- Clients ---")
    clients = await db["clients"].find({}).to_list(length=100)
    for c in clients:
        print(f"ID: {c.get('client_id')}, Name: {c.get('name')}")
        
    print("\n--- Users ---")
    users = await db["users"].find({}).to_list(length=100)
    for u in users:
        print(f"Email: {u.get('email')}, Client ID: {u.get('client_id')}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
