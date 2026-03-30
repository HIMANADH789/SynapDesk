from typing import Optional

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
                "prompt_tokens": response.usage_metadata.prompt_token_count or 0,
                "completion_tokens": response.usage_metadata.candidates_token_count or 0,
            }

        return LLMResponse(
            text=response.text or "",
            usage=usage,
            model=self._model,
        )

    def get_model_name(self) -> str:
        return self._model
