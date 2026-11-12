"""Compact provider-only formats. Saved/API plans retain the original complete contract."""

import json
from copy import deepcopy
from typing import Literal

from pydantic import Field, create_model

from app.agent_models import (
    Action,
    FactCandidate,
    Meal,
    Milestone,
    Model,
    NutritionPlan,
    WeeklyProgramme,
    WorkspaceDraft,
)


class IdeaRefinement(Model):
    action: Action
    reply: str = Field(min_length=1, max_length=800)
    facts: list[FactCandidate] = Field(default_factory=list, max_length=12)
    conflicts: list[str] = Field(default_factory=list, max_length=6)


class PlanRepair(Model):
    actions: list[Action] = Field(default_factory=list)
    remove_action_ids: list[str] = Field(default_factory=list)
    meals: list[Meal] = Field(default_factory=list, max_length=28)
    remove_meal_keys: list[str] = Field(default_factory=list, max_length=28)
    nutrition: NutritionPlan | None = None
    programme: WeeklyProgramme | None = None
    safety_notes: list[str] | None = Field(default=None, min_length=1, max_length=8)
    uncertainties: list[str] | None = Field(default=None, max_length=8)
    milestones: list[Milestone] | None = Field(default=None, max_length=6)
    summary: str | None = Field(default=None, max_length=2000)
    priority: str | None = Field(default=None, max_length=400)
    review_days: int | None = Field(default=None, ge=1, le=30)
    changes: str = Field(min_length=1, max_length=1500)
    reply: str = Field(min_length=1, max_length=1800)
    facts: list[FactCandidate] = Field(default_factory=list, max_length=12)
    conflicts: list[str] = Field(default_factory=list, max_length=6)


def apply_repair(previous, patch):
    base = WorkspaceDraft.model_validate(previous)
    actions = {a.id: a for a in base.actions}
    updates = {a.id: a for a in patch.actions}
    if (
        len(updates) != len(patch.actions)
        or not set(patch.remove_action_ids) <= actions.keys()
        or set(patch.remove_action_ids) & updates.keys()
    ):
        raise ValueError("Invalid action repair references")
    meals = {f"{m.day}-{m.slot}": m for m in base.meals}
    meal_updates = {f"{m.day}-{m.slot}": m for m in patch.meals}
    if (
        len(meal_updates) != len(patch.meals)
        or not set(patch.remove_meal_keys) <= meals.keys()
        or set(patch.remove_meal_keys) & meal_updates.keys()
    ):
        raise ValueError("Invalid meal repair references")
    for key in patch.remove_action_ids:
        actions.pop(key)
    for key in patch.remove_meal_keys:
        meals.pop(key)
    actions.update(updates)
    meals.update(meal_updates)
    data = base.model_dump(mode="json")
    data.update(
        {
            k: v
            for k, v in patch.model_dump(mode="json").items()
            if k
            not in {
                "actions",
                "meals",
                "remove_action_ids",
                "remove_meal_keys",
                "facts",
                "conflicts",
            }
            and v is not None
        }
    )
    data["actions"] = [a.model_dump(mode="json") for a in actions.values()]
    data["meals"] = [m.model_dump(mode="json") for m in meals.values()]
    data["facts"] = [*patch.facts, *base.facts][:12]
    data["conflicts"] = list(dict.fromkeys([*patch.conflicts, *base.conflicts]))[:6]
    return WorkspaceDraft.model_validate(data)


MealRecipe = create_model(
    "MealRecipe",
    __base__=Model,
    recipe_key=(str, Field(min_length=1, max_length=60)),
    **{
        k: (v.annotation, deepcopy(v))
        for k, v in Meal.model_fields.items()
        if k not in {"day", "slot"}
    },
)


class MealPlacement(Model):
    day: int = Field(ge=0, le=6)
    slot: Literal["breakfast", "lunch", "dinner", "snack"]
    recipe_key: str = Field(min_length=1, max_length=60)


WeeklyPlanDraft = create_model(
    "WeeklyPlanDraft",
    __base__=Model,
    **{
        k: (v.annotation, deepcopy(v))
        for k, v in WorkspaceDraft.model_fields.items()
        if k != "meals"
    },
    recipes=(list[MealRecipe], Field(default_factory=list, max_length=28)),
    meal_schedule=(list[MealPlacement], Field(default_factory=list, max_length=28)),
)


def compact_meals(data):
    if not isinstance(data, dict) or "meals" not in data:
        return data
    data = dict(data)
    recipes = []
    schedule = []
    seen = {}
    for meal in data.pop("meals"):
        recipe = {k: v for k, v in meal.items() if k not in {"day", "slot", "nutrition"}}
        signature = json.dumps(recipe, sort_keys=True, ensure_ascii=False)
        if signature not in seen:
            seen[signature] = f"recipe-{len(recipes) + 1}"
            recipes.append({"recipe_key": seen[signature], **recipe})
        schedule.append({"day": meal["day"], "slot": meal["slot"], "recipe_key": seen[signature]})
    return {**data, "recipes": recipes, "meal_schedule": schedule}


def expand_weekly(draft):
    recipes = {r.recipe_key: r.model_dump(exclude={"recipe_key"}) for r in draft.recipes}
    if len(recipes) != len(draft.recipes):
        raise ValueError("Duplicate recipe keys")
    meals = []
    for entry in draft.meal_schedule:
        if entry.recipe_key not in recipes:
            raise ValueError("Unverified meal recipe reference")
        meals.append({**recipes[entry.recipe_key], "day": entry.day, "slot": entry.slot})
    return WorkspaceDraft.model_validate(
        {**draft.model_dump(exclude={"recipes", "meal_schedule"}), "meals": meals}
    )


def compact_context(context, role):
    """No clinical reports/constraints are truncated. Only duplicates and frozen output are removed."""
    if "goal_workspace" not in context:
        return dict(context)
    omit = {
        "events",
        "body",
        "progress",
        "action_preferences",
        "profile_revision",
        "profile_confirmed_revision",
        "revision",
        "mode",
        "assessment_count",
        "checkin_count",
    }
    result = {k: v for k, v in context.items() if k not in omit and not k.startswith("_")}
    result["confirmed_visual_notes"] = [
        {k: e.get(k) for k in ("source_id", "question", "photo_notes")}
        for e in context.get("events", [])
        if (e.get("photo_notes") or {}).get("confirmed")
    ]
    result["answer_context"] = [
        {k: e.get(k) for k in ("source_id", "question", "skipped")}
        for e in context.get("events", [])
    ]
    # Reports_by_source retains verbatim answer provenance; progress_review retains recent outcomes.
    if role == "reviewer":
        selected = result.get("selected_idea")
        for k in (
            "plans",
            "proposal",
            "selected_idea",
            "previous_draft",
            "workspace_kept_actions",
        ):
            result.pop(k, None)
        result["kept_action_ids"] = [a["id"] for a in context.get("workspace_kept_actions", [])]
        if selected:
            result["selected_idea"] = {k: selected[k] for k in ("action_id", "intent")}
        draft = result.get("draft", {})
        ids = {a["id"] for a in draft.get("actions", [])}
        result["additional_actions_to_check"] = [
            a for a in result.pop("actions_to_check", []) if a["id"] not in ids
        ]
        result["draft"] = compact_meals(draft)
        used = {
            i["food_id"] for meal in draft.get("meals", []) for i in meal.get("ingredients", [])
        }
        if result.get("food_catalog"):
            result["food_catalog"] = {
                **result["food_catalog"],
                "foods": [f for f in result["food_catalog"].get("foods", []) if f["id"] in used],
            }
        result["verified_meal_nutrition"] = [
            {"day": m["day"], "slot": m["slot"], "nutrition": m["nutrition"]}
            for m in draft.get("meals", [])
            if "nutrition" in m
        ]

    elif result.get("selected_idea"):
        edit = result["selected_idea"]
        base = edit["base"]
        latest = result.get("previous_draft", base)
        target = next(a for a in latest["actions"] if a["id"] == edit["action_id"])
        result["selected_idea"] = {k: edit[k] for k in ("action_id", "intent")}
        result["selected_idea"]["action"] = target
        result["fixed_plan_constraints"] = {
            "programme": base.get("programme"),
            "nutrition": base.get("nutrition"),
            "meal_plan": compact_meals({"meals": base.get("meals", [])}),
            "other_actions": [
                {
                    k: a.get(k)
                    for k in ("id", "title", "days", "minutes", "monthly_cost_sek", "exercises")
                }
                for a in base["actions"]
                if a["id"] != edit["action_id"]
            ],
            "meal_preparation_by_day": [
                sum(m["preparation_minutes"] for m in base.get("meals", []) if m["day"] == d)
                for d in range(7)
            ],
        }
        for k in ("plans", "proposal", "previous_draft", "workspace_kept_actions"):
            result.pop(k, None)
        used = {i["food_id"] for meal in base.get("meals", []) for i in meal.get("ingredients", [])}
        if result.get("food_catalog"):
            result["food_catalog"] = {
                **result["food_catalog"],
                "foods": [f for f in result["food_catalog"].get("foods", []) if f["id"] in used],
            }
    else:
        for key in ("proposal", "previous_draft"):
            if result.get(key):
                result[key] = compact_meals(result[key])
        result["plans"] = [{**p, "plan": compact_meals(p["plan"])} for p in result.get("plans", [])]
    return result
