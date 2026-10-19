from __future__ import annotations

import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass

import anthropic
import httpx


@dataclass
class TargetResponse:
    text: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int | None = None
    finish_reason: str | None = None
    raw_model: str | None = None


# Stored when a provider returns no content. It is never sent back to a model
# as an assistant turn (seed and the Claude conversation both skip it).
EMPTY_RESPONSE = "[empty response]"


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

    def seed(self, messages: list[dict[str, str]]) -> None:
        """Replace the conversation with `messages` (alternating user and assistant
        dicts), so the next `reply` continues it."""
        raise NotImplementedError(f"{type(self).__name__} cannot seed a conversation")

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

    def seed(self, messages: list[dict[str, str]]) -> None:
        self._messages = [dict(m) for m in messages]

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
            text = response.content[0].text if response.content else EMPTY_RESPONSE
            if text != EMPTY_RESPONSE:
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
            import openai  # noqa: F401 (availability check)
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

    def seed(self, messages: list[dict[str, str]]) -> None:
        system = [{"role": "system", "content": self._system_prompt}] if self._system_prompt else []
        self._messages = system + [dict(m) for m in messages]

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

    def _config(self):
        from google.genai import types
        return types.GenerateContentConfig(**{"system_instruction": self._system_prompt}) if self._system_prompt else None

    def seed(self, messages: list[dict[str, str]]) -> None:
        from google.genai import types
        history = [
            types.Content(
                role="model" if m["role"] == "assistant" else "user",
                parts=[types.Part(text=m["content"])],
            )
            for m in messages
        ]
        self._chat = self._client.aio.chats.create(
            model=self._model_name, config=self._config(), history=history
        )

    async def send(self, prompt: str) -> TargetResponse:
        self._chat = self._client.aio.chats.create(
            model=self._model_name,
            config=self._config(),
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
        # Base models use Together API, with the Together key (never the OpenAI key)
        api_key = kwargs.pop("api_key", None) or _provider_key("TOGETHER_API_KEY", "Together AI", model)
        super().__init__(
            model=model,
            system_prompt="",  # No system prompt for base models
            api_key=api_key,
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

    def seed(self, messages: list[dict[str, str]]) -> None:
        """The first user message carries the context prefix, as `send` sent it."""
        seeded = [dict(m) for m in messages]
        if self._context_prefix and seeded and seeded[0]["role"] == "user":
            seeded[0]["content"] = f"{self._context_prefix}\n\n{seeded[0]['content']}"
        super().seed(seeded)


class OllamaTarget(OpenAITarget):
    """Target for local models via Ollama (or any OpenAI-compatible local server).
    Works with Ollama, LM Studio, vLLM, text-generation-webui, etc.

    Model IDs are expected in the form "ollama:<model_name>" (e.g. "ollama:llama3.2").
    The prefix is stripped before sending to the server.
    """

    DEFAULT_BASE_URL = "http://localhost:11434/v1"

    @staticmethod
    def default_base_url() -> str:
        """`LOCAL_MODEL_URL`, else the Settings Ollama URL (`OLLAMA_BASE_URL`) plus /v1."""
        return os.environ.get("LOCAL_MODEL_URL") or (
            os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/") + "/v1"
        )

    def __init__(self, model: str, system_prompt: str = "",
                 base_url: str | None = None, **kwargs):
        url = base_url or self.default_base_url()
        # Strip "ollama:" prefix if present — the server just wants the bare model name
        bare_model = model.removeprefix("ollama:")
        # OpenAI client requires an api_key; local servers don't need one
        super().__init__(
            model=bare_model,
            system_prompt=system_prompt,
            base_url=url,
            api_key="ollama",  # dummy key for local server
            **kwargs,
        )

    @classmethod
    async def list_available_models(cls, base_url: str | None = None) -> list[str]:
        """Query Ollama for available models.

        Tries Ollama-native API first (GET /api/tags), falls back to
        OpenAI-compatible /v1/models.  Returns bare model name strings.
        Returns empty list if server is unreachable.
        """
        url = base_url or cls.default_base_url()
        ollama_base = url.rstrip("/").removesuffix("/v1")

        async with httpx.AsyncClient(timeout=5.0) as client:
            # Try Ollama native API first
            try:
                resp = await client.get(f"{ollama_base}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    return [m["name"] for m in data.get("models", [])]
            except Exception:
                pass

            # Fall back to OpenAI-compatible endpoint
            try:
                resp = await client.get(f"{url}/models")
                if resp.status_code == 200:
                    data = resp.json()
                    return [m["id"] for m in data.get("data", [])]
            except Exception:
                pass

        return []

    @classmethod
    async def is_available(cls, base_url: str | None = None) -> bool:
        """Check if the local model server is reachable."""
        url = base_url or cls.default_base_url()
        ollama_base = url.rstrip("/").removesuffix("/v1")
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(ollama_base)
                return resp.status_code == 200
        except Exception:
            return False


XAI_BASE_URL = "https://api.x.ai/v1"
TOGETHER_BASE_URL = "https://api.together.xyz/v1"

_OPENAI_PREFIXES = ("gpt-", "o1-", "o3-", "o4-", "chatgpt-")
_TOGETHER_PREFIXES = ("meta-llama/", "llama-")


def _provider_key(env_name: str, provider_label: str, model_name: str) -> str:
    """Read a provider key; never fall back to another provider's key."""
    key = os.environ.get(env_name)
    if not key:
        raise ValueError(
            f"{provider_label} API key required to test '{model_name}'. "
            f"Set {env_name} or choose a different target model."
        )
    return key


def _provider_for_prefix(model_name: str) -> str | None:
    if model_name.startswith("claude-"):
        return "anthropic"
    if model_name.startswith(_OPENAI_PREFIXES):
        return "openai"
    if model_name.startswith("gemini-"):
        return "google"
    if model_name.startswith("grok-"):
        return "xai"
    if model_name.startswith(_TOGETHER_PREFIXES):
        return "together"
    if model_name.startswith("ollama:"):
        return "ollama"
    return None


def make_target(
    model_name: str,
    system_prompt: str = "",
    anthropic_client: anthropic.AsyncAnthropic | None = None,
    provider_hint: str | None = None,
) -> TargetModel:
    """The one target factory: pick the provider from the model id prefix.

    When no prefix matches, `provider_hint` (anthropic, openai, google, xai,
    together, ollama) decides. xAI and Together targets get their own keys and
    never the OpenAI key.
    """
    provider = _provider_for_prefix(model_name) or provider_hint
    if provider == "anthropic":
        if anthropic_client is None and not os.environ.get("ANTHROPIC_API_KEY"):
            raise ValueError(
                "Anthropic API key required to test Claude models. "
                "Set ANTHROPIC_API_KEY or choose a different target model."
            )
        return ClaudeTarget(model=model_name, client=anthropic_client, system_prompt=system_prompt)
    if provider == "openai":
        return OpenAITarget(model_name, system_prompt=system_prompt)
    if provider == "google":
        return GeminiTarget(model_name, system_prompt=system_prompt)
    if provider == "xai":
        return OpenAITarget(
            model_name,
            system_prompt=system_prompt,
            api_key=_provider_key("XAI_API_KEY", "xAI", model_name),
            base_url=XAI_BASE_URL,
        )
    if provider == "together":
        return OpenAITarget(
            model_name,
            system_prompt=system_prompt,
            api_key=_provider_key("TOGETHER_API_KEY", "Together AI", model_name),
            base_url=TOGETHER_BASE_URL,
        )
    if provider == "ollama":
        return OllamaTarget(model=model_name, system_prompt=system_prompt)
    raise ValueError(
        f"Unknown model prefix for '{model_name}'. "
        "Supported: claude-*, gpt-*, o1-*, o3-*, o4-*, chatgpt-*, gemini-*, grok-*, "
        "meta-llama/*, llama-*, ollama:*"
    )
