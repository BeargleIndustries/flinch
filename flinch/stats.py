"""Statistical analysis module for RLHF deception experiment.

Computes win-rates, Cohen's d effect sizes, bootstrap confidence intervals,
and Krippendorff's alpha for inter-rater agreement.

Requires: pip install -e ".[experiment]" (scipy, numpy, krippendorff)
"""
from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Graceful imports for optional dependencies
try:
    import numpy as np
except ImportError:
    np = None

try:
    from scipy import stats as scipy_stats
except ImportError:
    scipy_stats = None

try:
    import krippendorff as krippendorff_lib
except ImportError:
    krippendorff_lib = None


def _check_deps():
    missing = []
    if np is None:
        missing.append("numpy")
    if scipy_stats is None:
        missing.append("scipy")
    if krippendorff_lib is None:
        missing.append("krippendorff")
    if missing:
        raise ImportError(f"Missing experiment dependencies: {', '.join(missing)}. Install with: pip install -e '.[experiment]'")


def cohens_d(group1: list[float], group2: list[float]) -> float:
    """Compute Cohen's d with pooled standard deviation."""
    n1, n2 = len(group1), len(group2)
    if n1 < 2 or n2 < 2:
        return 0.0
    mean1, mean2 = sum(group1) / n1, sum(group2) / n2
    var1 = sum((x - mean1) ** 2 for x in group1) / (n1 - 1)
    var2 = sum((x - mean2) ** 2 for x in group2) / (n2 - 1)
    pooled_sd = math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
    if pooled_sd == 0:
        return 0.0
    return (mean1 - mean2) / pooled_sd


def _bootstrap_cohens_d(g1: list[float], g2: list[float], n_iter: int = 10000, seed: int = 42) -> tuple[float, float]:
    """Bootstrap CI for Cohen's d by resampling within each group."""
    if np is None:
        return (0.0, 0.0)
    rng = np.random.RandomState(seed)
    a1 = np.array(g1)
    a2 = np.array(g2)
    boot_ds = []
    for _ in range(n_iter):
        s1 = rng.choice(a1, size=len(a1), replace=True)
        s2 = rng.choice(a2, size=len(a2), replace=True)
        boot_ds.append(cohens_d(s1.tolist(), s2.tolist()))
    return (float(np.percentile(boot_ds, 2.5)), float(np.percentile(boot_ds, 97.5)))


def bootstrap_ci(data: list[float], statistic=None, n_iterations: int = 10000, ci: float = 0.95, seed: int = 42) -> tuple[float, float]:
    """Bootstrap confidence interval. Returns (lower, upper)."""
    if np is None:
        return (0.0, 0.0)
    if statistic is None:
        statistic = np.mean
    rng = np.random.RandomState(seed)
    arr = np.array(data)
    boot_stats = []
    for _ in range(n_iterations):
        sample = rng.choice(arr, size=len(arr), replace=True)
        boot_stats.append(statistic(sample))
    alpha = (1 - ci) / 2
    return (float(np.percentile(boot_stats, alpha * 100)), float(np.percentile(boot_stats, (1 - alpha) * 100)))


class ExperimentAnalyzer:
    """Statistical analysis for the RLHF deception experiment."""

    def __init__(self, async_db):
        self.db = async_db

    async def compute_win_rates(self, experiment_id: int) -> dict:
        """Per-condition win rates from AI and human rankings."""
        from flinch.db import list_conditions

        conditions = await list_conditions(self.db, experiment_id)
        cond_labels = {c["id"]: c["label"] for c in conditions}

        results = {"ai_raters": {}, "human_raters": {}, "combined": {}}

        # AI rater win rates
        cursor = await self.db.execute("""
            SELECT ar.id, ar.blinding_order, ari.position_label, ari.rank
            FROM ai_ratings ar
            JOIN ai_rating_items ari ON ari.rating_id = ar.id
            WHERE ar.experiment_id = ? AND ar.status = 'completed'
        """, (experiment_id,))
        ai_rows = await cursor.fetchall()

        ai_wins = {label: {"wins": 0, "losses": 0, "total": 0} for label in cond_labels.values()}
        ratings_by_parent = {}
        for row in ai_rows:
            rating_id = row[0]
            blinding = json.loads(row[1])
            pos = row[2]
            rank = row[3]
            if rating_id not in ratings_by_parent:
                ratings_by_parent[rating_id] = {"blinding": blinding, "items": []}
            ratings_by_parent[rating_id]["items"].append({"position": pos, "rank": rank})

        for rating_id, data in ratings_by_parent.items():
            blinding = data["blinding"]
            items = sorted(data["items"], key=lambda x: x["rank"])
            if items:
                winner_pos = items[0]["position"]
                winner_cond = blinding.get(winner_pos)
                if winner_cond:
                    winner_label = cond_labels.get(int(winner_cond) if isinstance(winner_cond, str) and winner_cond.isdigit() else winner_cond, "unknown")
                    if winner_label in ai_wins:
                        ai_wins[winner_label]["wins"] += 1
                for item in items:
                    cond_id = blinding.get(item["position"])
                    label = cond_labels.get(int(cond_id) if isinstance(cond_id, str) and cond_id.isdigit() else cond_id, "unknown")
                    if label in ai_wins:
                        ai_wins[label]["total"] += 1

        for label, counts in ai_wins.items():
            counts["win_rate"] = round(counts["wins"] / max(counts["total"], 1), 4)
        results["ai_raters"] = ai_wins

        # Human rater win rates (similar logic from eval_ratings)
        cursor = await self.db.execute("""
            SELECT et.id, et.blinding_order, er2.position_label, er2.rank
            FROM eval_tasks et
            JOIN eval_ratings er2 ON er2.eval_task_id = et.id
            WHERE et.experiment_id = ? AND et.status = 'completed'
        """, (experiment_id,))
        human_rows = await cursor.fetchall()

        human_wins = {label: {"wins": 0, "losses": 0, "total": 0} for label in cond_labels.values()}
        human_by_task = {}
        for row in human_rows:
            task_id = row[0]
            blinding = json.loads(row[1])
            pos = row[2]
            rank = row[3]
            if task_id not in human_by_task:
                human_by_task[task_id] = {"blinding": blinding, "items": []}
            human_by_task[task_id]["items"].append({"position": pos, "rank": rank})

        for task_id, data in human_by_task.items():
            blinding = data["blinding"]
            items = sorted(data["items"], key=lambda x: (x["rank"] or 999))
            if items:
                winner_pos = items[0]["position"]
                winner_cond = blinding.get(winner_pos)
                if winner_cond:
                    winner_label = cond_labels.get(int(winner_cond) if isinstance(winner_cond, str) and winner_cond.isdigit() else winner_cond, "unknown")
                    if winner_label in human_wins:
                        human_wins[winner_label]["wins"] += 1
                for item in items:
                    cond_id = blinding.get(item["position"])
                    label = cond_labels.get(int(cond_id) if isinstance(cond_id, str) and cond_id.isdigit() else cond_id, "unknown")
                    if label in human_wins:
                        human_wins[label]["total"] += 1

        for label, counts in human_wins.items():
            counts["win_rate"] = round(counts["wins"] / max(counts["total"], 1), 4)
        results["human_raters"] = human_wins

        return results

    async def compute_effect_sizes(self, experiment_id: int) -> dict:
        """Cohen's d for each NLP metric between condition pairs."""
        _check_deps()
        from flinch.db import list_conditions

        conditions = await list_conditions(self.db, experiment_id)
        cond_map = {c["id"]: c["label"] for c in conditions}

        metrics_cols = ["word_count", "flesch_kincaid_grade", "flesch_reading_ease",
                        "hedging_ratio", "confidence_ratio", "avg_sentence_length", "lexical_diversity"]

        # Get metrics grouped by condition
        cond_metrics = {}
        for cond in conditions:
            cursor = await self.db.execute("""
                SELECT rm.word_count, rm.flesch_kincaid_grade, rm.flesch_reading_ease,
                       rm.hedging_ratio, rm.confidence_ratio, rm.avg_sentence_length, rm.lexical_diversity
                FROM response_metrics rm
                JOIN experiment_responses er ON er.id = rm.response_id
                WHERE er.experiment_id = ? AND er.condition_id = ?
            """, (experiment_id, cond["id"]))
            rows = await cursor.fetchall()
            cond_metrics[cond["label"]] = {
                col: [float(r[i]) for r in rows if r[i] is not None]
                for i, col in enumerate(metrics_cols)
            }

        # Compute pairwise effect sizes
        labels = list(cond_metrics.keys())
        results = {}
        for i in range(len(labels)):
            for j in range(i + 1, len(labels)):
                pair_key = f"{labels[i]}_vs_{labels[j]}"
                pair_results = {}
                for col in metrics_cols:
                    g1 = cond_metrics[labels[i]].get(col, [])
                    g2 = cond_metrics[labels[j]].get(col, [])
                    if len(g1) >= 2 and len(g2) >= 2:
                        d = cohens_d(g1, g2)
                        ci_low, ci_high = _bootstrap_cohens_d(g1, g2)
                        # T-test for p-value
                        t_stat, p_val = scipy_stats.ttest_ind(g1, g2)
                        pair_results[col] = {
                            "cohens_d": round(d, 4),
                            "ci_lower": round(ci_low, 4),
                            "ci_upper": round(ci_high, 4),
                            "p_value": round(p_val, 6),
                            "n1": len(g1),
                            "n2": len(g2),
                        }
                results[pair_key] = pair_results

        return results

    async def compute_inter_rater_agreement(self, experiment_id: int) -> dict:
        """Krippendorff's alpha for AI raters, human raters, and cross-comparison."""
        _check_deps()

        results = {}

        # AI rater agreement
        cursor = await self.db.execute("""
            SELECT ar.prompt_id, ar.target_model_id, ar.rater_model,
                   ari.position_label, ari.rank
            FROM ai_ratings ar
            JOIN ai_rating_items ari ON ari.rating_id = ar.id
            WHERE ar.experiment_id = ? AND ar.status = 'completed'
        """, (experiment_id,))
        ai_rows = await cursor.fetchall()

        if ai_rows:
            # Build reliability matrix: rows = raters, cols = items
            rater_models = sorted(set(r[2] for r in ai_rows))
            items = sorted(set((r[0], r[1], r[3]) for r in ai_rows))  # (prompt, model, position)
            item_to_idx = {item: idx for idx, item in enumerate(items)}

            matrix = np.full((len(rater_models), len(items)), np.nan)
            for row in ai_rows:
                rater_idx = rater_models.index(row[2])
                item_key = (row[0], row[1], row[3])
                if item_key in item_to_idx:
                    matrix[rater_idx, item_to_idx[item_key]] = row[4] or np.nan

            try:
                alpha = krippendorff_lib.alpha(matrix, level_of_measurement="ordinal")
                results["ai_raters"] = {"alpha": round(alpha, 4), "n_raters": len(rater_models), "n_items": len(items)}
            except Exception as e:
                results["ai_raters"] = {"alpha": None, "error": str(e)}

        # Human rater agreement
        cursor = await self.db.execute("""
            SELECT et.id, er2.rater_id, er2.position_label, er2.rank
            FROM eval_tasks et
            JOIN eval_ratings er2 ON er2.eval_task_id = et.id
            WHERE et.experiment_id = ?
        """, (experiment_id,))
        human_rows = await cursor.fetchall()

        if human_rows:
            rater_ids = sorted(set(r[1] for r in human_rows))
            h_items = sorted(set((r[0], r[2]) for r in human_rows))
            h_item_to_idx = {item: idx for idx, item in enumerate(h_items)}

            h_matrix = np.full((len(rater_ids), len(h_items)), np.nan)
            for row in human_rows:
                rater_idx = rater_ids.index(row[1])
                item_key = (row[0], row[2])
                if item_key in h_item_to_idx:
                    h_matrix[rater_idx, h_item_to_idx[item_key]] = row[3] or np.nan

            try:
                alpha = krippendorff_lib.alpha(h_matrix, level_of_measurement="ordinal")
                results["human_raters"] = {"alpha": round(alpha, 4), "n_raters": len(rater_ids), "n_items": len(h_items)}
            except Exception as e:
                results["human_raters"] = {"alpha": None, "error": str(e)}

        return results

    async def compute_per_model_breakdown(self, experiment_id: int) -> dict:
        """All analyses broken down by target model."""
        cursor = await self.db.execute("""
            SELECT DISTINCT model_id FROM experiment_responses WHERE experiment_id = ?
        """, (experiment_id,))
        models = [r[0] for r in await cursor.fetchall()]

        breakdown = {}
        for model_id in models:
            # Win rate for this model only
            cursor = await self.db.execute("""
                SELECT ar.blinding_order, ari.position_label, ari.rank
                FROM ai_ratings ar
                JOIN ai_rating_items ari ON ari.rating_id = ar.id
                WHERE ar.experiment_id = ? AND ar.target_model_id = ? AND ar.status = 'completed'
            """, (experiment_id, model_id))
            rows = await cursor.fetchall()

            wins_by_cond = {}
            for row in rows:
                blinding = json.loads(row[0])
                pos = row[1]
                rank = row[2]
                cond_id = blinding.get(pos)
                if cond_id not in wins_by_cond:
                    wins_by_cond[cond_id] = {"wins": 0, "total": 0}
                wins_by_cond[cond_id]["total"] += 1
                if rank == 1:
                    wins_by_cond[cond_id]["wins"] += 1

            for cid in wins_by_cond:
                wins_by_cond[cid]["win_rate"] = round(wins_by_cond[cid]["wins"] / max(wins_by_cond[cid]["total"], 1), 4)

            breakdown[model_id] = {"win_rates": wins_by_cond}

        return breakdown

    def power_analysis(self, n_per_group: int = 1000) -> dict:
        """Pre-experiment power analysis.
        Design: paired comparison, d=0.3, alpha=0.05, power=0.80.
        """
        _check_deps()
        effect_size = 0.3
        alpha = 0.05
        target_power = 0.80

        # Required N for given effect size and power (two-sample t-test)
        # Using scipy's power analysis
        from scipy.stats import norm
        z_alpha = norm.ppf(1 - alpha / 2)
        z_beta = norm.ppf(target_power)
        required_n = math.ceil(2 * ((z_alpha + z_beta) / effect_size) ** 2)

        actual_power = None
        if n_per_group >= required_n:
            # Compute actual power with our sample size
            ncp = effect_size * math.sqrt(n_per_group / 2)
            actual_power = round(1 - scipy_stats.norm.cdf(z_alpha - ncp), 4)

        return {
            "effect_size_d": effect_size,
            "alpha": alpha,
            "target_power": target_power,
            "required_n_per_group": required_n,
            "actual_n_per_group": n_per_group,
            "actual_power": actual_power,
            "sufficient": n_per_group >= required_n,
        }

    async def full_analysis(self, experiment_id: int) -> dict:
        """Run all analyses, store results, return summary."""
        from flinch.db import save_analysis_result

        all_results = {}

        # Win rates
        win_rates = await self.compute_win_rates(experiment_id)
        await save_analysis_result(self.db, experiment_id, "win_rates", json.dumps(win_rates))
        all_results["win_rates"] = win_rates

        # Effect sizes
        try:
            effect_sizes = await self.compute_effect_sizes(experiment_id)
            await save_analysis_result(self.db, experiment_id, "effect_sizes", json.dumps(effect_sizes))
            all_results["effect_sizes"] = effect_sizes
        except ImportError as e:
            all_results["effect_sizes"] = {"error": str(e)}

        # Inter-rater agreement
        try:
            agreement = await self.compute_inter_rater_agreement(experiment_id)
            await save_analysis_result(self.db, experiment_id, "inter_rater_agreement", json.dumps(agreement))
            all_results["inter_rater_agreement"] = agreement
        except ImportError as e:
            all_results["inter_rater_agreement"] = {"error": str(e)}

        # Per-model breakdown
        breakdown = await self.compute_per_model_breakdown(experiment_id)
        await save_analysis_result(self.db, experiment_id, "per_model_breakdown", json.dumps(breakdown))
        all_results["per_model_breakdown"] = breakdown

        # Power analysis
        cursor = await self.db.execute("""
            SELECT COUNT(*) FROM experiment_responses
            WHERE experiment_id = ? AND status = 'completed'
        """, (experiment_id,))
        total_responses = (await cursor.fetchone())[0]
        power = self.power_analysis(n_per_group=total_responses // 3)  # rough per-condition
        await save_analysis_result(self.db, experiment_id, "power_analysis", json.dumps(power))
        all_results["power_analysis"] = power

        return all_results
