"""Goal-first regressions: no intake model roundtrip, streamed checked proposals, durable recovery."""

import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app import agent_provider, agent_store
from app.agent_models import ActionCheck, ReviewResult, WorkspaceDraft
from app.config import get_settings
from app.main import create_app


@pytest.fixture
def workspace(monkeypatch, tmp_path):
    monkeypatch.setenv("REVANA_DATABASE_PATH", str(tmp_path / "goals.sqlite3"))
    for name in ("REVANA_DATABASE_URL", "POSTGRES_URL", "DATABASE_URL"):
        monkeypatch.delenv(name, raising=False)
    get_settings.cache_clear()
    calls = []

    def generate(task, context, output, **kwargs):
        calls.append((task, context))
        if output is WorkspaceDraft:
            return WorkspaceDraft(
                reply="Start with an achievable meal structure and movement you enjoy.",
                facts=[],
                conflicts=[],
                clarification=None,
                summary="A practical, non-restrictive starting week.",
                reported=["Wants weight management"],
                hypotheses=[],
                uncertainties=["Activity unknown"],
                safety_notes=["Adjust if uncomfortable."],
                review_days=14,
                changes="Start simply.",
                actions=[
                    {
                        "id": "walk",
                        "category": "Body",
                        "title": "Walk after lunch",
                        "detail": "Try a comfortable short walk after lunch on three days.",
                        "why": "A convenient movement opportunity.",
                        "timing": "After lunch",
                        "cost": "No added cost",
                        "effort": "Low",
                        "observation": "Comfort and fit",
                        "minutes": 10,
                        "days": [0, 2, 4],
                    }
                ],
            )
        if output is ReviewResult:
            return ReviewResult(
                approved=True,
                issues=[],
                correction="",
                limitations=[],
                suggested_starts=[],
                action_checks=[
                    ActionCheck(
                        action_id=a["id"],
                        status="compatible",
                        reason="Synthetic review",
                        source_ids=[],
                    )
                    for a in context["draft"]["actions"]
                ],
            )
        raise AssertionError(output)

    monkeypatch.setattr(agent_provider, "generate", generate)
    with TestClient(create_app()) as client:
        yield client, calls
    get_settings.cache_clear()


def create(client, text="I want to lose weight"):
    r = client.post("/v1/workspace/goals", json={"message": text, "consent": True})
    assert r.status_code == 200, r.text
    data = r.json()
    return data["journey"], {"Authorization": f"Bearer {data['token']}"}, data["token"]


def run(client, j, headers, **payload):
    r = client.post(
        "/v1/workspace/run", headers=headers, json={"revision": j["revision"], **payload}
    )
    assert r.status_code == 200, r.text
    events = [json.loads(line[6:]) for line in r.text.splitlines() if line.startswith("data: ")]
    return events[-1]["journey"], events


def test_weight_goal_is_immediate_and_relevant(workspace):
    client, calls = workspace
    j, h, _ = create(client)
    assert calls == []
    assert j["context"]["goals"] == ["body"]
    q = j["workspace"]["question"]
    assert q["fields"] == ["height_cm", "weight_kg"]
    assert q["photo_mode"] == "none"
    j, events = run(client, j, h, question_id=q["id"], values={"height_cm": 175, "weight_kg": 86})
    assert events[-1]["type"] == "complete", events
    assert len(calls) == 2
    assert j["body"]["height_cm"] == 175
    assert j["workspace"]["question"] is None
    assert not j["plans"] and j["proposal"]
    assert [e["type"] for e in events] == [
        "started",
        "stage",
        "stage",
        "draft",
        "stage",
        "stage",
        "complete",
    ]
    assert calls[0][1]["body_context"]["weight_kg"] == 86
    assert client.get("/v1/workspace/state", headers=h).json()["proposal"] == j["proposal"]
    accepted = client.post("/v1/workspace/accept", headers=h, json={"revision": j["revision"]})
    assert accepted.status_code == 200, accepted.text
    saved = accepted.json()
    assert len(saved["plans"]) == 1 and saved["proposal"] is None
    assert saved["workspace"]["messages"] == [] and saved["events"] == []


def test_skip_not_repeated_and_measurements_not_invented(workspace):
    client, calls = workspace
    j, h, _ = create(client, "I want to lose 30 kg")
    assert j["body"]["weight_kg"] is None
    j, events = run(client, j, h, question_id=j["workspace"]["question"]["id"], skipped=True)
    assert events[-1]["type"] == "complete"
    assert j["workspace"]["question"] is None
    assert j["body"]["weight_kg"] is None
    assert "baseline" in j["workspace"]["answered_keys"]
    assert calls[0][1]["goal_workspace"]["answered_clarifications"] == ["baseline"]


def test_provided_baseline_and_bad_input(workspace):
    client, calls = workspace
    j, _h, _ = create(client, "I am 175 cm and 86 kg, age 34. I want to lose weight.")
    assert j["workspace"]["question"] is None
    assert j["body"]["age"] == 34
    assert calls == []
    other, oh, _ = create(client)
    q = other["workspace"]["question"]
    r = client.post(
        "/v1/workspace/run",
        headers=oh,
        json={"revision": other["revision"], "question_id": q["id"], "values": {"weight_kg": 2}},
    )
    assert r.status_code == 422
    assert calls == []
    r = client.post(
        "/v1/workspace/run",
        headers=oh,
        json={"revision": other["revision"], "question_id": "stale", "message": "hello"},
    )
    assert r.status_code == 409
    assert client.get("/v1/workspace/state").status_code in (401, 403)


def test_cancel_prevents_late_draft(workspace, monkeypatch):
    client, _ = workspace
    j, h, token = create(client, "Improve dry skin")
    original = agent_provider.generate

    def cancel(task, context, output, **kwargs):
        if output is WorkspaceDraft:
            from app.agent_models import RevisionRequest
            from app.goal_workspace import cancel_run

            cancel_run(RevisionRequest(revision=0), token)
        return original(task, context, output, **kwargs)

    monkeypatch.setattr(agent_provider, "generate", cancel)
    j, events = run(client, j, h, action="plan")
    assert events[-1]["type"] == "cancelled"
    assert j["proposal"] is None
    assert j["workspace"]["run"]["status"] == "cancelled"


def test_failure_and_abandoned_run_are_recoverable(workspace, monkeypatch):
    client, _ = workspace
    j, h, token = create(client, "Improve dry skin")

    def fail(*args, **kwargs):
        raise RuntimeError("Private provider details must not leak")

    monkeypatch.setattr(agent_provider, "generate", fail)
    j, events = run(client, j, h, action="plan")
    assert events[-1]["type"] == "error"
    assert "Private" not in events[-1]["message"]
    assert j["workspace"]["run"]["status"] == "failed"
    from app.agent_models import GoalRun

    saved = agent_store.read(token)
    saved.workspace.run = GoalRun(
        id="abandoned", status="running", started_at=datetime.now(UTC) - timedelta(seconds=200)
    )
    saved.workspace.phase = "running"
    agent_store.save(token, saved, saved.revision)
    restored = client.get("/v1/workspace/state", headers=h).json()
    assert restored["workspace"]["run"]["status"] == "failed"


def test_kept_habit_is_inserted_unchanged_before_review(workspace, monkeypatch):
    client, _ = workspace
    j, h, _ = create(client, "Improve dry skin")
    j, _ = run(client, j, h, action="plan")
    j = client.post("/v1/workspace/accept", headers=h, json={"revision": j["revision"]}).json()
    old = j["plans"][-1]["plan"]["actions"][0]
    j = client.post(
        "/v1/agent/action-preferences",
        headers=h,
        json={"revision": j["revision"], "action_id": old["id"], "choice": "keep"},
    ).json()
    original = agent_provider.generate
    checked = []

    def revised(task, context, output, **kwargs):
        result = original(task, context, output, **kwargs)
        if output is WorkspaceDraft:
            result.actions[0].detail = "Model changed this despite the user's keep"
        if output is ReviewResult:
            checked.extend(context["draft"]["actions"])
        return result

    monkeypatch.setattr(agent_provider, "generate", revised)
    j, events = run(client, j, h, message="Keep my chosen habit and review my plan.")
    assert events[-1]["type"] == "complete", events
    assert j["proposal"]["actions"][0] == old
    assert checked[0] == old
    assert j["plans"][-1]["plan"]["actions"][0] == old


def test_known_fields_not_reasked_and_failed_review_not_accepted(workspace, monkeypatch):
    client, _ = workspace
    j, h, _ = create(client, "I weigh 86 kg and I am 175 cm. I want to lose weight.")
    original = agent_provider.generate

    def questions(task, context, output, **kwargs):
        result = original(task, context, output, **kwargs)
        if output is WorkspaceDraft:
            from app.agent_models import GoalQuestion

            result.clarification = GoalQuestion(
                key="other", text="What is your height?", why="Redundant", fields=["height_cm"]
            )
        return result

    monkeypatch.setattr(agent_provider, "generate", questions)
    j, events = run(client, j, h, action="plan")
    assert events[-1]["type"] == "complete"
    assert j["workspace"]["question"] is None
    saved_token = h["Authorization"].removeprefix("Bearer ")
    saved = agent_store.read(saved_token)
    saved.workflow.status = "needs_review"
    saved = agent_store.save(saved_token, saved, saved.revision)
    r = client.post("/v1/workspace/accept", headers=h, json={"revision": saved.revision})
    assert r.status_code == 409


def test_workspace_preserves_network_origin_and_body_limits(workspace):
    client, calls = workspace
    r = client.post(
        "/v1/workspace/goals",
        headers={"origin": "https://unrelated.invalid"},
        json={"message": "Lose weight", "consent": True},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "origin_denied"
    r = client.post(
        "/v1/workspace/goals",
        headers={"host": "public.invalid"},
        json={"message": "Lose weight", "consent": True},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "local_only"
    r = client.post(
        "/v1/workspace/run", content=b"x" * 4_000_001, headers={"content-type": "application/json"}
    )
    assert r.status_code == 413
    assert calls == []


def test_disconnect_after_started_cancels_before_late_output(workspace):
    import asyncio

    from app.agent_models import WorkRequest
    from app.goal_workspace import run_goal

    client, _ = workspace
    j, _, token = create(client, "Improve dry skin")

    async def disconnect():
        response = run_goal(WorkRequest(revision=j["revision"], action="plan"), token)
        first = await anext(response.body_iterator)
        assert '"type": "started"' in first
        await response.body_iterator.aclose()
        # Give the worker its first opportunity to see the persisted cancellation.
        await asyncio.sleep(0)

    asyncio.run(disconnect())
    saved = agent_store.read(token)
    assert saved.workspace.run.status == "cancelled"
    assert saved.proposal is None
