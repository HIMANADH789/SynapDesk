import logging
from typing import Optional

import chromadb

from app.providers.base import VectorStoreProvider

logger = logging.getLogger(__name__)


class ChromaDBProvider(VectorStoreProvider):
    def __init__(self, persist_dir: str = "./chroma_data"):
        self._client = chromadb.PersistentClient(path=persist_dir)

    def _collection_name(self, client_id: str) -> str:
        return f"docs_{client_id}"

    def _get_or_create_collection(self, client_id: str):
        return self._client.get_or_create_collection(
            name=self._collection_name(client_id),
            metadata={"hnsw:space": "cosine"},
        )

    async def add_documents(
        self,
        client_id: str,
        doc_id: str,
        chunks: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        collection = self._get_or_create_collection(client_id)
        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    async def search(
        self,
        client_id: str,
        query_embedding: list[float],
        top_k: int = 5,
        where: Optional[dict] = None,
    ) -> list[dict]:
        collection = self._get_or_create_collection(client_id)

        def _query(w: Optional[dict]) -> list[dict]:
            kwargs = dict(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
            )
            if w:
                kwargs["where"] = w
            results = collection.query(**kwargs)
            items = []
            if results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    items.append({
                        "text": doc,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "score": 1 - results["distances"][0][i] if results["distances"] else 0,
                    })
            return items

        # Try filtered search first; fall back to unfiltered if too few results
        if where:
            try:
                items = _query(where)
                if len(items) >= 2:
                    return items
                # Not enough filtered results — fall back to full search
                logger.debug("Metadata filter returned < 2 results, falling back to unfiltered search")
            except Exception:
                logger.debug("Metadata filter failed, falling back to unfiltered search")

        return _query(None)

    async def delete_document(self, client_id: str, doc_id: str) -> None:
        collection = self._get_or_create_collection(client_id)
        results = collection.get(where={"doc_id": doc_id})
        if results["ids"]:
            collection.delete(ids=results["ids"])
