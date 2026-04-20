from typing import AsyncIterator, Optional

from google import genai
from google.genai.types import GenerateContentConfig, Content, Part

from app.providers.base import LLMProvider, LLMResponse


def _build_contents(prompt: str, system_prompt: Optional[str]) -> list:
    """
    For models on the v1 API (e.g. gemini-1.5-flash), system_instruction is
    passed as the first user turn rather than a separate config field, which
    avoids the 'Unknown name systemInstruction' serialisation error.
    """
    if system_prompt:
        return [
            Content(role="user", parts=[Part(text=system_prompt)]),
            Content(role="model", parts=[Part(text="Understood.")]),
            Content(role="user", parts=[Part(text=prompt)]),
        ]
    return [Content(role="user", parts=[Part(text=prompt)])]


class GeminiProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "models/gemini-pro-latest",
    ):
        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        import asyncio

        config = GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        contents = _build_contents(prompt, system_prompt)

        def _call():
            return self._client.models.generate_content(
                model=self._model,
                contents=contents,
                config=config,
            )

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, _call)

        usage = {}
        if response.usage_metadata:
            usage = {
                "input_tokens": response.usage_metadata.prompt_token_count or 0,
                "output_tokens": response.usage_metadata.candidates_token_count or 0,
            }

        return LLMResponse(
            text=response.text or "",
            usage=usage,
            model=self._model,
        )

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> AsyncIterator[str]:
        import asyncio

        config = GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        contents = _build_contents(prompt, system_prompt)

        loop = asyncio.get_event_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def _stream_in_thread():
            try:
                for chunk in self._client.models.generate_content_stream(
                    model=self._model,
                    contents=contents,
                    config=config,
                ):
                    if chunk.text:
                        loop.call_soon_threadsafe(queue.put_nowait, chunk.text)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, exc)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

        thread_future = loop.run_in_executor(None, _stream_in_thread)

        while True:
            item = await queue.get()
            if item is None:
                break
            if isinstance(item, Exception):
                raise item
            yield item

        await thread_future

    def get_model_name(self) -> str:
        return self._model
