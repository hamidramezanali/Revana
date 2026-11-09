from copy import deepcopy

import pytest
from fastapi import HTTPException
from test_agent import agent as agent_fixture
from test_agent import plan, start

from app import agent_provider, agent_store
from app.agent_models import ActionPreference, ReplacementAction, ReshuffleDraft

agent = agent_fixture


def setup_plan(client):
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    first = saved.plans[-1].plan.actions[0]
    saved.plans[-1].plan.actions.extend(
        [
            first.model_copy(
                update={
                    "id": "routine",
                    "title": "Simplify one routine",
                    "detail": "Keep your usual routine manageable.",
                }
            ),
            first.model_copy(
                update={
                    "id": "review",
                    "title": "Review one observation",
                    "detail": "Compare your observations at review time.",
                }
            ),
        ]
    )
    agent_store.save(access, saved, journey["revision"])
    return headers, client.get("/v1/agent/session", headers=headers).json()


def choose(client, headers, journey, action_id, choice):
    response = client.post(
        "/v1/agent/action-preferences",
        headers=headers,
        json={
            "revision": journey["revision"],
            "action_id": action_id,
            "choice": choice,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def revise(client, headers, journey, message=""):
    return client.post(
        "/v1/agent/reshuffle",
        headers=headers,
        json={
            "revision": journey["revision"],
            "message": message,
        },
    )


def draft_for(journey, source="routine"):
    base = journey["plans"][-1]["plan"]
    replacement = {
        **base["actions"][1],
        "id": "provider-id",
        "replaces_action_id": source,
        "title": "Try one practical alternative",
        "detail": "Use a different simple approach.",
    }
    return ReshuffleDraft(
        **{
            **base,
            "changes": "Keep the selected action and replace an unwanted step.",
            "actions": [ReplacementAction(**replacement)],
        }
    )


def test_preferences_persist_toggle_and_are_not_completions(agent):
    client, calls = agent
    headers, journey = setup_plan(client)
    calls_before = len(calls)
    journey = choose(client, headers, journey, "observe", "keep")
    assert journey["action_preferences"][-1]["choice"] == "keep"
    assert journey["completions"] == []
    journey = choose(client, headers, journey, "observe", "not_for_me")
    assert len(journey["action_preferences"]) == 1
    assert journey["action_preferences"][0]["choice"] == "not_for_me"
    assert client.get("/v1/agent/session", headers=headers).json() == journey
    journey = choose(client, headers, journey, "observe", "clear")
    assert journey["action_preferences"] == []
    assert len(calls) == calls_before


def test_reshuffle_keeps_exact_action_and_sends_problem_preferences_and_message(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    original = deepcopy(journey["plans"][-1])
    journey = choose(client, headers, journey, "observe", "keep")
    journey = choose(client, headers, journey, "routine", "not_for_me")
    captured = []

    def generate(task, context, output):
        captured.append(context)
        assert output is ReshuffleDraft
        return draft_for(journey)

    monkeypatch.setattr(agent_provider, "generate", generate)
    response = revise(client, headers, journey, "Make the remaining steps less time-consuming.")
    assert response.status_code == 200, response.text
    revised = response.json()
    assert revised["plans"][-1] == original
    assert revised["proposal"]["actions"][0] == original["plan"]["actions"][0]
    assert revised["proposal"]["actions"][1]["id"] not in {"provider-id", "routine"}
    assert len(revised["proposal"]["actions"]) == 2
    request = captured[0]["revision_request"]
    assert captured[0]["context"]["description"] == "Simpler routine"
    assert request["keep_unchanged"] == [original["plan"]["actions"][0]]
    assert request["not_for_me"] == [original["plan"]["actions"][1]]
    assert request["message"] == "Make the remaining steps less time-consuming."
    assert revised["plan_feedback"][-1]["kept_action_ids"] == ["observe"]
    accepted = client.post(
        "/v1/agent/accept", headers=headers, json={"revision": revised["revision"]}
    ).json()
    assert accepted["plans"][-1]["plan"]["actions"][0] == original["plan"]["actions"][0]
    assert any(
        item["plan_version"] == 2 and item["action_id"] == "observe" and item["choice"] == "keep"
        for item in accepted["action_preferences"]
    )


@pytest.mark.parametrize(
    "invalid",
    ["kept_source", "unknown_source", "repeat_rejected", "repeat_kept", "duplicate_source"],
)
def test_invalid_model_replacements_never_change_saved_plan(agent, monkeypatch, invalid):
    client, _ = agent
    headers, journey = setup_plan(client)
    journey = choose(client, headers, journey, "observe", "keep")
    journey = choose(client, headers, journey, "routine", "not_for_me")
    draft = draft_for(journey)
    if invalid == "kept_source":
        draft.actions[0].replaces_action_id = "observe"
    elif invalid == "unknown_source":
        draft.actions[0].replaces_action_id = "fabricated"
    elif invalid == "repeat_rejected":
        draft.actions[0].title = journey["plans"][-1]["plan"]["actions"][1]["title"]
    elif invalid == "repeat_kept":
        draft.actions[0].title = journey["plans"][-1]["plan"]["actions"][0]["title"]
    else:
        draft.actions.append(draft.actions[0].model_copy(update={"id": "second"}))
    monkeypatch.setattr(agent_provider, "generate", lambda *args: draft)
    assert revise(client, headers, journey).status_code == 502
    assert client.get("/v1/agent/session", headers=headers).json() == journey


def test_all_kept_and_empty_feedback_do_not_call_provider(agent):
    client, calls = agent
    headers, journey = setup_plan(client)
    calls_before = len(calls)
    assert revise(client, headers, journey).status_code == 422
    for action in journey["plans"][-1]["plan"]["actions"]:
        journey = choose(client, headers, journey, action["id"], "keep")
    assert revise(client, headers, journey).status_code == 409
    assert len(calls) == calls_before


def test_failed_generation_and_stale_choices_preserve_data(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    before = journey
    journey = choose(client, headers, journey, "routine", "not_for_me")
    assert revise(client, headers, before).status_code == 409

    def unavailable(*args):
        raise HTTPException(502, "Provider unavailable")

    monkeypatch.setattr(agent_provider, "generate", unavailable)
    assert revise(client, headers, journey).status_code == 502
    assert client.get("/v1/agent/session", headers=headers).json() == journey


def test_changed_choices_invalidate_proposal_and_discard_preserves_current_plan(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    original = deepcopy(journey["plans"])
    journey = choose(client, headers, journey, "routine", "not_for_me")
    monkeypatch.setattr(agent_provider, "generate", lambda *args: draft_for(journey))
    journey = revise(client, headers, journey).json()
    assert journey["proposal"] is not None
    journey = choose(client, headers, journey, "observe", "keep")
    assert journey["proposal"] is None
    assert (
        client.post(
            "/v1/agent/accept", headers=headers, json={"revision": journey["revision"]}
        ).status_code
        == 409
    )
    journey = revise(client, headers, journey).json()
    assert revise(client, headers, journey).status_code == 409
    discarded = client.post(
        "/v1/agent/discard-proposal", headers=headers, json={"revision": journey["revision"]}
    ).json()
    assert discarded["proposal"] is None
    assert discarded["plans"] == original


def test_other_plan_update_path_also_respects_keeps(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    journey = choose(client, headers, journey, "observe", "keep")
    journey = choose(client, headers, journey, "routine", "not_for_me")
    journey = client.post(
        "/v1/agent/checkins",
        headers=headers,
        json={"revision": journey["revision"], "message": "Less time."},
    ).json()
    expected = journey["plans"][-1]["plan"]["actions"][0]
    monkeypatch.setattr(agent_provider, "generate", lambda *args: draft_for(journey))
    result = plan(client, headers, journey)
    assert result.status_code == 200
    assert result.json()["proposal"]["actions"][0] == expected


def test_concurrent_preference_write_cannot_be_overwritten_by_generation(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    journey = choose(client, headers, journey, "routine", "not_for_me")
    access = headers["Authorization"].split()[1]

    def concurrent(task, context, output):
        saved = agent_store.read(access)
        saved.action_preferences.append(
            ActionPreference(plan_version=1, action_id="observe", choice="keep")
        )
        agent_store.save(access, saved, saved.revision)
        return draft_for(journey)

    monkeypatch.setattr(agent_provider, "generate", concurrent)
    assert revise(client, headers, journey).status_code == 409
    saved = client.get("/v1/agent/session", headers=headers).json()
    assert saved["proposal"] is None
    assert any(item["action_id"] == "observe" for item in saved["action_preferences"])
