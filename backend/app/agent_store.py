"""Local durable journeys with hashed bearer capabilities and optimistic concurrency."""

import hashlib
import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException

from app import postgres_store
from app.agent_models import Journey
from app.config import get_settings


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    settings = get_settings()
    if settings.database_url:
        with postgres_store.connection(settings.database_url.get_secret_value()) as db:
            yield db
        return
    if settings.hosted:
        raise HTTPException(
            503,
            "Connect Neon/Postgres in Vercel Storage and set DATABASE_URL or REVANA_DATABASE_URL, then redeploy.",
        )
    path = Path(settings.database_path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.execute("PRAGMA secure_delete=ON")
    db.execute(
        "CREATE TABLE IF NOT EXISTS journeys "
        "(key TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL)"
    )
    try:
        with db:
            yield db
    finally:
        db.close()


def key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create(journey: Journey) -> str:
    token = secrets.token_urlsafe(32)
    with connection() as db:
        db.execute(
            "INSERT INTO journeys VALUES (?, ?, ?)",
            (key(token), journey.revision, journey.model_dump_json()),
        )
    return token


def read(token: str) -> Journey:
    with connection() as db:
        row = db.execute("SELECT body FROM journeys WHERE key = ?", (key(token),)).fetchone()
    if row is None:
        raise HTTPException(404, "Journey not found.")
    return Journey.model_validate_json(row[0])


def save(token: str, journey: Journey, expected: int) -> Journey:
    journey.revision = expected + 1
    with connection() as db:
        cursor = db.execute(
            "UPDATE journeys SET revision = ?, body = ? WHERE key = ? AND revision = ?",
            (journey.revision, journey.model_dump_json(), key(token), expected),
        )
        if cursor.rowcount != 1:
            raise HTTPException(409, "Journey changed. Reload it before trying again.")
    return journey


def delete(token: str) -> None:
    with connection() as db:
        db.execute("DELETE FROM journeys WHERE key = ?", (key(token),))


def check_available() -> None:
    with connection() as db:
        db.execute("SELECT 1")
