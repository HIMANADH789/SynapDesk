"""
Cross-encoder reranker using sentence-transformers.
Lazy-loaded on first use so startup is unaffected.
Falls back to original cosine scores if the model fails to load.
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

_model = None
_load_attempted = False


def _get_model():
    global _model, _load_attempted
    if _load_attempted:
        return _model
    _load_attempted = True
    try:
        from sentence_transformers import CrossEncoder  # type: ignore
        import torch  # type: ignore
        # Explicitly load on CPU to avoid PyTorch meta-device errors
        # that occur when accelerate initialises models on a meta device.
        _model = CrossEncoder(
            "cross-encoder/ms-marco-MiniLM-L-6-v2",
            max_length=512,
            device="cpu",
        )
        # Ensure the underlying HuggingFace model is fully materialised on CPU
        if hasattr(_model, "model"):
            _model.model = _model.model.to(torch.device("cpu"))
        logger.info("Cross-encoder reranker loaded successfully on CPU")
    except Exception as e:
        logger.warning(f"Reranker could not be loaded — falling back to cosine scores: {e}")
        _model = None
    return _model


def preload() -> None:
    """Call at application startup to warm the model before the first request."""
    _get_model()


async def rerank(query: str, candidates: list[dict], top_k: int = 4) -> list[dict]:
    """
    Rerank `candidates` (each has a 'text' and 'score' key) using a cross-encoder.
    Returns the top_k highest-scoring candidates.
    Falls back to original cosine ordering if model unavailable.
    """
    if not candidates:
        return candidates

    model = _get_model()
    if model is None:
        # Graceful fallback: cosine order, just truncate to top_k
        return candidates[:top_k]

    pairs = [(query, c["text"]) for c in candidates]

    # Run synchronous cross-encoder in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    scores = await loop.run_in_executor(None, model.predict, pairs)

    ranked = sorted(zip(scores, candidates), key=lambda x: float(x[0]), reverse=True)
    return [c for _, c in ranked[:top_k]]
