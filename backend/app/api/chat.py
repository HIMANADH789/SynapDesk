from fastapi import APIRouter, Depends

from app.dependencies import get_embeddings, get_llm, get_vectordb
from app.models.chat import ChatRequest, ChatResponse, Source
from app.providers.base import EmbeddingProvider, LLMProvider, VectorStoreProvider
from app.services import rag_service, chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{client_id}/query", response_model=ChatResponse)
async def chat_query(
    client_id: str,
    request: ChatRequest,
    llm: LLMProvider = Depends(get_llm),
    embeddings: EmbeddingProvider = Depends(get_embeddings),
    vectordb: VectorStoreProvider = Depends(get_vectordb),
):
    result = await rag_service.query(
        client_id=client_id,
        message=request.message,
        session_id=request.session_id,
        llm=llm,
        embeddings=embeddings,
        vectordb=vectordb,
    )
    return ChatResponse(
        response=result["response"],
        sources=[Source(**s) for s in result["sources"]],
        session_id=result["session_id"],
    )


@router.get("/{client_id}/history/{session_id}")
async def get_chat_history(client_id: str, session_id: str):
    messages = await chat_service.get_history(session_id)
    return {"session_id": session_id, "messages": messages}


@router.get("/quota")
async def get_quota():
    return {"remaining_daily": rag_service.get_remaining_quota()}
