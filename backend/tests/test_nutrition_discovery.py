"""Nutrition-first planning and private-query-free method discovery regressions."""

from copy import deepcopy
from datetime import UTC, datetime

from test_goal_workspace import create, run
from test_goal_workspace import workspace as workspace_fixture

from app import agent_provider, agent_store, research
from app.agent_models import (
    AlternativeMethod,
    Meal,
    MealIngredient,
    MethodSynthesis,
    NutritionPlan,
    PrepSession,
    ResearchResult,
    ResearchSource,
)
from app.coaching_graph import plan_issues
from app.coaching_tools import body_guidance

workspace = workspace_fixture


def test_low_bmi_deficit_is_blocked_but_balanced_meal_prep_is_supported(workspace):
    from test_agent import example_plan

    client, _ = workspace
    _, _, token = create(client, "Improve my food routine")
    j = agent_store.read(token)
    j.body.age = 34
    j.body.height_cm = 175
    j.body.weight_kg = 58.5
    j.body.pregnancy = "not_applicable"
    p = example_plan()
    p.nutrition = NutritionPlan(
        focus="Practical lunches",
        energy_strategy="deficit_discussion",
        energy_explanation="Energy balance.",
        meal_pattern="Regular lunches.",
        portion_approach="Satisfying portions.",
    )
    assert body_guidance(j)["calorie_deficit_allowed"] is False
    assert body_guidance(j)["weight_management_appropriate_to_discuss"] is False
    assert any("deficit" in issue for issue in plan_issues(j, p))
    p.nutrition.energy_strategy = "balanced"
    assert not plan_issues(j, p)
    j.body.weight_kg = 86
    assert body_guidance(j)["weight_management_appropriate_to_discuss"] is True
    assert body_guidance(j)["calorie_deficit_allowed"] is False


def test_batch_prep_is_counted_once_with_real_meal_links_and_calories(workspace):
    from test_agent import example_plan

    client, _ = workspace
    _, _, token = create(client, "Prepare lunches")
    j = agent_store.read(token)
    j.body.daily_minutes = 30
    p = example_plan()
    p.actions[0].minutes = 5
    p.meals = [
        Meal(
            day=0,
            slot="lunch",
            title="Lunch",
            ingredients=[MealIngredient(food_id=553, grams=100)],
            instructions="Prepare the listed portion.",
            preparation_minutes=5,
            substitution_note="Choose tolerated foods.",
            storage="Follow chilled-food guidance.",
        )
    ]
    p.nutrition = NutritionPlan(
        focus="Lunch prep",
        energy_strategy="balanced",
        energy_explanation="Not a daily calorie target.",
        meal_pattern="Lunches.",
        portion_approach="Adjust to appetite.",
        prep_sessions=[
            PrepSession(
                day=0,
                minutes=25,
                title="Batch prep",
                steps=["Prepare the meal components."],
                storage="Cool and refrigerate promptly.",
                meal_keys=["0-lunch"],
            )
        ],
    )
    assert any("time budget" in issue for issue in plan_issues(j, p))
    p.nutrition.prep_sessions[0].minutes = 15
    assert not plan_issues(j, p)
    assert p.meals[0].nutrition.kcal == 95
    p.nutrition.prep_sessions[0].meal_keys = ["2-dinner"]
    assert any("actual scheduled meal" in issue for issue in plan_issues(j, p))


def install_discovery(monkeypatch, queries, *, unsupported=False, unavailable=False):
    original = agent_provider.generate

    def retrieve(intent, *, allowed_domains=None):
        queries.append((intent.query, intent.kind, allowed_domains))
        if unavailable:
            return ResearchResult(status="unavailable", summary="No usable sources.")
        service = intent.kind == "service"
        return ResearchResult(
            status="retrieved",
            summary="A retrieved public finding.",
            sources=[
                ResearchSource(
                    id="source-1",
                    title="Public listing" if service else "Primary evidence",
                    url="https://www.bokadirekt.se/places/example-clinic-123"
                    if service
                    else "https://www.aad.org/public/cosmetic/safety",
                    retrieved_at=datetime.now(UTC),
                    kind=intent.kind,
                    applicability="Generic topic.",
                    uncertainty="Not personal suitability.",
                )
            ],
        )

    def generate(task, context, output, **kwargs):
        if output is MethodSynthesis:
            source_id = context["evidence_sources"][0]["id"]
            return MethodSynthesis(
                summary="Compare the options with a qualified professional.",
                alternatives=[
                    AlternativeMethod(
                        title="Professional assessment",
                        approach="professional",
                        rationale="Clarify the issue before a procedure.",
                        suitability="consider",
                        evidence_summary="Evidence has limits.",
                        risks=["Suitability is unknown."],
                        practical_next_step="Discuss with an appropriately qualified professional.",
                        evidence_ids=["invented"] if unsupported else [source_id],
                    )
                ],
                limitations=["Not a diagnosis."],
            )
        return original(task, context, output, **kwargs)

    monkeypatch.setattr(research, "retrieve", retrieve)
    monkeypatch.setattr(agent_provider, "generate", generate)


def test_discovery_searches_minimal_topics_and_keeps_accepted_plan_unchanged(
    workspace, monkeypatch
):
    client, _ = workspace
    j, h, _token = create(
        client, "Synthetic private note: Alice has redness, age 34, 175 cm and 86 kg."
    )
    j, _ = run(client, j, h, action="plan")
    j = client.post("/v1/workspace/accept", headers=h, json={"revision": j["revision"]}).json()
    original_plan = deepcopy(j["plans"])
    original_review = deepcopy(j["workflow"])
    queries = []
    install_discovery(monkeypatch, queries)
    j, events = run(
        client,
        j,
        h,
        action="research",
        research_topic="laser_skin",
        research_city="Stockholm",
        research_services=True,
    )
    assert events[-1]["type"] == "complete", events
    report = j["workspace"]["method_reports"][-1]
    assert report["status"] == "ready"
    assert report["alternatives"][0]["suitability"] == "assessment_required"
    assert len(report["evidence"]) == len(report["listings"]) == 1
    assert j["plans"] == original_plan and j["proposal"] is None
    assert j["workflow"] == original_review
    joined = " ".join(q[0] for q in queries)
    assert "Alice" not in joined and "175" not in joined and "86" not in joined
    assert "Stockholm" in joined
    assert any(q[2] == ["bokadirekt.se"] for q in queries)
    assert (
        client.get("/v1/workspace/state", headers=h).json()["workspace"]["method_reports"]
        == j["workspace"]["method_reports"]
    )


def test_unsupported_methods_and_failed_searches_do_not_become_suggestions(workspace, monkeypatch):
    client, _ = workspace
    j, h, _ = create(client, "Improve my skin")
    queries = []
    install_discovery(monkeypatch, queries, unsupported=True)
    j, events = run(
        client, j, h, action="research", research_topic="skin_options", research_services=False
    )
    assert events[-1]["type"] == "complete"
    assert not j["workspace"]["method_reports"][-1]["alternatives"]
    install_discovery(monkeypatch, queries, unavailable=True)
    j, events = run(
        client, j, h, action="research", research_topic="skin_options", research_services=True
    )
    report = j["workspace"]["method_reports"][-1]
    assert report["status"] == "unavailable"
    assert not report["alternatives"] and not report["listings"]
    assert report["browse_url"].startswith("https://www.bokadirekt.se/")


def test_research_city_topic_and_answer_injection_are_rejected(workspace, monkeypatch):
    client, _ = workspace
    j, h, _ = create(client, "Improve my skin")
    queries = []
    install_discovery(monkeypatch, queries)
    for payload in (
        {"research_topic": "nutrition"},
        {"research_topic": "laser_skin", "research_city": "Alice home address"},
        {"research_topic": "laser_skin", "message": "Private profile text"},
    ):
        response = client.post(
            "/v1/workspace/run",
            headers=h,
            json={"revision": j["revision"], "action": "research", **payload},
        )
        assert response.status_code == 422, response.text
    assert queries == []


def test_discovery_can_be_cancelled_without_changing_plan_or_saving_report(workspace, monkeypatch):
    client, _ = workspace
    j, h, token = create(client, "Improve my skin")
    queries = []
    install_discovery(monkeypatch, queries)
    original = agent_provider.generate

    def cancel(task, context, output, **kwargs):
        if output is MethodSynthesis:
            from app.agent_models import RevisionRequest
            from app.goal_workspace import cancel_run

            cancel_run(RevisionRequest(revision=0), token)
        return original(task, context, output, **kwargs)

    monkeypatch.setattr(agent_provider, "generate", cancel)
    j, events = run(client, j, h, action="research", research_topic="laser_skin")
    assert events[-1]["type"] == "cancelled"
    assert not j["workspace"]["method_reports"] and j["proposal"] is None


def test_numerical_calorie_prescription_is_rejected_even_when_labelled_balanced(workspace):
    from test_agent import example_plan

    client, _ = workspace
    _, _, token = create(client, "Prepare meals")
    plan = example_plan()
    plan.nutrition = NutritionPlan(
        focus="Food",
        energy_strategy="balanced",
        energy_explanation="Eat 1200 kcal per day.",
        meal_pattern="Regular meals",
        portion_approach="Choose satisfying portions.",
    )
    assert any("numerical calorie" in issue for issue in plan_issues(agent_store.read(token), plan))


def test_researched_evidence_is_available_for_later_review_without_becoming_profile_facts(
    workspace, monkeypatch
):
    client, _ = workspace
    j, h, _ = create(client, "Improve skin comfort")
    queries = []
    install_discovery(monkeypatch, queries)
    j, events = run(
        client, j, h, action="research", research_topic="skin_options", research_services=False
    )
    report = j["workspace"]["method_reports"][-1]
    evidence_id = report["evidence"][0]["id"]
    assert not j["profile"]
    original = agent_provider.generate
    from app.agent_models import ReviewResult, WorkspaceDraft

    observed = []

    def generate(task, context, output, **kwargs):
        result = original(task, context, output, **kwargs)
        if output is WorkspaceDraft:
            assert context["researched_alternatives"][0]["id"] == report["id"]
            assert evidence_id in {s["id"] for s in context["research_context"]["sources"]}
            observed.append(True)
        if output is ReviewResult:
            for check in result.action_checks:
                check.source_ids = [evidence_id]
        return result

    monkeypatch.setattr(agent_provider, "generate", generate)
    j, events = run(
        client,
        j,
        h,
        action="plan",
        message="Discuss the researched options before changing anything.",
    )
    assert events[-1]["type"] == "complete", events
    assert observed
    assert not j["profile"]
    assert j["workflow"]["review"]["action_checks"][0]["status"] == "compatible"
