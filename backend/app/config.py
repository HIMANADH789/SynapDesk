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

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()
