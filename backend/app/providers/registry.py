from app.config import settings
from app.providers.base import EmbeddingProvider, LLMProvider, VectorStoreProvider

_llm_instance: LLMProvider | None = None
_embedding_instance: EmbeddingProvider | None = None
_vectordb_instance: VectorStoreProvider | None = None


def get_llm_provider() -> LLMProvider:
    global _llm_instance
    if _llm_instance is None:
        match settings.LLM_PROVIDER:
            case "gemini":
                from app.providers.llm.gemini import GeminiProvider
                _llm_instance = GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL)
            case "groq":
                from app.providers.llm.groq import GroqProvider
                _llm_instance = GroqProvider(api_key=settings.GROQ_API_KEY, model=settings.GROQ_MODEL)
            case "ollama":
                from app.providers.llm.ollama import OllamaProvider
                _llm_instance = OllamaProvider(base_url=settings.OLLAMA_URL)
            case _:
                raise ValueError(f"Unknown LLM provider: {settings.LLM_PROVIDER}")
    return _llm_instance


def get_embedding_provider() -> EmbeddingProvider:
    global _embedding_instance
    if _embedding_instance is None:
        match settings.EMBEDDING_PROVIDER:
            case "huggingface":
                from app.providers.embeddings.huggingface import HuggingFaceEmbeddingProvider
                _embedding_instance = HuggingFaceEmbeddingProvider(
                    model_name=settings.HUGGINGFACE_MODEL
                )
            case "google":
                from app.providers.embeddings.google import GoogleEmbeddingProvider
                _embedding_instance = GoogleEmbeddingProvider(
                    api_key=settings.GEMINI_API_KEY
                )
            case _:
                raise ValueError(f"Unknown embedding provider: {settings.EMBEDDING_PROVIDER}")
    return _embedding_instance


def get_vectordb_provider() -> VectorStoreProvider:
    global _vectordb_instance
    if _vectordb_instance is None:
        match settings.VECTORDB_PROVIDER:
            case "chromadb":
                from app.providers.vectordb.chromadb import ChromaDBProvider
                _vectordb_instance = ChromaDBProvider(
                    persist_dir=settings.CHROMA_PERSIST_DIR
                )
            case "mongodb":
                from app.providers.vectordb.mongodb import MongoDBVectorProvider
                _vectordb_instance = MongoDBVectorProvider(
                    index_name=settings.MONGODB_VECTOR_INDEX_NAME
                )
            case _:
                raise ValueError(f"Unknown vector DB provider: {settings.VECTORDB_PROVIDER}")
    return _vectordb_instance
