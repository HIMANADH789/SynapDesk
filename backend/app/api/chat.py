import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.dependencies import get_embeddings, get_llm, get_vectordb
from app.models.chat import ChatRequest, ChatResponse, Source
from app.providers.base import EmbeddingProvider, LLMProvider, VectorStoreProvider
from app.services import rag_service, chat_service
from app.utils.ip_rate_limiter import check_ip_rate_limit

logger = logging.getLogger("app.api.chat")
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{client_id}/query", response_model=ChatResponse)
async def chat_query(
    client_id: str,
    request: ChatRequest,
    http_request: Request,
    llm: LLMProvider = Depends(get_llm),
    embeddings: EmbeddingProvider = Depends(get_embeddings),
    vectordb: VectorStoreProvider = Depends(get_vectordb),
):
    channel = request.channel or "widget"
    await check_ip_rate_limit(http_request, client_id, channel)
    result = await rag_service.query(
        client_id=client_id,
        message=request.message,
        session_id=request.session_id,
        llm=llm,
        embeddings=embeddings,
        vectordb=vectordb,
        channel=channel,
    )
    return ChatResponse(
        response=result["response"],
        sources=[Source(**s) for s in result["sources"]],
        session_id=result["session_id"],
    )


@router.post("/{client_id}/stream")
async def chat_stream(
    client_id: str,
    request: ChatRequest,
    http_request: Request,
    llm: LLMProvider = Depends(get_llm),
    embeddings: EmbeddingProvider = Depends(get_embeddings),
    vectordb: VectorStoreProvider = Depends(get_vectordb),
):
    """Server-Sent Events endpoint. Streams tokens as they are generated."""
    channel = request.channel or "widget"
    await check_ip_rate_limit(http_request, client_id, channel)

    async def event_generator():
        try:
            async for event in rag_service.query_stream(
                client_id=client_id,
                message=request.message,
                session_id=request.session_id,
                llm=llm,
                embeddings=embeddings,
                vectordb=vectordb,
                channel=channel,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            msg = str(exc)
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                user_msg = "The AI service is temporarily rate-limited. Please wait a moment and try again."
            else:
                user_msg = "Sorry, something went wrong. Please try again."
            logger.error("Streaming error on %s/%s: %s", client_id, channel, exc)
            yield f"data: {json.dumps({'type': 'error', 'content': user_msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'session_id': None, 'sources': []})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{client_id}/history/{session_id}")
async def get_chat_history(client_id: str, session_id: str):
    messages = await chat_service.get_history(session_id)
    return {"session_id": session_id, "messages": messages}


@router.get("/quota")
async def get_quota():
    return {"remaining_daily": rag_service.get_remaining_quota()}
