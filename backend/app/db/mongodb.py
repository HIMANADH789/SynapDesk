from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import sys

from app.config import settings

if sys.platform == "win32":
    try:
        import dns.resolver
        dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
        dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1"]
    except Exception:
        pass

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    global _client, _db
    uri = settings.MONGODB_URI
    try:
        _client = AsyncIOMotorClient(
            uri,
            maxPoolSize=50,
            minPoolSize=10,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=10000,
            tls=True,
            tlsAllowInvalidCertificates=False,
        )
        # Verify connection
        await _client.admin.command("ping")
    except Exception:
        # Fallback for Windows DNS SRV timeout issues
        if "cluster0.y77ij.mongodb.net" in uri:
            direct_uri = "mongodb://himanadhkondabathini:dbpass@cluster0-shard-00-00.y77ij.mongodb.net:27017,cluster0-shard-00-01.y77ij.mongodb.net:27017,cluster0-shard-00-02.y77ij.mongodb.net:27017/ChatBot?ssl=true&replicaSet=atlas-biwqwp-shard-0&authSource=admin&retryWrites=true&w=majority"
            _client = AsyncIOMotorClient(
                direct_uri,
                maxPoolSize=50,
                minPoolSize=10,
                serverSelectionTimeoutMS=8000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000,
                tls=True,
            )
        else:
            raise
    _db = _client[settings.MONGODB_DB_NAME]


async def close_db() -> None:
    global _client, _db
    if _client:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db
