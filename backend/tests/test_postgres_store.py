import pytest
from fastapi import HTTPException

from app import postgres_store
from app.config import Settings


def test_neon_database_url_aliases_and_secret_representation(monkeypatch):
    for name in ("REVANA_DATABASE_URL", "POSTGRES_URL", "DATABASE_URL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://example:synthetic-password@db.example/test")
    settings = Settings(_env_file=None)
    assert settings.database_url is not None
    assert "synthetic-password" not in repr(settings)
    monkeypatch.setenv("REVANA_DATABASE_URL", "postgresql://preferred@other.example/test")
    assert (
        Settings(_env_file=None)
        .database_url.get_secret_value()
        .startswith("postgresql://preferred")
    )


@pytest.mark.parametrize(
    "sslmode,expected",
    [("disable", "require"), ("verify-full", "verify-full"), ("require", "require")],
)
def test_remote_database_requires_tls_and_disables_prepared_statements(
    monkeypatch, sslmode, expected
):
    calls = []
    monkeypatch.setattr(postgres_store.psycopg, "connect", lambda **kwargs: calls.append(kwargs))
    postgres_store.connect(
        f"postgresql://example:synthetic@remote.example/db?sslmode={sslmode}&connect_timeout=25"
    )
    assert calls[0]["sslmode"] == expected
    assert calls[0]["prepare_threshold"] is None
    assert calls[0]["connect_timeout"] == 10


def test_failed_connection_is_generic_and_does_not_echo_credentials(monkeypatch):
    postgres_store.prepare_schema.cache_clear()

    def fail(*args, **kwargs):
        raise postgres_store.psycopg.OperationalError("synthetic-password and private record")

    monkeypatch.setattr(postgres_store, "connect", fail)
    with (
        pytest.raises(HTTPException) as error,
        postgres_store.connection("postgresql://example:synthetic-password@remote.example/db"),
    ):
        pass
    assert error.value.status_code == 503
    assert "synthetic-password" not in error.value.detail
    assert "private record" not in error.value.detail
