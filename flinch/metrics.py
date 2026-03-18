"""Automated NLP metrics pipeline for experiment responses.

Computes readability, hedging frequency, confidence markers, and lexical diversity.
No sentiment analysis — intentionally excluded per proposal scope.

Requires: pip install -e ".[experiment]" (textstat)
"""
from __future__ import annotations

import logging
import re
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

# Graceful import for optional dependency
try:
    import textstat
except ImportError:
    textstat = None

# --- Marker Lists ---

HEDGING_MARKERS = [
    "might", "perhaps", "possibly", "could be", "it seems",
    "arguably", "in some cases", "it depends", "not necessarily",
    "to some extent", "in a way", "sort of", "kind of",
    "generally speaking", "tends to", "may or may not",
    "it's worth noting", "on the other hand", "however",
    "it is possible", "there is a chance", "it could be argued",
    "some might say", "it appears", "seemingly",
]

CONFIDENCE_MARKERS = [
    "certainly", "definitely", "absolutely", "clearly",
    "obviously", "undoubtedly", "without question",
    "there's no doubt", "it's clear that", "the fact is",
    "in fact", "indeed", "surely", "of course",
    "without a doubt", "unquestionably", "there is no question",
    "it is certain", "plainly", "evidently",
]


def _count_sentences(text: str) -> int:
    """Count sentences using simple regex."""
    sentences = re.split(r'[.!?]+', text.strip())
    return len([s for s in sentences if s.strip()])


def _count_markers(text: str, markers: list[str]) -> int:
    """Count occurrences of marker phrases in text (case-insensitive)."""
    text_lower = text.lower()
    count = 0
    for marker in markers:
        # Use word boundaries for single words, substring match for phrases
        if " " in marker:
            count += text_lower.count(marker)
        else:
            count += len(re.findall(rf'\b{re.escape(marker)}\b', text_lower))
    return count


def _lexical_diversity(text: str) -> float:
    """Type-token ratio (unique words / total words)."""
    words = re.findall(r'\b\w+\b', text.lower())
    if not words:
        return 0.0
    return len(set(words)) / len(words)


class ResponseMetricsAnalyzer:
    """Compute NLP metrics on response text."""

    def __init__(self):
        if textstat is None:
            logger.warning(
                "textstat not installed. Install with: pip install -e '.[experiment]' "
                "Readability metrics will be unavailable."
            )

    def analyze(self, response_text: str) -> dict:
        """Compute all metrics for a single response. Returns dict matching response_metrics columns."""
        if not response_text or not response_text.strip():
            return self._empty_metrics()

        words = re.findall(r'\b\w+\b', response_text)
        word_count = len(words)
        sentence_count = _count_sentences(response_text)
        hedging_count = _count_markers(response_text, HEDGING_MARKERS)
        confidence_count = _count_markers(response_text, CONFIDENCE_MARKERS)

        return {
            "word_count": word_count,
            "sentence_count": sentence_count,
            "flesch_kincaid_grade": textstat.flesch_kincaid_grade(response_text) if textstat else None,
            "flesch_reading_ease": textstat.flesch_reading_ease(response_text) if textstat else None,
            "hedging_count": hedging_count,
            "hedging_ratio": round(hedging_count / max(sentence_count, 1), 4),
            "confidence_marker_count": confidence_count,
            "confidence_ratio": round(confidence_count / max(sentence_count, 1), 4),
            "avg_sentence_length": round(word_count / max(sentence_count, 1), 2),
            "lexical_diversity": round(_lexical_diversity(response_text), 4),
        }

    def _empty_metrics(self) -> dict:
        return {
            "word_count": 0, "sentence_count": 0,
            "flesch_kincaid_grade": None, "flesch_reading_ease": None,
            "hedging_count": 0, "hedging_ratio": 0.0,
            "confidence_marker_count": 0, "confidence_ratio": 0.0,
            "avg_sentence_length": 0.0, "lexical_diversity": 0.0,
        }

    async def analyze_experiment(self, async_db, experiment_id: int) -> AsyncGenerator[dict, None]:
        """Compute metrics for all completed responses in an experiment.
        Skips responses that already have metrics (idempotent).
        Yields SSE progress events.
        """
        from flinch.db import save_response_metrics

        # Get completed responses without metrics
        cursor = await async_db.execute("""
            SELECT er.id, er.response_text
            FROM experiment_responses er
            LEFT JOIN response_metrics rm ON rm.response_id = er.id
            WHERE er.experiment_id = ? AND er.status = 'completed' AND rm.id IS NULL
        """, (experiment_id,))
        rows = await cursor.fetchall()

        total = len(rows)
        if total == 0:
            yield {"type": "complete", "message": "All responses already have metrics", "total": 0}
            return

        yield {"type": "started", "total": total}

        for i, row in enumerate(rows):
            response_id = row[0]  # or row["id"]
            response_text = row[1]  # or row["response_text"]

            metrics = self.analyze(response_text or "")
            await save_response_metrics(async_db, response_id, metrics)

            if (i + 1) % 100 == 0 or i == total - 1:
                yield {
                    "type": "progress",
                    "completed": i + 1,
                    "total": total,
                    "pct": round((i + 1) / total * 100, 1),
                }

        yield {"type": "complete", "completed": total, "total": total}
