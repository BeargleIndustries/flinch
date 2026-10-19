"""The .env file never overrides set variables, and its path is configurable (B07, I14)."""

from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_env_file_follows_variable(env: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import flinch.app

    assert flinch.app._env_file() == env / ".env"
    monkeypatch.delenv("FLINCH_ENV_FILE")
    assert flinch.app._env_file() == ROOT / ".env"


def test_set_variable_wins(env: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import flinch.app

    (env / ".env").write_text('ANTHROPIC_API_KEY="from-file"\n', encoding="utf-8")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "from-env")
    flinch.app._load_dotenv()
    assert flinch.app.os.environ["ANTHROPIC_API_KEY"] == "from-env"


def test_unset_variable_loads_from_file(env: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import flinch.app

    (env / ".env").write_text('ANTHROPIC_API_KEY="from-file"\n', encoding="utf-8")
    # delenv records the conftest value, so teardown restores it after _load_dotenv sets it.
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    flinch.app._load_dotenv()
    assert flinch.app.os.environ["ANTHROPIC_API_KEY"] == "from-file"


def test_saving_a_key_writes_the_temp_file(
    env: Path, app_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo_env = ROOT / ".env"
    before = repo_env.read_bytes() if repo_env.exists() else None
    # Register OPENAI_API_KEY with monkeypatch so the route's os.environ write is undone.
    monkeypatch.setenv("OPENAI_API_KEY", "placeholder")
    monkeypatch.delenv("OPENAI_API_KEY")

    resp = app_client.post("/api/settings/keys", json={"OPENAI_API_KEY": "sk-test-1234567890abcd"})

    assert resp.status_code == 200
    assert b'OPENAI_API_KEY="sk-test-1234567890abcd"' in (env / ".env").read_bytes()
    after = repo_env.read_bytes() if repo_env.exists() else None
    assert after == before
