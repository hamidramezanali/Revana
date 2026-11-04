import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("script", ["export_openapi.py", "export_client_types.py"])
def test_openapi_contract_is_current(script):
    result = subprocess.run(
        [sys.executable, f"scripts/{script}", "--check"],
        check=False,
        cwd=BACKEND,
        env={**os.environ, "PYTHONPATH": str(BACKEND)},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
