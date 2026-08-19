import asyncio
from app.db.mongodb import connect_db, get_db, close_db
from app.db.collections import CLIENTS

async def main():
    await connect_db()
    db = get_db()
    
    client_id = "sv_professionals"
    
    whatsapp_config = {
        "enabled": True,
        "phone_number_id": "1322414487627650",
        "access_token": "EAANZBJj2jPTUBSd3xOpyAEYVLiIaJu6WlA7pTChCzkUqUfxr2WSCSV0HR20pCZAjiQEy1py3C77fnOWwlTEn9kXhqtyJLKDXmJue2sL2zZC3qD90L9SivPdk4lZAAq51nclyLtUC6ZAzdwm7MhZAwJzDvczN6vdzDZAaASfZCUjSZCcPelGc95D4ltKkyEoAZBkSZB2xQZDZD",
        "app_secret": "",
        "verify_token": "SynapDeskSecretToken123",
        "waba_id": "2228003938052204"
    }
    
    await db[CLIENTS].update_one(
        {"client_id": client_id},
        {"$set": {
            "settings.setups.whatsapp": whatsapp_config
        }}
    )
    print("Updated setups.whatsapp successfully.")
    
    await close_db()

if __name__ == "__main__":
    asyncio.run(main())
