import time
from datetime import datetime, timezone

from app.db.mongodb import get_db
from app.db.collections import QUERY_LOGS, CLIENTS
from app.providers.base import EmbeddingProvider, LLMProvider, VectorStoreProvider
from app.services.chat_service import get_or_create_session, add_message, get_history
from app.utils.rate_limiter import RateLimiter
from app.config import settings

_rate_limiter = RateLimiter(
    rpm_limit=settings.GEMINI_RPM_LIMIT,
    daily_limit=settings.GEMINI_DAILY_LIMIT,
)

FALLBACK_MESSAGE = "I don't have specific information about that in our knowledge base. Please contact the administration directly for further assistance."

DEFAULT_SYSTEM_PROMPT = """You are a helpful front desk assistant for an educational institution.
Answer questions based on the provided context. Do not make up information.
If the context does not contain enough information, say so clearly.
Be concise, friendly, and professional."""

# Conversational patterns that need no retrieval
CONVERSATIONAL_TRIGGERS = {
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "how are you", "thanks", "thank you", "bye", "goodbye", "ok", "okay",
    "what can you do", "help", "who are you", "what are you",
}


def _is_conversational(message: str) -> bool:
    """Return True if the message is small talk that needs no retrieval."""
    lower = message.lower().strip().rstrip("?!.")
    if lower in CONVERSATIONAL_TRIGGERS:
        return True
    if len(lower.split()) <= 3 and any(t in lower for t in CONVERSATIONAL_TRIGGERS):
        return True
    return False


async def _decompose_question(message: str, llm: LLMProvider) -> list[str]:
    """Break a complex question into focused sub-questions for retrieval."""
    prompt = f"""You are a query decomposition assistant.
Given a user question, break it into 1-3 focused sub-questions that can each be looked up independently in a knowledge base.
If the question is already simple and focused, return just the original question.

User question: {message}

Return ONLY a numbered list of sub-questions, nothing else. Example:
1. What are the exam dates?
2. What is the hall ticket process?"""

    response = await llm.generate(prompt, temperature=0.0, max_tokens=200)
    lines = [l.strip() for l in response.text.strip().splitlines() if l.strip()]
    sub_questions = []
    for line in lines:
        # Strip leading "1. " "2. " etc.
        cleaned = line.lstrip("0123456789. ").strip()
        if cleaned:
            sub_questions.append(cleaned)
    return sub_questions if sub_questions else [message]


async def query(
    client_id: str,
    message: str,
    session_id: str | None,
    llm: LLMProvider,
    embeddings: EmbeddingProvider,
    vectordb: VectorStoreProvider,
) -> dict:
    start = time.time()
    db = get_db()

    session_id = await get_or_create_session(client_id, session_id)
    await add_message(session_id, "user", message)

    # Load client settings
    client = await db[CLIENTS].find_one({"client_id": client_id})
    system_prompt = DEFAULT_SYSTEM_PROMPT
    max_history = 3
    if client:
        cs = client.get("settings", {})
        if cs.get("system_prompt"):
            system_prompt = cs["system_prompt"]
        if cs.get("max_history_turns"):
            max_history = cs["max_history_turns"]

    # Get conversation history
    history = await get_history(session_id, max_turns=max_history)
    history_text = ""
    if len(history) > 1:
        history_text = "\nRecent conversation:\n"
        for msg in history[:-1]:
            role = "User" if msg["role"] == "user" else "Assistant"
            history_text += f"{role}: {msg['content']}\n"

    # --- CONVERSATIONAL PATH: no retrieval needed ---
    if _is_conversational(message):
        await _rate_limiter.acquire()
        conv_prompt = f"""{history_text}
User: {message}

Reply naturally and briefly. You are a front desk assistant."""
        llm_response = await llm.generate(conv_prompt, system_prompt=system_prompt, temperature=0.7, max_tokens=256)
        text = _clean_markdown(llm_response.text)
        await add_message(session_id, "assistant", text)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, text, [], response_time, llm_response.model, llm_response.usage)
        return {"response": text, "sources": [], "session_id": session_id}

    # --- RETRIEVAL PATH ---
    can_proceed = await _rate_limiter.acquire()
    if not can_proceed:
        if settings.GROQ_API_KEY:
            from app.providers.llm.groq import GroqProvider
            llm = GroqProvider(api_key=settings.GROQ_API_KEY)
        else:
            msg = "I'm currently at capacity. Please try again in a moment."
            await add_message(session_id, "assistant", msg)
            return {"response": msg, "sources": [], "session_id": session_id}

    # Only decompose if the question is clearly multi-part (contains "and", "also", "?...?", etc.)
    # This avoids burning an extra LLM call on simple single-topic questions
    DECOMPOSE_SIGNALS = ["and", "also", "as well", "additionally", "what about", "along with"]
    words = message.lower().split()
    should_decompose = (
        len(words) > 12
        and any(sig in message.lower() for sig in DECOMPOSE_SIGNALS)
        and message.count("?") > 1
    )

    if should_decompose:
        sub_questions = await _decompose_question(message, llm)
        # acquire another token for the decomposition call we just made
        await _rate_limiter.acquire()
    else:
        sub_questions = [message]

    # Retrieve context for each sub-question, deduplicate by chunk id
    seen_chunks: set[str] = set()
    all_sources = []
    context_parts = []

    for sq in sub_questions:
        sq_embedding = await embeddings.embed_query(sq)
        results = await vectordb.search(client_id, sq_embedding, top_k=4)
        for r in results:
            chunk_key = f"{r['metadata'].get('doc_id','')}_{r['metadata'].get('chunk_index','')}"
            if chunk_key not in seen_chunks and r["score"] > 0.25:
                seen_chunks.add(chunk_key)
                context_parts.append(r["text"])
                all_sources.append({
                    "doc_id": r["metadata"].get("doc_id", ""),
                    "filename": r["metadata"].get("filename", ""),
                    "chunk_index": r["metadata"].get("chunk_index", 0),
                    "score": round(r["score"], 3),
                    "text_preview": r["text"][:200],
                })

    # No relevant context found
    if not context_parts:
        await add_message(session_id, "assistant", FALLBACK_MESSAGE)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, FALLBACK_MESSAGE, [], response_time, llm.get_model_name(), {})
        return {"response": FALLBACK_MESSAGE, "sources": [], "session_id": session_id}

    context = "\n\n---\n\n".join(context_parts)

    # Build final prompt
    prompt = f"""Context from knowledge base:
{context}
{history_text}
User question: {message}

Instructions:
- Answer using ONLY the context above.
- Format your answer in clean plain text. Use short paragraphs or simple numbered/bulleted lists where appropriate.
- Do NOT use markdown symbols like **, *, ##, or backticks in your response.
- If the context is insufficient, say so and suggest contacting the administration.
- Be concise and direct."""

    can_proceed = await _rate_limiter.acquire()
    if not can_proceed:
        if settings.GROQ_API_KEY:
            from app.providers.llm.groq import GroqProvider
            llm = GroqProvider(api_key=settings.GROQ_API_KEY)

    llm_response = await llm.generate(prompt, system_prompt=system_prompt, temperature=0.2, max_tokens=1024)
    text = _clean_markdown(llm_response.text)

    await add_message(session_id, "assistant", text, all_sources)
    response_time = int((time.time() - start) * 1000)
    await _log_query(client_id, session_id, message, text, all_sources, response_time, llm_response.model, llm_response.usage)

    return {"response": text, "sources": all_sources, "session_id": session_id}


def _clean_markdown(text: str) -> str:
    """Strip markdown symbols so output is clean plain text."""
    import re
    # Remove bold/italic markers
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text)
    # Remove heading markers
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove inline code
    text = re.sub(r"`(.+?)`", r"\1", text)
    # Remove horizontal rules
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    # Clean up extra blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def _log_query(
    client_id: str, session_id: str, query_text: str, response: str,
    sources: list, response_time_ms: int, model: str, usage: dict,
):
    db = get_db()
    await db[QUERY_LOGS].insert_one({
        "client_id": client_id,
        "session_id": session_id,
        "query": query_text,
        "response": response,
        "sources": sources,
        "response_time_ms": response_time_ms,
        "llm_provider": model,
        "tokens_used": usage,
        "created_at": datetime.now(timezone.utc),
    })


def get_remaining_quota() -> int:
    return _rate_limiter.remaining_daily
