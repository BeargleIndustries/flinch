# Contributing to Flinch

Flinch is in early preview. Contributions are welcome — bug fixes, new features, documentation improvements, and probe format ideas.

## Setup

```bash
git clone https://github.com/BeargleIndustries/flinch.git
cd flinch
pip install -e ".[dev]"
```

## Development

- **Lint**: `ruff check .`
- **Format**: `ruff format .`
- **Test**: `pytest`
- **Run**: `python -m flinch.app`

## Probe Guidelines

Flinch probes are research instruments for studying AI content restriction consistency. When creating probes:

- Probes should test genuine content policy boundaries, not attempt to extract harmful instructions
- No real personal information or identifying details
- No child exploitation content under any circumstances
- No actual instructions for weapons, drugs, or attacks — the goal is to test *fictional/creative writing* restrictions
- Frame probes as fiction, journalism, academic, or clinical scenarios

## Pull Requests

- Describe what you're testing and why
- Keep changes focused — one feature or fix per PR
- Include probe domain and tags if adding new probe formats
- Run `ruff check .` before submitting

## Issues

Bug reports, feature requests, and research methodology discussions are all welcome. Please include:
- What you expected vs. what happened
- Which target model(s) you were testing
- Flinch version (`pip show flinch`)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
