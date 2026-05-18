import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb+srv://23071a12c9_db_user:ChatX%40123@vnr.w20yvt2.mongodb.net/?appName=VNR')['VNR']
    c = await db.clients.find_one({'client_id': 'VNR'})
    if not c:
        print("VNR not found")
        return
    script = c.get('settings', {}).get('custom_widget_script', '')
    if not script:
        print("No script")
        return
        
    # Fix the escaped backticks and dollar signs
    script = script.replace('\\`', '`').replace('\\$', '$')
    
    await db.clients.update_one(
        {'client_id': 'VNR'},
        {'$set': {'settings.custom_widget_script': script}}
    )
    print("Fixed syntax errors in database script for VNR")

asyncio.run(fix())
