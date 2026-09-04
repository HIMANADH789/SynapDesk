import asyncio
import json
import logging
import re
from typing import AsyncIterator, Optional

import httpx

from app.providers.base import LLMProvider, LLMResponse

logger = logging.getLogger("GroqProvider")

FALLBACK_MODELS = ["groq/compound", "groq/compound-mini", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"]


def _strip_thinking_tags(text: str) -> str:
    """Remove <think>...</think> scratchpads from thinking models."""
    if not text:
        return ""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    return cleaned if cleaned else text.strip()


class GroqProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "groq/compound",
    ):
        self._api_key = api_key
        # Use groq/compound as preferred high-throughput model (70k TPM vs 8k TPM for older Qwen)
        self._model = model if model and model != "qwen/qwen3.6-27b" else "groq/compound"
        self._base_url = "https://api.groq.com/openai/v1"

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _messages(self, prompt: str, system_prompt: Optional[str]) -> list:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        return messages

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 768,
    ) -> LLMResponse:
        models_to_try = [self._model] + [m for m in FALLBACK_MODELS if m != self._model]
        last_exception = None

        for model in models_to_try:
            for attempt in range(3):
                try:
                    async with httpx.AsyncClient(timeout=30) as client:
                        response = await client.post(
                            f"{self._base_url}/chat/completions",
                            headers=self._headers(),
                            json={
                                "model": model,
                                "messages": self._messages(prompt, system_prompt),
                                "temperature": temperature,
                                "max_tokens": max_tokens,
                            },
                        )

                        if response.status_code in (429, 503):
                            retry_after = response.headers.get("retry-after")
                            try:
                                delay = float(retry_after) if retry_after else min(1.5 * (attempt + 1), 4.0)
                            except (ValueError, TypeError):
                                delay = 2.0
                            logger.warning(
                                "Groq rate limited (status %d) on model '%s'. Sleeping %.2fs (attempt %d/3)...",
                                response.status_code,
                                model,
                                delay,
                                attempt + 1,
                            )
                            await asyncio.sleep(delay)
                            continue

                        response.raise_for_status()
                        data = response.json()

                        raw_content = data["choices"][0]["message"].get("content") or ""
                        choice = _strip_thinking_tags(raw_content)
                        usage = data.get("usage", {})

                        return LLMResponse(
                            text=choice,
                            usage={
                                "input_tokens": usage.get("prompt_tokens", 0),
                                "output_tokens": usage.get("completion_tokens", 0),
                            },
                            model=model,
                        )

                except httpx.HTTPStatusError as e:
                    last_exception = e
                    if e.response.status_code in (429, 503) and attempt < 2:
                        continue
                    break
                except Exception as e:
                    last_exception = e
                    logger.warning("Groq call failed on model '%s' (attempt %d): %s", model, attempt + 1, e)
                    await asyncio.sleep(1.0)

        if last_exception:
            raise last_exception
        raise RuntimeError("GroqProvider generation failed across all models.")

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 768,
    ) -> AsyncIterator[str]:
        models_to_try = [self._model] + [m for m in FALLBACK_MODELS if m != self._model]

        for model in models_to_try:
            for attempt in range(3):
                try:
                    async with httpx.AsyncClient(timeout=60) as client:
                        async with client.stream(
                            "POST",
                            f"{self._base_url}/chat/completions",
                            headers=self._headers(),
                            json={
                                "model": model,
                                "messages": self._messages(prompt, system_prompt),
                                "temperature": temperature,
                                "max_tokens": max_tokens,
                                "stream": True,
                            },
                        ) as response:
                            if response.status_code in (429, 503):
                                retry_after = response.headers.get("retry-after")
                                try:
                                    delay = float(retry_after) if retry_after else min(1.5 * (attempt + 1), 4.0)
                                except (ValueError, TypeError):
                                    delay = 2.0
                                logger.warning(
                                    "Groq stream rate limited (status %d) on model '%s'. Sleeping %.2fs...",
                                    response.status_code,
                                    model,
                                    delay,
                                )
                                await asyncio.sleep(delay)
                                continue

                            response.raise_for_status()
                            async for line in response.aiter_lines():
                                if not line.startswith("data: "):
                                    continue
                                payload = line[6:].strip()
                                if payload == "[DONE]":
                                    break
                                try:
                                    data = json.loads(payload)
                                    text = data["choices"][0]["delta"].get("content", "")
                                    if text:
                                        yield text
                                except (json.JSONDecodeError, KeyError, IndexError):
                                    continue
                            return

                except Exception as e:
                    logger.warning("Groq stream failed on '%s': %s", model, e)
                    if attempt < 2:
                        await asyncio.sleep(1.5)
                        continue
                    break

    def get_model_name(self) -> str:
        return self._model

