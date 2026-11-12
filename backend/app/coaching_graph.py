"""Bounded LangGraph workflows; app database owns turn-level durable state.

No checkpoint transcripts or external tracing are created. A graph ends at a user
question/proposal; resuming loads the revision-checked Journey from the existing store.
"""

from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langsmith import tracing_context

from app import workflow
from app.agent_models import Plan, SuggestionBatch
from app.coaching_tools import body_guidance, progress_context


class State(TypedDict, total=False):
    journey: Any
    context: dict
    task: str
    output: Any
    draft: Any
    result: Any
    decision: Any


def profile_node(state: State):
    journey = state["journey"]
    return {
        "context": {
            **workflow.context_for(journey, state["context"]),
            "body_context": journey.body.model_dump(mode="json"),
            "profile_confirmed": journey.profile_confirmed_revision == journey.profile_revision,
        }
    }


def safety_node(state: State):
    return {"context": {**state["context"], "body_guidance": body_guidance(state["journey"])}}


def progress_node(state: State):
    return {"context": {**state["context"], "progress_review": progress_context(state["journey"])}}


def domains_node(state: State):
    from importlib.resources import files

    goals = set(state["journey"].context.goals)
    relevant = [domain for domain in ("skin", "hair", "body") if domain in goals]
    from app.nutrition import catalog

    guidance = {
        domain: files("app").joinpath(f"prompts/{domain}.md").read_text(encoding="utf-8")
        for domain in relevant
    }
    return {
        "context": {
            **state["context"],
            "domain_guidance": guidance,
            "food_catalog": catalog() if "body" in relevant else None,
            "research_context": state["journey"].workflow.research.model_dump(mode="json"),
        }
    }


def planner_node(state: State):
    journey = state["journey"]
    resume = state["context"].pop("_resume_draft", None)
    if resume is not None:
        draft = state["output"].model_validate(resume)
    else:
        journey.workflow.stages.append("planner")
        draft = workflow.stage("planner", state["task"], state["context"], state["output"])
    if isinstance(draft, SuggestionBatch):
        from uuid import uuid4

        for action in draft.actions:
            action.id = uuid4().hex
    if state["context"].get("keep_all_actions"):
        from app.agent_models import Action

        draft.actions = [
            Action.model_validate(action) for action in state["context"]["keep_all_actions"]
        ]
    if state["context"].get("workspace_kept_actions"):
        from app.agent_models import Action

        frozen = [Action.model_validate(a) for a in state["context"]["workspace_kept_actions"]]
        ids = {a.id for a in frozen}
        titles = {a.title.casefold() for a in frozen}
        draft.actions = frozen + [
            a for a in draft.actions if a.id not in ids and a.title.casefold() not in titles
        ]
    if "goal_workspace" in state["context"]:
        from app.idea_actions import constrain

        draft = constrain(draft, state["context"])
    sink = workflow._event_sink.get()
    if sink:
        sink({"type": "draft", "plan": draft.model_dump(mode="json")})
    return {"draft": draft}


def plan_issues(journey, draft):
    problems = []
    if isinstance(draft, Plan) and any(not meal.nutrition.available for meal in draft.meals):
        problems.append(
            "Use only verified food IDs from food_catalog; nutrition is unavailable for unknown ingredients."
        )
    if isinstance(draft, Plan):
        import re

        from app.nutrition import catalog

        foods = {food["id"]: food for food in catalog()["foods"]}
        allergies = " ".join(
            f.value.lower() for f in journey.profile if f.active and f.category == "allergy"
        )
        if journey.preferences:
            allergies += " " + " ".join(journey.preferences.sensitivities).lower()
        markers = {
            "milk": r"\b(milk|dairy|mjölk)\b",
            "egg": r"\b(egg|eggs|ägg)\b",
            "oats": r"\b(oat|oats|gluten|havre)\b",
            "soy": r"\b(soy|soya|soja)\b",
            "fish": r"\b(fish|fisk|salmon|lax|tuna|tonfisk)\b",
            "wheat": r"\b(wheat|gluten|vete)\b",
            "peanut": r"\b(peanut|peanuts|jordnöt|jordnötter)\b",
            "nuts": r"\b(nut|nuts|nötter|almond|almonds|mandel)\b",
            "sesame": r"\b(sesame|sesam)\b",
            "shellfish": r"\b(shellfish|skaldjur|shrimp|räkor)\b",
        }
        blocked = {tag for tag, pattern in markers.items() if re.search(pattern, allergies)}
        if any(
            blocked.intersection(foods.get(i.food_id, {}).get("known_allergens", []))
            for meal in draft.meals
            for i in meal.ingredients
        ):
            problems.append(
                "A meal contains a catalogued allergen matching a reported restriction. Replace it; do not erase the restriction."
            )
    if not isinstance(draft, Plan):
        return problems
    if draft.nutrition:
        energy_text = f"{draft.nutrition.energy_explanation} {draft.nutrition.portion_approach} {draft.nutrition.meal_pattern}"
        if re.search(
            r"(?:\d{2,4}\s*(?:kcal|calories|kalorier).{0,30}(?:per day|daily|a day|/day|per dag|/dag|dagligen|deficit|underskott)|(?:daily|deficit|underskott|target).{0,30}\d{2,4}\s*(?:kcal|calories|kalorier))",
            energy_text,
            re.IGNORECASE | re.DOTALL,
        ):
            problems.append(
                "Do not prescribe an unverified numerical calorie target or deficit. Use balanced meal guidance and application-calculated ingredient estimates."
            )
        if (
            draft.nutrition.energy_strategy == "deficit_discussion"
            and not body_guidance(journey)["weight_management_appropriate_to_discuss"]
        ):
            problems.append(
                "An energy-deficit approach is not supported by this profile; use balanced meals or individualized clinical review."
            )
        meal_keys = {f"{meal.day}-{meal.slot}" for meal in draft.meals}
        if any(
            key not in meal_keys
            for session in draft.nutrition.prep_sessions
            for key in session.meal_keys
        ):
            problems.append("Batch-prep sessions must refer to actual scheduled meal keys.")
    if draft.programme and draft.programme.training_included:
        sessions = [a for a in draft.actions if a.exercises]
        if not sessions:
            problems.append(
                "A training programme needs actual exercises, not generic activity intentions."
            )
        for action in sessions:
            if any(step.week > draft.programme.weeks for step in action.progression):
                problems.append("Keep progression steps within this programme block.")
            if not action.days or action.minutes is None:
                problems.append(
                    "Schedule each session on real weekdays with a whole-session time estimate."
                )
            if not action.progression and not all(e.progression for e in action.exercises):
                problems.append(
                    "Provide criteria-based progression and an easier fallback for the training sessions."
                )
            for exercise in action.exercises:
                if not exercise.duration_minutes and not (
                    exercise.sets and exercise.repetitions.strip()
                ):
                    problems.append("Every exercise needs sets and repetitions or a duration.")
                if (
                    exercise.sets
                    and (exercise.sets > 1 or not exercise.duration_minutes)
                    and exercise.rest_seconds is None
                ):
                    problems.append(
                        f"Provide rest intervals: exercise '{exercise.name}' in action '{action.id}' needs rest_seconds for its sets. Use an explicit supported interval (or zero only if no rest is intended); do not omit it."
                    )
            if (
                action.minutes is not None
                and sum(e.duration_minutes or 0 for e in action.exercises) > action.minutes
            ):
                problems.append("Exercise durations exceed the declared whole-session time.")
    if journey.body.daily_minutes is not None:
        if any(action.minutes is None for action in draft.actions):
            problems.append(
                "Provide honest time estimates before asserting this plan fits the available minutes."
            )
        for day in range(7):
            meal_minutes = sum(
                meal.preparation_minutes for meal in getattr(draft, "meals", []) if meal.day == day
            )
            prep_minutes = (
                sum(
                    session.minutes
                    for session in draft.nutrition.prep_sessions
                    if session.day == day
                )
                if draft.nutrition
                else 0
            )
            minutes = (
                prep_minutes
                + meal_minutes
                + sum(action.minutes or 0 for action in draft.actions if day in action.days)
            )
            if minutes > journey.body.daily_minutes:
                problems.append("The combined daily schedule exceeds the user's time budget.")
                break
    costs = [action.monthly_cost_sek for action in draft.actions]
    if journey.body.monthly_budget_sek is not None and any(cost is None for cost in costs):
        problems.append(
            "State estimated costs or avoid new purchases before asserting the plan fits this budget."
        )
    if (
        journey.body.monthly_budget_sek is not None
        and sum(cost or 0 for cost in costs) > journey.body.monthly_budget_sek
    ):
        problems.append("Combined monthly costs exceed the stated budget.")
    return problems


def reviewer_node(state: State):
    journey, draft = state["journey"], state["draft"]
    result = workflow.review(journey, state["context"], draft)
    problems = plan_issues(journey, draft)
    if problems:
        result.approved = False
        result.issues.extend(problems)
        result.correction = " ".join(problems)
    return {"result": result}


def correction_node(state: State):
    state["journey"].workflow.stages.append("planner_correction")
    updated = {
        **state,
        "task": state["task"] + " Apply exactly one targeted correction.",
        "context": {
            **state["context"],
            "reviewer_correction": state["result"].correction,
            "previous_draft": state["draft"].model_dump(mode="json"),
        },
    }
    # Separate node; never recursively restart the workflow.
    draft = workflow.stage("planner", updated["task"], updated["context"], state["output"])
    if isinstance(draft, SuggestionBatch):
        from uuid import uuid4

        for action in draft.actions:
            action.id = uuid4().hex
    if state["context"].get("keep_all_actions"):
        from app.agent_models import Action

        draft.actions = [
            Action.model_validate(action) for action in state["context"]["keep_all_actions"]
        ]
    if state["context"].get("workspace_kept_actions"):
        from app.agent_models import Action

        frozen = [Action.model_validate(a) for a in state["context"]["workspace_kept_actions"]]
        ids = {a.id for a in frozen}
        titles = {a.title.casefold() for a in frozen}
        draft.actions = frozen + [
            a for a in draft.actions if a.id not in ids and a.title.casefold() not in titles
        ]
    if "goal_workspace" in state["context"]:
        from app.idea_actions import constrain

        draft = constrain(draft, state["context"])
    sink = workflow._event_sink.get()
    if sink:
        sink({"type": "draft", "plan": draft.model_dump(mode="json")})
    return {"draft": draft}


def needs_correction(state: State):
    ids = {action.id for action in state["draft"].actions}
    result = state["result"]
    rejected = not result.approved or any(
        check.action_id in ids and check.status != "compatible" for check in result.action_checks
    )
    return "correct" if rejected and result.correction.strip() else "finish"


def finish_node(state: State):
    journey, result = state["journey"], state["result"]
    if isinstance(state["draft"], Plan):
        review_days = [
            milestone.day
            for milestone in state["draft"].milestones
            if milestone.label in {"Review", "Seek assessment"}
        ]
        if review_days:
            state["draft"].review_days = min(state["draft"].review_days, min(review_days))
    if not result.approved:
        for check in result.action_checks:
            if check.action_id in {a.id for a in state["draft"].actions}:
                check.status = "needs_review"
                check.reason = "Draft needs refinement: " + "; ".join(result.issues)
        result.suggested_starts = []
        journey.workflow.status = "needs_review"
        journey.workflow.message = (
            "The draft needs clarification after one refinement. Your accepted plan is unchanged."
        )
    return {}


def _planning_graph():
    graph = StateGraph(State)
    for name, node in [
        ("profile", profile_node),
        ("safety", safety_node),
        ("progress", progress_node),
        ("domains", domains_node),
        ("planner", planner_node),
        ("reviewer", reviewer_node),
        ("correct", correction_node),
        ("review_again", reviewer_node),
        ("finish", finish_node),
    ]:
        graph.add_node(name, node)
    graph.add_edge(START, "profile")
    for left, right in [
        ("profile", "safety"),
        ("safety", "progress"),
        ("progress", "domains"),
        ("domains", "planner"),
        ("planner", "reviewer"),
        ("correct", "review_again"),
        ("review_again", "finish"),
        ("finish", END),
    ]:
        graph.add_edge(left, right)
    graph.add_conditional_edges(
        "reviewer", needs_correction, {"correct": "correct", "finish": "finish"}
    )
    return graph.compile()


PLANNING = _planning_graph()


def plan(journey, task, context, output):
    with tracing_context(enabled=False):
        state = PLANNING.invoke(
            {"journey": journey, "task": task, "context": context, "output": output},
            config={"recursion_limit": 16},
        )
    return state["draft"]


def assess(journey, task, context, output):
    def ask(state):
        return {"decision": workflow.stage("coach", task, state["context"], output)}

    graph = StateGraph(State)
    graph.add_node("profile", profile_node)
    graph.add_node("safety", safety_node)
    graph.add_node("progress", progress_node)
    graph.add_node("question_coach", ask)
    graph.add_edge(START, "profile")
    graph.add_edge("profile", "safety")
    graph.add_edge("safety", "progress")
    graph.add_edge("progress", "question_coach")
    graph.add_edge("question_coach", END)
    with tracing_context(enabled=False):
        return graph.compile().invoke(
            {"journey": journey, "context": context}, config={"recursion_limit": 8}
        )["decision"]
