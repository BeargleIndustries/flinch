"""Publish: Markdown, HTML, CSV and PDF; PDF is stored as HTML and converted on download (B24, I13)."""

from __future__ import annotations

import pytest

TEMPLATES = ("comparison_table", "consistency_matrix", "pushback_summary", "full_report")
PDF_UNAVAILABLE = "PDF export needs weasyprint on the sidecar."


@pytest.mark.parametrize("fmt", ["markdown", "html", "csv"])
@pytest.mark.parametrize("template", TEMPLATES)
def test_text_formats_return_text(app_client, template: str, fmt: str) -> None:
    resp = app_client.post("/api/publication/export", json={"name": "doc", "format": fmt, "template": template})
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["preview"], str)
    assert isinstance(body["export_id"], int)
    download = app_client.get(f"/api/publication/exports/{body['export_id']}/download")
    assert download.status_code == 200
    assert download.text == body["preview"]


def test_json_is_not_a_format(app_client) -> None:
    resp = app_client.post("/api/publication/export", json={"name": "doc", "format": "json"})
    assert resp.status_code == 422


def test_pdf_is_stored_as_html(app_client) -> None:
    import flinch.app
    from flinch import db

    resp = app_client.post("/api/publication/export", json={"name": "doc", "format": "pdf"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["preview"].startswith("<!DOCTYPE html>")
    stored = db.get_publication_export(flinch.app._conn, body["export_id"])
    assert stored["format"] == "pdf"
    assert stored["content"] == body["preview"]


def test_pdf_download_follows_capability(app_client) -> None:
    """weasyprint may be missing, or installed without working native libraries."""
    has_pdf = app_client.get("/api/settings/capabilities").json()["pdf"]
    export_id = app_client.post("/api/publication/export", json={"name": "doc", "format": "pdf"}).json()["export_id"]

    resp = app_client.get(f"/api/publication/exports/{export_id}/download")

    if has_pdf:
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
    else:
        assert resp.status_code == 400
        assert resp.json()["detail"] == PDF_UNAVAILABLE


def test_pdf_without_weasyprint_is_400(app_client, monkeypatch: pytest.MonkeyPatch) -> None:
    """The publish download and the session export give the reason, not a 500."""
    import flinch.themes

    def missing(html_content: str) -> bytes:
        raise ImportError("weasyprint is required for PDF export.")

    monkeypatch.setattr(flinch.themes, "html_to_pdf", missing)
    export_id = app_client.post("/api/publication/export", json={"name": "doc", "format": "pdf"}).json()["export_id"]
    session_id = app_client.post("/api/sessions", json={"name": "s"}).json()["id"]

    for url, params in (
        (f"/api/publication/exports/{export_id}/download", None),
        (f"/api/sessions/{session_id}/export", {"format": "pdf"}),
    ):
        resp = app_client.get(url, params=params)
        assert resp.status_code == 400, url
        assert resp.json()["detail"] == PDF_UNAVAILABLE
