from __future__ import annotations

import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass

import anthropic


@dataclass
class TargetResponse:
    text: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int | None = None
    finish_reason: str | None = None
    raw_model: str | None = None


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
    async def send(self, prompt: str) -> TargetResponse: ...

    @abstractmethod
    async def reply(self, pushback: str) -> TargetResponse: ...

    @abstractmethod
    def reset(self) -> None: ...

    @property
    def is_base_model(self) -> bool:
        """Whether this is a pre-RLHF base model."""
        return False


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

    async def _call(self) -> TargetResponse:
        try:
            kwargs = dict(
                model=self._model,
                max_tokens=self._max_tokens,
                messages=self._messages,
            )
            if self._system_prompt:
                kwargs["system"] = self._system_prompt
            t0 = time.monotonic()
            response = await self._client.messages.create(**kwargs)
            latency_ms = int((time.monotonic() - t0) * 1000)
            text = response.content[0].text
            self._messages.append({"role": "assistant", "content": text})
            return TargetResponse(
                text=text,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                latency_ms=latency_ms,
                finish_reason=response.stop_reason,
                raw_model=response.model,
            )
        except anthropic.RateLimitError as e:
            raise TargetRateLimitError(str(e)) from e
        except anthropic.APIConnectionError as e:
            raise TargetConnectionError(str(e)) from e
        except anthropic.APIError as e:
            raise TargetModelError(str(e)) from e

    async def send(self, prompt: str) -> TargetResponse:
        self.reset()
        self._messages.append({"role": "user", "content": prompt})
        return await self._call()

    async def reply(self, pushback: str) -> TargetResponse:
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

    async def send(self, prompt: str) -> TargetResponse:
        self._messages = []
        if self._system_prompt:
            self._messages.append({"role": "system", "content": self._system_prompt})
        self._messages.append({"role": "user", "content": prompt})
        return await self._call()

    async def reply(self, pushback: str) -> TargetResponse:
        self._messages.append({"role": "user", "content": pushback})
        return await self._call()

    async def _call(self) -> TargetResponse:
        try:
            t0 = time.monotonic()
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=self._messages,
            )
            latency_ms = int((time.monotonic() - t0) * 1000)
            reply_text = response.choices[0].message.content
            self._messages.append({"role": "assistant", "content": reply_text})
            usage = response.usage
            return TargetResponse(
                text=reply_text,
                input_tokens=usage.prompt_tokens if usage else None,
                output_tokens=usage.completion_tokens if usage else None,
                latency_ms=latency_ms,
                finish_reason=response.choices[0].finish_reason,
                raw_model=response.model,
            )
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

    async def send(self, prompt: str) -> TargetResponse:
        from google.genai import types
        config = types.GenerateContentConfig(**{"system_instruction": self._system_prompt}) if self._system_prompt else None
        self._chat = self._client.aio.chats.create(
            model=self._model_name,
            config=config,
        )
        try:
            t0 = time.monotonic()
            response = await self._chat.send_message(prompt)
            latency_ms = int((time.monotonic() - t0) * 1000)
            meta = getattr(response, "usage_metadata", None)
            return TargetResponse(
                text=response.text,
                input_tokens=meta.prompt_token_count if meta else None,
                output_tokens=meta.candidates_token_count if meta else None,
                latency_ms=latency_ms,
                finish_reason=None,
                raw_model=self._model_name,
            )
        except Exception as e:
            msg = str(e)
            if "429" in msg or "rate" in msg.lower() or "quota" in msg.lower():
                raise TargetRateLimitError(msg) from e
            raise TargetConnectionError(msg) from e

    async def reply(self, pushback: str) -> TargetResponse:
        if not self._chat:
            return await self.send(pushback)
        try:
            t0 = time.monotonic()
            response = await self._chat.send_message(pushback)
            latency_ms = int((time.monotonic() - t0) * 1000)
            meta = getattr(response, "usage_metadata", None)
            return TargetResponse(
                text=response.text,
                input_tokens=meta.prompt_token_count if meta else None,
                output_tokens=meta.candidates_token_count if meta else None,
                latency_ms=latency_ms,
                finish_reason=None,
                raw_model=self._model_name,
            )
        except Exception as e:
            msg = str(e)
            if "429" in msg or "rate" in msg.lower() or "quota" in msg.lower():
                raise TargetRateLimitError(msg) from e
            raise TargetConnectionError(msg) from e


class BaseModelTarget(OpenAITarget):
    """Target for pre-RLHF base models via Together API.
    Base models don't support system prompts, so we prepend context as user message."""

    BASE_MODELS = {
        "meta-llama/Llama-4-Scout-Base",
        "deepseek-ai/DeepSeek-V3-Base",
        "meta-llama/Llama-3.3-70B",
    }

    def __init__(self, model: str, system_prompt: str = "", **kwargs):
        # Base models use Together API
        super().__init__(
            model=model,
            system_prompt="",  # No system prompt for base models
            base_url="https://api.together.xyz/v1",
            **kwargs
        )
        self._context_prefix = system_prompt  # Stored for prepending

    @property
    def is_base_model(self) -> bool:
        return True

    async def send(self, prompt: str) -> TargetResponse:
        """Prepend system context as part of the user message for base models."""
        if self._context_prefix:
            full_prompt = f"{self._context_prefix}\n\n{prompt}"
        else:
            full_prompt = prompt
        return await super().send(full_prompt)
