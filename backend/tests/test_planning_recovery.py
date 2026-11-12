"""Bounded planning latency and explicit retry without repeated intake/generation."""

import pytest
from fastapi import HTTPException
from test_goal_workspace import create, run
from test_goal_workspace import workspace as workspace_fixture

from app import agent_provider, agent_store, workflow
from app.agent_models import AssessmentDecision, ReviewResult, WorkspaceDraft
from app.config import get_settings

workspace = workspace_fixture


def test_review_timeout_reuses_unchecked_draft_and_still_requires_review(workspace, monkeypatch):
    client, calls = workspace
    j, h, _ = create(client, "Improve dry skin")
    original = agent_provider.generate
    fail_review = True

    def generate(task, context, output, **kwargs):
        if output is ReviewResult and fail_review:
            raise HTTPException(502, "Checking the plan took too long.")
        return original(task, context, output, **kwargs)

    monkeypatch.setattr(agent_provider, "generate", generate)
    j, events = run(client, j, h)
    assert events[-1]["type"] == "error"
    checkpoint = j["workspace"]["review_draft"]
    assert checkpoint and not j["proposal"] and not j["plans"]
    assert j["workspace"]["assessment_complete"]
    assert (
        client.post("/v1/workspace/accept", headers=h, json={"revision": j["revision"]}).status_code
        == 409
    )
    fail_review = False
    j, events = run(client, j, h, action="retry")
    assert events[-1]["type"] == "complete", events
    assert len([task for task, _ in calls if task.startswith("[stage:planner]")]) == 1
    assert j["proposal"]["actions"] == checkpoint["actions"]
    assert j["workspace"]["review_draft"] is None
    assert not j["plans"]


def test_final_assessment_handoff_survives_planner_timeout(workspace, monkeypatch):
    client, _ = workspace
    j, h, token = create(client, "Improve dry skin")
    saved = agent_store.read(token)
    saved.workspace.question = None
    saved.workspace.timeline_note = "8 weeks"
    saved = agent_store.save(token, saved, saved.revision)
    j = saved.model_dump(mode="json")
    original = agent_provider.generate
    seen = []
    fail_plan = True

    def generate(task, context, output, **kwargs):
        seen.append(output)
        if output is AssessmentDecision:
            return AssessmentDecision(
                reply="Enough context.", question=None, facts=[], conflicts=[]
            )
        if output is WorkspaceDraft and fail_plan:
            raise HTTPException(502, "Building the plan took too long.")
        return original(task, context, output, **kwargs)

    monkeypatch.setattr(agent_provider, "generate", generate)
    j, events = run(client, j, h, action="continue")
    assert events[-1]["type"] == "error"
    assert j["workspace"]["assessment_complete"] is True
    fail_plan = False
    j, events = run(client, j, h, action="retry")
    assert events[-1]["type"] == "complete", events
    assert seen.count(AssessmentDecision) == 1


def test_role_budgets_respect_whole_run_deadline(monkeypatch):
    get_settings.cache_clear()
    assert get_settings().workflow_timeout_seconds == 270
    captured = []
    monkeypatch.setattr(
        agent_provider,
        "generate",
        lambda task, context, output: captured.append(context["_stage_timeout"]),
    )
    token = workflow._deadline.set(None)
    try:
        for role in ("planner", "reviewer", "coach"):
            workflow.stage(role, "test", {}, ReviewResult)
        assert captured == [120, 60, 45]
        monkeypatch.setattr(workflow, "monotonic", lambda: 100)
        workflow._deadline.set(112)
        workflow.stage("planner", "test", {}, ReviewResult)
        assert captured[-1] == 12
        workflow._deadline.set(101)
        with pytest.raises(HTTPException):
            workflow.stage("planner", "test", {}, ReviewResult)
    finally:
        workflow._deadline.reset(token)
        get_settings.cache_clear()
