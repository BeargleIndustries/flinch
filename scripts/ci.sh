#!/usr/bin/env bash
# Linux CI gate (plan F11). The GitHub workflow calls only this script.
#
# Locally on Windows, run it under Git Bash by absolute path (plain `bash`
# resolves to WSL):
#   & "$env:ProgramFiles\Git\bin\bash.exe" scripts/ci.sh
#
# `pip install` runs only when $CI is set (I37): a local `pip install -e` would
# re-point the developer's editable install at whichever worktree ran it.
set -euo pipefail

cd "$(dirname "$0")/.."

step() { printf '\n== %s\n' "$*"; }

# node:sqlite (ui/tests/e2e/batch-cancel.spec.ts) needs Node 22.13 or newer.
if ! node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)'; then
  echo "Node 22.13 or newer is required (node:sqlite)" >&2
  exit 1
fi

if [ -n "${CI:-}" ]; then
  step "pip install -e .[dev,multi-model,experiment]"
  python -m pip install -e ".[dev,multi-model,experiment]"
fi

step "ruff check flinch tests scripts"
if command -v ruff >/dev/null 2>&1; then
  ruff check flinch tests scripts
elif command -v uvx >/dev/null 2>&1; then
  uvx ruff check flinch tests scripts
else
  python -m ruff check flinch tests scripts
fi

step "pytest -q"
python -m pytest -q

step "npm ci"
npm --prefix ui ci

step "npm run check"
npm --prefix ui run check

step "npm test"
npm --prefix ui test

step "npm run lint"
npm --prefix ui run lint

step "npm run build"
npm --prefix ui run build

step "playwright install chromium"
if [ -n "${CI:-}" ] && [ "$(uname -s)" = "Linux" ]; then
  npx --prefix ui playwright install --with-deps chromium
else
  npx --prefix ui playwright install chromium
fi

step "npm run test:e2e"
npm --prefix ui run test:e2e

step "ci.sh passed"
