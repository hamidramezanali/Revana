import os

import pytest
from fastapi.testclient import TestClient
from test_agent import example_plan

from app import agent_provider, agent_store
from app.agent_models import Decision, Plan
from app.config import get_settings
from app.main import create_app


@pytest.fixture
def runtime(monkeypatch):
    for name in ("REVANA_DATABASE_URL", "POSTGRES_URL", "DATABASE_URL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("REVANA_ENVIRONMENT", "production")
    monkeypatch.setenv("REVANA_OPENAI_API_KEY", "synthetic-only")
    monkeypatch.setenv("REVANA_OPENAI_MODEL", "synthetic-model")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def new_session(client):
    return client.post(
        "/v1/agent/sessions",
        headers={"Origin": "https://revana-test.example"},
        json={
            "context": {
                "goals": ["skin"],
                "description": "Synthetic hosted test",
                "target_date": "",
            },
            "consent": True,
        },
    )


def test_hosted_startup_health_and_clear_missing_database_error(runtime, monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Must not fall back to SQLite or spend on a provider call")

    monkeypatch.setattr(agent_store.sqlite3, "connect", forbidden)
    monkeypatch.setattr(agent_provider, "generate", forbidden)
    with TestClient(create_app(), base_url="https://revana-test.example") as client:
        assert client.get("/v1/health").status_code == 200
        response = client.get("/v1/agent/status")
        assert response.status_code == 503
        assert "DATABASE_URL" in response.json()["error"]["message"]
        assert new_session(client).status_code == 503


def test_hosted_blocks_unrelated_browser_origin(runtime):
    with TestClient(create_app(), base_url="https://revana-test.example") as client:
        response = client.get("/v1/agent/status", headers={"Origin": "https://unrelated.example"})
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "origin_denied"


def test_local_boundary_remains(runtime, monkeypatch):
    monkeypatch.delenv("VERCEL")
    monkeypatch.setenv("REVANA_ENVIRONMENT", "development")
    get_settings.cache_clear()
    with TestClient(create_app(), base_url="https://revana-test.example") as client:
        assert client.get("/v1/agent/status").status_code == 403


def test_hosted_postgres_sessions_remain_separate_and_mutations_resume(runtime, monkeypatch):
    url = os.environ.get("REVANA_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Requires an isolated test Postgres database")
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()

    def generate(task, context, output):
        return (
            example_plan()
            if output is Plan
            else Decision(summary="Ready", ready=True, questions=[])
        )

    monkeypatch.setattr(agent_provider, "generate", generate)
    with TestClient(create_app(), base_url="https://revana-test.example") as client:
        status = client.get("/v1/agent/status", headers={"Origin": "https://revana-test.example"})
        assert status.status_code == 200 and status.json()["mode"] == "hosted"
        assert status.json()["configured"] is True
        first = new_session(client)
        second = new_session(client)
        assert first.status_code == second.status_code == 200
        one, two = first.json(), second.json()
        assert one["token"] != two["token"]
        headers = {"Authorization": f"Bearer {one['token']}"}
        result = client.post(
            "/v1/agent/plan",
            headers=headers,
            json={
                "revision": one["journey"]["revision"],
                "preferences": {"sensitivities": [], "budget": "Low", "effort": "Low"},
            },
        )
        assert result.status_code == 200
        assert len(client.get("/v1/agent/session", headers=headers).json()["plans"]) == 1
        assert (
            client.get(
                "/v1/agent/session", headers={"Authorization": f"Bearer {two['token']}"}
            ).json()["plans"]
            == []
        )
        assert client.get("/v1/agent/session").status_code == 401
        assert (
            client.get(
                "/v1/agent/session", headers={"Authorization": "Bearer " + "x" * 40}
            ).status_code
            == 404
        )
        assert client.delete("/v1/agent/session", headers=headers).status_code == 204
        assert client.get("/v1/agent/session", headers=headers).status_code == 404


def test_hosted_missing_key_has_actionable_error(runtime, monkeypatch):
    monkeypatch.setattr(agent_store, "check_available", lambda: None)
    monkeypatch.setenv("REVANA_OPENAI_API_KEY", "")
    get_settings.cache_clear()
    with TestClient(create_app(), base_url="https://revana-test.example") as client:
        response = client.get("/v1/agent/status")
        assert response.status_code == 503
        assert "REVANA_OPENAI_API_KEY" in response.json()["error"]["message"]
        assert "REVANA_OPENAI_MODEL" not in response.json()["error"]["message"]


@pytest.mark.parametrize("model", [None, "", "  ", "custom-model"])
def test_hosted_uses_selected_terra_default_and_allows_override(runtime, monkeypatch, model):
    monkeypatch.setattr(agent_store, "check_available", lambda: None)
    if model is None:
        monkeypatch.delenv("REVANA_OPENAI_MODEL")
    else:
        monkeypatch.setenv("REVANA_OPENAI_MODEL", model)
    get_settings.cache_clear()
    expected = "custom-model" if model == "custom-model" else "gpt-6.1-terra"
    assert get_settings().openai_model == expected
    with TestClient(create_app(), base_url="https://revana-test.example") as client:
        response = client.get("/v1/agent/status")
        assert response.status_code == 200 and response.json()["configured"] is True
