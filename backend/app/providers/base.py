from abc import ABC, abstractmethod
from typing import Optional

from pydantic import BaseModel


class LLMResponse(BaseModel):
    text: str
    usage: dict
    model: str


class LLMProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> LLMResponse: ...

    @abstractmethod
    def get_model_name(self) -> str: ...


class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed_texts(self, texts: list[str]) -> list[list[float]]: ...

    @abstractmethod
    async def embed_query(self, text: str) -> list[float]: ...

    @abstractmethod
    def get_dimension(self) -> int: ...


class VectorStoreProvider(ABC):
    @abstractmethod
    async def add_documents(
        self,
        client_id: str,
        doc_id: str,
        chunks: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None: ...

    @abstractmethod
    async def search(
        self,
        client_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]: ...

    @abstractmethod
    async def delete_document(self, client_id: str, doc_id: str) -> None: ...
