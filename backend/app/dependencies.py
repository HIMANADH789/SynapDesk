from app.providers.base import EmbeddingProvider, LLMProvider, VectorStoreProvider
from app.providers.registry import (
    get_embedding_provider,
    get_llm_provider,
    get_vectordb_provider,
)


def get_llm() -> LLMProvider:
    return get_llm_provider()


def get_embeddings() -> EmbeddingProvider:
    return get_embedding_provider()


def get_vectordb() -> VectorStoreProvider:
    return get_vectordb_provider()
