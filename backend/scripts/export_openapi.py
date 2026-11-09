"""Write the API contract to contracts/openapi.json (or check that it is current).

Usage: python scripts/export_openapi.py [--check]
"""

import json
import sys
from pathlib import Path

from app.main import app

CONTRACT = Path(__file__).resolve().parents[2] / "contracts" / "openapi.json"


def render() -> str:
    return json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"


def main() -> int:
    expected = render()
    if "--check" in sys.argv:
        current = CONTRACT.read_text(encoding="utf-8") if CONTRACT.exists() else ""
        if current != expected:
            print("contracts/openapi.json is out of date. Run: python scripts/export_openapi.py")
            return 1
        return 0
    CONTRACT.parent.mkdir(parents=True, exist_ok=True)
    CONTRACT.write_text(expected, encoding="utf-8", newline="\n")
    print(f"Wrote {CONTRACT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
