from copy import deepcopy

import pytest
from fastapi import HTTPException
from test_agent import agent as agent_fixture
from test_agent import example_plan, plan, start
from test_plan_preferences import setup_plan
from test_suggestions import batch, more, pick

from app import agent_provider, agent_store
from app.agent_models import Decision, GeneratedQuestion, Plan, SuggestionBatch

agent = agent_fixture


def clarification():
    return SuggestionBatch(
        reply=(
            "I hear that you want a change this week. I can help with practical habits, "
            "but cannot promise 3 kg of fat loss in a week. Which route fits you?"
        ),
        questions=[
            GeneratedQuestion(
                id="provider-question",
                text="Which area would you like practical options for?",
                why="Choose the route you want to explore.",
                selection_mode="multiple",
                photo_mode="none",
                options=[
                    {"id": str(i), "label": label, "exclusive": False}
                    for i, label in enumerate(
                        [
                            "Meal planning",
                            "Drinks",
                            "Walking",
                            "Strength",
                            "Sleep",
                            "Shopping",
                            "Snacks",
                            "Professional support",
                        ]
                    )
                ],
            )
        ],
        actions=[],
        safety_notes=["Avoid crash diets or dehydration."],
    )


def respond(client, headers, journey, **payload):
    return client.post(
        "/v1/agent/suggestions",
        headers=headers,
        json={
            "revision": journey["revision"],
            "question_id": journey["suggestion_board"]["pending_question"]["id"],
            **payload,
        },
    )


def test_latest_message_and_choices_drive_conversation_without_replacing_plan(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    journey = pick(client, headers, journey, "observe", "keep").json()
    before = deepcopy(journey)
    captured = []

    def generate(task, context, output):
        assert output is SuggestionBatch
        captured.append((task, context))
        if len(captured) == 1:
            return clarification()
        result = batch(journey)
        result.actions = [
            result.actions[0].model_copy(
                update={
                    "title": f"Concrete alternative {i}",
                    "detail": f"Practical step {i}",
                }
            )
            for i in range(7)
        ]
        return result

    monkeypatch.setattr(agent_provider, "generate", generate)
    response = more(client, headers, journey, "I want to lose 3 kg in a week. Give me options.")
    assert response.status_code == 200
    journey = response.json()
    board = journey["suggestion_board"]
    question = board["pending_question"]
    assert len(question["options"]) == 8
    assert question["id"] != "provider-question"
    assert board["suggestions"] == before["suggestion_board"]["suggestions"]
    assert board["kept"] == before["suggestion_board"]["kept"]
    assert "3 kg" in board["conversation"][-1]["reply"]
    task, context = captured[-1]
    assert "LATEST" in task and "never private chain-of-thought" in task
    assert (
        context["current_request"]["message"] == "I want to lose 3 kg in a week. Give me options."
    )
    selected = question["options"][:7]
    response = respond(
        client,
        headers,
        journey,
        selected_option_ids=[option["id"] for option in selected],
        message="Low impact, please.",
    )
    assert response.status_code == 200
    journey = response.json()
    board = journey["suggestion_board"]
    assert len(board["suggestions"]) == 7
    assert len({a["id"] for a in board["suggestions"]}) == 7
    assert board["pending_question"] is None
    assert board["conversation"][-1]["selected_answers"] == [o["label"] for o in selected]
    request = captured[-1][1]["suggestion_request"]
    assert request["message"] == "Low impact, please."
    assert request["selected_answers"] == [o["label"] for o in selected]
    assert "Professional support" not in str(request)
    assert journey["plans"] == before["plans"] and journey["completions"] == []
    assert board["kept"] == before["suggestion_board"]["kept"]
    assert client.get("/v1/agent/session", headers=headers).json() == journey


@pytest.mark.parametrize(
    "failure",
    ["unknown", "duplicate", "exclusive", "single", "stale", "empty", "skip_with_text", "provider"],
)
def test_invalid_and_failed_coach_answers_preserve_question_and_saved_choices(
    agent, monkeypatch, failure
):
    client, _ = agent
    headers, journey = setup_plan(client)
    monkeypatch.setattr(agent_provider, "generate", lambda *args: clarification())
    journey = more(client, headers, journey, "Give me a choice").json()
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    if failure == "exclusive":
        saved.suggestion_board.pending_question.options[0].exclusive = True
    if failure == "single":
        saved.suggestion_board.pending_question.selection_mode = "single"
    agent_store.save(access, saved, saved.revision)
    journey = client.get("/v1/agent/session", headers=headers).json()
    options = journey["suggestion_board"]["pending_question"]["options"]
    payload = {"selected_option_ids": [o["id"] for o in options[:2]]}
    if failure == "unknown":
        payload = {"selected_option_ids": ["invented"]}
    if failure == "duplicate":
        payload = {"selected_option_ids": [options[0]["id"]] * 2}
    if failure == "stale":
        payload = {"question_id": "stale", "message": "Answer"}
    if failure == "empty":
        payload = {}
    if failure == "skip_with_text":
        payload = {"skipped": True, "message": "PRIVATE"}
    calls = []

    def generate(*args):
        calls.append(args)
        raise HTTPException(502, "Synthetic failure")

    monkeypatch.setattr(agent_provider, "generate", generate)
    response = respond(client, headers, journey, **payload)
    assert response.status_code == (
        502 if failure == "provider" else 409 if failure == "stale" else 422
    )
    assert "PRIVATE" not in response.text
    assert len(calls) == (1 if failure == "provider" else 0)
    assert client.get("/v1/agent/session", headers=headers).json() == journey


def test_skip_and_free_text_pivot_are_explicit_and_conversation_reaches_plan(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    monkeypatch.setattr(agent_provider, "generate", lambda *args: clarification())
    journey = more(client, headers, journey, "I need choices").json()
    journey = respond(client, headers, journey, skipped=True).json()
    assert journey["suggestion_board"]["conversation"][-1]["skipped"]
    captured = []

    def generate(task, context, output):
        captured.append(context)
        if output is Plan:
            return example_plan()
        if output is SuggestionBatch:
            return batch(journey)
        return Decision(summary="Enough is known.", ready=True, questions=[])

    monkeypatch.setattr(agent_provider, "generate", generate)
    journey = more(client, headers, journey, "Actually, focus on getting stronger.").json()
    assert journey["suggestion_board"]["pending_question"] is None
    assert journey["suggestion_board"]["conversation"][-1]["selected_answers"] == []
    journey = client.post(
        "/v1/agent/checkins",
        headers=headers,
        json={
            "revision": journey["revision"],
            "message": "Use my new goal, with gentle movement.",
        },
    )
    assert journey.status_code == 200
    journey = journey.json()
    assert plan(client, headers, journey).status_code == 200
    assert "Actually, focus on getting stronger." in str(captured[-1]["coach_conversation"])
    assert captured[-1]["current_request"]["message"] == "Use my new goal, with gentle movement."
    assert all("options" not in turn for turn in captured[-1]["coach_conversation"])
    assert "Professional support" not in str(captured[-1]["coach_conversation"])


def test_assessment_accepts_more_than_six_choices_and_status_has_no_cycle_cap(agent):
    client, _ = agent
    headers, journey = start(client)
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    saved.decision.questions = clarification().questions
    agent_store.save(access, saved, saved.revision)
    journey = client.get("/v1/agent/session", headers=headers).json()
    question = journey["decision"]["questions"][0]
    result = client.post(
        "/v1/agent/answers",
        headers=headers,
        json={
            "revision": journey["revision"],
            "question_id": question["id"],
            "selected_option_ids": [o["id"] for o in question["options"]],
        },
    )
    assert result.status_code == 200
    assert len(result.json()["events"][-1]["selected_options"]) == 8
    status = client.get("/v1/agent/status").json()
    assert status["max_questions"] is None and status["max_checkin_questions"] is None
