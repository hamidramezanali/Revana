"""Create an ignored, import-ready file containing only the backend model credentials."""

import json
import os
import subprocess
import sys
import tempfile
from collections.abc import Mapping
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
NAMES = ("REVANA_OPENAI_API_KEY", "REVANA_OPENAI_MODEL")


def render_environment(source: Path, environ: Mapping[str, str]) -> str:
    local = dotenv_values(source, interpolate=False) if source.exists() else {}
    values = {name: environ.get(name, local.get(name) or "").strip() for name in NAMES}
    if not all(values.values()):
        raise ValueError("Configure both backend OpenAI variables before exporting.")
    if any(any(char in value for char in "\r\n\0") for value in values.values()):
        raise ValueError("Environment values must be single-line strings.")
    # Quote values for dotenv imports, without interpolating or printing their contents.
    return "".join(f"{name}={json.dumps(values[name])}\n" for name in NAMES)


def main() -> int:
    destination = ROOT / ".env.vercel.local"
    temporary = None
    try:
        ignored = subprocess.run(
            ["git", "check-ignore", "--quiet", "--", str(destination)],
            cwd=ROOT,
            capture_output=True,
            check=False,
        )
        if ignored.returncode != 0 or destination.is_symlink():
            raise ValueError("The export destination must be an ignored, regular local file.")
        payload = render_environment(ROOT / "backend" / ".env", os.environ)
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            dir=ROOT,
            prefix=".env.vercel-",
            suffix=".local",
            delete=False,
        ) as handle:
            temporary = Path(handle.name)
            handle.write(payload)
        temporary.replace(destination)
    except (OSError, ValueError):
        print(
            "Export failed. Check the backend key/model configuration and Git ignore rules.",
            file=sys.stderr,
        )
        return 1
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    print(f"Created {destination.name} for Vercel import. It contains secrets; keep it local.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
