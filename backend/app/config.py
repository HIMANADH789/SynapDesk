from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Provider selection
    LLM_PROVIDER: str = "gemini"
    EMBEDDING_PROVIDER: str = "huggingface"
    VECTORDB_PROVIDER: str = "chromadb"

    # API keys
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Local provider config
    OLLAMA_URL: str = "http://localhost:11434"
    HUGGINGFACE_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "chatbot"

    # Auth
    JWT_SECRET: str = "change-me-in-production"
    JWT_EXPIRY_HOURS: int = 24

    # Rate limiting
    GEMINI_RPM_LIMIT: int = 10
    GEMINI_DAILY_LIMIT: int = 250

    # RAG enhancements (all default ON)
    HYDE_ENABLED: bool = True               # Hypothetical Document Embedding
    RERANK_ENABLED: bool = True             # Cross-encoder reranking
    CACHE_ENABLED: bool = True              # Semantic query cache
    CACHE_SIMILARITY_THRESHOLD: float = 0.92  # Cosine sim threshold for cache hit
    CACHE_TTL_HOURS: int = 24              # How long cached answers stay valid
    RETRIEVAL_CANDIDATES: int = 15         # Candidates fetched before reranking
    RETRIEVAL_TOP_K: int = 4              # Final chunks after reranking

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()
