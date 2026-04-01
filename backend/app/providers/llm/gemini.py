from typing import AsyncIterator, Optional

from google import genai
from google.genai.types import GenerateContentConfig

from app.providers.base import LLMProvider, LLMResponse


class GeminiProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.5-flash",
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
        config = GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        if system_prompt:
            config.system_instruction = system_prompt

        response = self._client.models.generate_content(
            model=self._model,
            contents=prompt,
            config=config,
        )

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
        if system_prompt:
            config.system_instruction = system_prompt

        loop = asyncio.get_event_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def _stream_in_thread():
            try:
                for chunk in self._client.models.generate_content_stream(
                    model=self._model,
                    contents=prompt,
                    config=config,
                ):
                    if chunk.text:
                        loop.call_soon_threadsafe(queue.put_nowait, chunk.text)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

        # Start thread without blocking; read queue concurrently
        thread_future = loop.run_in_executor(None, _stream_in_thread)

        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            yield chunk

        await thread_future  # ensure thread is fully done

    def get_model_name(self) -> str:
        return self._model
