from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.mongodb import connect_db, close_db
from app.db.collections import create_indexes
from app.api import health, documents, chat, auth, clients, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    try:
        await create_indexes()
    except Exception as exc:
        import logging
        logging.getLogger("app").warning(
            "MongoDB index creation failed (cluster may be paused or IP not whitelisted): %s", exc
        )
    yield
    await close_db()


app = FastAPI(
    title="AI Front Desk",
    description="RAG Chatbot for Educational Institutions",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
