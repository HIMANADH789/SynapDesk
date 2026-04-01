from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.api.auth import get_current_user
from app.dependencies import get_embeddings, get_llm, get_vectordb
from app.providers.base import EmbeddingProvider, LLMProvider, VectorStoreProvider
from app.services import document_service

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    embeddings: EmbeddingProvider = Depends(get_embeddings),
    vectordb: VectorStoreProvider = Depends(get_vectordb),
    llm: LLMProvider = Depends(get_llm),
):
    client_id = user["client_id"]

    if not file.filename:
        raise HTTPException(400, "No filename provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: .{ext}. Allowed: {ALLOWED_EXTENSIONS}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)} MB")

    try:
        doc = await document_service.upload_document(
            client_id=client_id,
            filename=file.filename,
            file_bytes=file_bytes,
            embedding_provider=embeddings,
            vectordb_provider=vectordb,
            llm_provider=llm,
        )
        return {
            "doc_id": doc["doc_id"],
            "filename": doc["filename"],
            "status": doc["status"],
            "chunks_count": doc["chunks_count"],
        }
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("")
async def list_documents(user: dict = Depends(get_current_user)):
    docs = await document_service.list_documents(user["client_id"])
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return {"documents": docs, "total": len(docs)}


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    user: dict = Depends(get_current_user),
    vectordb: VectorStoreProvider = Depends(get_vectordb),
):
    deleted = await document_service.delete_document(user["client_id"], doc_id, vectordb)
    if not deleted:
        raise HTTPException(404, "Document not found")
    return {"message": "Document deleted successfully"}
