from __future__ import annotations
import logging
import anthropic

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

    def __init__(self, client: anthropic.AsyncAnthropic):
        self._client = client

    async def complete(self, system: str, messages: list[dict], model: str, max_tokens: int = 1024) -> str:
        try:
            response = await self._client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
            return response.content[0].text
        except anthropic.APIError as e:
            raise LLMBackendError(f"Anthropic API error: {e}") from e


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
