"""Provider payload size, round-trip safety, focused edits and numeric diagnostics."""

import json

import httpx
import pytest
from test_agent import example_plan
from test_goal_workspace import create, run
from test_goal_workspace import workspace as workspace_fixture

from app import agent_provider, performance
from app.agent_models import Meal, MealIngredient, ReviewResult, WorkspaceDraft
from app.planning_wire import (
    IdeaRefinement,
    PlanRepair,
    WeeklyPlanDraft,
    apply_repair,
    compact_context,
    compact_meals,
    expand_weekly,
)

workspace = workspace_fixture


def week():
    data = example_plan().model_dump(mode="json")
    data["meals"] = [
        Meal(
            day=day,
            slot=slot,
            title="Prepared meal",
            ingredients=[MealIngredient(food_id=553, grams=100)],
            instructions="Prepare the listed ingredients.",
            preparation_minutes=5,
            substitution_note="Use tolerated foods.",
            storage="Follow local food safety guidance.",
        ).model_dump(mode="json")
        for day in range(7)
        for slot in ("breakfast", "lunch", "dinner")
    ]
    return WorkspaceDraft(**data, reply="A useful plan.", facts=[], conflicts=[])


def test_recipe_compression_is_lossless_and_references_are_verified():
    draft = week()
    compact = compact_meals(draft.model_dump(mode="json"))
    assert len(compact["recipes"]) == 1 and len(compact["meal_schedule"]) == 21
    assert len(json.dumps(compact)) < len(draft.model_dump_json()) * 0.5
    assert expand_weekly(WeeklyPlanDraft.model_validate(compact)) == draft
    compact["meal_schedule"][0]["recipe_key"] = "missing"
    with pytest.raises(ValueError):
        expand_weekly(WeeklyPlanDraft.model_validate(compact))


def test_compaction_keeps_health_answer_provenance_and_review_scope():
    draft = week().model_dump(mode="json")
    ctx = {
        "plan_feedback": [{"message": "Synthetic adverse response"}],
        "completions": [{"action_id": "observe", "completed": True}],
        "goal_workspace": {},
        "body_guidance": {"constraints": ["Do not restrict"]},
        "reported_profile": [{"value": "Synthetic allergy"}],
        "reports_by_source": {"event-1": "Neither"},
        "events": [
            {"source_id": "1", "question": "Which foods do you avoid?", "photo_notes": None},
            {
                "source_id": "2",
                "question": "Products",
                "photo_notes": {"confirmed": True, "observations": ["Reviewed label"]},
            },
        ],
        "selected_idea": {"action_id": "observe", "intent": "details", "base": draft},
        "plans": [{"plan": draft}],
        "draft": draft,
        "actions_to_check": draft["actions"],
    }
    result = compact_context(ctx, "reviewer")
    assert "plans" not in result and "actions_to_check" not in result
    assert result["additional_actions_to_check"] == []
    assert result["selected_idea"] == {"action_id": "observe", "intent": "details"}
    for key in (
        "body_guidance",
        "reported_profile",
        "reports_by_source",
        "plan_feedback",
        "completions",
    ):
        assert result[key] == ctx[key]
    assert result["answer_context"][0]["question"] == "Which foods do you avoid?"
    assert len(result["confirmed_visual_notes"]) == 1
    assert len(result["verified_meal_nutrition"]) == 21
    selected = compact_context(ctx, "planner")
    assert len(selected["fixed_plan_constraints"]["meal_plan"]["meal_schedule"]) == 21
    assert len(selected["fixed_plan_constraints"]["meal_plan"]["recipes"]) == 1
    assert ctx["selected_idea"]["base"] == draft  # never mutate application-owned context


def test_partial_repair_preserves_unmodified_artifacts_and_rejects_bad_references():
    original = week()
    changed = original.actions[0].model_copy(update={"detail": "A corrected instruction."})
    repaired = apply_repair(
        original.model_dump(mode="json"),
        PlanRepair(actions=[changed], changes="Corrected instruction.", reply="Adjusted one item."),
    )
    assert repaired.meals == original.meals
    assert repaired.actions[0].detail == "A corrected instruction."
    assert repaired.safety_notes == original.safety_notes
    with pytest.raises(ValueError):
        apply_repair(
            original.model_dump(mode="json"),
            PlanRepair(remove_action_ids=["missing"], changes="Invalid.", reply="Invalid."),
        )


def test_provider_uses_compact_wire_format_and_records_only_numeric_diagnostics(monkeypatch):
    monkeypatch.setenv("REVANA_OPENAI_API_KEY", "synthetic-key")
    monkeypatch.setenv("REVANA_OPENAI_MODEL", "configured-model")
    from app.config import get_settings

    get_settings.cache_clear()
    draft = week()
    captured = []
    original_client = httpx.Client

    def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "usage": {"input_tokens": 100, "output_tokens": 50},
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": json.dumps(compact_meals(draft.model_dump(mode="json"))),
                            }
                        ],
                    }
                ],
            },
        )

    monkeypatch.setattr(
        httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(handler))
    )
    token = performance.start()
    try:
        result = agent_provider.generate(
            "[stage:planner] Synthetic test",
            {"goal_workspace": {}, "private_test_marker": "Not a telemetry value"},
            WorkspaceDraft,
        )
        assert result == draft
        assert captured[0]["text"]["format"]["name"] == "WeeklyPlanDraft"
        metrics = performance.snapshot()
        assert metrics["calls"][0]["input_tokens"] == 100
        assert "Not a telemetry value" not in json.dumps(metrics)
        assert "synthetic-key" not in json.dumps(metrics)
    finally:
        performance.reset(token)
        get_settings.cache_clear()


def test_failed_frozen_neighbour_is_not_repeatedly_replanned(workspace, monkeypatch):
    from test_goal_workspace import two_idea_draft

    client, _ = workspace
    j, h, _ = two_idea_draft(client)
    original = agent_provider.generate
    calls = []

    def generate(task, context, output, **kwargs):
        calls.append(output)
        result = original(task, context, output, **kwargs)
        if output is ReviewResult:
            result.approved = False
            result.correction = "The fixed other action needs review."
            for check in result.action_checks:
                if check.action_id != "walk":
                    check.status = "needs_review"
        return result

    monkeypatch.setattr(agent_provider, "generate", generate)
    saved, events = run(client, j, h, action_id="walk", idea_intent="details")
    assert events[-1]["type"] == "error"
    assert calls == [IdeaRefinement, ReviewResult]
    assert saved["proposal"] == j["proposal"]
    assert saved["workspace"]["run"]["performance"]["storage_operations"] > 0


def test_full_plan_correction_is_a_patch_followed_by_whole_plan_review(workspace, monkeypatch):
    client, _ = workspace
    j, h, _ = create(client, "Improve my routine")
    original = agent_provider.generate
    calls = []

    def generate(task, context, output, **kwargs):
        calls.append(output)
        if output is PlanRepair:
            action = WorkspaceDraft.model_validate(context["previous_draft"]).actions[0]
            action.detail = "1. Choose a suitable time.\n2. Record comfort and convenience."
            return PlanRepair(
                actions=[action],
                changes="Made instructions concrete.",
                reply="Refined the instructions.",
            )
        result = original(task, context, output, **kwargs)
        if output is ReviewResult and calls.count(ReviewResult) == 1:
            result.approved = False
            result.correction = "Make the first instruction concrete."
            result.action_checks[0].status = "needs_review"
        return result

    monkeypatch.setattr(agent_provider, "generate", generate)
    j, events = run(client, j, h, action="plan")
    assert events[-1]["type"] == "complete", events
    assert calls == [WorkspaceDraft, ReviewResult, PlanRepair, ReviewResult]
    assert j["proposal"]["actions"][0]["detail"].startswith("1. Choose")
    assert not j["plans"]
