# Flinch

AI content restriction consistency research tool.

![Flinch Preview](flinch-preview.png)

## What is Flinch?

Flinch is a human-in-the-loop research instrument for testing whether AI models enforce content restrictions consistently. It grew out of [empirical research](https://beargleindustries.com/notes/rules-are-rules-until-they-arent) examining how language models handle creative writing requests that touch sensitive topics.

The core question: when a model refuses a prompt, is it applying a consistent rule — or flinching?

A "flinch" is a content restriction that doesn't hold up under examination. The model refuses, but when you ask "what specifically is the concern?", the refusal collapses. Flinch helps researchers measure this systematically across models, prompts, and conversation contexts.

## Status

**v0.8.0 — Experiment Framework.** Full A/B condition experiment pipeline: run probes across system prompt conditions (e.g., deception vs. honesty), compute lexical metrics (MTLD, Honore's Statistic, hedging, etc.), run statistical analysis, export CSV. Local model support via Ollama. Bug reports welcome.

## Features

### Core Testing
- **Multi-model testing** — test probes against Claude, GPT, Gemini, Grok, and Llama models from a single interface
- **AI-powered coach** — analyzes refusals using 7 pushback strategies distilled from empirical research
- **Human-in-the-loop** — coach suggests, you decide. Override and edit suggestions to teach the coach
- **Hybrid classification** — keyword scan + LLM judge categorizes responses as refused/collapsed/negotiated/complied
- **Batch testing** — run multiple probes sequentially against a model
- **Custom probes** — write ad-hoc probes at any point in the workflow

### Comparison & Analysis
- **Multi-model comparison** — run the same probes across models, see agreement/disagreement side-by-side with persistent results
- **Statistical analysis** — run probes repeatedly (up to 100x) per model to get refusal rate distributions and consistency scores
- **Framing variants** — test semantically equivalent probes with different framing to detect inconsistency, with AI-generated variant groups
- **Narrative momentum** — multi-turn conversation sequences with configurable warmup strategies that build context before the test probe, tracking at which turn compliance occurs
- **Policy scorecards** — cross-model policy enforcement comparison with per-domain breakdowns

### Publication & Export
- **Themed exports** — configurable theme system for HTML and PDF exports with live preview
- **Built-in themes** — Beargle Dark, Clean Light, and Neutral Dark presets; create custom themes via markdown files
- **PDF export** — generate publication-ready PDF reports (requires optional `weasyprint` dependency)
- **Publication templates** — comparison tables, consistency matrices, pushback summaries, and full research reports
- **Data export** — per-session export (JSON, CSV, HTML, PDF) plus bulk "Export All" for complete data download

### Dashboard & Data
- **Dashboard** — unified data browser with aggregate stats, classification distribution, and inline detail views for all sessions, comparisons, and sequences
- **Inline data viewing** — click any session to see runs with full probe text, responses, and pushback conversations; click comparisons for side-by-side model results; click sequences for turn-by-turn flow
- **Clear all data** — two-step confirmation to reset the database while preserving probes and strategies
- **Dark theme web UI** — runs locally in your browser

### Experiment Framework
- **Condition experiments** — run the same probes under different system prompt conditions (e.g., honesty vs. deception framing). Variant groups support `type: conditions` for A/B testing and `type: framings` for probe text alternatives
- **Lexical analysis engine** — 25+ metrics per response: MTLD, Honoré's Statistic, TTR, Flesch-Kincaid, Gunning Fog, POS rates, hedging/confidence/evasion markers, sentiment analysis
- **Statistical analysis** — Mann-Whitney U, Wilcoxon signed-rank (paired by probe), Cohen's d, rank-biserial correlation, Benjamini-Hochberg FDR correction
- **Condition comparison dashboard** — per-condition system prompts, side-by-side response browser, metric comparison table with significance flags
- **HH-RLHF prompt library** — download script extracts 35K+ deception-viable prompts from Anthropic's HH-RLHF dataset with stratified sampling
- **CSV export** — one row per response with all metrics, conditions, and system prompts for external analysis
- **Resume support** — retry failed probes (3x with backoff), resume interrupted experiments from where they left off
- **AI rater pipeline** — automated evaluation using multiple rater models with blinding and position randomization
- **Local model support** — run experiments against Ollama models (auto-detected) for free iteration before using API models

## Supported Models

| Provider | Models | Env Variable |
|----------|--------|-------------|
| Anthropic | Claude Opus 4, Sonnet 4, Haiku 4.5, 3.5 Sonnet, 3.5 Haiku, 3 Opus | `ANTHROPIC_API_KEY` |
| OpenAI | GPT-4.1, 4.1 Mini, 4.1 Nano, GPT-4o, 4o Mini, o3-mini, o4-mini, GPT-4 Turbo | `OPENAI_API_KEY` |
| Google | Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash | `GOOGLE_API_KEY` |
| xAI | Grok 3, Grok 3 Mini | `XAI_API_KEY` |
| Meta (via Together) | Llama 4 Maverick, Llama 3.3 70B, Llama 3.1 8B | `TOGETHER_API_KEY` |
| Local (via Ollama) | Any model you have pulled (Qwen, Mistral, Llama, etc.) | None — just run Ollama locally |

No single provider is required. Flinch auto-detects available providers for the coach and classifier (prefers Anthropic > OpenAI > Google > Ollama). You only need API keys for the models you want to test as targets. Ollama models are auto-detected from your local instance at `http://localhost:11434`.

## Quick Start

```bash
# Clone and install
git clone https://github.com/BeargleIndustries/flinch.git
cd flinch
pip install -e .

# Configure API keys
cp .env.example .env
# Edit .env with your API keys (any provider works — Anthropic, OpenAI, Google, or Ollama)

# Run
python -m flinch.app
# Open http://127.0.0.1:8000
```

Optional dependencies:
```bash
# Multi-model testing (OpenAI, Google)
pip install -e ".[multi-model]"

# PDF export (requires system libraries — cairo, pango)
pip install -e ".[pdf]"

# Experiment framework (lexical analysis, stats, MTLD, Honoré's)
pip install -e ".[experiment]"

# Download HH-RLHF prompt library (one-time, ~35K prompts)
pip install datasets
python scripts/download_hh_prompts.py
```

## How It Works

1. **Send a probe** — a prompt designed to test a content restriction boundary
2. **Model responds** — Flinch classifies the response (refused / collapsed / negotiated / complied)
3. **Coach analyzes** — if the model refused, the AI coach reads the refusal and suggests a pushback strategy
4. **You decide** — accept the suggestion, edit it, write your own, or skip
5. **Pushback sent** — the follow-up goes to the model in the same conversation context
6. **Final classification** — did the refusal hold, or did it collapse?
7. **Learn** — promote effective pushbacks to the coach's training examples

The coach uses 7 pushback moves distilled from empirical research: specificity challenge, equivalence probe, projection check, contradiction mirror, category reductio, reality anchor, and minimal pressure. See `flinch/playbook.md` for the full methodology.

## Creating Probes

Probes are markdown files in `flinch/probes/`. See `example-probes.md` for the format:

```markdown
## probe-name
- domain: category
- tags: tag1, tag2, tag3
- description: Brief description

The actual prompt text sent to the target model.
```

Load probes using "Load Defaults" (imports all files in `flinch/probes/`), "Import File" (pick a specific file), or create them directly in the UI. Bulk select and delete probes via the "Select" toggle in the sidebar. Sessions can be scoped to specific probes via the probe picker in the new session dialog.

## Running Condition Experiments

Condition experiments test the same probes under different system prompt conditions. Create a variant group file in `flinch/variants/`:

```markdown
# My Experiment

Description of what you're testing.

- type: conditions

---

## Baseline

## Condition A
You are a helpful assistant that prioritizes accuracy.

## Condition B
You are a helpful assistant that prioritizes user satisfaction.
```

Then:
1. Create a session and load your probes
2. Go to the Framing Variants tab
3. Click "Run" on your conditions group — runs every probe once per condition
4. View results in the Condition Comparison dashboard (auto-opens after run)
5. Click "Compute Metrics" for lexical analysis (MTLD, Honoré's, hedging, etc.)
6. Click "Run Analysis" for statistical tests (Mann-Whitney U, Wilcoxon, FDR correction)
7. Export CSV for external analysis

If a run is interrupted, go to Experiments tab → click the experiment → Resume.

## Custom Themes

Export themes are markdown files in `flinch/themes/`. Create a new `.md` file following the same format as `presets.md`:

```markdown
## my-theme
- display_name: My Theme
- description: A custom theme for exports
- bg_color: #1e1e2e
- text_color: #cdd6f4
- accent_color: #89b4fa
- border_color: #313244
- heading_color: #cba6f7
- color_high: #a6e3a1
- color_mid: #f9e2af
- color_low: #f38ba8
- font_body: system-ui, sans-serif
- font_mono: monospace
- font_heading: system-ui, sans-serif
- font_size_base: 14px
- max_width: 1100px
```

Custom themes appear in the theme picker after restarting the server.

## Research Background

Flinch builds on ["Rules Are Rules, Until They Aren't"](https://beargleindustries.com/notes/rules-are-rules-until-they-arent) — empirical research examining content restriction consistency across language models. Key findings:

- The majority of initial refusals collapsed under basic follow-up questioning
- Models frequently refused based on content they *imagined* would follow, not content in the prompt
- Emphatic refusals ("I absolutely cannot") were more likely to collapse than measured ones
- The same content was accepted or refused based on surface-level framing (clinical vs. colloquial language)

This tool exists to make that kind of measurement systematic and reproducible.

## How It Runs

Flinch runs locally on your machine at `127.0.0.1:8000`. The only external connections it makes are API calls to the model providers you configure (Anthropic, OpenAI, Google, etc.).

## Disclaimer

Flinch is a research tool for studying AI content restriction behavior. It is not designed to circumvent safety measures or generate harmful content. The probes test *creative writing and fictional scenarios* — the research question is about consistency, not capability.

Responsible use is expected. Don't use this tool to extract genuinely dangerous information. That's not what it's for, and it's not what the research is about.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
