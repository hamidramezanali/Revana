import pytest
from fastapi import HTTPException
from test_agent import agent as agent_fixture
from test_agent import answer, plan, start

from app import agent_provider, agent_store
from app.agent_models import FitOptions

agent = agent_fixture


def edit(client, headers, journey, index=0, **payload):
    event = journey["events"][index]
    question = event["question_snapshot"]
    return client.post(
        "/v1/agent/answers",
        headers=headers,
        json={
            "revision": journey["revision"],
            "event_index": index,
            "question_id": question["id"] if question else f"legacy-{index}",
            "answer": "Updated answer",
            **payload,
        },
    )


def test_edit_replaces_dependent_answers_and_recounts_budget(agent):
    client, calls = agent
    headers, journey = start(client)
    for _ in range(6):
        journey = answer(client, headers, journey).json()
    first_question = journey["events"][0]["question_snapshot"]
    response = edit(
        client,
        headers,
        journey,
        selected_option_ids=[first_question["options"][0]["id"]],
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["assessment_count"] == 1
    assert len(updated["events"]) == 1
    assert updated["events"][0]["answer"] == "Updated answer"
    assert updated["events"][0]["selected_options"] == ["Cleanser"]
    assert calls[-1][1]["events"][0]["answer"] == "Updated answer"
    assert "question_snapshot" not in calls[-1][1]["events"][0]
    assert len(updated["decision"]["questions"]) == 1
    assert client.get("/v1/agent/session", headers=headers).json() == updated
    assert edit(client, headers, journey).status_code == 409  # Stale revision.


def test_invalid_edit_and_provider_failure_preserve_saved_answers(agent, monkeypatch):
    client, _ = agent
    headers, journey = start(client)
    for _ in range(2):
        journey = answer(client, headers, journey).json()
    assert edit(client, headers, journey, selected_option_ids=["invented"]).status_code == 422
    assert edit(client, headers, journey, question_id="wrong").status_code == 409

    def fail(*args, **kwargs):
        raise HTTPException(502, "Synthetic provider failure")

    monkeypatch.setattr(agent_provider, "generate", fail)
    assert edit(client, headers, journey).status_code == 502
    assert client.get("/v1/agent/session", headers=headers).json() == journey


def test_edit_legacy_text_only_and_skip(agent):
    client, _ = agent
    headers, journey = start(client)
    journey = answer(client, headers, journey).json()
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    saved.events[0].question_snapshot = None
    agent_store.save(access, saved, saved.revision)
    journey = client.get("/v1/agent/session", headers=headers).json()
    response = edit(client, headers, journey, skipped=True, answer="")
    assert response.status_code == 200
    assert response.json()["events"][0]["skipped"]
    assert response.json()["assessment_count"] == 1


def test_edit_only_current_checkin_and_preserve_accepted_plan(agent):
    client, _ = agent
    headers, journey = start(client)
    journey = answer(client, headers, journey).json()
    journey = plan(client, headers, journey).json()
    accepted = journey["plans"]
    assert edit(client, headers, journey).status_code == 409
    journey = client.post(
        "/v1/agent/checkins",
        headers=headers,
        json={"revision": journey["revision"], "message": "A new preference"},
    ).json()
    for _ in range(2):
        journey = answer(client, headers, journey).json()
    assert edit(client, headers, journey, index=0).status_code == 409
    response = edit(client, headers, journey, index=2)
    assert response.status_code == 200
    journey = response.json()
    assert journey["checkin_count"] == 1
    assert journey["assessment_count"] == 1
    assert journey["plans"] == accepted
    assert journey["events"][1]["kind"] == "checkin"
    journey = plan(client, headers, journey).json()
    assert edit(client, headers, journey, index=2).status_code == 409


@pytest.mark.parametrize(
    "goals,description",
    [
        (["body"], "I want to lose weight with manageable habits."),
        (["skin", "hair"], "I want a simple product routine."),
        (["other"], "I want to lose weight; not skin advice."),
    ],
)
def test_tailored_fit_options_use_actual_request_without_saving_choices(
    agent,
    monkeypatch,
    goals,
    description,
):
    client, _calls = agent
    response = client.post(
        "/v1/agent/sessions",
        json={
            "context": {"goals": goals, "description": description, "target_date": ""},
            "consent": True,
        },
    )
    created = response.json()
    headers = {"Authorization": f"Bearer {created['token']}"}
    journey = answer(client, headers, created["journey"]).json()
    captured = []

    def generate(task, context, output):
        captured.append((task, context, output))
        return FitOptions(
            options=["Food allergies or dietary restrictions"],
            limitations_hint="Foods you avoid or movement limits relevant to your goal…",
        )

    monkeypatch.setattr(agent_provider, "generate", generate)
    response = client.post(
        "/v1/agent/fit-options",
        headers=headers,
        json={"revision": journey["revision"]},
    )
    assert response.status_code == 200
    task, context, output = captured[0]
    assert context["context"] == journey["context"]
    assert context["events"][0]["answer"] == journey["events"][0]["answer"]
    assert "do not ask about skin/scalp" in task
    assert output is FitOptions
    assert client.get("/v1/agent/session", headers=headers).json() == journey
    assert (
        client.post(
            "/v1/agent/fit-options",
            headers=headers,
            json={"revision": 0},
        ).status_code
        == 409
    )
    assert len(captured) == 1
