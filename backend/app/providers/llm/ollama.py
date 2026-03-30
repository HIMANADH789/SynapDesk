from typing import Optional

import httpx

from app.providers.base import LLMProvider, LLMResponse


class OllamaProvider(LLMProvider):
    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.2",
    ):
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/api/generate",
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()

        return LLMResponse(
            text=data.get("response", ""),
            usage={
                "prompt_tokens": data.get("prompt_eval_count", 0),
                "completion_tokens": data.get("eval_count", 0),
            },
            model=self._model,
        )

    def get_model_name(self) -> str:
        return self._model
