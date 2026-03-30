import uuid
import time
from datetime import datetime, timezone

from app.db.mongodb import get_db
from app.db.collections import DOCUMENTS
from app.providers.base import EmbeddingProvider, VectorStoreProvider
from app.utils.file_extractors import extract_text
from app.utils.chunking import recursive_chunk


async def upload_document(
    client_id: str,
    filename: str,
    file_bytes: bytes,
    embedding_provider: EmbeddingProvider,
    vectordb_provider: VectorStoreProvider,
) -> dict:
    db = get_db()
    doc_id = str(uuid.uuid4())
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"

    # Save initial metadata
    doc_record = {
        "doc_id": doc_id,
        "client_id": client_id,
        "filename": filename,
        "file_type": ext,
        "file_size_bytes": len(file_bytes),
        "status": "processing",
        "error_message": None,
        "chunks_count": 0,
        "uploaded_at": datetime.now(timezone.utc),
        "processed_at": None,
        "chunks": [],  # Store raw chunks for ChromaDB rebuild
    }
    await db[DOCUMENTS].insert_one(doc_record)

    try:
        start = time.time()

        # Extract text
        text = extract_text(file_bytes, filename)
        if not text.strip():
            raise ValueError("No text content found in file")

        # Chunk
        chunks = recursive_chunk(text)
        if not chunks:
            raise ValueError("No chunks produced from file content")

        # Embed
        embeddings = await embedding_provider.embed_texts(chunks)

        # Build metadata for each chunk
        metadatas = [
            {
                "doc_id": doc_id,
                "filename": filename,
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]

        # Store in vector DB
        await vectordb_provider.add_documents(
            client_id=client_id,
            doc_id=doc_id,
            chunks=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        processing_time = int((time.time() - start) * 1000)

        # Update metadata
        await db[DOCUMENTS].update_one(
            {"doc_id": doc_id},
            {
                "$set": {
                    "status": "ready",
                    "chunks_count": len(chunks),
                    "processing_time_ms": processing_time,
                    "processed_at": datetime.now(timezone.utc),
                    "chunks": chunks,
                }
            },
        )

        doc_record.update(
            status="ready",
            chunks_count=len(chunks),
            processed_at=datetime.now(timezone.utc),
        )
        return doc_record

    except Exception as e:
        await db[DOCUMENTS].update_one(
            {"doc_id": doc_id},
            {"$set": {"status": "failed", "error_message": str(e)}},
        )
        raise


async def list_documents(client_id: str) -> list[dict]:
    db = get_db()
    cursor = db[DOCUMENTS].find(
        {"client_id": client_id},
        {"chunks": 0},  # Exclude raw chunks from listing
    ).sort("uploaded_at", -1)
    return await cursor.to_list(length=100)


async def delete_document(
    client_id: str,
    doc_id: str,
    vectordb_provider: VectorStoreProvider,
) -> bool:
    db = get_db()
    result = await db[DOCUMENTS].delete_one(
        {"doc_id": doc_id, "client_id": client_id}
    )
    if result.deleted_count == 0:
        return False
    await vectordb_provider.delete_document(client_id, doc_id)
    return True
