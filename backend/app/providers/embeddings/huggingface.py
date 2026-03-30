import asyncio
from functools import partial

from sentence_transformers import SentenceTransformer

from app.providers.base import EmbeddingProvider


class HuggingFaceEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self._model = SentenceTransformer(model_name)
        self._dimension = self._model.get_sentence_embedding_dimension()

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None, partial(self._model.encode, texts, normalize_embeddings=True)
        )
        return embeddings.tolist()

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed_texts([text])
        return results[0]

    def get_dimension(self) -> int:
        return self._dimension
