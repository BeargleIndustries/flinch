"""Theme engine for Flinch export system."""
from __future__ import annotations

import functools
import logging
import re
import time
from html import escape as html_escape
from pathlib import Path

from flinch.models import ExportTheme, ThemeSummary

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CSS value sanitization
# ---------------------------------------------------------------------------

_CSS_DANGEROUS = re.compile(
    r"[{}]|;\s*\w|url\s*\(|expression\s*\(|@import|javascript:",
    re.IGNORECASE,
)


def _sanitize_css_value(value: str) -> str:
    """Strip CSS-dangerous tokens from a theme value."""
    if _CSS_DANGEROUS.search(value):
        # Strip everything after the first dangerous token
        return _CSS_DANGEROUS.split(value)[0].strip()
    return value

# ---------------------------------------------------------------------------
# Hardcoded fallback presets — themes work even without .md files
# ---------------------------------------------------------------------------

BUILTIN_THEMES: dict[str, ExportTheme] = {
    "beargle-dark": ExportTheme(
        name="beargle-dark",
        display_name="Beargle Dark",
        description="Dark theme with Beargle Industries branding",
        bg_color="#0a0a0a",
        bg_secondary="#161616",
        text_color="#e0e0e0",
        text_secondary="#aaaaaa",
        accent_color="#4a9eff",
        border_color="#2a2a2a",
        heading_color="#cccccc",
        color_high="#6ef",
        color_mid="#fa6",
        color_low="#f86",
        font_body="system-ui, -apple-system, sans-serif",
        font_mono="'JetBrains Mono', 'Fira Code', monospace",
        font_heading="Poppins, system-ui, sans-serif",
        font_size_base="14px",
        show_logo=False,
        header_text="Beargle Industries",
        header_subtitle="Flinch Research Report",
        max_width="1200px",
        padding="2rem",
        is_builtin=True,
    ),
    "clean-light": ExportTheme(
        name="clean-light",
        display_name="Clean Light",
        description="Light theme for print-friendly reports",
        bg_color="#ffffff",
        bg_secondary="#f8f9fa",
        text_color="#1a1a1a",
        text_secondary="#666666",
        accent_color="#2563eb",
        border_color="#e2e8f0",
        heading_color="#111827",
        color_high="#059669",
        color_mid="#d97706",
        color_low="#dc2626",
        font_body="Georgia, 'Times New Roman', serif",
        font_mono="'Courier New', monospace",
        font_heading="system-ui, sans-serif",
        font_size_base="15px",
        show_logo=False,
        max_width="900px",
        padding="2rem",
        is_builtin=True,
    ),
    "neutral-dark": ExportTheme(
        name="neutral-dark",
        display_name="Neutral Dark",
        description="Subdued dark theme without branding",
        bg_color="#1a1a2e",
        bg_secondary="#16213e",
        text_color="#d4d4d8",
        text_secondary="#71717a",
        accent_color="#a78bfa",
        border_color="#27272a",
        heading_color="#e4e4e7",
        color_high="#34d399",
        color_mid="#fbbf24",
        color_low="#f87171",
        font_body="system-ui, sans-serif",
        font_mono="monospace",
        font_heading="system-ui, sans-serif",
        font_size_base="14px",
        show_logo=False,
        max_width="1100px",
        padding="2rem",
        is_builtin=True,
    ),
}

# ---------------------------------------------------------------------------
# Markdown parser
# ---------------------------------------------------------------------------

def parse_themes_markdown(text: str, source_file: str = "") -> dict[str, ExportTheme]:
    """Parse markdown with ## theme-name sections and - key: value lines.

    Returns dict keyed by theme name.
    """
    themes: dict[str, ExportTheme] = {}
    current_name: str | None = None
    current_props: dict[str, str | bool] = {}

    for line in text.splitlines():
        # Section header: ## theme-name
        heading = re.match(r"^##\s+(\S+)", line)
        if heading:
            if current_name and current_props:
                _finalize_theme(current_name, current_props, source_file, themes)
            current_name = heading.group(1).strip()
            current_props = {}
            continue

        # Property line: - key: value
        if current_name:
            prop = re.match(r"^\s*-\s+(\w+)\s*:\s*(.*)", line)
            if prop:
                key = prop.group(1).strip()
                raw = prop.group(2).strip()
                if raw.lower() == "true":
                    current_props[key] = True
                elif raw.lower() == "false":
                    current_props[key] = False
                else:
                    current_props[key] = raw

    # Flush last section
    if current_name and current_props:
        _finalize_theme(current_name, current_props, source_file, themes)

    return themes


def _finalize_theme(
    name: str,
    props: dict,
    source_file: str,
    out: dict[str, ExportTheme],
) -> None:
    props.setdefault("name", name)
    props.setdefault("display_name", name)
    props["source_file"] = source_file
    props["is_builtin"] = False
    # Sanitize all string CSS values
    for key, val in props.items():
        if isinstance(val, str) and key not in ("name", "display_name", "description", "source_file"):
            props[key] = _sanitize_css_value(val)
    try:
        out[name] = ExportTheme(**props)
    except Exception as exc:
        logger.warning("Skipping malformed theme %s: %s", name, exc)


# ---------------------------------------------------------------------------
# Theme loader
# ---------------------------------------------------------------------------

_theme_cache: dict[str, ExportTheme] | None = None
_theme_cache_time: float = 0.0
_THEME_CACHE_TTL: float = 30.0  # seconds


def load_themes(themes_dir: str | Path | None = None) -> dict[str, ExportTheme]:
    """Load all themes: builtins first, then user .md files (overrides allowed).

    Results are cached for 30 seconds to avoid re-reading .md files on every call.

    Args:
        themes_dir: Directory to scan for *.md theme files. Defaults to
                    flinch/themes/ (the package directory itself).

    Returns:
        Merged dict of ExportTheme objects keyed by name.
    """
    global _theme_cache, _theme_cache_time

    if themes_dir is None and _theme_cache is not None:
        if time.monotonic() - _theme_cache_time < _THEME_CACHE_TTL:
            return _theme_cache

    merged: dict[str, ExportTheme] = dict(BUILTIN_THEMES)

    if themes_dir is None:
        themes_dir = Path(__file__).parent

    themes_path = Path(themes_dir)
    if not themes_path.exists() or not themes_path.is_dir():
        return merged

    for md_file in sorted(themes_path.glob("*.md")):
        try:
            text = md_file.read_text(encoding="utf-8")
            parsed = parse_themes_markdown(text, source_file=str(md_file))
            merged.update(parsed)
        except Exception as exc:
            logger.warning("Failed to load theme file %s: %s", md_file, exc)

    if themes_dir == Path(__file__).parent:
        _theme_cache = merged
        _theme_cache_time = time.monotonic()

    return merged


def reload_themes() -> dict[str, ExportTheme]:
    """Force-reload themes, clearing the cache."""
    global _theme_cache
    _theme_cache = None
    return load_themes()


# ---------------------------------------------------------------------------
# Theme accessors
# ---------------------------------------------------------------------------

def get_theme(name: str) -> ExportTheme:
    """Return named theme, falling back to beargle-dark if not found."""
    themes = load_themes()
    return themes.get(name) or themes["beargle-dark"]


def list_themes() -> list[ThemeSummary]:
    """Return summaries of all available themes."""
    return [
        ThemeSummary(
            name=t.name,
            display_name=t.display_name,
            description=t.description,
            is_builtin=t.is_builtin,
        )
        for t in load_themes().values()
    ]


# ---------------------------------------------------------------------------
# CSS renderer
# ---------------------------------------------------------------------------

def render_theme_css(theme: ExportTheme) -> str:
    """Generate a full <style>...</style> block for the given theme.

    When called with beargle-dark defaults, output is functionally equivalent
    to the _HTML_STYLE constant in publication.py.
    """
    t = theme
    return f"""<style>
  /* ── Reset & base ─────────────────────────────────────────────────── */
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}

  body {{
    background: {t.bg_color};
    color: {t.text_color};
    font-family: {t.font_body};
    font-size: {t.font_size_base};
    padding: {t.padding};
    max-width: {t.max_width};
    margin: 0 auto;
  }}

  /* ── Headings ──────────────────────────────────────────────────────── */
  h1, h2, h3 {{ color: {t.heading_color}; font-family: {t.font_heading}; }}
  h1 {{ font-size: 1.8em; margin-bottom: 1rem; }}
  h2 {{ font-size: 1.4em; margin: 1.5rem 0 0.75rem; }}
  h3 {{ font-size: 1.1em; margin: 1rem 0 0.5rem; }}

  /* ── Links ─────────────────────────────────────────────────────────── */
  a {{ color: {t.accent_color}; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}

  /* ── Tables ────────────────────────────────────────────────────────── */
  table {{
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 2rem;
  }}
  th {{
    background: {t.bg_secondary};
    color: {t.text_secondary};
    text-align: left;
    padding: 6px 12px;
    border: 1px solid {t.border_color};
    font-family: {t.font_heading};
  }}
  td {{
    padding: 5px 12px;
    border: 1px solid {t.border_color};
    vertical-align: top;
  }}
  tr:nth-child(even) td {{ background: {t.bg_secondary}; }}

  /* ── Classification color classes ──────────────────────────────────── */
  .hi {{ color: {t.color_high}; }}
  .md {{ color: {t.color_mid}; }}
  .lo {{ color: {t.color_low}; }}

  /* ── Metadata / footnotes ───────────────────────────────────────────── */
  p.meta {{ color: {t.text_secondary}; font-size: 0.85em; }}

  /* ── Code / pre ─────────────────────────────────────────────────────── */
  code, pre {{
    font-family: {t.font_mono};
    font-size: 0.9em;
    background: {t.bg_secondary};
    border: 1px solid {t.border_color};
    border-radius: 3px;
  }}
  code {{ padding: 0.1em 0.3em; }}
  pre {{
    padding: 1em;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }}
  pre code {{ background: none; border: none; padding: 0; }}

  /* ── Print / PDF ────────────────────────────────────────────────────── */
  @page {{
    size: A4 landscape;
    margin: 1.5cm;
  }}

  @media print {{
    body {{
      background: #fff;
      color: #000;
      padding: 0;
      max-width: 100%;
      font-size: 11px;
    }}
    h1, h2, h3 {{ color: #000; page-break-after: avoid; }}
    table {{ page-break-inside: avoid; }}
    th {{ background: #eee; color: #333; border-color: #ccc; }}
    td {{ border-color: #ccc; }}
    tr:nth-child(even) td {{ background: #f9f9f9; }}
    a {{ color: #000; text-decoration: underline; }}
    .hi {{ color: #006600; }}
    .md {{ color: #996600; }}
    .lo {{ color: #cc0000; }}
    p.meta {{ color: #555; }}
    code, pre {{ background: #f5f5f5; border-color: #ccc; }}
  }}
</style>"""


# ---------------------------------------------------------------------------
# Header renderer
# ---------------------------------------------------------------------------

def render_theme_header(theme: ExportTheme) -> str:
    """Return an HTML header div, or empty string if nothing to show."""
    t = theme
    if not t.show_logo and not t.header_text:
        return ""

    parts: list[str] = []
    parts.append(
        f'<div style="padding:1rem 0 1.5rem; border-bottom:1px solid {t.border_color}; margin-bottom:2rem;">'
    )

    if t.show_logo and t.logo_url:
        # Validate logo URL scheme
        safe_url = html_escape(t.logo_url, quote=True)
        if not t.logo_url.startswith(("http://", "https://", "/")):
            safe_url = ""
        if safe_url:
            parts.append(
                f'  <img src="{safe_url}" alt="{html_escape(t.header_text, quote=True)}" '
                f'style="height:40px; margin-bottom:0.5rem; display:block;" />'
            )

    if t.header_text:
        parts.append(
            f'  <h1 style="color:{t.heading_color}; font-family:{t.font_heading}; '
            f'font-size:1.6em; margin:0;">{html_escape(t.header_text)}</h1>'
        )

    if t.header_subtitle:
        parts.append(
            f'  <p style="color:{t.text_secondary}; font-size:0.9em; margin:0.25rem 0 0;">'
            f'{html_escape(t.header_subtitle)}</p>'
        )

    parts.append("</div>")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# PDF conversion
# ---------------------------------------------------------------------------

def html_to_pdf(html_content: str) -> bytes:
    """Convert an HTML string to PDF bytes using WeasyPrint.

    Raises:
        ImportError: if weasyprint is not installed.
    """
    try:
        from weasyprint import HTML  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "weasyprint is required for PDF export. "
            "Install it with: pip install weasyprint"
        ) from exc

    return HTML(string=html_content).write_pdf()
