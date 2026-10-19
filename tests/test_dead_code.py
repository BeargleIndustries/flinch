"""Dead code removed in B33 / D28 stays removed."""

from __future__ import annotations

import pytest

REMOVED_ROUTES = (
    "/api/sessions/{session_id}/batch-conditions",
    "/api/experiments/{experiment_id}/resume-conditions",
)

REMOVED_DB_FUNCTIONS = (
    "find_experiment_response",
    "create_corpus_import",
    "update_corpus_import",
    "get_corpus_import",
    "list_corpus_imports",
    "add_extracted_probe",
    "get_extracted_probes",
    "update_extracted_probe",
    "confirm_extracted_probes",
)


@pytest.mark.parametrize("path", REMOVED_ROUTES)
def test_removed_route_absent(path: str) -> None:
    import flinch.app

    assert path not in flinch.app.app.openapi()["paths"]


def test_removed_models_absent() -> None:
    import flinch.app
    import flinch.models

    for name in ("ConditionItem", "BatchConditionsRequest"):
        assert not hasattr(flinch.app, name)
        assert not hasattr(flinch.models, name)


def test_removed_runner_method_absent() -> None:
    from flinch.runner import Runner

    assert not hasattr(Runner, "run_batch_conditions")


@pytest.mark.parametrize("name", REMOVED_DB_FUNCTIONS)
def test_removed_db_function_absent(name: str) -> None:
    import flinch.db

    assert not hasattr(flinch.db, name)


def test_experiments_api_intact() -> None:
    import flinch.app

    paths = flinch.app.app.openapi()["paths"]
    assert any(p.startswith("/api/experiments") for p in paths)
