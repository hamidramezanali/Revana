from copy import deepcopy

import pytest
from fastapi import HTTPException
from test_agent import agent as agent_fixture
from test_plan_preferences import choose, setup_plan

from app import agent_provider, agent_store
from app.agent_models import SuggestionBatch

agent = agent_fixture


def pick(client, headers, journey, action_id, choice):
    return client.post(
        "/v1/agent/suggestion-choice",
        headers=headers,
        json={"revision": journey["revision"], "action_id": action_id, "choice": choice},
    )


def more(client, headers, journey, message=""):
    return client.post(
        "/v1/agent/suggestions",
        headers=headers,
        json={"revision": journey["revision"], "message": message},
    )


def batch(journey, suffix="new"):
    action = deepcopy(journey["plans"][-1]["plan"]["actions"][0])
    action.update(
        id="provider-id", title=f"Alternative {suffix}", detail=f"Different detail {suffix}"
    )
    return SuggestionBatch(
        reply="Here is an alternative that fits your latest request.",
        questions=[],
        actions=[action],
        safety_notes=["Review persistent concerns."],
    )


def test_keep_moves_to_separate_persistent_list_without_completing_or_changing_plan(agent):
    client, calls = agent
    headers, journey = setup_plan(client)
    original = deepcopy(journey["plans"])
    calls_before = len(calls)
    journey = pick(client, headers, journey, "observe", "keep").json()
    board = journey["suggestion_board"]
    assert board["kept"] == [original[-1]["plan"]["actions"][0]]
    assert [a["id"] for a in board["suggestions"]] == ["routine", "review"]
    assert journey["plans"] == original and journey["completions"] == []
    assert len(calls) == calls_before
    assert client.get("/v1/agent/session", headers=headers).json() == journey
    journey = pick(client, headers, journey, "observe", "clear").json()
    assert journey["suggestion_board"]["kept"] == []
    journey = pick(client, headers, journey, "observe", "not_for_me").json()
    assert "observe" in journey["suggestion_board"]["rejected_ids"]
    assert all(a["id"] != "observe" for a in journey["suggestion_board"]["suggestions"])


def test_fresh_batches_preserve_kept_exactly_and_include_feedback(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    original = deepcopy(journey["plans"])
    journey = pick(client, headers, journey, "observe", "keep").json()
    journey = pick(client, headers, journey, "routine", "not_for_me").json()
    captured = []

    def generate(task, context, output):
        assert output is SuggestionBatch
        captured.append(context)
        return batch(journey, str(len(captured)))

    monkeypatch.setattr(agent_provider, "generate", generate)
    for _ in range(2):
        response = more(client, headers, journey, "Less effort please")
        assert response.status_code == 200, response.text
        journey = response.json()
        assert journey["suggestion_board"]["kept"] == [original[-1]["plan"]["actions"][0]]
        assert len(journey["suggestion_board"]["suggestions"]) == 1
        assert journey["plans"] == original and journey["proposal"] is None
    request = captured[-1]["suggestion_request"]
    assert request["message"] == "Less effort please"
    assert request["not_for_me"][0]["id"] == "routine"
    assert len(request["previously_shown"]) == 4
    assert captured[-1]["context"]["description"] == "Simpler routine"
    new_id = journey["suggestion_board"]["suggestions"][0]["id"]
    assert new_id != "provider-id"
    journey = pick(client, headers, journey, new_id, "keep").json()
    completed = client.post(
        "/v1/agent/actions",
        headers=headers,
        json={
            "revision": journey["revision"],
            "action_id": new_id,
            "completed": True,
        },
    )
    assert completed.status_code == 200


def test_generate_without_votes_or_when_all_kept_and_migrate_old_choices(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    for action in journey["plans"][-1]["plan"]["actions"]:
        journey = choose(client, headers, journey, action["id"], "keep")
    monkeypatch.setattr(agent_provider, "generate", lambda *args: batch(journey))
    result = more(client, headers, journey)
    assert result.status_code == 200
    board = result.json()["suggestion_board"]
    assert len(board["kept"]) == 3 and len(board["suggestions"]) == 1
    journey = result.json()
    # No votes or feedback on the latest batch are needed to request another one.
    monkeypatch.setattr(agent_provider, "generate", lambda *args: batch(journey, "next"))
    assert more(client, headers, journey).status_code == 200


@pytest.mark.parametrize("failure", ["repeat", "duplicate", "provider", "concurrent"])
def test_invalid_or_failed_batches_never_lose_choices(agent, monkeypatch, failure):
    client, _ = agent
    headers, journey = setup_plan(client)
    journey = pick(client, headers, journey, "observe", "keep").json()

    def generate(*args):
        result = batch(journey)
        if failure == "repeat":
            result.actions[0].title = journey["plans"][-1]["plan"]["actions"][0]["title"]
        if failure == "duplicate":
            result.actions.append(result.actions[0].model_copy())
        if failure == "provider":
            raise HTTPException(502, "Unavailable")
        if failure == "concurrent":
            assert pick(client, headers, journey, "routine", "keep").status_code == 200
        return result

    monkeypatch.setattr(agent_provider, "generate", generate)
    assert more(client, headers, journey).status_code == (409 if failure == "concurrent" else 502)
    saved = client.get("/v1/agent/session", headers=headers).json()
    if failure == "concurrent":
        assert len(saved["suggestion_board"]["kept"]) == 2
    else:
        assert saved == journey
    assert pick(client, headers, journey, "unknown", "keep").status_code in (409, 422)


def test_stale_revisions_do_not_generate_but_old_round_limit_no_longer_applies(agent, monkeypatch):
    client, _calls = agent
    headers, journey = setup_plan(client)
    before = journey
    journey = pick(client, headers, journey, "observe", "keep").json()
    assert more(client, headers, before).status_code == 409
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    saved.suggestion_board.rounds = 50
    agent_store.save(access, saved, saved.revision)
    journey = client.get("/v1/agent/session", headers=headers).json()
    monkeypatch.setattr(agent_provider, "generate", lambda *args: batch(journey))
    result = more(client, headers, journey)
    assert result.status_code == 200
    assert result.json()["suggestion_board"]["rounds"] == 51


def test_no_votes_needed_for_first_batch(agent, monkeypatch):
    client, _ = agent
    headers, journey = setup_plan(client)
    monkeypatch.setattr(agent_provider, "generate", lambda *args: batch(journey))
    response = more(client, headers, journey)
    assert response.status_code == 200
    assert response.json()["suggestion_board"]["kept"] == []


def test_legacy_rejections_and_new_choices_stay_consistent(agent):
    client, _ = agent
    headers, journey = setup_plan(client)
    journey = choose(client, headers, journey, "observe", "keep")
    journey = choose(client, headers, journey, "routine", "not_for_me")
    journey = pick(client, headers, journey, "observe", "not_for_me").json()
    assert journey["suggestion_board"]["kept"] == []
    assert set(journey["suggestion_board"]["rejected_ids"]) == {"observe", "routine"}
    assert all(p["choice"] == "not_for_me" for p in journey["action_preferences"])
