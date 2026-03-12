from __future__ import annotations
import logging
import os

logger = logging.getLogger(__name__)


class LLMBackendError(Exception):
    """Common error type for LLM backend failures."""
    pass


class LLMBackend:
    """Abstraction for LLM calls used by Coach/NarrativeCoach."""

    async def complete(self, system: str, messages: list[dict], model: str, max_tokens: int = 1024) -> str:
        """Send a chat completion and return the text response."""
        raise NotImplementedError


class AnthropicBackend(LLMBackend):
    """Backend using the Anthropic SDK (default for coach)."""

    def __init__(self, client):
        import anthropic
        self._client = client
        self._anthropic = anthropic

    async def complete(self, system: str, messages: list[dict], model: str, max_tokens: int = 1024) -> str:
        try:
            response = await self._client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
            return response.content[0].text
        except self._anthropic.APIError as e:
            raise LLMBackendError(f"Anthropic API error: {e}") from e


class OpenAIBackend(LLMBackend):
    """Backend using the OpenAI SDK directly."""

    def __init__(self, default_model: str = "gpt-4.1-mini"):
        try:
            import openai
        except ImportError:
            raise LLMBackendError(
                "The 'openai' package is required for OpenAI support. "
                "Install it with: pip install flinch[multi-model]"
            ) from None
        self._client = openai.AsyncOpenAI()
        self._default_model = default_model

    async def complete(self, system: str, messages: list[dict], model: str | None = None, max_tokens: int = 1024) -> str:
        try:
            msgs = [{"role": "system", "content": system}] + messages
            response = await self._client.chat.completions.create(
                model=model or self._default_model,
                max_tokens=max_tokens,
                messages=msgs,
            )
            return response.choices[0].message.content
        except Exception as e:
            raise LLMBackendError(f"OpenAI backend error ({type(e).__name__}): {e}") from e


class GoogleBackend(LLMBackend):
    """Backend using the Google GenAI SDK."""

    def __init__(self, default_model: str = "gemini-2.0-flash"):
        try:
            import google.genai as genai
        except ImportError:
            raise LLMBackendError(
                "The 'google-genai' package is required for Google support. "
                "Install it with: pip install google-genai"
            ) from None
        self._client = genai.Client()
        self._default_model = default_model

    async def complete(self, system: str, messages: list[dict], model: str | None = None, max_tokens: int = 1024) -> str:
        try:
            contents = [
                {
                    "role": m["role"] if m["role"] != "assistant" else "model",
                    "parts": [{"text": m["content"]}],
                }
                for m in messages
            ]
            config = {"system_instruction": system, "max_output_tokens": max_tokens}
            response = await self._client.aio.models.generate_content(
                model=model or self._default_model,
                contents=contents,
                config=config,
            )
            return response.text
        except Exception as e:
            raise LLMBackendError(f"Google backend error ({type(e).__name__}): {e}") from e


class OpenAICompatibleBackend(LLMBackend):
    """Backend using the OpenAI SDK pointed at a compatible endpoint (e.g. Ollama).

    Ollama exposes an OpenAI-compatible API at http://localhost:11434/v1.
    This backend converts Anthropic-style calls (separate system param) to
    OpenAI-style calls (system message in messages list).
    """

    def __init__(self, base_url: str, api_key: str = "ollama", default_model: str = "llama3.2"):
        try:
            import openai
        except ImportError:
            raise LLMBackendError(
                "The 'openai' package is required for Ollama/local model support. "
                "Install it with: pip install flinch[multi-model]"
            ) from None
        self._client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._default_model = default_model

    async def complete(self, system: str, messages: list[dict], model: str | None = None, max_tokens: int = 1024) -> str:
        try:
            msgs = [{"role": "system", "content": system}] + messages
            # Always use our configured model — callers pass Anthropic model names
            # (e.g. "claude-sonnet-4-20250514") which aren't valid for Ollama
            response = await self._client.chat.completions.create(
                model=self._default_model,
                max_tokens=max_tokens,
                messages=msgs,
            )
            return response.choices[0].message.content
        except Exception as e:
            raise LLMBackendError(f"OpenAI-compatible backend error ({type(e).__name__}): {e}") from e


def get_best_available_backend() -> LLMBackend | None:
    """Return the best available LLM backend based on configured API keys.

    Preference order: Anthropic > OpenAI > Google > Ollama.
    """
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            import anthropic
            return AnthropicBackend(anthropic.AsyncAnthropic())
        except Exception:
            pass

    if os.environ.get("OPENAI_API_KEY"):
        try:
            return OpenAIBackend()
        except Exception:
            pass

    if os.environ.get("GOOGLE_API_KEY"):
        try:
            return GoogleBackend()
        except Exception:
            pass

    # Try Ollama as last resort
    try:
        import httpx
        resp = httpx.get("http://localhost:11434/api/tags", timeout=2)
        if resp.status_code == 200:
            models = resp.json().get("models", [])
            if models:
                return OpenAICompatibleBackend(
                    base_url="http://localhost:11434/v1",
                    api_key="ollama",
                    default_model=models[0]["name"],
                )
    except Exception:
        pass

    return None


def get_backend_for_provider(provider: str) -> LLMBackend | None:
    """Get a backend for a specific provider."""
    if provider == "anthropic" and os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        return AnthropicBackend(anthropic.AsyncAnthropic())
    elif provider == "openai" and os.environ.get("OPENAI_API_KEY"):
        return OpenAIBackend()
    elif provider == "google" and os.environ.get("GOOGLE_API_KEY"):
        return GoogleBackend()
    elif provider == "ollama":
        return OpenAICompatibleBackend(base_url="http://localhost:11434/v1", api_key="ollama")
    return None
