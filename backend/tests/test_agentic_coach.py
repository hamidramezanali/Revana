from datetime import timedelta

from test_agent import agent as agent_fixture
from test_agent import example_plan, plan, start

from app import agent_store, workflow
from app.agent_models import BodyContext, Decision, Journey, Meal, MealIngredient, Plan, ProfileFact
from app.coaching_graph import PLANNING
from app.coaching_tools import body_guidance, local_today
from app.nutrition import catalog, meal_totals, shopping_list

agent = agent_fixture


def test_graph_has_separate_bounded_responsibilities():
    assert {
        "profile",
        "safety",
        "progress",
        "domains",
        "planner",
        "reviewer",
        "correct",
        "finish",
    } <= set(PLANNING.nodes)
    assert PLANNING.checkpointer is None


def test_body_context_and_unsafe_target_are_not_calorie_prescriptions():
    journey = Journey(
        context={"goals": ["body"], "description": "Event goal", "target_date": ""},
        decision=Decision(summary="Start", ready=True, questions=[]),
    )
    assert body_guidance(journey)["maintenance_estimate"] is None
    journey.body = BodyContext(
        age=34,
        height_cm=160,
        weight_kg=49,
        target_weight_kg=46,
        equation_coefficient="female",
        pregnancy="not_applicable",
        activity="regular_training",
    )
    result = body_guidance(journey)
    assert result["calorie_deficit_allowed"] is False
    assert result["maintenance_estimate"] is None
    assert any("target" in item for item in result["constraints"])
    journey.body.target_weight_kg = None
    result = body_guidance(journey)
    assert result["maintenance_estimate"]["resting_kcal"] == 1159
    journey.body.equation_coefficient = "not_specified"
    assert body_guidance(journey)["maintenance_estimate"] is None


def test_context_changes_invalidate_proposals_and_conflicts_are_atomic(agent):
    client, _ = agent
    headers, journey = start(client)
    saved = plan(client, headers, journey).json()
    before = saved["plans"]
    response = client.post(
        "/v1/agent/body-context",
        headers=headers,
        json={
            "revision": saved["revision"],
            "body": {"age": 34, "height_cm": 160, "weight_kg": 49, "daily_minutes": 10},
        },
    )
    assert response.status_code == 200
    changed = response.json()
    assert changed["body"]["weight_kg"] == 49
    assert changed["plans"] == before and changed["proposal"] is None
    assert changed["workflow"]["status"] == "needs_review"
    assert (
        client.post(
            "/v1/agent/body-context",
            headers=headers,
            json={"revision": saved["revision"], "body": {"age": 18}},
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/v1/agent/body-context",
            headers=headers,
            json={"revision": changed["revision"], "body": {"age": -3}},
        ).status_code
        == 422
    )
    assert client.get("/v1/agent/session", headers=headers).json() == changed


def test_numeric_answer_validates_and_updates_profile(agent):
    client, _ = agent
    headers, _journey = start(client)
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    question = saved.decision.questions[0]
    question.input_kind = "number"
    question.options = []
    question.unit = "cm"
    question.number_min = 100
    question.number_max = 250
    question.profile_key = "height_cm"
    saved = agent_store.save(access, saved, saved.revision)
    request = {"revision": saved.revision, "question_id": question.id, "answer": "nan"}
    assert client.post("/v1/agent/answers", headers=headers, json=request).status_code == 422
    assert agent_store.read(access).revision == saved.revision
    request["answer"] = "160"
    result = client.post("/v1/agent/answers", headers=headers, json=request)
    assert result.status_code == 200, result.text
    assert result.json()["body"]["height_cm"] == 160


def test_progress_separates_attempts_outcomes_and_rejects_future_dates(agent):
    client, _ = agent
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    accepted = journey["plans"]
    today = local_today(agent_store.read(headers["Authorization"].split()[1]))
    response = client.post(
        "/v1/agent/progress",
        headers=headers,
        json={
            "revision": journey["revision"],
            "status": "not_attempted",
            "observed_on": str(today),
            "action_id": "observe",
        },
    )
    assert response.status_code == 200
    journey = response.json()
    assert journey["completions"] == [] and journey["progress"][-1]["status"] == "not_attempted"
    assert (
        client.post(
            "/v1/agent/progress",
            headers=headers,
            json={
                "revision": journey["revision"],
                "status": "followed",
                "observed_on": str(today + timedelta(days=1)),
            },
        ).status_code
        == 422
    )
    response = client.post(
        "/v1/agent/progress",
        headers=headers,
        json={
            "revision": journey["revision"],
            "status": "worse",
            "observed_on": str(today),
            "note": "Synthetic worsening",
        },
    )
    journey = response.json()
    assert journey["workflow"]["status"] == "needs_review"
    assert journey["plans"] == accepted
    assert (
        client.post(
            "/v1/agent/progress",
            headers=headers,
            json={
                "revision": journey["revision"],
                "status": "followed",
                "observed_on": str(today),
                "action_id": "someone-elses-action",
            },
        ).status_code
        == 422
    )
    removed = client.request(
        "DELETE",
        f"/v1/agent/progress/{journey['progress'][-1]['id']}",
        headers=headers,
        json={"revision": journey["revision"]},
    )
    assert removed.status_code == 200 and len(removed.json()["progress"]) == 1


def meal(day=0, food=553, grams=100):
    return Meal(
        day=day,
        slot="lunch",
        title="Synthetic lunch",
        ingredients=[MealIngredient(food_id=food, grams=grams)],
        instructions="Prepare the named food.",
        preparation_minutes=2,
        substitution_note="Confirm any substitutions.",
    )


def test_nutrition_uses_published_weights_and_unknowns_never_become_zero():
    source = next(food for food in catalog()["foods"] if food["id"] == 553)
    result = meal_totals([MealIngredient(food_id=553, grams=100)])
    assert (
        result["kcal"] == source["kcal_per_100g"]
        and result["protein_g"] == source["protein_per_100g"]
    )
    doubled = meal_totals([MealIngredient(food_id=553, grams=200)])
    assert doubled["kcal"] == result["kcal"] * 2
    assert meal_totals([MealIngredient(food_id=999999, grams=100)])["kcal"] is None
    original = meal().model_dump(mode="json")
    original["nutrition"] = {"kcal": 9999}
    assert Meal.model_validate(original).nutrition.kcal == result["kcal"]
    plan = example_plan()
    plan.meals = [meal(), meal(day=1, grams=150)]
    assert shopping_list(plan)[0]["grams"] == 250
    assert (
        Plan.model_validate_json(plan.model_dump_json()).meals[0].nutrition.kcal == result["kcal"]
    )


def test_meal_swap_is_a_proposal_and_does_not_rewrite_keeps(agent):
    client, _ = agent
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    saved.plans[-1].plan.meals = [meal(), meal(day=1, food=588, grams=150)]
    saved = agent_store.save(access, saved, saved.revision)
    before = saved.plans[-1].model_dump(mode="json")
    response = client.post(
        "/v1/agent/meal-swap",
        headers=headers,
        json={
            "revision": saved.revision,
            "day": 0,
            "slot": "lunch",
            "source_day": 1,
            "source_slot": "lunch",
        },
    )
    assert response.status_code == 200, response.text
    changed = response.json()
    assert changed["plans"][-1] == before
    assert changed["proposal"]["actions"] == before["plan"]["actions"]
    assert changed["proposal"]["meals"][0]["ingredients"][0]["food_id"] == 588
    assert changed["proposal"]["meals"][1] == before["plan"]["meals"][1]


def test_confirmation_consolidates_transcripts_but_preserves_sourced_facts(agent):
    client, _ = agent
    headers, _journey = start(client)
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    saved.profile.append(
        ProfileFact(
            id="confirmed-report",
            category="routine",
            value="Short routine",
            source_id="opening",
            quote="Simpler routine",
            status="reported",
        )
    )
    saved = agent_store.save(access, saved, saved.revision)
    response = client.post(
        "/v1/agent/plan",
        headers=headers,
        json={
            "revision": saved.revision,
            "preferences": {
                "sensitivities": [],
                "budget": "Not specified",
                "effort": "Three coordinated habits",
            },
            "confirm_profile": True,
        },
    )
    assert response.status_code == 200, response.text
    changed = response.json()
    assert changed["memory_consolidated"] and changed["events"] == []
    assert changed["suggestion_board"]["conversation"] == []
    assert changed["profile"][0]["confirmed"]
    assert workflow.reports(agent_store.read(access))["opening"].count("Simpler routine") >= 1


def test_services_have_no_fabricated_marketplace_fields(agent):
    client, _ = agent
    headers, _ = start(client)
    result = client.get("/v1/agent/services", headers=headers).json()
    assert not result["live_search"] and not result["booking"] and not result["availability"]
    assert result["links"][0]["url"] == "https://www.bokadirekt.se/"
    assert "rating" not in str(result)


def test_initial_plan_and_effort_budget_are_enforced_after_one_repair(agent, monkeypatch):
    from app import agent_provider

    client, _ = agent
    headers, journey = start(client)
    original = agent_provider.generate

    def generate(task, context, output):
        if output is Plan:
            value = example_plan()
            value.actions[0].minutes = 60
            return value
        return original(task, context, output)

    monkeypatch.setattr(agent_provider, "generate", generate)
    response = client.post(
        "/v1/agent/body-context",
        headers=headers,
        json={"revision": journey["revision"], "body": {"daily_minutes": 5}},
    )
    journey = response.json()
    response = plan(client, headers, journey)
    assert response.status_code == 502
    assert agent_store.read(headers["Authorization"].split()[1]).plans == []
