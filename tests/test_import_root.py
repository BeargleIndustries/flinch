"""I37: tests import the running worktree's own `flinch`, never the main worktree's.

`flinch` is installed editable through a `.pth` file that names the main
worktree, so without `[tool.pytest.ini_options] pythonpath = ["."]` a task
worktree's tests would silently run the main tree's code.
"""

from __future__ import annotations

from pathlib import Path

import flinch

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_flinch_imports_from_this_worktree() -> None:
    assert Path(flinch.__file__).resolve().parents[1] == REPO_ROOT
