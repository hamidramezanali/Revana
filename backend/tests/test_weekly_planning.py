# ruff: noqa: F811
"""Assessment and full weekly programme regressions using synthetic profiles only."""

from datetime import timedelta

from test_goal_workspace import create, run, workspace  # noqa: F401

from app import agent_provider, agent_store
from app.agent_models import (
    AssessmentDecision,
    GoalQuestion,
    ProgressionStep,
    WeeklyProgramme,
    WorkspaceDraft,
)
from app.coaching_graph import plan_issues
from app.coaching_tools import local_today


def respond(client, j, headers, **kwargs):
    return run(client, j, headers, action="continue", **kwargs)


def test_missing_timeline_asked_without_model_or_reasking_measurements(workspace):
    client, calls = workspace
    j, _h, _ = create(client, "I want strength and body habits. I am 175 cm and 86 kg.")
    assert j["workspace"]["question"]["key"] == "timeline"
    assert calls == []
    assert j["workspace"]["outcome"] == j["context"]["description"]
    assert j["workspace"]["question"]["fields"] == []


def test_adaptive_assessment_updates_date_and_builds_full_programme(workspace, monkeypatch):
    client, calls = workspace
    original = agent_provider.generate

    def adaptive(task, context, output, **kwargs):
        if output is AssessmentDecision:
            calls.append((task, context))
            answered = context["assessment"]["answered_keys"]
            if "experience" not in answered:
                return AssessmentDecision(
                    reply="Equipment and training experience change the exercise selection.",
                    question=GoalQuestion(
                        key="experience",
                        text="What strength training have you done, and what equipment can you use?",
                        why="Choose appropriate exercises.",
                        choices=[
                            "New to training; bodyweight only",
                            "Some experience; dumbbells",
                            "Regular gym access",
                        ],
                    ),
                    facts=[],
                    conflicts=[],
                )
            if "health" not in answered:
                return AssessmentDecision(
                    reply="Check relevant limitations before loading a session.",
                    question=GoalQuestion(
                        key="health",
                        text="Any injuries or movements that hurt?",
                        why="Adapt the session.",
                        choices=["None reported", "Some movements hurt", "Prefer not to say"],
                    ),
                    facts=[],
                    conflicts=[],
                )
            return AssessmentDecision(
                reply="Enough context to build the programme.",
                question=None,
                facts=[],
                conflicts=[],
            )
        result = original(task, context, output, **kwargs)
        if output is WorkspaceDraft:
            assert (
                context["goal_workspace"]["outcome"]
                == "Build strength without pursuing lower weight"
            )
            assert context["goal_workspace"]["target_date"]
            result.programme = WeeklyProgramme(
                weeks=8,
                outcome="Build strength",
                deadline_assessment="Review strength and tolerance over eight weeks; no promised body-weight change.",
                schedule_notes="Two training days separated by recovery.",
                success_signals=["More controlled repetitions at the same effort."],
                review_rule="Review after two weeks.",
                training_included=True,
            )
            base = result.actions[0]
            result.actions = []
            for i in range(5):
                action = base.model_copy(deep=True)
                action.id = f"action-{i}"
                action.title = f"Distinct practical action {i}"
                action.days = [i]
                result.actions.append(action)
            result.actions[0].exercises = [
                {
                    "name": "Supported squat",
                    "sets": 2,
                    "repetitions": "6 controlled repetitions",
                    "rest_seconds": 60,
                    "duration_minutes": None,
                    "instructions": "Use support and a comfortable range.",
                    "easier_alternative": "Sit to stand from a higher chair.",
                    "form_cues": ["Move slowly."],
                    "progression": "Add repetitions only after comfortable sessions.",
                }
            ]
            from app.agent_models import Exercise

            result.actions[0].exercises = [
                Exercise.model_validate(e) for e in result.actions[0].exercises
            ]
            result.actions[0].progression = [
                ProgressionStep(
                    week=2,
                    instruction="Build toward eight controlled repetitions.",
                    advance_when="Two comfortable sessions completed.",
                    if_difficult="Repeat the starting week or reduce range.",
                )
            ]
        return result

    monkeypatch.setattr(agent_provider, "generate", adaptive)
    j, h, token = create(client, "I want to improve strength. I am 175 cm and 86 kg.")
    question = j["workspace"]["question"]
    j, events = respond(
        client,
        j,
        h,
        question_id=question["id"],
        choices=["8 weeks"],
        text_values={"goal_outcome": "Build strength without pursuing lower weight"},
    )
    assert events[-1]["type"] == "complete"
    assert j["workspace"]["question"]["key"] == "experience"
    assert not j["proposal"]
    saved = agent_store.read(token)
    assert saved.context.target_date == (local_today(saved) + timedelta(days=56)).isoformat()
    assert len(calls) == 1
    j, _ = respond(
        client,
        j,
        h,
        question_id=j["workspace"]["question"]["id"],
        choices=["New to training; bodyweight only"],
    )
    assert j["workspace"]["question"]["key"] == "health"
    j, events = respond(
        client, j, h, question_id=j["workspace"]["question"]["id"], choices=["None reported"]
    )
    assert events[-1]["type"] == "complete", events
    assert j["workspace"]["assessment_complete"]
    assert len(j["proposal"]["actions"]) == 5
    assert j["proposal"]["programme"]["weeks"] == 8
    assert j["proposal"]["actions"][0]["exercises"][0]["rest_seconds"] == 60
    assert j["proposal"]["actions"][0]["progression"][0]["week"] == 2


def test_six_answer_bound_stops_without_seventh_question(workspace, monkeypatch):
    client, calls = workspace
    j, h, token = create(client, "Build strength in 8 weeks. I am 175 cm and 86 kg.")
    saved = agent_store.read(token)
    saved.workspace.assessment_count = 6
    saved.workspace.answered_keys = [
        "baseline",
        "timeline",
        "experience",
        "schedule",
        "health",
        "nutrition",
    ]
    saved = agent_store.save(token, saved, saved.revision)
    j, events = respond(
        client, saved.model_dump(mode="json"), h, message="Build with these answers."
    )
    assert events[-1]["type"] == "complete"
    assert j["workspace"]["question"] is None
    assert len(calls) == 2


def test_skip_timeline_and_finish_early_are_explicit(workspace):
    client, calls = workspace
    j, h, _ = create(client, "Improve dry skin")
    assert j["workspace"]["question"]["key"] == "timeline"
    j, events = run(
        client, j, h, question_id=j["workspace"]["question"]["id"], skipped=True, action="plan"
    )
    assert events[-1]["type"] == "complete"
    assert j["workspace"]["assessment_complete"]
    assert "skipped" in j["workspace"]["timeline_note"].lower()
    assert len(calls) == 2


def test_dates_and_field_injection_are_validated(workspace):
    client, calls = workspace
    j, h, _ = create(client, "Improve dry skin")
    q = j["workspace"]["question"]["id"]
    for extra in (
        {"text_values": {"target_date": "2020-01-01"}},
        {"text_values": {"other": "bad"}},
        {"text_values": {"target_date": "2030-01-01"}, "choices": ["4 weeks"]},
    ):
        response = client.post(
            "/v1/workspace/run",
            headers=h,
            json={"revision": j["revision"], "question_id": q, **extra},
        )
        assert response.status_code == 422, response.text
    assert not calls


def test_programme_validation_keeps_budget_and_exercise_quality(workspace):
    from test_agent import example_plan

    client, _ = workspace
    _, _, token = create(client, "Build strength")
    journey = agent_store.read(token)
    plan = example_plan()
    plan.programme = WeeklyProgramme(
        weeks=4,
        outcome="Build strength",
        deadline_assessment="Review in four weeks.",
        schedule_notes="Alternate sessions and recovery.",
        success_signals=["Comfortable sessions."],
        review_rule="Review tolerance.",
        training_included=True,
    )
    assert any("actual exercises" in issue for issue in plan_issues(journey, plan))
    from app.agent_models import Exercise

    plan.actions[0].exercises = [
        Exercise(
            name="Supported squat",
            sets=2,
            repetitions="6",
            instructions="Controlled comfortable range.",
            easier_alternative="Higher chair.",
        )
    ]
    issues = plan_issues(journey, plan)
    assert any("progression" in issue for issue in issues)
    assert any("rest intervals" in issue for issue in issues)


def test_long_detail_survives_plan_serialization(workspace):
    from test_agent import example_plan

    plan = example_plan()
    plan.actions[0].detail = "1. " + ("Detailed usable instructions. " * 180)
    assert 1000 < len(plan.actions[0].detail) < 8000
    from app.agent_models import Plan

    restored = Plan.model_validate(plan.model_dump(mode="json"))
    assert restored.actions[0].detail == plan.actions[0].detail


def test_explicit_available_time_is_captured_without_confusing_walk_duration(workspace):
    client, _ = workspace
    j, _, _ = create(client, "Build strength in 8 weeks. I have 45 minutes per day in total.")
    assert j["body"]["daily_minutes"] == 45
    j, _, _ = create(client, "I walk for 10 minutes per day and want a strength plan.")
    assert j["body"]["daily_minutes"] is None


def test_initial_numeric_answers_lead_to_timeline_then_adaptive_question(workspace, monkeypatch):
    client, calls = workspace
    j, h, _ = create(client, "I want to improve my weight and body habits.")
    assert j["workspace"]["question"]["key"] == "baseline"
    j, _events = respond(
        client,
        j,
        h,
        question_id=j["workspace"]["question"]["id"],
        values={"height_cm": 175, "weight_kg": 86},
    )
    assert j["workspace"]["question"]["key"] == "timeline"
    assert not calls
    assert not j["proposal"]


def test_timeline_is_not_silently_omitted_when_only_outcome_is_sent(workspace):
    client, _ = workspace
    j, h, _ = create(client, "Improve my skin")
    response = client.post(
        "/v1/workspace/run",
        headers=h,
        json={
            "revision": j["revision"],
            "question_id": j["workspace"]["question"]["id"],
            "text_values": {"goal_outcome": "Reduce stinging"},
        },
    )
    assert response.status_code == 422
    assert (
        client.get("/v1/workspace/state", headers=h).json()["workspace"]["question"]["key"]
        == "timeline"
    )
