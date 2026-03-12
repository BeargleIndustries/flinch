from __future__ import annotations

import os
from abc import ABC, abstractmethod

import anthropic


class TargetModelError(Exception):
    pass


class TargetRateLimitError(TargetModelError):
    pass


class TargetConnectionError(TargetModelError):
    pass


class TargetModel(ABC):
    @property
    @abstractmethod
    def model_name(self) -> str: ...

    @abstractmethod
    async def send(self, prompt: str) -> str: ...

    @abstractmethod
    async def reply(self, pushback: str) -> str: ...

    @abstractmethod
    def reset(self) -> None: ...


class ClaudeTarget(TargetModel):
    def __init__(
        self,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
        client: anthropic.AsyncAnthropic | None = None,
        system_prompt: str = "",
    ) -> None:
        self._model = model
        self._max_tokens = max_tokens
        self._client = client or anthropic.AsyncAnthropic()
        self._system_prompt = system_prompt
        self._messages: list[dict] = []

    @property
    def model_name(self) -> str:
        return self._model

    def reset(self) -> None:
        self._messages = []

    async def _call(self) -> str:
        try:
            kwargs = dict(
                model=self._model,
                max_tokens=self._max_tokens,
                messages=self._messages,
            )
            if self._system_prompt:
                kwargs["system"] = self._system_prompt
            response = await self._client.messages.create(**kwargs)
            text = response.content[0].text
            self._messages.append({"role": "assistant", "content": text})
            return text
        except anthropic.RateLimitError as e:
            raise TargetRateLimitError(str(e)) from e
        except anthropic.APIConnectionError as e:
            raise TargetConnectionError(str(e)) from e
        except anthropic.APIError as e:
            raise TargetModelError(str(e)) from e

    async def send(self, prompt: str) -> str:
        self.reset()
        self._messages.append({"role": "user", "content": prompt})
        return await self._call()

    async def reply(self, pushback: str) -> str:
        self._messages.append({"role": "user", "content": pushback})
        return await self._call()


class OpenAITarget(TargetModel):
    """OpenAI GPT models via the openai Python SDK."""

    def __init__(self, model: str, system_prompt: str = "", api_key: str | None = None, base_url: str | None = None) -> None:
        try:
            import openai
        except ImportError:
            raise ImportError("openai package required. Install with: pip install openai")
        self._model = model
        self._system_prompt = system_prompt
        import openai as _openai
        kwargs = {"api_key": api_key or os.environ.get("OPENAI_API_KEY")}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = _openai.AsyncOpenAI(**kwargs)
        self._messages: list[dict] = []

    @property
    def model_name(self) -> str:
        return self._model

    def reset(self) -> None:
        self._messages = []

    async def send(self, prompt: str) -> str:
        self._messages = []
        if self._system_prompt:
            self._messages.append({"role": "system", "content": self._system_prompt})
        self._messages.append({"role": "user", "content": prompt})
        return await self._call()

    async def reply(self, pushback: str) -> str:
        self._messages.append({"role": "user", "content": pushback})
        return await self._call()

    async def _call(self) -> str:
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=self._messages,
            )
            reply = response.choices[0].message.content
            self._messages.append({"role": "assistant", "content": reply})
            return reply
        except Exception as e:
            msg = str(e)
            if "rate" in msg.lower() or "429" in msg:
                raise TargetRateLimitError(msg) from e
            raise TargetConnectionError(msg) from e


class GeminiTarget(TargetModel):
    """Google Gemini models via google.genai SDK."""

    def __init__(self, model: str, system_prompt: str = "", api_key: str | None = None) -> None:
        try:
            from google import genai
        except ImportError:
            raise ImportError(
                "google-genai package required. Install with: pip install google-genai"
            )
        key = api_key or os.environ.get("GOOGLE_API_KEY", "")
        self._client = genai.Client(api_key=key)
        self._model_name = model
        self._system_prompt = system_prompt
        self._chat = None

    @property
    def model_name(self) -> str:
        return self._model_name

    def reset(self) -> None:
        self._chat = None

    async def send(self, prompt: str) -> str:
        from google.genai import types
        config = types.GenerateContentConfig(**{"system_instruction": self._system_prompt}) if self._system_prompt else None
        self._chat = self._client.aio.chats.create(
            model=self._model_name,
            config=config,
        )
        try:
            response = await self._chat.send_message(prompt)
            return response.text
        except Exception as e:
            msg = str(e)
            if "429" in msg or "rate" in msg.lower() or "quota" in msg.lower():
                raise TargetRateLimitError(msg) from e
            raise TargetConnectionError(msg) from e

    async def reply(self, pushback: str) -> str:
        if not self._chat:
            return await self.send(pushback)
        try:
            response = await self._chat.send_message(pushback)
            return response.text
        except Exception as e:
            msg = str(e)
            if "429" in msg or "rate" in msg.lower() or "quota" in msg.lower():
                raise TargetRateLimitError(msg) from e
            raise TargetConnectionError(msg) from e
