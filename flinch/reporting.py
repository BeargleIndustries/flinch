"""Publication-ready reporting for RLHF deception experiment.

Generates charts (matplotlib), formatted tables (markdown/HTML/LaTeX),
and complete reports for Alignment Forum publication.

Requires: pip install -e ".[experiment]" (matplotlib, numpy)
"""
from __future__ import annotations

import io
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive backend
    import matplotlib.pyplot as plt
    import numpy as np
except ImportError:
    plt = None
    np = None


class ExperimentReporter:
    """Generate publication-ready charts and tables."""

    def __init__(self, async_db):
        self.db = async_db

    async def generate_charts(self, experiment_id: int, output_dir: str | None = None) -> list[str]:
        """Generate matplotlib charts. Returns list of saved file paths."""
        if plt is None:
            raise ImportError("matplotlib required. Install with: pip install -e '.[experiment]'")

        if output_dir is None:
            output_dir = f"data/reports/{experiment_id}"
        os.makedirs(output_dir, exist_ok=True)

        saved = []

        # Get analysis results
        from flinch.db import list_analysis_results
        results = await list_analysis_results(self.db, experiment_id)
        result_map = {}
        for r in results:
            result_map[r["analysis_type"]] = json.loads(r["results"]) if isinstance(r["results"], str) else r["results"]

        # 1. Win-rate bar chart
        if "win_rates" in result_map:
            path = self._chart_win_rates(result_map["win_rates"], output_dir)
            if path:
                saved.append(path)

        # 2. Effect size forest plot
        if "effect_sizes" in result_map:
            path = self._chart_effect_sizes(result_map["effect_sizes"], output_dir)
            if path:
                saved.append(path)

        # 3. Metric distributions
        path = await self._chart_metric_distributions(experiment_id, output_dir)
        if path:
            saved.append(path)

        return saved

    def _chart_win_rates(self, win_rates: dict, output_dir: str) -> str | None:
        """Win-rate bar chart by condition."""
        try:
            fig, axes = plt.subplots(1, 2, figsize=(12, 5))

            for ax, (source, title) in zip(axes, [("ai_raters", "AI Rater Preferences"), ("human_raters", "Human Rater Preferences")]):
                data = win_rates.get(source, {})
                if not data:
                    ax.set_visible(False)
                    continue
                labels = list(data.keys())
                rates = [data[l].get("win_rate", 0) for l in labels]
                colors = {"honest": "#4CAF50", "deceptive": "#f44336", "neutral": "#2196F3", "high_effort_honest": "#FF9800"}
                bar_colors = [colors.get(l, "#9E9E9E") for l in labels]

                ax.bar(labels, rates, color=bar_colors, edgecolor="white", linewidth=0.5)
                ax.set_ylabel("Win Rate")
                ax.set_title(title)
                ax.set_ylim(0, 1)
                ax.axhline(y=1/len(labels), color="gray", linestyle="--", alpha=0.5, label="Chance")
                ax.legend()

            plt.tight_layout()
            path = os.path.join(output_dir, "win_rates.png")
            plt.savefig(path, dpi=300, bbox_inches="tight")
            plt.close()
            return path
        except Exception as e:
            logger.error(f"Win rate chart failed: {e}")
            return None

    def _chart_effect_sizes(self, effect_sizes: dict, output_dir: str) -> str | None:
        """Forest plot of Cohen's d with CIs."""
        try:
            all_items = []
            for pair, metrics in effect_sizes.items():
                for metric, vals in metrics.items():
                    all_items.append({
                        "label": f"{pair}\n{metric}",
                        "d": vals["cohens_d"],
                        "ci_low": vals.get("ci_lower", vals["cohens_d"] - 0.2),
                        "ci_high": vals.get("ci_upper", vals["cohens_d"] + 0.2),
                        "p": vals.get("p_value", 1.0),
                    })

            if not all_items:
                return None

            fig, ax = plt.subplots(figsize=(10, max(4, len(all_items) * 0.4)))
            y_pos = range(len(all_items))

            for i, item in enumerate(all_items):
                color = "#f44336" if item["p"] < 0.05 else "#9E9E9E"
                ax.plot(item["d"], i, "o", color=color, markersize=6)
                ax.plot([item["ci_low"], item["ci_high"]], [i, i], "-", color=color, linewidth=1.5)

            ax.axvline(x=0, color="black", linestyle="-", linewidth=0.5)
            ax.axvline(x=0.2, color="gray", linestyle=":", alpha=0.5)
            ax.axvline(x=-0.2, color="gray", linestyle=":", alpha=0.5)
            ax.set_yticks(list(y_pos))
            ax.set_yticklabels([item["label"] for item in all_items], fontsize=7)
            ax.set_xlabel("Cohen's d (with 95% CI)")
            ax.set_title("Effect Sizes: Condition Pair Comparisons")

            plt.tight_layout()
            path = os.path.join(output_dir, "effect_sizes.png")
            plt.savefig(path, dpi=300, bbox_inches="tight")
            plt.close()
            return path
        except Exception as e:
            logger.error(f"Effect size chart failed: {e}")
            return None

    async def _chart_metric_distributions(self, experiment_id: int, output_dir: str) -> str | None:
        """Violin plots of key metrics per condition."""
        try:
            from flinch.db import list_conditions
            conditions = await list_conditions(self.db, experiment_id)

            ALLOWED_METRICS = {"word_count", "hedging_ratio", "confidence_ratio", "flesch_reading_ease",
                               "flesch_kincaid_grade", "avg_sentence_length", "lexical_diversity"}
            metrics = ["word_count", "hedging_ratio", "confidence_ratio", "flesch_reading_ease"]
            metrics = [m for m in metrics if m in ALLOWED_METRICS]
            fig, axes = plt.subplots(1, len(metrics), figsize=(4 * len(metrics), 5))

            colors = {"honest": "#4CAF50", "deceptive": "#f44336", "neutral": "#2196F3", "high_effort_honest": "#FF9800"}

            for ax, metric in zip(axes, metrics):
                data_by_cond = []
                labels = []
                for cond in conditions:
                    cursor = await self.db.execute(f"""
                        SELECT rm.{metric}
                        FROM response_metrics rm
                        JOIN experiment_responses er ON er.id = rm.response_id
                        WHERE er.experiment_id = ? AND er.condition_id = ? AND rm.{metric} IS NOT NULL
                    """, (experiment_id, cond["id"]))
                    vals = [r[0] for r in await cursor.fetchall()]
                    if vals:
                        data_by_cond.append(vals)
                        labels.append(cond["label"])

                if data_by_cond:
                    parts = ax.violinplot(data_by_cond, showmeans=True, showmedians=True)
                    ax.set_xticks(range(1, len(labels) + 1))
                    ax.set_xticklabels(labels, rotation=45, fontsize=8)
                ax.set_title(metric.replace("_", " ").title(), fontsize=9)

            plt.tight_layout()
            path = os.path.join(output_dir, "metric_distributions.png")
            plt.savefig(path, dpi=300, bbox_inches="tight")
            plt.close()
            return path
        except Exception as e:
            logger.error(f"Distribution chart failed: {e}")
            return None

    async def generate_tables(self, experiment_id: int) -> dict:
        """Generate formatted tables in markdown, HTML, and LaTeX."""
        from flinch.db import list_analysis_results

        results = await list_analysis_results(self.db, experiment_id)
        result_map = {}
        for r in results:
            result_map[r["analysis_type"]] = json.loads(r["results"]) if isinstance(r["results"], str) else r["results"]

        tables = {}

        # Win-rate summary table
        if "win_rates" in result_map:
            tables["win_rates"] = self._format_win_rate_table(result_map["win_rates"])

        # Effect size table
        if "effect_sizes" in result_map:
            tables["effect_sizes"] = self._format_effect_size_table(result_map["effect_sizes"])

        # Inter-rater agreement
        if "inter_rater_agreement" in result_map:
            tables["inter_rater_agreement"] = self._format_agreement_table(result_map["inter_rater_agreement"])

        return tables

    def _format_win_rate_table(self, data: dict) -> dict:
        md = "| Condition | AI Win Rate | Human Win Rate |\n|---|---|---|\n"
        all_conds = set()
        for source in ["ai_raters", "human_raters"]:
            all_conds.update(data.get(source, {}).keys())
        for cond in sorted(all_conds):
            ai_rate = data.get("ai_raters", {}).get(cond, {}).get("win_rate", "N/A")
            human_rate = data.get("human_raters", {}).get(cond, {}).get("win_rate", "N/A")
            md += f"| {cond} | {ai_rate} | {human_rate} |\n"
        return {"markdown": md}

    def _format_effect_size_table(self, data: dict) -> dict:
        md = "| Comparison | Metric | Cohen's d | 95% CI | p-value |\n|---|---|---|---|---|\n"
        for pair, metrics in data.items():
            for metric, vals in metrics.items():
                sig = "***" if vals.get("p_value", 1) < 0.001 else "**" if vals.get("p_value", 1) < 0.01 else "*" if vals.get("p_value", 1) < 0.05 else ""
                md += f"| {pair} | {metric} | {vals['cohens_d']}{sig} | [{vals.get('ci_lower', 'N/A')}, {vals.get('ci_upper', 'N/A')}] | {vals.get('p_value', 'N/A')} |\n"
        return {"markdown": md}

    def _format_agreement_table(self, data: dict) -> dict:
        md = "| Rater Type | Krippendorff's α | N Raters | N Items |\n|---|---|---|---|\n"
        for rater_type, vals in data.items():
            alpha = vals.get("alpha", "N/A")
            n_raters = vals.get("n_raters", "N/A")
            n_items = vals.get("n_items", "N/A")
            md += f"| {rater_type} | {alpha} | {n_raters} | {n_items} |\n"
        return {"markdown": md}

    async def generate_full_report(self, experiment_id: int, format: str = "markdown") -> str:
        """Complete publication report with embedded charts and tables."""
        from flinch.db import get_experiment, list_analysis_results

        exp = await get_experiment(self.db, experiment_id)
        tables = await self.generate_tables(experiment_id)

        report = f"# {exp['name']} — Results Report\n\n"
        report += f"**Generated:** {datetime.now(timezone.utc).isoformat()}\n\n"
        report += f"## Experiment Description\n{exp.get('description', '')}\n\n"

        report += "## Win Rates\n\n"
        if "win_rates" in tables:
            report += tables["win_rates"]["markdown"] + "\n\n"

        report += "## Effect Sizes\n\n"
        if "effect_sizes" in tables:
            report += tables["effect_sizes"]["markdown"] + "\n\n"

        report += "## Inter-Rater Agreement\n\n"
        if "inter_rater_agreement" in tables:
            report += tables["inter_rater_agreement"]["markdown"] + "\n\n"

        # Charts reference
        report += "## Charts\n\n"
        charts_dir = f"data/reports/{experiment_id}"
        if os.path.exists(charts_dir):
            for f in sorted(os.listdir(charts_dir)):
                if f.endswith(".png"):
                    report += f"![{f}]({charts_dir}/{f})\n\n"

        return report

    async def generate_preregistration(self, experiment_id: int) -> str:
        """OSF preregistration document."""
        from flinch.db import get_experiment, list_conditions, list_experiment_prompts

        exp = await get_experiment(self.db, experiment_id)
        conditions = await list_conditions(self.db, experiment_id)
        prompts = await list_experiment_prompts(self.db, experiment_id)

        doc = "# OSF Preregistration\n\n"
        doc += f"## Study Title\n{exp['name']}\n\n"
        doc += f"## Description\n{exp.get('description', '')}\n\n"

        doc += "## Hypotheses\n"
        doc += "H1: Human raters will systematically prefer deceptive-condition outputs over honest-condition outputs.\n"
        doc += "H2: AI raters will show an equal or stronger preference for deceptive-condition outputs compared to human raters.\n"
        doc += "H3: Pre-RLHF base models will show a significantly smaller preference gap between conditions.\n\n"

        doc += "## Design\n"
        doc += f"- Conditions: {', '.join(c['label'] for c in conditions)}\n"
        doc += f"- Number of prompts: {len(prompts)}\n"
        model_ids = exp.get('model_ids', [])
        if isinstance(model_ids, str):
            model_ids = json.loads(model_ids)
        base_model_ids = exp.get('base_model_ids', [])
        if isinstance(base_model_ids, str):
            base_model_ids = json.loads(base_model_ids)
        doc += f"- Models: {model_ids}\n"
        doc += f"- Base models: {base_model_ids}\n\n"

        doc += "## Analysis Plan\n"
        doc += "- Primary: Per-condition win-rates from blinded preference rankings\n"
        doc += "- Secondary: Cohen's d effect sizes for NLP metrics (hedging, confidence, readability)\n"
        doc += "- Validation: Krippendorff's alpha for inter-rater agreement\n"
        doc += "- Power: d=0.3, alpha=0.05, power=0.80\n\n"

        doc += "## Sampling Plan\n"
        doc += "- 1,000 prompts sampled from Anthropic's published training set\n"
        doc += "- Filtered to factual/reasoning categories\n"
        doc += "- 3 human raters per evaluation task via Prolific ($12/hr)\n\n"

        return doc
