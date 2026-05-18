import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def update_logo():
    db = AsyncIOMotorClient('mongodb+srv://23071a12c9_db_user:ChatX%40123@vnr.w20yvt2.mongodb.net/?appName=VNR')['VNR']
    c = await db.clients.find_one({'client_id': 'VNR'})
    
    script = c.get('settings', {}).get('custom_widget_script', '')
    
    # Replace the apiUrl/widget/logo.png with the frontend URL
    updated_script = script.replace('${apiUrl}/widget/logo.png', 'http://localhost:3000/VNRLogo.png')
    
    await db.clients.update_one(
        {'client_id': 'VNR'},
        {'$set': {'settings.custom_widget_script': updated_script}}
    )
    print("Logo URL updated successfully!")

asyncio.run(update_logo())
