import asyncio
from app.db.mongodb import connect_db, close_db, get_db
from app.db.collections import CLIENTS

async def main():
    await connect_db()
    db = get_db()
    
    client_id = "sv_professional"
    phone_id = "1113664651833942"
    
    # Update both the setups location and whatsapp_config legacy location just to be absolutely safe
    await db[CLIENTS].update_one(
        {"client_id": client_id},
        {"$set": {
            "settings.setups.whatsapp.phone_number_id": phone_id,
            "settings.setups.whatsapp.enabled": True,
            "settings.whatsapp_config.phone_number_id": phone_id
        }}
    )
    print(f"Updated {client_id} with phone_number_id {phone_id}")
    await close_db()

if __name__ == "__main__":
    asyncio.run(main())
