"""Independent suggestion batches and a durable user-selected list."""

from uuid import uuid4

from fastapi import HTTPException

from app import agent_provider as provider
from app.agent_models import Journey, SuggestionBatch, SuggestionBoard
from app.plan_revision import current_preferences, normalized


def board_for(journey: Journey) -> SuggestionBoard:
    if journey.suggestion_board is not None:
        return journey.suggestion_board
    current = journey.plans[-1].plan
    choices = {item.action_id: item.choice for item in current_preferences(journey)}
    return SuggestionBoard(
        suggestions=[a.model_copy(deep=True) for a in current.actions if a.id not in choices],
        kept=[a.model_copy(deep=True) for a in current.actions if choices.get(a.id) == "keep"],
        seen=[a.model_copy(deep=True) for a in current.actions],
        rejected_ids=[a.id for a in current.actions if choices.get(a.id) == "not_for_me"],
        safety_notes=current.safety_notes,
    )


def generate_batch(journey: Journey, context: dict, message: str) -> SuggestionBoard:
    board = board_for(journey).model_copy(deep=True)
    if board.rounds >= 50:
        raise HTTPException(
            409, "Suggestion limit reached for this local journey. Export it first."
        )
    # Keep explicit suggestions distinct from user-reported facts and accepted plans.
    context.pop("suggestion_board", None)
    context.pop("action_exploration", None)
    context["suggestion_request"] = {
        "kept": [a.model_dump() for a in board.kept],
        "not_for_me": [a.model_dump() for a in board.seen if a.id in board.rejected_ids],
        "previously_shown": [a.model_dump() for a in board.seen],
        "message": message,
    }
    batch = provider.generate(
        "Generate a fresh batch of 1-4 relevant suggestions using the original problem, ALL "
        "answers, constraints and suggestion_request. This is exploration, not a revision "
        "of the accepted plan. Do not repeat previously_shown suggestions, including kept "
        "or rejected actions, or disguise them with new wording. Do not assume why an action "
        "was rejected. Respect the combined effort of the kept list; do not encourage doing "
        "everything at once. Never claim suggestions were tried or completed. If specific "
        "advice is unsuitable, suggest an appropriate assessment or clarification step. "
        "Include applicable safety notes. No replaces_action_id is needed for a new batch.",
        context,
        SuggestionBatch,
    )
    titles = {normalized(a.title) for a in board.seen}
    details = {normalized(a.detail) for a in board.seen}
    for action in batch.actions:
        if normalized(action.title) in titles or normalized(action.detail) in details:
            raise HTTPException(502, "The coach repeated a previous suggestion. Please retry.")
        titles.add(normalized(action.title))
        details.add(normalized(action.detail))
        action.id = uuid4().hex
    board.suggestions = batch.actions
    board.seen.extend(a.model_copy(deep=True) for a in batch.actions)
    board.safety_notes = batch.safety_notes
    board.rounds += 1
    return board
