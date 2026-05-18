import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
async def run():
    db = AsyncIOMotorClient('mongodb+srv://23071a12c9_db_user:ChatX%40123@vnr.w20yvt2.mongodb.net/?appName=VNR')['VNR']
    c = await db.clients.find_one({'client_id':'VNR'})
    if c:
        with open('vnr_script.js', 'w', encoding='utf-8') as f:
            f.write(c.get('settings',{}).get('custom_widget_script',''))
        print('Done')
    else:
        print('No VNR client found')
asyncio.run(run())
