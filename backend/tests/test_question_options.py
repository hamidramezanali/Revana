import json
from importlib.resources import files

import pytest
from pydantic import ValidationError
from test_agent import agent as agent_fixture
from test_agent import example_plan, plan, start

from app import agent_provider, agent_store
from app.agent_models import Decision, GeneratedDecision, GeneratedQuestion, Plan, Question

agent = agent_fixture


def respond(client, headers, journey, **payload):
    return client.post(
        "/v1/agent/answers",
        headers=headers,
        json={
            "revision": journey["revision"],
            "question_id": journey["decision"]["questions"][0]["id"],
            **payload,
        },
    )


def test_selections_and_text_reach_every_followup_and_plan(agent):
    client, calls = agent
    headers, journey = start(client)
    options = journey["decision"]["questions"][0]["options"]
    ids = [option["id"] for option in options[:2]]
    response = respond(
        client, headers, journey, selected_option_ids=ids, answer="Only in the evening."
    )
    assert response.status_code == 200
    journey = response.json()
    event = journey["events"][0]
    assert event["selected_options"] == ["Cleanser", "Moisturizer"]
    assert event["answer"] == "Only in the evening."
    assert event["skipped"] is False
    reported_event = {key: value for key, value in event.items() if key != "question_snapshot"}
    assert calls[-1][1]["events"][0] == reported_event
    assert "decision" not in calls[-1][1]
    assert plan(client, headers, journey).status_code == 200
    assert calls[-1][1]["events"][0] == reported_event
    assert calls[-1][1]["preferences"]["sensitivities"] == ["Sensitive skin"]
    assert "ONE coherent personal plan" in calls[-1][0]
    assert "decision" not in calls[-1][1]


@pytest.mark.parametrize(
    "kind", ["unknown", "duplicate", "single", "exclusive", "empty", "skip_with_answer"]
)
def test_invalid_choices_do_not_save_or_call_provider(agent, kind):
    client, calls = agent
    headers, journey = start(client)
    question = journey["decision"]["questions"][0]
    ids = [option["id"] for option in question["options"]]
    payload = {"selected_option_ids": ids[:2]}
    if kind == "unknown":
        payload = {"selected_option_ids": ["fabricated-id"]}
    elif kind == "duplicate":
        payload = {"selected_option_ids": [ids[0], ids[0]]}
    elif kind == "single":
        access = headers["Authorization"].split()[1]
        saved = agent_store.read(access)
        saved.decision.questions[0].selection_mode = "single"
        agent_store.save(access, saved, journey["revision"])
        journey = client.get("/v1/agent/session", headers=headers).json()
    elif kind == "exclusive":
        payload = {"selected_option_ids": [ids[0], ids[-1]]}
    elif kind == "empty":
        payload = {"answer": "   "}
    elif kind == "skip_with_answer":
        payload = {"answer": "Private input", "skipped": True}
    calls_before = len(calls)
    response = respond(client, headers, journey, **payload)
    assert response.status_code == 422
    assert "Private input" not in response.text
    assert len(calls) == calls_before
    assert client.get("/v1/agent/session", headers=headers).json() == journey


def test_selected_only_text_only_and_skip_are_distinct(agent):
    client, _ = agent
    headers, journey = start(client)
    chosen = journey["decision"]["questions"][0]["options"][0]["id"]
    journey = respond(client, headers, journey, selected_option_ids=[chosen]).json()
    assert journey["events"][-1]["selected_options"] == ["Cleanser"]
    journey = respond(client, headers, journey, answer="My own answer").json()
    assert journey["events"][-1]["selected_options"] == []
    assert journey["events"][-1]["answer"] == "My own answer"
    journey = respond(client, headers, journey, skipped=True).json()
    assert journey["events"][-1]["skipped"] is True
    assert journey["events"][-1]["answer"] == ""


def test_agent_can_stop_before_six_and_plan_keeps_all_answers(agent, monkeypatch):
    client, _calls = agent
    headers, journey = start(client)
    captured = []

    def finish(task, context, output):
        captured.append(context)
        if output is Plan:
            return example_plan()
        return Decision(
            summary="Enough information for a useful starting plan.", ready=True, questions=[]
        )

    monkeypatch.setattr(agent_provider, "generate", finish)
    journey = respond(
        client, headers, journey, answer="A complete description of my routine."
    ).json()
    assert journey["assessment_count"] == 1
    assert journey["decision"]["ready"]
    assert journey["decision"]["questions"] == []
    assert plan(client, headers, journey).status_code == 200
    assert captured[-1]["events"][0]["answer"] == "A complete description of my routine."


def test_legacy_saved_journey_stays_readable_without_options(agent):
    client, _ = agent
    headers, journey = start(client)
    access = headers["Authorization"].split()[1]
    question = journey["decision"]["questions"][0]
    del question["options"]
    del question["selection_mode"]
    with agent_store.connection() as db:
        db.execute(
            "UPDATE journeys SET body = ? WHERE key = ?",
            (json.dumps(journey), agent_store.key(access)),
        )
    restored = client.get("/v1/agent/session", headers=headers).json()
    assert restored["decision"]["questions"][0]["options"] == []
    assert respond(client, headers, restored, answer="A legacy typed answer.").status_code == 200


def test_generated_schema_requires_options_and_all_properties():
    schema = GeneratedDecision.model_json_schema()
    for model in [schema, *schema["$defs"].values()]:
        assert set(model.get("required", [])) == set(model.get("properties", {}))
        assert model["additionalProperties"] is False
    generated = schema["$defs"]["GeneratedQuestion"]
    assert generated["properties"]["options"]["minItems"] == 1
    assert "maxItems" not in generated["properties"]["options"]
    assert "ALL recorded answers" in files("app").joinpath("prompts/coach.md").read_text()


def test_duplicate_or_blank_option_labels_are_rejected():
    for label in ["  ", " cleanser "]:
        with pytest.raises(ValidationError):
            Question(
                id="q",
                text="Routine?",
                why="Avoid duplicates.",
                options=[
                    {"id": "one", "label": "Cleanser", "exclusive": False},
                    {"id": "two", "label": label, "exclusive": False},
                ],
            )


def test_legacy_question_gets_options_without_losing_answers_or_consuming_question(
    agent, monkeypatch
):
    client, _ = agent
    headers, _journey = start(client)
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    saved.decision.questions[0].options = []
    agent_store.save(access, saved, saved.revision)
    before = client.get("/v1/agent/session", headers=headers).json()
    question = before["decision"]["questions"][0]
    calls = []

    def options(task, context, output):
        calls.append(context)
        return GeneratedQuestion(
            id="generated",
            text="A changed wording must not overwrite the question.",
            why="A rationale",
            selection_mode="multiple",
            photo_mode="none",
            options=[
                {"id": str(i), "label": label, "exclusive": False}
                for i, label in enumerate(["Cleanser", "Moisturizer", "Another step"])
            ],
        )

    monkeypatch.setattr(agent_provider, "generate", options)
    result = client.post(
        "/v1/agent/question-options", headers=headers, json={"revision": before["revision"]}
    )
    assert result.status_code == 200
    after = result.json()
    upgraded = after["decision"]["questions"][0]
    assert upgraded["text"] == question["text"]
    assert upgraded["id"] == question["id"]
    assert len(upgraded["options"]) == 3
    assert after["assessment_count"] == before["assessment_count"]
    assert after["events"] == before["events"]
    assert (
        client.post(
            "/v1/agent/question-options", headers=headers, json={"revision": after["revision"]}
        ).json()
        == after
    )
    assert len(calls) == 1
