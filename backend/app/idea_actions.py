"""Explicit per-idea decisions and isolated refinements; never infer completion."""

from fastapi import HTTPException

from app.agent_models import Action, ActionPreference, IdeaFeedback, Plan


def signature(action):
    return " ".join(action.title.casefold().split())


def removed(journey):
    return (
        [f.action for f in journey.workspace.idea_feedback if f.choice == "remove"]
        if journey.workspace
        else []
    )


def is_removed(journey, action):
    return any(signature(a) == signature(action) for a in removed(journey))


def base_plan(journey):
    return journey.proposal or (journey.plans[-1].plan if journey.plans else None)


def find_action(journey, action_id):
    plan = base_plan(journey)
    action = next((a for a in plan.actions if a.id == action_id), None) if plan else None
    if not action:
        raise HTTPException(409, "This idea has changed. Reopen the current plan.")
    return plan, action


def choose(journey, action, choice):
    workspace = journey.workspace
    feedback = [f for f in workspace.idea_feedback if signature(f.action) != signature(action)]
    if choice != "clear":
        if len(feedback) >= 100:
            raise HTTPException(
                409, "This goal has reached its idea-decision limit. Start a new goal."
            )
        feedback.append(IdeaFeedback(action=action.model_copy(deep=True), choice=choice))
    workspace.idea_feedback = feedback
    if journey.plans:
        version = journey.plans[-1].version
        journey.action_preferences = [
            p
            for p in journey.action_preferences
            if not (p.plan_version == version and p.action_id == action.id)
        ]
        if choice == "keep" and not journey.proposal:
            journey.action_preferences.append(
                ActionPreference(plan_version=version, action_id=action.id, choice="keep")
            )


def kept(journey, plan):
    from app.plan_revision import current_preferences

    legacy = {p.action_id for p in current_preferences(journey) if p.choice == "keep"}
    return (
        [
            a
            for a in plan.actions
            if not is_removed(journey, a)
            and (
                a.id in legacy
                or any(
                    f.choice == "keep" and f.action.model_dump() == a.model_dump()
                    for f in journey.workspace.idea_feedback
                )
            )
        ]
        if plan
        else []
    )


def constrain(draft, context):
    """Run before reviewer on initial output AND correction. Other ideas are immutable."""
    edit = context.get("selected_idea")
    if edit:
        original = Plan.model_validate(edit["base"])
        target = next(a for a in original.actions if a.id == edit["action_id"])
        candidate = next((a for a in draft.actions if a.id == target.id), None)
        if candidate is None:
            raise HTTPException(
                502,
                "The agent did not refine the selected idea. The saved plan is unchanged; retry.",
            )
        candidate.id = target.id
        if edit["intent"] == "details":
            candidate.title = target.title
            candidate.category = target.category
        updated = original.model_dump(mode="json")
        updated["actions"] = [
            candidate.model_dump(mode="json") if a.id == target.id else a.model_dump(mode="json")
            for a in original.actions
        ]
        updated["changes"] = "Refined one idea: " + target.title
        result = Plan.model_validate(updated)
        for name in Plan.model_fields:
            setattr(draft, name, getattr(result, name))
    rejected = {signature(Action.model_validate(a)) for a in context.get("removed_ideas", [])}
    draft.actions = [a for a in draft.actions if signature(a) not in rejected]
    if not draft.actions:
        raise HTTPException(
            502,
            "The agent repeated removed ideas. Your saved plan is unchanged; ask for different suggestions.",
        )
    return draft
