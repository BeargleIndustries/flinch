from __future__ import annotations

import asyncio
import logging
import random
import re
from collections import Counter

import httpx

logger = logging.getLogger(__name__)


class HHRLHFImporter:
    """Download and import Anthropic HH-RLHF prompts from HuggingFace."""

    SUBSETS = [
        "harmless-base",
        "helpful-base",
        "helpful-online",
        "helpful-rejection-sampled",
    ]
    HF_API_BASE = "https://datasets-server.huggingface.co"

    FACTUAL_KEYWORDS = [
        "what is", "what are", "how does", "how do", "when did", "where is",
        "who is", "who was", "explain", "define", "tell me about", "what's the",
        "how many", "how much", "is it true", "can you tell me",
    ]
    ADVICE_KEYWORDS = [
        "how can i", "how should i", "what should i", "how do i",
        "advice", "recommend", "suggest", "help me", "tips for",
        "best way to", "how to", "should i", "what do you think i should",
    ]
    OPINION_KEYWORDS = [
        "what do you think", "do you think", "your opinion",
        "is it better", "which is better", "do you agree", "do you believe",
        "what's your", "how do you feel", "would you say",
    ]
    ETHICAL_KEYWORDS = [
        "is it wrong", "is it ethical", "is it moral", "should people",
        "is it okay to", "is it right to", "is it fair", "is it justified",
        "morally", "ethically", "right or wrong",
    ]

    # Patterns for prompts we want to filter out
    _GREETING_RE = re.compile(
        r"^(hi|hello|hey|good\s+(morning|afternoon|evening)|howdy|sup|what'?s\s+up)[!?.]*$",
        re.IGNORECASE,
    )
    _HUMAN_TURN_RE = re.compile(r"\n\nHuman:\s*(.*?)(?=\n\nAssistant:|\Z)", re.DOTALL)

    def extract_first_human_turn(self, chosen: str) -> str | None:
        """Extract first human turn from HH-RLHF conversation format.

        Format: '\\n\\nHuman: {text}\\n\\nAssistant: {text}...'
        Returns the first human message text, stripped.
        Returns None if format doesn't match.
        """
        m = self._HUMAN_TURN_RE.search(chosen)
        if not m:
            return None
        text = m.group(1).strip()
        return text if text else None

    def categorize_prompt(self, text: str) -> str:
        """Categorize prompt into domain using keyword heuristics.

        Returns: 'factual', 'advice', 'opinion', 'ethical', or 'other'.
        Case-insensitive. First match wins (checked in order:
        ethical, opinion, advice, factual — most specific first).
        """
        lower = text.lower()
        for kw in self.ETHICAL_KEYWORDS:
            if kw in lower:
                return "ethical"
        for kw in self.OPINION_KEYWORDS:
            if kw in lower:
                return "opinion"
        for kw in self.ADVICE_KEYWORDS:
            if kw in lower:
                return "advice"
        for kw in self.FACTUAL_KEYWORDS:
            if kw in lower:
                return "factual"
        return "other"

    def filter_deception_viable(self, prompt: str) -> bool:
        """Return True if prompt is a viable candidate for deceptive-framing experiments.

        Filters out:
        - Too short (< 10 words)
        - Pure greetings
        - Overtly harmful requests that will just be refused outright
        """
        words = prompt.split()
        if len(words) < 10:
            return False
        if self._GREETING_RE.match(prompt.strip()):
            return False
        # Crude harmful-request filter: prompts that are blatantly asking for
        # clearly illegal/dangerous content with no plausible legitimate framing.
        lower = prompt.lower()
        hard_filters = [
            "how to make a bomb",
            "how to build a bomb",
            "how to make explosives",
            "how to synthesize meth",
            "how to make meth",
            "child pornography",
            "how to rape",
            "how to murder",
            "step by step instructions to kill",
        ]
        for hf in hard_filters:
            if hf in lower:
                return False
        return True

    async def fetch_rows(
        self,
        split: str = "train",
        max_rows: int = 170000,
        batch_size: int = 100,
        progress_callback=None,
    ) -> list[dict]:
        """Fetch rows from HuggingFace Datasets Server API.

        The HH-RLHF dataset has a single 'default' config with all subsets merged.
        Uses: GET {HF_API_BASE}/rows?dataset=Anthropic/hh-rlhf&config=default&split={split}&offset={offset}&length={batch_size}

        Returns list of {"prompt": str, "subset": "default", "domain": str}.
        Extracts first human turn from each row's "chosen" field.
        Skips rows where extraction fails.
        """
        results: list[dict] = []
        offset = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            while offset < max_rows:
                length = min(batch_size, max_rows - offset)
                url = (
                    f"{self.HF_API_BASE}/rows"
                    f"?dataset=Anthropic/hh-rlhf"
                    f"&config=default"
                    f"&split={split}"
                    f"&offset={offset}"
                    f"&length={length}"
                )
                data = None
                for attempt in range(5):
                    try:
                        resp = await client.get(url)
                        resp.raise_for_status()
                        data = resp.json()
                        break
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code == 416:
                            # Offset beyond dataset size
                            return results
                        if e.response.status_code == 429:
                            wait = min(2 ** (attempt + 1), 30)
                            logger.info("Rate limited at offset %d, waiting %ds...", offset, wait)
                            if progress_callback:
                                progress_callback(offset, len(results), f"rate limited, retrying in {wait}s")
                            await asyncio.sleep(wait)
                            continue
                        logger.warning("HTTP error at offset %d: %s", offset, e)
                        return results
                    except Exception as e:
                        logger.warning("Error at offset %d: %s", offset, e)
                        return results

                if data is None:
                    logger.warning("Failed after 5 retries at offset %d", offset)
                    return results

                rows = data.get("rows", [])
                if not rows:
                    break

                for row_wrapper in rows:
                    row = row_wrapper.get("row", {})
                    chosen = row.get("chosen", "")
                    text = self.extract_first_human_turn(chosen)
                    if not text:
                        continue
                    domain = self.categorize_prompt(text)
                    results.append({"prompt": text, "subset": "default", "domain": domain})

                offset += len(rows)
                if progress_callback and offset % 1000 < batch_size:
                    progress_callback(offset, len(results))

                # Polite delay — longer to avoid rate limits on large fetches
                await asyncio.sleep(0.15)

                if len(rows) < batch_size:
                    break

        logger.info("Finished fetching: %d usable rows from %d total", len(results), offset)
        return results

    async def fetch_subset_rows(
        self,
        subset: str,
        split: str = "train",
        max_rows: int = 50000,
        batch_size: int = 100,
    ) -> list[dict]:
        """Backward-compatible wrapper — fetches from the merged default config."""
        return await self.fetch_rows(split=split, max_rows=max_rows, batch_size=batch_size)

    def stratified_sample(
        self,
        prompts: list[dict],
        target_count: int = 800,
        stratification: dict[str, float] | None = None,
        seed: int = 42,
    ) -> list[dict]:
        """Stratified random sample from categorized prompts.

        Default stratification (proportional to research value):
            factual: 0.35, advice: 0.25, opinion: 0.25, ethical: 0.15

        Skips 'other' category.
        If a category has fewer prompts than needed, takes all available
        and redistributes remainder proportionally.

        Returns sampled prompts with domain labels.
        """
        rng = random.Random(seed)

        if stratification is None:
            stratification = {
                "factual": 0.35,
                "advice": 0.25,
                "opinion": 0.25,
                "ethical": 0.15,
            }

        # Bucket by domain (excluding 'other')
        buckets: dict[str, list[dict]] = {k: [] for k in stratification}
        for p in prompts:
            domain = p.get("domain", "other")
            if domain in buckets:
                buckets[domain].append(p)

        # Shuffle each bucket deterministically
        for bucket in buckets.values():
            rng.shuffle(bucket)

        # First pass: allocate targets
        targets: dict[str, int] = {}
        for domain, ratio in stratification.items():
            targets[domain] = round(target_count * ratio)

        # Clamp to available and collect overflow
        overflow = 0
        shortfall_domains: list[str] = []
        for domain, needed in targets.items():
            available = len(buckets[domain])
            if available < needed:
                overflow += needed - available
                targets[domain] = available
                shortfall_domains.append(domain)

        # Redistribute overflow to domains with headroom
        if overflow > 0:
            headroom_domains = [
                d for d in stratification
                if d not in shortfall_domains and len(buckets[d]) > targets[d]
            ]
            if headroom_domains:
                total_headroom_ratio = sum(stratification[d] for d in headroom_domains)
                for d in headroom_domains:
                    extra = round(overflow * stratification[d] / total_headroom_ratio)
                    cap = len(buckets[d]) - targets[d]
                    targets[d] += min(extra, cap)

        sampled: list[dict] = []
        for domain, count in targets.items():
            sampled.extend(buckets[domain][:count])

        rng.shuffle(sampled)
        return sampled

    async def import_to_experiment(
        self,
        db_conn,
        experiment_id: int,
        target_count: int = 800,
        subsets: list[str] | None = None,
        stratification: dict[str, float] | None = None,
        seed: int = 42,
        progress_callback=None,
    ) -> dict:
        """Full pipeline: download → extract → categorize → sample → import.

        1. Download from each subset (or specified subsets)
        2. Extract first human turns
        3. Categorize by domain
        4. Stratified sample to target_count
        5. Insert into experiment_prompts table

        progress_callback(stage: str, current: int, total: int) called for SSE.

        Returns: {
            "imported": int,
            "by_domain": {"factual": N, "advice": N, ...},
            "by_subset": {"harmless-base": N, ...},
            "skipped": int,
        }
        """
        active_subsets = subsets or self.SUBSETS

        # --- Idempotency check ---
        async with db_conn.execute(
            "SELECT COUNT(*) FROM experiment_prompts WHERE experiment_id = ?",
            (experiment_id,),
        ) as cur:
            row = await cur.fetchone()
            existing_count = row[0] if row else 0

        if existing_count > 0:
            logger.warning(
                "Experiment %d already has %d prompts — skipping import.",
                experiment_id,
                existing_count,
            )
            return {
                "imported": 0,
                "by_domain": {},
                "by_subset": {},
                "skipped": existing_count,
                "warning": f"Experiment already has {existing_count} prompts. Delete them first to re-import.",
            }

        # --- Download ---
        all_prompts: list[dict] = []
        total_subsets = len(active_subsets)
        for i, subset in enumerate(active_subsets):
            if progress_callback:
                await progress_callback("downloading", i, total_subsets)
            logger.info("Downloading subset: %s", subset)
            rows = await self.fetch_subset_rows(subset)
            all_prompts.extend(rows)

        if progress_callback:
            await progress_callback("downloading", total_subsets, total_subsets)

        # --- Filter deception-viable prompts ---
        raw_count = len(all_prompts)
        all_prompts = [p for p in all_prompts if self.filter_deception_viable(p["prompt"])]
        filtered_count = raw_count - len(all_prompts)
        logger.info(
            "After deception-viability filter: %d kept, %d removed",
            len(all_prompts),
            filtered_count,
        )

        # --- Deduplication ---
        seen: set[str] = set()
        deduped: list[dict] = []
        for p in all_prompts:
            key = p["prompt"].strip().lower()
            if key not in seen:
                seen.add(key)
                deduped.append(p)
        dedup_removed = len(all_prompts) - len(deduped)
        if dedup_removed:
            logger.info("Deduplication removed %d duplicate prompts", dedup_removed)
        all_prompts = deduped

        # --- Stratified sample ---
        if progress_callback:
            await progress_callback("sampling", 0, 1)
        sampled = self.stratified_sample(
            all_prompts,
            target_count=target_count,
            stratification=stratification,
            seed=seed,
        )
        if progress_callback:
            await progress_callback("sampling", 1, 1)

        # --- Insert into DB ---
        if progress_callback:
            await progress_callback("importing", 0, len(sampled))

        entries = [
            {
                "custom_prompt_text": p["prompt"],
                "domain": p["domain"],
                "sort_order": idx,
            }
            for idx, p in enumerate(sampled)
        ]

        rows_db = [
            (
                experiment_id,
                None,  # probe_id
                e["custom_prompt_text"],
                e["domain"],
                e["sort_order"],
            )
            for e in entries
        ]
        await db_conn.executemany(
            """INSERT OR IGNORE INTO experiment_prompts
               (experiment_id, probe_id, custom_prompt_text, domain, sort_order)
               VALUES (?, ?, ?, ?, ?)""",
            rows_db,
        )
        await db_conn.commit()

        if progress_callback:
            await progress_callback("importing", len(sampled), len(sampled))

        # --- Stats ---
        domain_counts: Counter = Counter(p["domain"] for p in sampled)
        subset_counts: Counter = Counter(p["subset"] for p in sampled)

        result = {
            "imported": len(sampled),
            "by_domain": dict(domain_counts),
            "by_subset": dict(subset_counts),
            "skipped": filtered_count + dedup_removed,
        }
        logger.info("HH-RLHF import complete: %s", result)
        return result
