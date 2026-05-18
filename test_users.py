import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')
uri = os.getenv('MONGODB_URI')
db_name = os.getenv('MONGODB_DB_NAME')

async def main():
    client = AsyncIOMotorClient(uri)
    db = client[db_name]
    sa = await db['users'].find_one({'role': 'super_admin'})
    if sa:
        print(f"SuperAdmin: {sa['email']}")
    else:
        print("No super_admin found.")
    
    admins = await db['users'].find({'role': 'admin'}).to_list(10)
    for a in admins:
        print(f"Admin: {a['email']} (Client: {a.get('client_id')})")

asyncio.run(main())
