"""Per-run numeric diagnostics only: no prompts, keys, answers or provider text."""

from contextvars import ContextVar
from functools import wraps
from time import perf_counter

_current = ContextVar("run_performance", default=None)


def start():
    return _current.set(
        {
            "started": perf_counter(),
            "storage_ms": 0.0,
            "storage_operations": 0,
            "context_ms": 0.0,
            "calls": [],
        }
    )


def reset(token):
    _current.reset(token)


def timed(kind):
    def decorate(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            begin = perf_counter()
            try:
                return fn(*args, **kwargs)
            finally:
                current = _current.get()
                if current is not None:
                    current[kind + "_ms"] += (perf_counter() - begin) * 1000
                    if kind == "storage":
                        current["storage_operations"] += 1

        return wrapped

    return decorate


def provider(role, started, input_chars, output_chars, usage, ok):
    current = _current.get()
    if current is None:
        return

    usage = usage if isinstance(usage, dict) else {}

    def count(key):
        value = usage.get(key)
        return value if isinstance(value, int) and value >= 0 else None

    current["calls"].append(
        {
            "role": role if role in {"coach", "planner", "reviewer", "researcher"} else "coach",
            "elapsed_ms": round((perf_counter() - started) * 1000, 1),
            "input_chars": input_chars,
            "output_chars": output_chars,
            "input_tokens": count("input_tokens"),
            "output_tokens": count("output_tokens"),
            "completed": ok,
        }
    )


def snapshot():
    current = _current.get()
    if current is None:
        return None
    return {
        "total_ms": round((perf_counter() - current["started"]) * 1000, 1),
        "storage_ms": round(current["storage_ms"], 1),
        "storage_operations": current["storage_operations"],
        "context_ms": round(current["context_ms"], 1),
        "calls": list(current["calls"]),
    }
