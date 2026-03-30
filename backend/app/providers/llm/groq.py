from typing import Optional

import httpx

from app.providers.base import LLMProvider, LLMResponse


class GroqProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "llama-3.3-70b-versatile",
    ):
        self._api_key = api_key
        self._model = model
        self._base_url = "https://api.groq.com/openai/v1"

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()

        choice = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})

        return LLMResponse(
            text=choice,
            usage={
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
            },
            model=self._model,
        )

    def get_model_name(self) -> str:
        return self._model
