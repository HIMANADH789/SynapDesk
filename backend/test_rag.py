import asyncio
from app.config import settings
from app.providers.registry import get_llm_provider, get_embedding_provider, get_vectordb_provider
from app.services import rag_service
from app.db.mongodb import connect_db, close_db

async def main():
    print("Testing RAG pipeline initialization...")
    try:
        await connect_db()
        print("Connected to DB.")
        
        # Override settings for test
        settings.LLM_PROVIDER = "gemini"
        settings.EMBEDDING_PROVIDER = "google"
        
        print("Getting LLM...")
        llm = get_llm_provider()
        
        print("Getting Embeddings...")
        embeddings = get_embedding_provider()
        
        print("Getting VectorDB...")
        vectordb = get_vectordb_provider()
        
        print("Running query...")
        result = await rag_service.query(
            client_id="sv_professionals",
            message="hi",
            session_id="test_session_123",
            llm=llm,
            embeddings=embeddings,
            vectordb=vectordb,
            channel="whatsapp"
        )
        print("Query successful!")
        print("Response:", result["response"])
        
    except Exception as e:
        import traceback
        print("Exception occurred:")
        traceback.print_exc()
    finally:
        await close_db()

if __name__ == "__main__":
    asyncio.run(main())
