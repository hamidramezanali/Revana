"""Durable PostgreSQL storage; independent of the unchanged hosted access guard."""

from contextlib import contextmanager
from functools import lru_cache
from importlib.resources import files

import psycopg
from fastapi import HTTPException
from psycopg.conninfo import conninfo_to_dict


def connect(url: str):
    parameters = conninfo_to_dict(url)
    if parameters.get("host") not in {"localhost", "127.0.0.1", "::1"} and parameters.get(
        "sslmode"
    ) not in {"require", "verify-ca", "verify-full"}:
        parameters["sslmode"] = "require"
    parameters["connect_timeout"] = 10
    return psycopg.connect(**parameters, prepare_threshold=None)


@lru_cache(maxsize=4)
def prepare_schema(url: str):
    with connect(url) as db:
        db.execute("SET LOCAL statement_timeout = '15s'")
        db.execute("SELECT pg_advisory_xact_lock(782413901)")
        db.execute(files("app").joinpath("migrations/001_journeys.sql").read_text(encoding="utf-8"))


class PostgresSession:
    def __init__(self, db):
        self.db = db

    def execute(self, query, parameters=()):
        # Values are always passed separately from these application-owned SQL templates.
        query = query.replace("journeys", "revana_journeys").replace("?", "%s")
        return self.db.execute(query, parameters)


@contextmanager
def connection(url: str):
    try:
        prepare_schema(url)
        with connect(url) as db:
            db.execute("SET LOCAL statement_timeout = '15s'")
            yield PostgresSession(db)
    except (psycopg.Error, ValueError):
        raise HTTPException(
            503, "Profile storage is unavailable. Check the Postgres connection and retry."
        ) from None
