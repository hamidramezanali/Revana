"""Visual body goals are preferences, never measurements or automatic plan changes."""

from copy import deepcopy

from test_goal_workspace import create, run
from test_goal_workspace import workspace as workspace_fixture

from app import agent_store
from app.coaching_tools import body_guidance

workspace = workspace_fixture
CHOICE = {
    "direction": "recomposition",
    "areas": [
        {"area": "waist", "intention": "reduce_size", "note": ""},
        {"area": "glutes", "intention": "build_muscle", "note": ""},
    ],
    "priority_area": "glutes",
}


def test_body_goals_persist_and_reach_planner_and_reviewer(workspace):
    client, calls = workspace
    j, h, token = create(client, "Improve my body composition")
    assert j["context"]["goals"] == ["body"]
    before = deepcopy(j["body"])
    r = client.post(
        "/v1/workspace/body-goals",
        headers=h,
        json={"revision": j["revision"], "body_goals": CHOICE},
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert not calls
    assert j["body_goals"] == CHOICE and j["body"] == before
    assert client.get("/v1/workspace/state", headers=h).json()["body_goals"] == CHOICE
    j, events = run(client, j, h, action="plan")
    assert events[-1]["type"] == "complete", events
    assert all(ctx["body_goals"]["priority_area"] == "glutes" for _, ctx in calls)
    assert all(ctx["body_goals"]["source"] == "user_selected_preferences" for _, ctx in calls)
    assert j["body"] == before
    assert not j["profile"]
    assert body_guidance(agent_store.read(token))["calorie_deficit_allowed"] is False


def test_edit_clears_unchecked_work_preserves_accepted_plan_and_answers(workspace):
    client, _ = workspace
    j, h, token = create(client, "Improve strength")
    j, _ = run(client, j, h)
    j = client.post("/v1/workspace/accept", headers=h, json={"revision": j["revision"]}).json()
    old = deepcopy(j["plans"])
    saved = agent_store.read(token)
    saved.workspace.assessment_count = 4
    saved.workspace.answered_keys = ["timeline", "nutrition", "health"]
    saved = agent_store.save(token, saved, saved.revision)
    r = client.post(
        "/v1/workspace/body-goals",
        headers=h,
        json={"revision": saved.revision, "body_goals": CHOICE},
    )
    j = r.json()
    assert j["plans"] == old and j["proposal"] is None
    assert j["workspace"]["review_draft"] is None
    assert j["workspace"]["assessment_count"] == 4
    assert j["workspace"]["answered_keys"] == ["timeline", "nutrition", "health"]
    assert j["workflow"]["status"] == "needs_review"
    assert (
        client.post(
            "/v1/workspace/body-goals",
            headers=h,
            json={"revision": saved.revision, "body_goals": CHOICE},
        ).status_code
        == 409
    )


def test_invalid_or_unowned_body_goals_rejected(workspace):
    client, _ = workspace
    j, h, _ = create(client, "Improve body habits")
    for invalid in (
        {**CHOICE, "priority_area": "arms"},
        {**CHOICE, "areas": CHOICE["areas"] * 2},
        {**CHOICE, "areas": [{"area": "waist", "intention": "other"}]},
        {**CHOICE, "areas": [{"area": "face", "intention": "reduce_size"}]},
    ):
        assert (
            client.post(
                "/v1/workspace/body-goals",
                headers=h,
                json={"revision": j["revision"], "body_goals": invalid},
            ).status_code
            == 422
        )
    assert (
        client.post(
            "/v1/workspace/body-goals", json={"revision": j["revision"], "body_goals": CHOICE}
        ).status_code
        == 401
    )
    skin, sh, _ = create(client, "Improve dry skin")
    assert (
        client.post(
            "/v1/workspace/body-goals",
            headers=sh,
            json={"revision": skin["revision"], "body_goals": CHOICE},
        ).status_code
        == 422
    )


def test_body_map_cannot_change_a_running_goal_or_remove_safety_constraints(workspace):
    from datetime import UTC, datetime

    from app.agent_models import GoalRun

    client, _ = workspace
    _j, h, token = create(client, "Improve body composition")
    saved = agent_store.read(token)
    saved.body.height_cm = 175
    saved.body.weight_kg = 58.5
    saved.body.age = 34
    saved.body.pregnancy = "not_applicable"
    saved.workspace.run = GoalRun(id="working", status="running", started_at=datetime.now(UTC))
    saved = agent_store.save(token, saved, saved.revision)
    request = {"revision": saved.revision, "body_goals": {**CHOICE, "direction": "reduce_fat"}}
    assert client.post("/v1/workspace/body-goals", headers=h, json=request).status_code == 409
    saved.workspace.run.status = "cancelled"
    saved = agent_store.save(token, saved, saved.revision)
    request["revision"] = saved.revision
    assert client.post("/v1/workspace/body-goals", headers=h, json=request).status_code == 200
    assert (
        body_guidance(agent_store.read(token))["weight_management_appropriate_to_discuss"] is False
    )
