import argparse
import json
import os
import sys
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
parser = argparse.ArgumentParser(
    description="Synthetic workspace latency check. --live makes billable OpenAI requests; never loads real journeys."
)
parser.add_argument("--live", action="store_true")
parser.add_argument("--case", choices=["create", "refine"], default="refine")
args = parser.parse_args()
if not args.live:
    parser.error("Pass --live deliberately to run billable synthetic requests.")
from fastapi.testclient import TestClient

from app import agent_provider, agent_store
from app.agent_models import Action, BodyContext, Meal, MealIngredient, Plan, PlanVersion
from app.config import get_settings
from app.main import create_app

original = agent_provider.generate
records = []


def timed(task, context, output, **kwargs):
    role = task.split("]", 1)[0] + "]"
    t = time.perf_counter()
    from app.planning_wire import compact_context

    size = len(
        json.dumps(
            compact_context(context, role.removeprefix("[stage:").removesuffix("]")),
            ensure_ascii=False,
            default=str,
        )
    )
    print(
        {"role": role, "status": "started", "input_chars": size, "schema": output.__name__},
        flush=True,
    )
    try:
        result = original(task, context, output, **kwargs)
        records.append(
            {
                "role": role,
                "seconds": round(time.perf_counter() - t, 3),
                "input_chars": size,
                "artifact_chars": len(result.model_dump_json()),
            }
        )
        print(records[-1], flush=True)
        return result
    except Exception:
        print(
            {"role": role, "failed": True, "seconds": round(time.perf_counter() - t, 3)}, flush=True
        )
        raise


agent_provider.generate = timed
with tempfile.TemporaryDirectory(prefix="revana-latency-") as folder:
    os.environ["REVANA_DATABASE_PATH"] = str(Path(folder) / "synthetic.sqlite3")
    # An explicit empty primary alias overrides any database URL in .env as well.
    os.environ["REVANA_DATABASE_URL"] = ""
    os.environ["REVANA_ENVIRONMENT"] = "development"
    os.environ.pop("VERCEL", None)
    for name in ("POSTGRES_URL", "DATABASE_URL"):
        os.environ.pop(name, None)
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        made = client.post(
            "/v1/workspace/goals",
            json={
                "message": "Synthetic benchmark: prepare convenient vegetarian lunches for work. I prefer vegetarian food, have a fridge and freezer, and want an eight-week lunch routine. No known food allergies or clinician-directed dietary restrictions reported. I can prepare food on Sunday and Wednesday.",
                "consent": True,
            },
        ).json()
        token = made["token"]
        j = agent_store.read(token)
        j.body = BodyContext(
            age=34, height_cm=175, weight_kg=86, pregnancy="not_applicable", daily_minutes=60
        )
        action = Action(
            id="lunch",
            category="food",
            title="Prepare weekday chickpea lunches",
            detail="1. Rinse the canned chickpeas.\n2. Combine them with cooked rice and broccoli.\n3. Cool and refrigerate promptly; freeze later portions.\n4. Pack a portion that suits your appetite and adjust based on satisfaction.",
            why="Makes vegetarian lunches convenient on workdays.",
            timing="Sunday and Wednesday.",
            cost="Use existing groceries.",
            effort="Moderate",
            observation="Lunches are convenient and satisfying.",
            minutes=15,
            days=[2, 6],
        )
        other = action.model_copy(
            update={
                "id": "review",
                "title": "Review which lunches worked",
                "category": "review",
                "detail": "Note convenience and satisfaction. Choose one adjustment for next week.",
                "minutes": 5,
                "days": [6],
            }
        )
        meals = [
            Meal(
                day=d,
                slot=slot,
                title="Chickpea, rice and broccoli bowl",
                ingredients=[
                    MealIngredient(food_id=3815, grams=120),
                    MealIngredient(food_id=804, grams=150),
                    MealIngredient(food_id=4939, grams=150),
                ],
                instructions="Combine prepared ingredients. Follow safe cooling, refrigeration and reheating guidance; freeze later portions.",
                preparation_minutes=5,
                substitution_note="Use tolerated listed alternatives.",
                storage="Keep refrigerated; freeze later portions.",
            )
            for d in range(7)
            for slot in ("lunch",)
        ]
        plan = Plan(
            summary="Vegetarian food preparation and weekly review.",
            reported=[],
            hypotheses=[],
            uncertainties=["Synthetic timing fixture; no medical clearance."],
            safety_notes=["Check actual food labels and tolerate activity."],
            review_days=14,
            changes="Synthetic fixture.",
            actions=[action, other],
            meals=meals,
        )
        j.plans = [PlanVersion(version=1, created_at=datetime.now(UTC), plan=plan)]
        j.workspace.assessment_complete = True
        j.workspace.question = None
        j = agent_store.save(token, j, j.revision)
        t = time.perf_counter()
        payload = {
            "revision": j.revision,
            "action": "continue",
            "action_id": "lunch",
            "idea_intent": "details",
            "message": "Make the lunch preparation instructions more specific. Preserve the scheduled ingredient amounts, meal coverage and all other plan items.",
        }
        if args.case == "create":
            j.plans = []
            j.workspace.outcome = "Prepare seven vegetarian lunches and two beginner bodyweight strength sessions over eight weeks."
            j.workspace.timeline_note = "8 weeks"
            j.workspace.messages[
                -1
            ].text = "Create seven vegetarian lunches using repeatable recipes and batch prep, plus two beginner bodyweight strength sessions. Include exercise sets, reps, rest, technique and progression. Fridge/freezer available. 60 minutes per day total. No reported allergies, injuries or clinician-directed dietary restrictions; this is not clinical clearance."
            j = agent_store.save(token, j, j.revision)
            payload = {"revision": j.revision, "action": "plan"}
        r = client.post(
            "/v1/workspace/run", headers={"Authorization": "Bearer " + token}, json=payload
        )
        events = [json.loads(line[6:]) for line in r.text.splitlines() if line.startswith("data: ")]
        final = events[-1]
        summary = {
            "result": final["type"],
            "total_seconds": round(time.perf_counter() - t, 3),
            "model_seconds": round(sum(x["seconds"] for x in records), 3),
            "calls": records,
            "message": final.get("message"),
            "performance": final.get("journey", {})
            .get("workspace", {})
            .get("run", {})
            .get("performance"),
        }
        print(summary, flush=True)
