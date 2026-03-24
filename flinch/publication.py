"""Publication-ready export templates for research papers."""
from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timezone
from html import escape as html_escape

from flinch.themes import get_theme, render_theme_css, render_theme_header

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_CLASSIFICATIONS = ("refused", "collapsed", "negotiated", "complied")


def _pct(numerator: int, denominator: int) -> str:
    if denominator == 0:
        return "—"
    return f"{numerator / denominator:.1%}"


def _rate(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)


# ---------------------------------------------------------------------------
# Filter helpers
# ---------------------------------------------------------------------------

def _build_run_where(filters: dict | None) -> tuple[str, list]:
    """Build WHERE clause fragments for the runs table based on filter dict.

    Supported keys:
      models        list[str]  – target_model IN (...)
      domains       list[str]  – probe domain IN (...)
      date_range    {start, end} – runs.created_at range (ISO strings)
      classifications list[str] – initial_classification IN (...)
    """
    filters = filters or {}
    clauses: list[str] = []
    params: list = []

    if models := filters.get("models"):
        ph = ",".join("?" * len(models))
        clauses.append(f"r.target_model IN ({ph})")
        params.extend(models)

    if domains := filters.get("domains"):
        ph = ",".join("?" * len(domains))
        clauses.append(f"p.domain IN ({ph})")
        params.extend(domains)

    if dr := filters.get("date_range"):
        if start := dr.get("start"):
            clauses.append("r.created_at >= ?")
            params.append(start)
        if end := dr.get("end"):
            clauses.append("r.created_at <= ?")
            params.append(end)

    if classifications := filters.get("classifications"):
        ph = ",".join("?" * len(classifications))
        clauses.append(f"r.initial_classification IN ({ph})")
        params.extend(classifications)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def _build_stat_run_where(filters: dict | None) -> tuple[str, list]:
    """Build WHERE clause for stat_runs / stat_run_iterations queries."""
    filters = filters or {}
    clauses: list[str] = []
    params: list = []

    if models := filters.get("models"):
        ph = ",".join("?" * len(models))
        clauses.append(f"sr.target_model IN ({ph})")
        params.extend(models)

    if domains := filters.get("domains"):
        ph = ",".join("?" * len(domains))
        clauses.append(f"p.domain IN ({ph})")
        params.extend(domains)

    if dr := filters.get("date_range"):
        if start := dr.get("start"):
            clauses.append("sr.created_at >= ?")
            params.append(start)
        if end := dr.get("end"):
            clauses.append("sr.created_at <= ?")
            params.append(end)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


# ---------------------------------------------------------------------------
# Table formatter
# ---------------------------------------------------------------------------

def _format_table(headers: list[str], rows: list[list], fmt: str) -> str:
    """Render a 2-D table in markdown, html, or csv format."""
    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        writer.writerows(rows)
        return buf.getvalue()

    if fmt == "html":
        th = "".join(f"<th>{html_escape(str(h))}</th>" for h in headers)
        body_rows = []
        for row in rows:
            cells = "".join(f"<td>{html_escape(str(c))}</td>" for c in row)
            body_rows.append(f"  <tr>{cells}</tr>")
        return (
            "<table>\n"
            f"  <thead><tr>{th}</tr></thead>\n"
            "  <tbody>\n"
            + "\n".join(body_rows)
            + "\n  </tbody>\n</table>"
        )

    # Default: markdown
    col_widths = [
        max(len(str(headers[i])), *(len(str(row[i])) for row in rows) if rows else [0])
        for i in range(len(headers))
    ]
    def pad(val: object, w: int) -> str:
        return str(val).ljust(w)

    header_line = "| " + " | ".join(pad(h, col_widths[i]) for i, h in enumerate(headers)) + " |"
    sep_line = "| " + " | ".join("-" * col_widths[i] for i in range(len(headers))) + " |"
    data_lines = [
        "| " + " | ".join(pad(row[i], col_widths[i]) for i in range(len(headers))) + " |"
        for row in rows
    ]
    return "\n".join([header_line, sep_line] + data_lines)


# ---------------------------------------------------------------------------
# Summary statistics
# ---------------------------------------------------------------------------

def _summary_stats(conn, filters: dict | None = None) -> dict:
    """Aggregate statistics across all runs matching filters."""
    where, params = _build_run_where(filters)
    sql = f"""
        SELECT
            COUNT(DISTINCT r.id)           AS total_runs,
            COUNT(DISTINCT r.target_model) AS total_models,
            COUNT(DISTINCT r.probe_id)     AS total_probes,
            MIN(r.created_at)              AS date_start,
            MAX(r.created_at)              AS date_end,
            SUM(CASE WHEN r.initial_classification = 'refused'    THEN 1 ELSE 0 END) AS refused,
            SUM(CASE WHEN r.initial_classification = 'collapsed'  THEN 1 ELSE 0 END) AS collapsed,
            SUM(CASE WHEN r.initial_classification = 'negotiated' THEN 1 ELSE 0 END) AS negotiated,
            SUM(CASE WHEN r.initial_classification = 'complied'   THEN 1 ELSE 0 END) AS complied
        FROM runs r
        LEFT JOIN probes p ON p.id = r.probe_id
        {where}
    """
    row = conn.execute(sql, params).fetchone()
    if not row:
        return {}
    d = dict(row)
    total = d.get("total_runs") or 0
    d["overall_refusal_rate"] = _rate(d.get("refused") or 0, total)
    return d


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_comparison_table(
    conn,
    filters: dict | None = None,
    format: str = "markdown",
    theme: str = "beargle-dark",
) -> str:
    """Per-model comparison table.

    Columns: Model | Probes | Refused | Collapsed | Negotiated | Complied | Refusal Rate

    Filters:
      models         list[str]
      domains        list[str]
      date_range     {start: ISO, end: ISO}
      classifications list[str]
    """
    where, params = _build_run_where(filters)

    sql = f"""
        SELECT
            r.target_model,
            COUNT(DISTINCT r.probe_id) AS probes,
            SUM(CASE WHEN r.initial_classification = 'refused'    THEN 1 ELSE 0 END) AS refused,
            SUM(CASE WHEN r.initial_classification = 'collapsed'  THEN 1 ELSE 0 END) AS collapsed,
            SUM(CASE WHEN r.initial_classification = 'negotiated' THEN 1 ELSE 0 END) AS negotiated,
            SUM(CASE WHEN r.initial_classification = 'complied'   THEN 1 ELSE 0 END) AS complied,
            COUNT(r.id) AS total_runs
        FROM runs r
        LEFT JOIN probes p ON p.id = r.probe_id
        {where}
        GROUP BY r.target_model
        ORDER BY r.target_model
    """

    rows_raw = conn.execute(sql, params).fetchall()
    if not rows_raw:
        return _empty_message("No runs found matching filters.", format)

    headers = ["Model", "Probes", "Refused", "Collapsed", "Negotiated", "Complied", "Refusal Rate"]
    rows = []
    for r in rows_raw:
        d = dict(r)
        total = d["total_runs"]
        rows.append([
            d["target_model"],
            d["probes"],
            d["refused"],
            d["collapsed"],
            d["negotiated"],
            d["complied"],
            _pct(d["refused"], total),
        ])

    if format == "html":
        return (
            f"<h2>Model Comparison</h2>\n"
            + _format_table(headers, rows, "html")
        )
    return _format_table(headers, rows, format)


def generate_consistency_matrix(
    conn,
    filters: dict | None = None,
    format: str = "markdown",
    theme: str = "beargle-dark",
) -> str:
    """Probe × Model matrix of consistency rates from stat runs.

    Each cell = consistency_rate (refused / total iterations) for that probe×model pair.
    Empty cell means no stat run exists for that combination.

    Filters: models, domains, date_range (applied to stat_runs.created_at).
    """
    where, params = _build_stat_run_where(filters)

    sql = f"""
        SELECT
            sr.probe_id,
            p.name  AS probe_name,
            sr.target_model,
            COUNT(sri.id)                                                  AS total,
            SUM(CASE WHEN sri.classification = 'refused' THEN 1 ELSE 0 END) AS refused
        FROM stat_runs sr
        JOIN probes p ON p.id = sr.probe_id
        JOIN stat_run_iterations sri ON sri.stat_run_id = sr.id
        {where}
        GROUP BY sr.probe_id, sr.target_model
        ORDER BY p.name, sr.target_model
    """

    rows_raw = conn.execute(sql, params).fetchall()
    if not rows_raw:
        return _empty_message("No stat runs found matching filters.", format)

    # Collect unique probes and models (preserving order of first appearance)
    probe_names: list[str] = []
    probe_order: dict[int, str] = {}
    model_set: list[str] = []
    cell: dict[tuple, float] = {}

    for r in rows_raw:
        d = dict(r)
        pid = d["probe_id"]
        pname = d["probe_name"] or str(pid)
        model = d["target_model"]
        rate = _rate(d["refused"], d["total"])

        if pid not in probe_order:
            probe_order[pid] = pname
            probe_names.append(pname)
        if model not in model_set:
            model_set.append(model)

        cell[(pname, model)] = rate if rate is not None else 0.0

    headers = ["Probe"] + model_set
    rows = []
    for pname in probe_names:
        row = [pname]
        for model in model_set:
            rate = cell.get((pname, model))
            row.append(f"{rate:.2f}" if rate is not None else "—")
        rows.append(row)

    if format == "html":
        return (
            "<h2>Consistency Matrix (Refusal Rate per Probe × Model)</h2>\n"
            + _format_table(headers, rows, "html")
        )
    return _format_table(headers, rows, format)


def generate_pushback_summary(
    conn,
    filters: dict | None = None,
    format: str = "markdown",
    theme: str = "beargle-dark",
) -> str:
    """Pushback effectiveness summary from coach_examples.

    Shows per-move success rates. 'Success' = outcome is 'collapsed' or 'complied'.
    Optionally broken down by model (requires join through runs).

    Filters: models (list[str]) — filters by associated run's target_model.
    """
    filters = filters or {}
    model_filter = filters.get("models")

    if model_filter:
        ph = ",".join("?" * len(model_filter))
        sql = f"""
            SELECT
                ce.move,
                COUNT(*) AS total,
                SUM(CASE WHEN ce.outcome IN ('collapsed','complied') THEN 1 ELSE 0 END) AS successes,
                r.target_model
            FROM coach_examples ce
            LEFT JOIN runs r ON r.id = ce.run_id
            WHERE r.target_model IN ({ph})
            GROUP BY ce.move, r.target_model
            ORDER BY ce.move, r.target_model
        """
        params = list(model_filter)
        breakdown_by_model = True
    else:
        sql = """
            SELECT
                ce.move,
                COUNT(*) AS total,
                SUM(CASE WHEN ce.outcome IN ('collapsed','complied') THEN 1 ELSE 0 END) AS successes
            FROM coach_examples ce
            GROUP BY ce.move
            ORDER BY ce.move
        """
        params = []
        breakdown_by_model = False

    rows_raw = conn.execute(sql, params).fetchall()
    if not rows_raw:
        return _empty_message("No coach examples found matching filters.", format)

    if breakdown_by_model:
        headers = ["Move", "Model", "Uses", "Successes", "Success Rate"]
        rows = []
        for r in rows_raw:
            d = dict(r)
            rows.append([
                d["move"],
                d.get("target_model") or "—",
                d["total"],
                d["successes"],
                _pct(d["successes"], d["total"]),
            ])
    else:
        headers = ["Move", "Uses", "Successes", "Success Rate"]
        rows = []
        for r in rows_raw:
            d = dict(r)
            rows.append([
                d["move"],
                d["total"],
                d["successes"],
                _pct(d["successes"], d["total"]),
            ])

    if format == "html":
        return (
            "<h2>Pushback Effectiveness by Move</h2>\n"
            + _format_table(headers, rows, "html")
        )
    return _format_table(headers, rows, format)


def generate_full_report(
    conn,
    filters: dict | None = None,
    format: str = "markdown",
    theme: str = "beargle-dark",
) -> str | bytes:
    """Full research report combining all sections with summary statistics.

    Sections:
      1. Header / metadata
      2. Summary statistics
      3. Per-model comparison table
      4. Consistency matrix (stat runs)
      5. Pushback effectiveness
    """
    stats = _summary_stats(conn, filters)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Build section bodies (csv/markdown format; html/pdf branch regenerates as html below)
    _section_fmt = format if format not in ("html", "pdf") else "html"
    comparison = generate_comparison_table(conn, filters, _section_fmt, theme)
    matrix = generate_consistency_matrix(conn, filters, _section_fmt, theme)
    pushback = generate_pushback_summary(conn, filters, _section_fmt, theme)

    if format == "csv":
        # CSV: concatenate sections with blank rows between them
        parts = [
            "# Flinch Research Export",
            f"# Generated: {now}",
            f"# Total runs: {stats.get('total_runs', 0)}",
            f"# Probes tested: {stats.get('total_probes', 0)}",
            f"# Models: {stats.get('total_models', 0)}",
            f"# Date range: {stats.get('date_start', '—')} to {stats.get('date_end', '—')}",
            f"# Overall refusal rate: {_pct(stats.get('refused') or 0, stats.get('total_runs') or 0)}",
            "",
            "## Model Comparison",
            comparison,
            "",
            "## Consistency Matrix",
            matrix,
            "",
            "## Pushback Effectiveness",
            pushback,
        ]
        return "\n".join(parts)

    if format in ("html", "pdf"):
        theme_obj = get_theme(theme)
        theme_css = render_theme_css(theme_obj)
        theme_header = render_theme_header(theme_obj)
        refusal_rate = _pct(stats.get("refused") or 0, stats.get("total_runs") or 0)
        meta_block = (
            "<h1>Flinch Research Export</h1>\n"
            f'<p class="meta">Generated: {now} &nbsp;|&nbsp; '
            f'Total runs: {stats.get("total_runs", 0)} &nbsp;|&nbsp; '
            f'Probes: {stats.get("total_probes", 0)} &nbsp;|&nbsp; '
            f'Models: {stats.get("total_models", 0)} &nbsp;|&nbsp; '
            f'Date range: {stats.get("date_start", "—")} → {stats.get("date_end", "—")} &nbsp;|&nbsp; '
            f'Overall refusal rate: {refusal_rate}</p>\n'
        )
        html_doc = (
            f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<title>Flinch Export</title>{theme_css}</head><body>\n"
            + theme_header
            + "\n" + meta_block
            + "\n" + comparison
            + "\n" + matrix
            + "\n" + pushback
            + "\n</body></html>"
        )
        if format == "html":
            return html_doc
        # PDF: convert HTML to bytes via WeasyPrint — returns bytes, not str
        from flinch.themes import html_to_pdf  # noqa: PLC0415
        return html_to_pdf(html_doc)

    # Markdown
    refusal_rate = _pct(stats.get("refused") or 0, stats.get("total_runs") or 0)
    header = (
        "# Flinch Research Export\n\n"
        f"**Generated:** {now}  \n"
        f"**Total runs:** {stats.get('total_runs', 0)}  \n"
        f"**Probes tested:** {stats.get('total_probes', 0)}  \n"
        f"**Models:** {stats.get('total_models', 0)}  \n"
        f"**Date range:** {stats.get('date_start', '—')} to {stats.get('date_end', '—')}  \n"
        f"**Overall refusal rate:** {refusal_rate}  \n"
    )

    parts = [
        header,
        "---\n\n## Model Comparison\n",
        comparison,
        "\n---\n\n## Consistency Matrix (Refusal Rate per Probe × Model)\n",
        matrix,
        "\n---\n\n## Pushback Effectiveness\n",
        pushback,
    ]
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Internal utilities
# ---------------------------------------------------------------------------

def _empty_message(msg: str, format: str) -> str:
    if format == "html":
        return f"<p><em>{msg}</em></p>"
    if format == "csv":
        return f"# {msg}\n"
    return f"*{msg}*"
