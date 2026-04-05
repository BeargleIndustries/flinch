#!/usr/bin/env python3
"""One-time download script: extract 800 deception-viable prompts from Anthropic HH-RLHF.

Run once, save to flinch/probes/hh-rlhf-800.md in standard Flinch probe format.
After that, import via the existing "Load Defaults" UI or import_probes_from_markdown().

Usage:
    python scripts/download_hh_prompts.py
    python scripts/download_hh_prompts.py --target 1000 --seed 42 --output flinch/probes/hh-rlhf-1000.md
"""
import argparse
import asyncio
import re
import sys
from collections import Counter
from pathlib import Path

# Add project root to path so we can import flinch modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from flinch.hh_import import HHRLHFImporter


def slugify(text: str, max_len: int = 50) -> str:
    """Convert prompt text to a kebab-case slug for probe names."""
    slug = text.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = slug[:max_len].rstrip('-')
    return slug or "unnamed-probe"


def to_markdown(prompts: list[dict]) -> str:
    """Convert prompt records to Flinch probe markdown format."""
    lines = [
        "# HH-RLHF Deception/Honesty Experiment Probes",
        "",
        "Stratified sample from Anthropic's HH-RLHF dataset for A/B system prompt experiments.",
        "Each probe is a first-turn human message extracted from the dataset.",
        "",
        "**Format:** Each `## heading` is a probe name. Metadata lines start with `- key:`.",
        "Everything after the metadata is the prompt text sent to the target model.",
        "",
        "---",
        "",
    ]

    seen_slugs: dict[str, int] = {}
    for p in prompts:
        slug = slugify(p["prompt"])
        # Deduplicate slugs
        if slug in seen_slugs:
            seen_slugs[slug] += 1
            slug = f"{slug}-{seen_slugs[slug]}"
        else:
            seen_slugs[slug] = 1

        lines.append(f"## {slug}")
        lines.append(f"- domain: {p['domain']}")
        lines.append(f"- tags: hh-rlhf, {p['domain']}, {p['subset']}")
        lines.append("")
        lines.append(p["prompt"].strip())
        lines.append("")

    return "\n".join(lines)


async def main(target: int, seed: int, output: Path) -> None:
    if output.exists():
        answer = input(f"{output} already exists. Overwrite? [y/N] ").strip().lower()
        if answer != "y":
            print("Aborted.")
            return

    importer = HHRLHFImporter()

    def on_progress(offset, extracted, msg=None):
        if msg:
            print(f"\n  [{msg}]", flush=True)
        else:
            print(f"\r  Fetched {offset:,} rows, extracted {extracted:,} prompts...", end="", flush=True)

    print("Downloading HH-RLHF dataset from HuggingFace (merged default config)...")
    print("  (169K rows, ~30 min with rate limit backoff)")
    all_prompts = await importer.fetch_rows(progress_callback=on_progress)
    print(f"\n\nTotal downloaded: {len(all_prompts)} usable prompts")

    # Filter deception-viable
    raw_count = len(all_prompts)
    all_prompts = [p for p in all_prompts if importer.filter_deception_viable(p["prompt"])]
    filtered_out = raw_count - len(all_prompts)
    print(f"After deception-viability filter: {len(all_prompts)} kept, {filtered_out} removed")

    # Deduplicate
    seen: set[str] = set()
    deduped: list[dict] = []
    for p in all_prompts:
        key = p["prompt"].strip().lower()
        if key not in seen:
            seen.add(key)
            deduped.append(p)
    dedup_removed = len(all_prompts) - len(deduped)
    if dedup_removed:
        print(f"Deduplication removed {dedup_removed} duplicates")
    all_prompts = deduped
    print(f"After dedup: {len(all_prompts)} unique prompts")

    # Domain breakdown before sampling
    domain_totals = Counter(p["domain"] for p in all_prompts)
    print("\nDomain breakdown (pre-sample):")
    for domain, count in sorted(domain_totals.items()):
        print(f"  {domain}: {count}")

    # Save the FULL library as JSON (all viable prompts, not just the sample)
    import json
    library_path = output.parent / "hh-rlhf-library.json"
    library_records = [
        {"prompt_text": p["prompt"], "domain": p["domain"]}
        for p in all_prompts
    ]
    library_path.parent.mkdir(parents=True, exist_ok=True)
    library_path.write_text(json.dumps(library_records, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nFull library saved: {library_path} ({len(library_records)} prompts)")

    # Stratified sample
    print(f"\nSampling {target} prompts (stratified)...")
    sampled = importer.stratified_sample(all_prompts, target_count=target, seed=seed)

    # Write sample as probe markdown
    output.parent.mkdir(parents=True, exist_ok=True)
    md = to_markdown(sampled)
    output.write_text(md, encoding="utf-8")

    # Summary stats
    final_domain = Counter(p["domain"] for p in sampled)

    print(f"\n--- Summary ---")
    print(f"Total extracted:         {len(all_prompts)}")
    print(f"After filtering + dedup: {len(deduped)}")
    print(f"Full library:            {len(library_records)} prompts -> {library_path}")
    print(f"Sampled probe set:       {len(sampled)} prompts -> {output}")
    print(f"Per-domain counts (sample):")
    for domain, count in sorted(final_domain.items()):
        print(f"  {domain}: {count}")
    print(f"\nImport probe set in Flinch via 'Load Defaults' or import_probes_from_markdown()")
    print(f"Re-sample from library anytime: change --target or --seed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download HH-RLHF prompts to Flinch probe markdown.")
    parser.add_argument("--target", type=int, default=800, help="Number of prompts to sample (default: 800)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for sampling (default: 42)")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("flinch/probes/hh-rlhf-800.md"),
        help="Output markdown file path (default: flinch/probes/hh-rlhf-800.md)",
    )
    args = parser.parse_args()
    asyncio.run(main(target=args.target, seed=args.seed, output=args.output))
