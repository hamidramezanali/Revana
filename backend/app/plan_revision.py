"""Construct plan revisions while preserving explicit user keeps in application code."""

from uuid import uuid4

from fastapi import HTTPException

from app import workflow
from app.agent_models import Action, ActionPreference, Journey, Plan, ReshuffleDraft


def current_preferences(journey: Journey) -> list[ActionPreference]:
    if not journey.plans:
        return []
    version = journey.plans[-1].version
    return [item for item in journey.action_preferences if item.plan_version == version]


def normalized(value: str) -> str:
    return " ".join(value.casefold().split())


def build_revision(journey: Journey, context: dict, message: str) -> Plan:
    current = journey.plans[-1]
    preferences = {item.action_id: item.choice for item in current_preferences(journey)}
    kept = [action for action in current.plan.actions if preferences.get(action.id) == "keep"]
    rejected = [
        action for action in current.plan.actions if preferences.get(action.id) == "not_for_me"
    ]
    editable = {
        action.id: action for action in current.plan.actions if preferences.get(action.id) != "keep"
    }
    if not editable:
        raise HTTPException(
            409, "All actions are kept. Unmark an action before refreshing the plan."
        )
    context = {
        **context,
        "revision_request": {
            "base_version": current.version,
            "keep_unchanged": [action.model_dump() for action in kept],
            "not_for_me": [action.model_dump() for action in rejected],
            "reassess": [action.model_dump() for action in editable.values()],
            "message": message,
        },
    }
    draft = workflow.plan(
        journey,
        "Draft ONE revised personal plan using the user's goals, ALL answers, constraints, "
        "current plan and revision_request. Return only replacement actions in actions; "
        "the application inserts keep_unchanged actions verbatim. Each replacement must "
        "identify its source with replaces_action_id from reassess; at most one replacement "
        "per source. Do not replace, rewrite or duplicate kept actions. Replace actions "
        "marked not_for_me with genuinely different, relevant suggestions, using the "
        "optional message to understand why. Unmarked actions may be reassessed. Do not "
        "return rejected actions under new IDs. If no suitable replacement exists, omit "
        "that source and explain the uncertainty. Metadata must describe the whole plan, "
        "including kept actions. Explain what changes without claiming anything was completed.",
        context,
        ReshuffleDraft,
    )
    replacements: dict[str, Action] = {}
    id_mapping = {}
    rejected_titles = {normalized(action.title) for action in rejected}
    rejected_details = {normalized(action.detail) for action in rejected}
    kept_titles = {normalized(action.title) for action in kept}
    for replacement in draft.actions:
        source_id = replacement.replaces_action_id
        if source_id not in editable or source_id in replacements:
            raise HTTPException(502, "The coach returned an invalid replacement. Please retry.")
        if (
            normalized(replacement.title) in rejected_titles
            or normalized(replacement.detail) in rejected_details
            or normalized(replacement.title) in kept_titles
        ):
            raise HTTPException(502, "The coach repeated a kept or unwanted action. Please retry.")
        action = Action.model_validate(replacement.model_dump(exclude={"replaces_action_id"}))
        source = editable[source_id]
        if action.model_dump(exclude={"id"}) == source.model_dump(exclude={"id"}):
            action.id = source.id
        else:
            action.id = uuid4().hex
        id_mapping[replacement.id] = action.id
        replacements[source_id] = action
    actions = [
        action.model_copy(deep=True)
        if preferences.get(action.id) == "keep"
        else replacements.get(action.id)
        for action in current.plan.actions
    ]
    actions = [action for action in actions if action is not None]
    if not actions:
        raise HTTPException(
            502, "The coach could not suggest a suitable revised plan. Please retry."
        )
    workflow.remap_checks(journey, id_mapping)
    result = Plan.model_validate({**draft.model_dump(exclude={"actions"}), "actions": actions})
    return workflow.require_usable_plan(journey, result)
