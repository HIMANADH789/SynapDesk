from google import genai

from app.providers.base import EmbeddingProvider


class GoogleEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str, model: str = "gemini-embedding-001"):
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._dimension = 768

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        result = self._client.models.embed_content(
            model=self._model, contents=texts
        )
        return [e.values for e in result.embeddings]

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed_texts([text])
        return results[0]

    def get_dimension(self) -> int:
        return self._dimension
