from app.db.mongodb import get_db

CLIENTS = "clients"
USERS = "users"
DOCUMENTS = "documents"
QUERY_LOGS = "query_logs"
CHAT_SESSIONS = "chat_sessions"


async def create_indexes() -> None:
    db = get_db()

    await db[CLIENTS].create_index("client_id", unique=True)
    await db[USERS].create_index("email", unique=True)
    await db[USERS].create_index("client_id")
    await db[DOCUMENTS].create_index("doc_id", unique=True)
    await db[DOCUMENTS].create_index("client_id")
    await db[QUERY_LOGS].create_index([("client_id", 1), ("created_at", -1)])
    await db[QUERY_LOGS].create_index("session_id")
    await db[CHAT_SESSIONS].create_index("session_id", unique=True)
    await db[CHAT_SESSIONS].create_index("client_id")
