import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.hash import bcrypt
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')
uri = os.getenv('MONGODB_URI')
db_name = os.getenv('MONGODB_DB_NAME')

async def main():
    client = AsyncIOMotorClient(uri)
    db = client[db_name]
    
    new_hash = bcrypt.hash('password123')
    
    await db['users'].update_one({'email': 'ravi@gmail.com'}, {'$set': {'password_hash': new_hash}})
    print("Updated ravi@gmail.com password to password123")
    
    await db['users'].update_one({'email': 'rahul@gmail.com'}, {'$set': {'password_hash': new_hash}})
    print("Updated rahul@gmail.com password to password123")

asyncio.run(main())
