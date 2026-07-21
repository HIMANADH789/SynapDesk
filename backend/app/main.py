from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.mongodb import connect_db, close_db
from app.db.collections import create_indexes
from app.api import health, documents, chat, auth, clients, analytics, integrations


def _register_adapters() -> None:
    """Register all channel adapters with the factory at startup."""
    from app.adapters import factory
    from app.adapters.whatsapp import WhatsAppAdapter
    from app.adapters.facebook import FacebookAdapter
    from app.adapters.telegram import TelegramAdapter
    from app.adapters.slack import SlackAdapter

    for adapter in (WhatsAppAdapter(), FacebookAdapter(), TelegramAdapter(), SlackAdapter()):
        factory.register(adapter)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _register_adapters()
    await connect_db()
    try:
        await create_indexes()
    except Exception as exc:
        import logging
        logging.getLogger("app").warning(
            "MongoDB index creation failed (cluster may be paused or IP not whitelisted): %s", exc
        )
    # Pre-warm cross-encoder reranker so the first chat request has no model-load latency
    import asyncio
    from app.utils import reranker as reranker_util
    await asyncio.get_event_loop().run_in_executor(None, reranker_util.preload)
    yield
    await close_db()


app = FastAPI(
    title="AI Front Desk",
    description="RAG Chatbot for Educational Institutions",
    version="0.1.0",
    lifespan=lifespan,
)

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://your-admin-app.vercel.app",  # Production frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*",  # Allows embedded widget on third-party client sites
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz", status_code=200)
async def health_check():
    """Health check endpoint for Render monitoring."""
    return {"status": "ok", "service": "rag-backend"}


app.include_router(health.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(integrations.router, prefix="/api")
app.include_router(integrations.webhook_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
