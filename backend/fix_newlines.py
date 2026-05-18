import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb+srv://23071a12c9_db_user:ChatX%40123@vnr.w20yvt2.mongodb.net/?appName=VNR')['VNR']
    c = await db.clients.find_one({'client_id': 'VNR'})
    
    script = c.get('settings', {}).get('custom_widget_script', '')
    
    # Fix the escaped newlines in the split function
    script = script.replace('split("\\\\n\\\\n")', 'split("\\n\\n")')
    
    await db.clients.update_one(
        {'client_id': 'VNR'},
        {'$set': {'settings.custom_widget_script': script}}
    )
    print("Newlines fixed!")

asyncio.run(fix())
