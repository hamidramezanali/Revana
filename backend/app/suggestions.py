"""Independent suggestion batches and a durable user-selected list."""

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException

from app import agent_provider as provider
from app.agent_models import CoachTurn, Journey, SuggestionBatch, SuggestionBoard, SuggestionRequest
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


def conversation_context(board: SuggestionBoard) -> list[dict]:
    return [
        {
            "user_message": turn.message,
            "question_answered": turn.question.text if turn.question else None,
            "selected_answers": turn.selected_answers,
            "skipped": turn.skipped,
            "coach_reply": turn.reply,
        }
        for turn in board.conversation
    ]


def generate_batch(journey: Journey, context: dict, request: SuggestionRequest) -> SuggestionBoard:
    board = board_for(journey).model_copy(deep=True)
    question = board.pending_question if request.question_id else None
    selected = []
    if request.question_id:
        if question is None or request.question_id != question.id:
            raise HTTPException(409, "This coach question is no longer active.")
        available = {option.id: option for option in question.options}
        if any(option_id not in available for option_id in request.selected_option_ids):
            raise HTTPException(422, "Choose from the current coach question's options.")
        selected = [available[option_id] for option_id in request.selected_option_ids]
        if len(selected) > 1 and (
            question.selection_mode == "single" or any(option.exclusive for option in selected)
        ):
            raise HTTPException(422, "These options cannot be selected together.")
    # Keep explicit suggestions distinct from user-reported facts and accepted plans.
    context.pop("suggestion_board", None)
    context.pop("action_exploration", None)
    context.pop("coach_conversation", None)
    context["current_request"] = {
        "message": request.message.strip(),
        "selected_answers": [option.label for option in selected],
        "skipped": request.skipped,
    }
    context["suggestion_request"] = {
        "kept": [a.model_dump() for a in board.kept],
        "not_for_me": [a.model_dump() for a in board.seen if a.id in board.rejected_ids],
        "previously_shown": [a.model_dump() for a in board.seen],
        "conversation": conversation_context(board),
        "message": request.message.strip(),
        "question_answered": question.text if question else None,
        "selected_answers": [option.label for option in selected],
        "skipped": request.skipped,
    }
    batch = provider.generate(
        "Respond to the person's LATEST message and selected answers in suggestion_request "
        "as the primary conversational request. Earlier goals and the accepted plan are "
        "background; follow explicit changes in direction while retaining relevant safety "
        "constraints. Read the conversation and ALL reported answers. Write a direct, useful "
        "reply addressing what they actually asked, with a short user-facing explanation "
        "of the recommendations and uncertainty, never private chain-of-thought. If a "
        "missing fact would materially change the advice, ask one focused question with "
        "relevant selectable options, suitable single/multiple selection and optional text. "
        "Let the number of options and successive turns follow the need; no fixed quota. "
        "Set photo_mode=none for coach questions. Do not re-ask known or skipped information. "
        "Offer practical alternative actions when enough is known, including more than "
        "three when the user wants breadth. actions may be empty when clarifying or simply "
        "answering. Do not fill space with generic tracking when the user wants an action "
        "plan. For an aggressive target, acknowledge it, briefly explain the limitation, "
        "offer safer concrete routes and let the user choose; never promise rapid results "
        "or prescribe crash diets, dehydration or extreme exercise. This is exploration, "
        "not a revision of the accepted plan. Keep saved actions unchanged. Do not repeat "
        "kept/rejected actions or disguise them with new wording. Previously shown unchosen "
        "ideas may be revisited only when the new request warrants it; do not pad the reply "
        "with repeats. Never claim suggestions were completed. Include applicable safety "
        "notes. No replaces_action_id is needed.",
        context,
        SuggestionBatch,
    )
    protected = [*board.kept, *[a for a in board.seen if a.id in board.rejected_ids]]
    titles = {normalized(a.title) for a in protected}
    details = {normalized(a.detail) for a in protected}
    for action in batch.actions:
        if normalized(action.title) in titles or normalized(action.detail) in details:
            raise HTTPException(502, "The coach repeated a previous suggestion. Please retry.")
        titles.add(normalized(action.title))
        details.add(normalized(action.detail))
        action.id = uuid4().hex
    if batch.actions:
        board.suggestions = batch.actions
    board.seen.extend(a.model_copy(deep=True) for a in batch.actions)
    board.safety_notes = batch.safety_notes
    board.rounds += 1
    board.conversation.append(
        CoachTurn(
            created_at=datetime.now(UTC),
            message=request.message.strip(),
            selected_answers=[option.label for option in selected],
            skipped=request.skipped,
            reply=batch.reply,
            question=question,
        )
    )
    board.pending_question = batch.questions[0] if batch.questions else None
    if board.pending_question:
        board.pending_question.id = uuid4().hex
        board.pending_question.photo_mode = "none"
        for option in board.pending_question.options:
            option.id = uuid4().hex
    return board
