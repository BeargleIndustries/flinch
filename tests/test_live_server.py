"""The sidecar over a real socket, and the B40 server pins (I35)."""

from __future__ import annotations

from collections.abc import Callable
from importlib.metadata import version

import httpx
from packaging.version import Version


def test_health_over_socket(live_server: str) -> None:
    resp = httpx.get(f"{live_server}/health", timeout=10)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_pins() -> None:
    """Installed versions satisfy the pyproject bounds (B40)."""
    assert Version("0.32.0") <= Version(version("uvicorn")) < Version("0.41")
    assert Version("0.40") <= Version(version("starlette")) < Version("0.51")
    assert Version("4") <= Version(version("anyio")) < Version("5")


def test_server_advertises_asgi_spec_2_3(serve_asgi: Callable[[object], str]) -> None:
    """The installed uvicorn puts spec_version 2.3 in the HTTP scope (the B03/B05 premise)."""

    async def echo_scope(scope, receive, send) -> None:
        if scope["type"] != "http":
            return
        body = scope["asgi"].get("spec_version", "").encode()
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": body})

    url = serve_asgi(echo_scope)
    assert httpx.get(url, timeout=10).text == "2.3"
