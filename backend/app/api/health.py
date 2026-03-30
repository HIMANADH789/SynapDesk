from fastapi import APIRouter

from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "providers": {
            "llm": settings.LLM_PROVIDER,
            "embedding": settings.EMBEDDING_PROVIDER,
            "vectordb": settings.VECTORDB_PROVIDER,
        },
        "version": "0.1.0",
    }
