import asyncio
from app.db.mongodb import connect_db, get_db, close_db
from app.db.collections import CLIENTS

async def main():
    await connect_db()
    db = get_db()
    client = await db[CLIENTS].find_one({"client_id": "sv_professionals"})
    import json
    print(json.dumps(client.get("settings", {}), default=str, indent=2))
    await close_db()

if __name__ == "__main__":
    asyncio.run(main())
