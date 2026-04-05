"""Automated NLP metrics pipeline for experiment responses.

Delegates core computation to LexicalAnalyzer (lexical.py).
ResponseMetricsAnalyzer is a thin wrapper that adds experiment-specific
orchestration: SSE streaming, DB persistence, force-recompute support.

Requires: pip install -e ".[experiment]" (textstat, textblob, lexical-diversity)
"""
from __future__ import annotations

import logging
from typing import AsyncGenerator

from flinch.lexical import LexicalAnalyzer

logger = logging.getLogger(__name__)


class ResponseMetricsAnalyzer:
    """Compute NLP metrics on response text."""

    def __init__(self):
        self._lexical = LexicalAnalyzer()

    def analyze(self, response_text: str) -> dict:
        """Compute all metrics for a single response. Returns dict matching response_metrics columns."""
        if not response_text or not response_text.strip():
            return self._empty_metrics()

        # Delegate all computation to the lexical engine
        metrics = self._lexical.analyze(response_text)

        # Backward-compatible alias: some DB columns may still use avg_sentence_length
        if "avg_sentence_length" not in metrics and metrics.get("words_per_sentence") is not None:
            metrics["avg_sentence_length"] = metrics["words_per_sentence"]

        # Backward-compatible alias: lexical_diversity -> ttr
        if "lexical_diversity" not in metrics and metrics.get("ttr") is not None:
            metrics["lexical_diversity"] = metrics["ttr"]

        return metrics

    def _empty_metrics(self) -> dict:
        """Return all-None/zero metrics for empty input. Matches all LexicalAnalyzer keys."""
        return {
            # Structure
            "word_count": None,
            "sentence_count": None,
            "words_per_sentence": None,
            "avg_sentence_length": None,  # backward-compat alias
            # Readability
            "flesch_kincaid_grade": None,
            "flesch_reading_ease": None,
            "gunning_fog": None,
            # Lexical diversity
            "mtld": None,
            "ttr": None,
            "lexical_diversity": None,  # backward-compat alias
            "honore_statistic": None,
            # Word frequency
            "avg_word_freq_rank": None,
            "median_word_freq_rank": None,
            "oov_rate": None,
            # POS rates
            "modal_rate": None,
            "adjective_rate": None,
            "adverb_rate": None,
            "subordination_rate": None,
            # Sentiment
            "subjectivity": None,
            "polarity": None,
            # Marker counts
            "hedging_count": None,
            "hedging_ratio": None,
            "confidence_marker_count": None,
            "confidence_ratio": None,
            "evasion_count": None,
            "evasion_ratio": None,
            # Formatting
            "bold_count": None,
            "has_list": None,
        }

    async def analyze_experiment(
        self,
        async_db,
        experiment_id: int,
        force: bool = False,
    ) -> AsyncGenerator[dict, None]:
        """Compute metrics for all completed responses in an experiment.

        When force=False (default): skips responses that already have metrics (idempotent).
        When force=True: recomputes metrics even if they already exist.

        Yields SSE progress events.
        """
        from flinch.db import save_response_metrics

        if force:
            # Recompute all completed responses regardless of existing metrics
            async with async_db.execute("""
                SELECT er.id, er.response_text
                FROM experiment_responses er
                WHERE er.experiment_id = ? AND er.status = 'completed'
            """, (experiment_id,)) as cursor:
                rows = await cursor.fetchall()
        else:
            # Skip responses that already have metrics
            async with async_db.execute("""
                SELECT er.id, er.response_text
                FROM experiment_responses er
                LEFT JOIN response_metrics rm ON rm.response_id = er.id
                WHERE er.experiment_id = ? AND er.status = 'completed' AND rm.id IS NULL
            """, (experiment_id,)) as cursor:
                rows = await cursor.fetchall()

        total = len(rows)
        if total == 0:
            yield {"type": "complete", "message": "All responses already have metrics", "total": 0}
            return

        yield {"type": "started", "total": total}

        for i, row in enumerate(rows):
            response_id = row[0]
            response_text = row[1]

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
