import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://himanadhkondabathini:dbpass@cluster0.y77ij.mongodb.net/?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client["ChatBot"]
    
    with open("c:\\ChatX\\backend\\vnr_script.js", "r", encoding="utf-8") as f:
        script_code = f.read()

    result = await db["clients"].update_one(
        {"client_id": "vnr"},
        {"$set": {"settings.widget_code": script_code}}
    )
    
    if result.modified_count > 0:
        print("Successfully updated vnr script in MongoDB!")
    else:
        print("Script was already up to date or vnr client not found.")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
