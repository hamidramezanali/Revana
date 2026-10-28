import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


def test_openapi_contract_is_current():
    result = subprocess.run(
        [sys.executable, "scripts/export_openapi.py", "--check"],
        check=False,
        cwd=BACKEND,
        env={**os.environ, "PYTHONPATH": str(BACKEND)},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
