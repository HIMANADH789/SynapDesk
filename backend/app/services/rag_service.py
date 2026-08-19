"""
RAG pipeline with six enhancements:
  1. Clarification detection  — asks for context when retrieved chunks are ambiguous
  2. Cross-encoder reranking  — re-scores top-K candidates with a cross-encoder
  3. Contextual chunk headers — chunks already contain document-level context (done at upload)
  4. Metadata filtering       — narrows ChromaDB search using query-extracted entities
  5. HyDE                     — embeds a hypothetical answer instead of the raw query
  6. Semantic query cache      — returns cached answers for near-duplicate queries
"""

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.db.collections import QUERY_LOGS, CLIENTS
from app.db.mongodb import get_db
from app.models.client import get_setup
from app.providers.base import EmbeddingProvider, LLMProvider, VectorStoreProvider
from app.services.chat_service import add_message, get_history, get_or_create_session
from app.utils.rate_limiter import RateLimiter
from app.utils import reranker as reranker_util
from app.utils.query_cache import check_cache, store_cache

logger = logging.getLogger(__name__)

_rate_limiter = RateLimiter(
    rpm_limit=settings.GEMINI_RPM_LIMIT,
    daily_limit=settings.GEMINI_DAILY_LIMIT,
)

FALLBACK_MESSAGE = (
    "I don't have specific information about that in our knowledge base. "
    "Please contact the administration directly for further assistance."
)

DEFAULT_SYSTEM_PROMPT = """You are a knowledgeable and friendly AI assistant. You help users by answering their questions accurately using the information available to you. You speak in a warm, professional, and conversational tone. You never fabricate information."""

CONVERSATIONAL_TRIGGERS = {
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "how are you", "thanks", "thank you", "bye", "goodbye", "ok", "okay",
    "what can you do", "help", "who are you", "what are you",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_conversational(message: str) -> bool:
    lower = message.lower().strip().rstrip("?!.")
    if lower in CONVERSATIONAL_TRIGGERS:
        return True
    if len(lower.split()) <= 3 and any(t in lower for t in CONVERSATIONAL_TRIGGERS):
        return True
    return False


def _clean_markdown(text: str) -> str:
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _parse_json_response(text: str) -> dict:
    """Best-effort JSON extraction from an LLM response."""
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text.strip())
    except Exception:
        return {}


# ── Enhancement 4: Query-time metadata extraction ────────────────────────────

_QUERY_METADATA_PROMPT = """Extract metadata from this user question as JSON.

Question: {query}

Return ONLY a JSON object:
{{
  "year": "1st | 2nd | 3rd | 4th | null",
  "semester": "1 | 2 | null",
  "department": "department name or null",
  "course": "course name or null"
}}
Use null for any field not mentioned. Return ONLY valid JSON."""


async def _extract_query_metadata(query: str, llm: LLMProvider) -> dict:
    try:
        resp = await llm.generate(_QUERY_METADATA_PROMPT.format(query=query), temperature=0.0, max_tokens=150)
        return _parse_json_response(resp.text)
    except Exception:
        return {}


def _build_where_filter(metadata: dict) -> Optional[dict]:
    """
    Build a ChromaDB `where` filter from query metadata.
    Only filter on fields that were explicitly mentioned in the query.
    """
    conditions = []
    for key in ("year", "semester", "department", "course"):
        val = metadata.get(key)
        if val and val != "null":
            conditions.append({key: {"$eq": val}})
    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}




# ── Enhancement 5: HyDE ──────────────────────────────────────────────────────

_HYDE_PROMPT = """Write a brief, factual answer to this question as if it came from an official document.
Keep it under 100 words. Be specific and direct.

Question: {query}
Answer:"""

# Circuit breaker: skip HyDE for 60s after 3 consecutive failures
_hyde_fail_count = 0
_hyde_open_until: float = 0.0


async def _hypothetical_embedding(
    query: str, llm: LLMProvider, embeddings: EmbeddingProvider
) -> list[float]:
    """Generate a hypothetical answer and embed it for richer semantic retrieval."""
    global _hyde_fail_count, _hyde_open_until

    if time.time() < _hyde_open_until:
        return await embeddings.embed_query(query)

    try:
        resp = await llm.generate(
            _HYDE_PROMPT.format(query=query), temperature=0.1, max_tokens=150
        )
        _hyde_fail_count = 0
        hyp_text = resp.text.strip()
        return await embeddings.embed_query(hyp_text)
    except Exception as e:
        _hyde_fail_count += 1
        if _hyde_fail_count >= 3:
            _hyde_open_until = time.time() + 60.0
            _hyde_fail_count = 0
            logger.warning("HyDE circuit breaker opened for 60s (quota/rate-limit pressure)")
        else:
            logger.debug("HyDE skipped, falling back to query embedding: %s", type(e).__name__)
        return await embeddings.embed_query(query)


# ── Enhancement 1: Clarification detection ───────────────────────────────────

_CLARIFICATION_PROMPT = """You are a helpful assistant deciding whether a user's question needs clarification before it can be answered accurately.

User question: "{query}"

Retrieved context snippets (these are what we found in our knowledge base):
{context_snippets}

Decide if the user's question is too vague or broad to answer accurately based on the retrieved snippets.
A question needs clarification when:
- The context provides multiple completely different answers depending on a missing detail (e.g., year, department).
- The question is out of context and you need more specifics to help them.

If you can provide a helpful, general answer covering the possibilities, do that instead of asking for clarification.
If you DO need clarification, write ONE short, polite, and customer-friendly question (max 15 words) asking for the missing detail.
Otherwise, return needs_clarification: false.

Respond ONLY with valid JSON (no markdown, no explanation):
{"needs_clarification": true, "question": "Which department are you asking about?"}
or
{"needs_clarification": false}"""


async def _check_clarification(
    query: str,
    candidates: list[dict],
    llm: LLMProvider,
    history: list | None = None,
) -> Optional[str]:
    """
    Decide if the query needs clarification before a good answer can be given.

    Two-pass approach:
    1. Fast heuristics: skip unless there is genuine metadata diversity OR
       very low confidence across all retrieved chunks.
    2. If heuristic fires, ask LLM to confirm and generate the question.
    Returns a clarifying question string, or None if the answer can proceed.
    """
    if not candidates:
        return None

    # ── Skip if user is answering a previous clarification ───────────────────
    # If the last assistant message ended with "?", the user is replying to our
    # clarification — don't loop back into another clarification check.
    if history:
        for msg in reversed(history[:-1]):  # exclude last user message
            if msg.get("role") == "assistant":
                if str(msg.get("content", "")).strip().endswith("?"):
                    return None
                break  # only look at the most recent assistant turn

    # ── Skip for very short clarification-answering patterns ─────────────────
    # A reply like "Computer Science" or "3rd year CSE" should go straight to answer.
    query_words = query.strip().split()
    if len(query_words) <= 4 and not any(
        w in query.lower() for w in ("what", "who", "when", "where", "how", "which", "why")
    ):
        return None

    # ── Heuristic 1: metadata diversity ──────────────────────────────────────
    entity_keys = ("year", "semester", "department", "course")
    diversity: dict[str, set] = {k: set() for k in entity_keys}
    for c in candidates:
        meta = c.get("metadata", {})
        for k in entity_keys:
            val = meta.get(k)
            if val and val not in ("null", None, ""):
                diversity[k].add(str(val))

    # Require at least 3 distinct values in a field to flag ambiguity
    has_metadata_ambiguity = any(len(v) >= 3 for v in diversity.values())

    # ── Heuristic 2: very low confidence ─────────────────────────────────────
    scores = [c.get("score", 0.0) for c in candidates]
    top_score = max(scores) if scores else 0.0
    # Flag when top retrieval score is fairly low and there are multiple candidates
    low_confidence = top_score < 0.35 and len(candidates) >= 3

    if not has_metadata_ambiguity and not low_confidence:
        return None

    # ── LLM-based clarification check ────────────────────────────────────────
    snippets = []
    for i, c in enumerate(candidates[:4], 1):
        text = c.get("text", "")[:120].replace("\n", " ")
        snippets.append(f"{i}. {text}…")
    context_snippets = "\n".join(snippets)

    try:
        await _rate_limiter.acquire()
        resp = await llm.generate(
            _CLARIFICATION_PROMPT.format(query=query, context_snippets=context_snippets),
            temperature=0.0,
            max_tokens=80,
        )
        data = _parse_json_response(resp.text)
        if data.get("needs_clarification") and data.get("question"):
            return str(data["question"])
    except Exception as e:
        logger.debug("Clarification check failed: %s", type(e).__name__)

    return None


# ── Sub-question decomposition (unchanged) ────────────────────────────────────

async def _decompose_question(message: str, llm: LLMProvider) -> list[str]:
    prompt = f"""You are a query decomposition assistant.
Given a user question, break it into 1-3 focused sub-questions for a knowledge base lookup.
If the question is already simple, return just the original question.

User question: {message}

Return ONLY a numbered list of sub-questions, nothing else."""
    response = await llm.generate(prompt, temperature=0.0, max_tokens=200)
    lines = [l.strip() for l in response.text.strip().splitlines() if l.strip()]
    sub_questions = [line.lstrip("0123456789. ").strip() for line in lines if line]
    return [q for q in sub_questions if q] or [message]


# ── Core retrieval (shared by query() and query_stream()) ─────────────────────

async def _retrieve_and_rerank(
    client_id: str,
    message: str,
    llm: LLMProvider,
    embeddings: EmbeddingProvider,
    vectordb: VectorStoreProvider,
) -> tuple[list[dict], list[dict]]:
    """
    Runs the full retrieval pipeline:
      - Optional HyDE embedding
      - Optional metadata filtering
      - Sub-question decomposition (for complex multi-part queries)
      - Cross-encoder reranking
    Returns (all_sources, reranked_candidates).
    """
    DECOMPOSE_SIGNALS = ["and", "also", "as well", "additionally", "what about", "along with"]
    words = message.lower().split()
    should_decompose = (
        len(words) > 12
        and any(sig in message.lower() for sig in DECOMPOSE_SIGNALS)
        and message.count("?") > 1
    )

    if should_decompose:
        sub_questions = await _decompose_question(message, llm)
        await _rate_limiter.acquire()
    else:
        sub_questions = [message]

    # Enhancement 4: extract metadata from query for pre-filtering
    query_meta = await _extract_query_metadata(message, llm)
    where_filter = _build_where_filter(query_meta)
    if where_filter:
        logger.debug(f"Applying metadata filter: {where_filter}")

    seen_chunks: set[str] = set()
    all_candidates: list[dict] = []

    for sq in sub_questions:
        # Enhancement 5: HyDE
        if settings.HYDE_ENABLED and not _is_conversational(sq):
            await _rate_limiter.acquire()
            sq_embedding = await _hypothetical_embedding(sq, llm, embeddings)
        else:
            sq_embedding = await embeddings.embed_query(sq)

        # Fetch more candidates than needed so reranker has room to work
        candidates = await vectordb.search(
            client_id,
            sq_embedding,
            top_k=25,
            where=where_filter,
        )

        for r in candidates:
            chunk_key = f"{r['metadata'].get('doc_id','')}_{r['metadata'].get('chunk_index','')}"
            if chunk_key not in seen_chunks and r["score"] > 0.20:
                seen_chunks.add(chunk_key)
                all_candidates.append(r)

    if not all_candidates:
        return [], []

    # Enhancement 2: Cross-encoder reranking
    if settings.RERANK_ENABLED and len(all_candidates) > settings.RETRIEVAL_TOP_K:
        top_candidates = await reranker_util.rerank(
            message, all_candidates, top_k=settings.RETRIEVAL_TOP_K
        )
    else:
        top_candidates = all_candidates[:settings.RETRIEVAL_TOP_K]

    all_sources = []
    seen_docs = set()
    for c in top_candidates:
        doc_id = c["metadata"].get("doc_id", "")
        if doc_id not in seen_docs:
            seen_docs.add(doc_id)
            all_sources.append({
                "doc_id": doc_id,
                "filename": c["metadata"].get("filename", ""),
                "chunk_index": c["metadata"].get("chunk_index", 0),
                "score": round(c["score"], 3),
                "text_preview": c["text"][:200],
            })

    return all_sources, top_candidates


def _build_rag_prompt(context: str, history_text: str, message: str) -> str:
    return f"""Context from knowledge base:
{context}
{history_text}
User question: {message}

Answer rules:
1. Answer using ONLY the context above. You must include the COMPLETE information — reproduce every detail, rule, penalty, consequence, deadline, and step exactly as stated. If the context says "which may include cancellation of the exam", you MUST include that phrase. Never drop or summarize away parts of sentences.
2. Do NOT invent or assume any information not present in the context.
3. Speak naturally and directly. Never say "the context states", "based on the document", "not specified in the provided context", or similar phrases. Just answer the question as if you know it.
4. Do NOT suggest contacting anyone or any department unless the question is completely unanswerable from the context. If you have the answer, just give it.
5. Do NOT add a "Sources" section or mention any filenames.
6. Format: use bullet points (•) for lists, short paragraphs, normal sentence casing. No markdown symbols (**, ##, backticks).
7. Keep answers complete but not bloated — no filler paragraphs, no repeating the same point in different words."""


# ── Public API: non-streaming ─────────────────────────────────────────────────

async def query(
    client_id: str,
    message: str,
    session_id: Optional[str],
    llm: LLMProvider,
    embeddings: EmbeddingProvider,
    vectordb: VectorStoreProvider,
    channel: str = "widget",
) -> dict:
    start = time.time()
    db = get_db()

    session_id = await get_or_create_session(client_id, session_id)
    await add_message(session_id, "user", message)

    client = await db[CLIENTS].find_one({"client_id": client_id})
    system_prompt = DEFAULT_SYSTEM_PROMPT
    max_history = 3
    if client:
        cs = client.get("settings", {})
        if cs.get("system_prompt"):
            system_prompt = cs["system_prompt"]
        if cs.get("max_history_turns"):
            max_history = cs["max_history_turns"]

    history = await get_history(session_id, max_turns=max_history)

    # Session query limit
    from app.services.chat_service import count_session_queries
    query_count = await count_session_queries(session_id)
    _setup_cfg = get_setup((client or {}).get("settings", {}), channel)
    max_qs = _setup_cfg.get("max_queries_per_session", 50)
    if max_qs > 0 and query_count >= max_qs:
        limit_msg = f"You've reached the session limit of {max_qs} messages. Please start a new conversation."
        await add_message(session_id, "assistant", limit_msg)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, limit_msg, [], response_time, "limit", {}, channel=channel)
        return {"response": limit_msg, "sources": [], "session_id": session_id}

    history_text = _build_history_text(history)

    # Conversational shortcut — no retrieval
    if _is_conversational(message):
        await _rate_limiter.acquire()
        conv_prompt = f"{history_text}\nUser: {message}\n\nReply naturally and briefly. You are a front desk assistant."
        llm_response = await llm.generate(conv_prompt, system_prompt=system_prompt, temperature=0.7, max_tokens=256)
        text = _clean_markdown(llm_response.text)
        await add_message(session_id, "assistant", text)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, text, [], response_time, llm_response.model, llm_response.usage, channel=channel)
        return {"response": text, "sources": [], "session_id": session_id}

    can_proceed = await _rate_limiter.acquire()
    if not can_proceed:
        llm = _get_fallback_llm(llm)

    # Enhancement 6: semantic cache check
    if settings.CACHE_ENABLED:
        query_embedding_for_cache = await embeddings.embed_query(message)
        cached = await check_cache(client_id, query_embedding_for_cache)
        if cached:
            logger.debug("Cache hit for query: %s", message[:60])
            await add_message(session_id, "assistant", cached["response"], cached["sources"])
            response_time = int((time.time() - start) * 1000)
            await _log_query(client_id, session_id, message, cached["response"], cached["sources"], response_time, "cache", {}, channel=channel)
            return {"response": cached["response"], "sources": cached["sources"], "session_id": session_id}

    # Retrieve + rerank
    all_sources, top_candidates = await _retrieve_and_rerank(client_id, message, llm, embeddings, vectordb)

    if not top_candidates:
        await add_message(session_id, "assistant", FALLBACK_MESSAGE)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, FALLBACK_MESSAGE, [], response_time, llm.get_model_name(), {}, channel=channel)
        return {"response": FALLBACK_MESSAGE, "sources": [], "session_id": session_id}

    # Enhancement 1: clarification check
    clarification = await _check_clarification(message, top_candidates, llm, history=history)
    if clarification:
        await add_message(session_id, "assistant", clarification)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, clarification, [], response_time, llm.get_model_name(), {}, channel=channel)
        return {"response": clarification, "sources": [], "session_id": session_id}

    context = "\n\n---\n\n".join(c["text"] for c in top_candidates)
    prompt = _build_rag_prompt(context, history_text, message)

    can_proceed = await _rate_limiter.acquire()
    if not can_proceed:
        llm = _get_fallback_llm(llm)

    llm_response = await llm.generate(prompt, system_prompt=system_prompt, temperature=0.2, max_tokens=1024)
    text = _clean_markdown(llm_response.text)

    await add_message(session_id, "assistant", text, all_sources)
    response_time = int((time.time() - start) * 1000)
    await _log_query(client_id, session_id, message, text, all_sources, response_time, llm_response.model, llm_response.usage, channel=channel)

    # Store in semantic cache
    if settings.CACHE_ENABLED:
        await store_cache(client_id, message, query_embedding_for_cache, text, all_sources)

    return {"response": text, "sources": all_sources, "session_id": session_id}


# ── Public API: streaming ─────────────────────────────────────────────────────

async def query_stream(
    client_id: str,
    message: str,
    session_id: Optional[str],
    llm: LLMProvider,
    embeddings: EmbeddingProvider,
    vectordb: VectorStoreProvider,
    channel: str = "widget",
):
    start = time.time()
    db = get_db()

    session_id = await get_or_create_session(client_id, session_id)
    await add_message(session_id, "user", message)

    client = await db[CLIENTS].find_one({"client_id": client_id})
    system_prompt = DEFAULT_SYSTEM_PROMPT
    max_history = 3
    if client:
        cs = client.get("settings", {})
        if cs.get("system_prompt"):
            system_prompt = cs["system_prompt"]
        if cs.get("max_history_turns"):
            max_history = cs["max_history_turns"]

    history = await get_history(session_id, max_turns=max_history)

    # Session query limit
    from app.services.chat_service import count_session_queries
    query_count = await count_session_queries(session_id)
    _setup_cfg = get_setup((client or {}).get("settings", {}), channel)
    max_qs = _setup_cfg.get("max_queries_per_session", 50)
    if max_qs > 0 and query_count >= max_qs:
        limit_msg = f"You've reached the session limit of {max_qs} messages. Please start a new conversation."
        await add_message(session_id, "assistant", limit_msg)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, limit_msg, [], response_time, "limit", {}, channel=channel)
        yield {"type": "token", "text": limit_msg}
        yield {"type": "done", "session_id": session_id, "sources": []}
        return

    history_text = _build_history_text(history)

    # Conversational shortcut
    if _is_conversational(message):
        await _rate_limiter.acquire()
        conv_prompt = f"{history_text}\nUser: {message}\n\nReply naturally and briefly. You are a front desk assistant."
        full_text = ""
        async for chunk in llm.generate_stream(conv_prompt, system_prompt=system_prompt, temperature=0.7, max_tokens=256):
            full_text += chunk
            yield {"type": "token", "text": chunk}
        full_text = _clean_markdown(full_text)
        await add_message(session_id, "assistant", full_text)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, full_text, [], response_time, llm.get_model_name(), {}, channel=channel)
        yield {"type": "done", "session_id": session_id, "sources": []}
        return

    can_proceed = await _rate_limiter.acquire()
    if not can_proceed:
        llm = _get_fallback_llm(llm)

    # Enhancement 6: semantic cache
    query_embedding_for_cache = None
    if settings.CACHE_ENABLED:
        query_embedding_for_cache = await embeddings.embed_query(message)
        cached = await check_cache(client_id, query_embedding_for_cache)
        if cached:
            logger.debug("Cache hit (stream) for query: %s", message[:60])
            await add_message(session_id, "assistant", cached["response"], cached["sources"])
            response_time = int((time.time() - start) * 1000)
            await _log_query(client_id, session_id, message, cached["response"], cached["sources"], response_time, "cache", {}, channel=channel)
            yield {"type": "token", "text": cached["response"]}
            yield {"type": "done", "session_id": session_id, "sources": cached["sources"]}
            return

    # Retrieve + rerank
    all_sources, top_candidates = await _retrieve_and_rerank(client_id, message, llm, embeddings, vectordb)

    if not top_candidates:
        await add_message(session_id, "assistant", FALLBACK_MESSAGE)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, FALLBACK_MESSAGE, [], response_time, llm.get_model_name(), {}, channel=channel)
        yield {"type": "token", "text": FALLBACK_MESSAGE}
        yield {"type": "done", "session_id": session_id, "sources": []}
        return

    # Enhancement 1: clarification check
    clarification = await _check_clarification(message, top_candidates, llm, history=history)
    if clarification:
        await add_message(session_id, "assistant", clarification)
        response_time = int((time.time() - start) * 1000)
        await _log_query(client_id, session_id, message, clarification, [], response_time, llm.get_model_name(), {}, channel=channel)
        yield {"type": "token", "text": clarification}
        yield {"type": "done", "session_id": session_id, "sources": []}
        return

    context = "\n\n---\n\n".join(c["text"] for c in top_candidates)
    prompt = _build_rag_prompt(context, history_text, message)

    can_proceed = await _rate_limiter.acquire()
    if not can_proceed:
        llm = _get_fallback_llm(llm)

    full_text = ""
    async for chunk in llm.generate_stream(prompt, system_prompt=system_prompt, temperature=0.2, max_tokens=1024):
        full_text += chunk
        yield {"type": "token", "text": chunk}

    full_text = _clean_markdown(full_text)
    await add_message(session_id, "assistant", full_text, all_sources)
    response_time = int((time.time() - start) * 1000)
    await _log_query(client_id, session_id, message, full_text, all_sources, response_time, llm.get_model_name(), {}, channel=channel)

    if settings.CACHE_ENABLED and query_embedding_for_cache is not None:
        await store_cache(client_id, message, query_embedding_for_cache, full_text, all_sources)

    yield {"type": "done", "session_id": session_id, "sources": all_sources}


# ── Private helpers ───────────────────────────────────────────────────────────

def _build_history_text(history: list) -> str:
    if len(history) <= 1:
        return ""
    lines = ["\nRecent conversation:"]
    for msg in history[:-1]:
        role = "User" if msg["role"] == "user" else "Assistant"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)


def _get_fallback_llm(current_llm: LLMProvider) -> LLMProvider:
    # Try Groq if not current, then Gemini, then Ollama
    from app.config import settings
    model_name = current_llm.get_model_name().lower()
    # If current is Gemini and Groq is available, fallback to Groq
    if ("gemini" in model_name or model_name.startswith("models/")) and settings.GROQ_API_KEY:
        from app.providers.llm.groq import GroqProvider
        return GroqProvider(api_key=settings.GROQ_API_KEY, model=settings.GROQ_MODEL)
    # If current is Groq and Gemini is available, fallback to Gemini
    if model_name.startswith("llama") and settings.GEMINI_API_KEY:
        from app.providers.llm.gemini import GeminiProvider
        return GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL)
    # Otherwise, fallback to Ollama if available
    if settings.OLLAMA_URL:
        from app.providers.llm.ollama import OllamaProvider
        return OllamaProvider(base_url=settings.OLLAMA_URL)
    return current_llm


async def _log_query(
    client_id: str, session_id: str, query_text: str, response: str,
    sources: list, response_time_ms: int, model: str, usage: dict,
    channel: str = "widget",
) -> None:
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
        "channel": channel,
        "created_at": datetime.now(timezone.utc),
    })


def get_remaining_quota() -> int:
    return _rate_limiter.remaining_daily
