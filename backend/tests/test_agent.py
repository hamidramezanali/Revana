import json
import os

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import agent_provider, agent_store
from app.agent_models import Decision, Plan, Question
from app.config import get_settings
from app.main import create_app


def example_plan():
    return Plan(
        summary="Keep your routine simple.",
        reported=["User wants a simpler routine."],
        hypotheses=["Fewer steps may be easier to maintain."],
        uncertainties=["Reactions unknown."],
        safety_notes=["Persistent concerns need qualified assessment."],
        review_days=14,
        changes="Start with one observation.",
        actions=[
            {
                "id": "observe",
                "category": "Routine",
                "title": "Record one observation",
                "detail": "Note comfort after your usual routine.",
                "why": "Establish a baseline.",
                "timing": "This evening",
                "cost": "No added cost",
                "effort": "Low",
                "observation": "Comfort or irritation",
            }
        ],
    )


@pytest.fixture(
    params=["sqlite"] + (["postgres"] if os.environ.get("REVANA_TEST_DATABASE_URL") else [])
)
def agent(monkeypatch, tmp_path, request):
    monkeypatch.setenv("REVANA_DATABASE_PATH", str(tmp_path / "journeys.sqlite3"))
    for name in ("REVANA_DATABASE_URL", "POSTGRES_URL", "DATABASE_URL"):
        monkeypatch.delenv(name, raising=False)
    if request.param == "postgres":
        monkeypatch.setenv("REVANA_DATABASE_URL", os.environ["REVANA_TEST_DATABASE_URL"])
    get_settings.cache_clear()
    calls = []

    def generate(task, context, output):
        calls.append((task, context))
        if output is Plan:
            return example_plan()
        return Decision(
            summary="Based on your answers.",
            ready=False,
            questions=[
                Question(
                    id="provider-id",
                    text=f"What is your routine detail {len(context['events']) + 1}?",
                    why="Avoid suggesting duplicate steps.",
                    options=[
                        {"id": "cleanser", "label": "Cleanser", "exclusive": False},
                        {"id": "moisturizer", "label": "Moisturizer", "exclusive": False},
                        {"id": "unsure", "label": "Not sure", "exclusive": True},
                    ],
                    selection_mode="multiple",
                )
            ],
        )

    monkeypatch.setattr(agent_provider, "generate", generate)
    with TestClient(create_app()) as client:
        yield client, calls
    get_settings.cache_clear()


def start(client):
    response = client.post(
        "/v1/agent/sessions",
        json={
            "context": {"goals": ["skin"], "description": "Simpler routine", "target_date": ""},
            "consent": True,
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    return {"Authorization": f"Bearer {payload['token']}"}, payload["journey"]


def answer(client, headers, journey):
    return client.post(
        "/v1/agent/answers",
        headers=headers,
        json={
            "revision": journey["revision"],
            "question_id": journey["decision"]["questions"][0]["id"],
            "answer": "My sensitive private answer",
        },
    )


def plan(client, headers, journey):
    return client.post(
        "/v1/agent/plan",
        headers=headers,
        json={
            "revision": journey["revision"],
            "preferences": {"sensitivities": ["Sensitive skin"], "budget": "Low", "effort": "Low"},
        },
    )


def test_assessment_continues_past_old_question_cap_and_keeps_context(agent):
    client, calls = agent
    headers, journey = start(client)
    for _ in range(8):
        response = answer(client, headers, journey)
        assert response.status_code == 200
        journey = response.json()
    assert journey["assessment_count"] == 8
    assert not journey["decision"]["ready"]
    assert journey["decision"]["questions"]
    assert len(calls) == 9
    assert calls[1][1]["events"][0]["answer"] == "My sensitive private answer"


def test_plan_checkin_proposal_accept_resume_delete(agent):
    client, _ = agent
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()  # Early finish is allowed.
    original = journey["plans"][0]
    response = client.post(
        "/v1/agent/checkins",
        headers=headers,
        json={"revision": journey["revision"], "message": "Less time now"},
    )
    journey = response.json()
    assert journey["mode"] == "checkin"
    for _ in range(5):
        journey = answer(client, headers, journey).json()
    assert journey["checkin_count"] == 5
    assert journey["decision"]["questions"]
    journey = plan(client, headers, journey).json()
    assert journey["proposal"] is not None
    assert journey["plans"] == [original]
    response = client.post(
        "/v1/agent/accept", headers=headers, json={"revision": journey["revision"]}
    )
    journey = response.json()
    assert len(journey["plans"]) == 2
    assert journey["proposal"] is None
    assert client.get("/v1/agent/session", headers=headers).json() == journey
    assert plan(client, headers, journey).status_code == 409
    assert client.delete("/v1/agent/session", headers=headers).status_code == 204
    assert client.get("/v1/agent/session", headers=headers).status_code == 404


def test_stale_replay_and_private_errors(agent):
    client, _ = agent
    headers, journey = start(client)
    assert answer(client, headers, journey).status_code == 200
    assert answer(client, headers, journey).status_code == 409
    assert client.get("/v1/agent/session").status_code == 401
    other_headers, _ = start(client)
    assert client.get("/v1/agent/session", headers=other_headers).json()["events"] == []
    invalid = client.post(
        "/v1/agent/answers",
        headers=headers,
        json={"revision": -1, "question_id": "x", "answer": "PRIVATE"},
    )
    assert invalid.status_code == 422
    assert "PRIVATE" not in invalid.text
    assert client.get("/v1/agent/session", headers=headers).headers["cache-control"] == "no-store"


def test_provider_failure_does_not_save_answer(agent, monkeypatch):
    client, _ = agent
    headers, journey = start(client)

    def failure(*args):
        raise HTTPException(502, "Agent unavailable")

    monkeypatch.setattr(agent_provider, "generate", failure)
    assert answer(client, headers, journey).status_code == 502
    assert client.get("/v1/agent/session", headers=headers).json() == journey


def test_consent_origin_and_network_boundary(agent):
    client, _ = agent
    assert client.post("/v1/agent/sessions", json={"consent": False}).status_code == 422
    assert (
        client.get("/v1/agent/status", headers={"Origin": "https://untrusted.example"}).status_code
        == 403
    )
    assert client.get("http://public.example/v1/agent/status").status_code == 403


def test_store_compares_revision_and_hashes_token(agent):
    client, _ = agent
    headers, _journey = start(client)
    token = headers["Authorization"].split()[1]
    saved = agent_store.read(token)
    agent_store.save(token, saved, 0)
    with pytest.raises(HTTPException) as error:
        agent_store.save(token, saved, 0)
    assert error.value.status_code == 409
    with agent_store.connection() as db:
        stored_key = db.execute("SELECT key FROM journeys").fetchone()[0]
    assert stored_key != token


def test_provider_payload_and_failure_redaction(monkeypatch):
    monkeypatch.setenv("REVANA_OPENAI_API_KEY", "private-key")
    monkeypatch.setenv("REVANA_OPENAI_MODEL", "configured-model")
    get_settings.cache_clear()
    original_client = httpx.Client
    captured = []

    def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {"type": "output_text", "text": example_plan().model_dump_json()}
                        ],
                    }
                ],
            },
        )

    monkeypatch.setattr(
        httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(handler))
    )
    result = agent_provider.generate("Make plan", {"answer": "private answer"}, Plan)
    assert result == example_plan()
    assert captured[0]["store"] is False
    assert captured[0]["model"] == "configured-model"
    assert captured[0]["text"]["format"]["strict"] is True
    assert "private-key" not in json.dumps(captured)

    def broken(request):
        return httpx.Response(429, text="private upstream content")

    monkeypatch.setattr(
        httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(broken))
    )
    with pytest.raises(HTTPException) as error:
        agent_provider.generate("Make plan", {}, Plan)
    assert error.value.status_code == 502
    assert "private" not in error.value.detail
    get_settings.cache_clear()


def test_action_completion_persists_and_is_scoped_to_plan(agent):
    client, _ = agent
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    response = client.post(
        "/v1/agent/actions",
        headers=headers,
        json={
            "revision": journey["revision"],
            "action_id": "observe",
            "completed": True,
        },
    )
    assert response.status_code == 200
    journey = response.json()
    assert journey["completions"][0]["plan_version"] == 1
    assert (
        client.get("/v1/agent/session", headers=headers).json()["completions"]
        == journey["completions"]
    )
    invalid = client.post(
        "/v1/agent/actions",
        headers=headers,
        json={
            "revision": journey["revision"],
            "action_id": "not-in-plan",
            "completed": True,
        },
    )
    assert invalid.status_code == 422
    response = client.post(
        "/v1/agent/actions",
        headers=headers,
        json={
            "revision": journey["revision"],
            "action_id": "observe",
            "completed": False,
        },
    )
    assert response.json()["completions"] == []


def test_repeated_question_is_not_saved(agent, monkeypatch):
    client, _ = agent
    headers, journey = start(client)
    previous = journey["decision"]["questions"][0]
    monkeypatch.setattr(
        agent_provider,
        "generate",
        lambda *args: Decision(summary="Repeated", ready=False, questions=[Question(**previous)]),
    )
    assert answer(client, headers, journey).status_code == 502
    assert client.get("/v1/agent/session", headers=headers).json() == journey


def test_missing_configuration_does_not_create_a_journey(agent, monkeypatch):
    client, _ = agent
    monkeypatch.setenv("REVANA_OPENAI_API_KEY", "")
    monkeypatch.setenv("REVANA_OPENAI_MODEL", "")
    get_settings.cache_clear()
    # Restore the real adapter to exercise its configuration gate.
    import importlib

    real_generate = importlib.reload(agent_provider).generate
    monkeypatch.setattr(agent_provider, "generate", real_generate)
    result = client.post(
        "/v1/agent/sessions",
        json={
            "context": {"goals": ["hair"], "description": "", "target_date": ""},
            "consent": True,
        },
    )
    assert result.status_code == 503


@pytest.mark.parametrize("limitations", ["", "Avoid fragranced products", "x" * 800])
def test_limitations_reach_provider_and_survive_resume(agent, limitations):
    client, calls = agent
    headers, journey = start(client)
    preferences = {
        "sensitivities": [],
        "budget": "Low",
        "effort": "Low",
        "limitations": limitations,
    }
    response = client.post(
        "/v1/agent/plan",
        headers=headers,
        json={"revision": journey["revision"], "preferences": preferences},
    )
    assert response.status_code == 200
    assert calls[-1][1]["preferences"]["limitations"] == limitations
    resumed = client.get("/v1/agent/session", headers=headers).json()
    assert resumed["preferences"]["limitations"] == limitations


def test_overlong_limitations_leave_journey_unchanged(agent):
    client, calls = agent
    headers, journey = start(client)
    count = len(calls)
    response = client.post(
        "/v1/agent/plan",
        headers=headers,
        json={
            "revision": journey["revision"],
            "preferences": {
                "sensitivities": [],
                "budget": "Low",
                "effort": "Low",
                "limitations": "x" * 801,
            },
        },
    )
    assert response.status_code == 422
    assert len(calls) == count
    assert client.get("/v1/agent/session", headers=headers).json() == journey
