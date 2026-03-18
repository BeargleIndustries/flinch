"""Per-provider rate limiting with token bucket algorithm."""
from __future__ import annotations
import asyncio
import time
import logging

logger = logging.getLogger(__name__)


class ProviderRateLimiter:
    """Rate limiter for API providers with exponential backoff."""

    DEFAULT_LIMITS = {
        "anthropic": {"rpm": 60, "concurrent": 5},
        "openai": {"rpm": 60, "concurrent": 5},
        "google": {"rpm": 60, "concurrent": 3},
        "together": {"rpm": 60, "concurrent": 3},
        "xai": {"rpm": 60, "concurrent": 3},
    }

    def __init__(self, provider: str, rpm: int | None = None, concurrent: int | None = None):
        defaults = self.DEFAULT_LIMITS.get(provider, {"rpm": 30, "concurrent": 2})
        self.provider = provider
        self.rpm = rpm or defaults["rpm"]
        self.max_concurrent = concurrent or defaults["concurrent"]
        self._semaphore = asyncio.Semaphore(self.max_concurrent)
        self._interval = 60.0 / self.rpm  # seconds between requests
        self._last_request = 0.0
        self._lock = asyncio.Lock()
        # Stats
        self.total_requests = 0
        self.total_retries = 0
        self.total_tokens_in = 0
        self.total_tokens_out = 0

    async def acquire(self):
        """Wait for rate limit slot. Returns when safe to make a request."""
        await self._semaphore.acquire()
        async with self._lock:
            now = time.monotonic()
            wait_time = self._interval - (now - self._last_request)
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self._last_request = time.monotonic()

    def release(self):
        """Release the concurrency semaphore."""
        self._semaphore.release()

    def record_usage(self, input_tokens: int = 0, output_tokens: int = 0):
        """Track token usage for cost estimation."""
        self.total_requests += 1
        self.total_tokens_in += input_tokens
        self.total_tokens_out += output_tokens

    def record_retry(self):
        """Track retries."""
        self.total_retries += 1

    def get_stats(self) -> dict:
        return {
            "provider": self.provider,
            "total_requests": self.total_requests,
            "total_retries": self.total_retries,
            "total_tokens_in": self.total_tokens_in,
            "total_tokens_out": self.total_tokens_out,
        }


class RateLimiterPool:
    """Manages rate limiters for all providers."""

    def __init__(self, config: dict | None = None):
        self._limiters: dict[str, ProviderRateLimiter] = {}
        self._config = config or {}

    def get(self, provider: str) -> ProviderRateLimiter:
        if provider not in self._limiters:
            provider_config = self._config.get(provider, {})
            self._limiters[provider] = ProviderRateLimiter(
                provider,
                rpm=provider_config.get("rpm"),
                concurrent=provider_config.get("concurrent"),
            )
        return self._limiters[provider]

    def get_all_stats(self) -> dict:
        return {name: limiter.get_stats() for name, limiter in self._limiters.items()}
