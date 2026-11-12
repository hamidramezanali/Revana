"""Short adaptive assessment; dates and measurements use explicit user input only."""

import re
from datetime import date, timedelta
from importlib.resources import files

from fastapi import HTTPException

from app import workflow
from app.agent_models import AssessmentDecision, GoalQuestion
from app.coaching_tools import local_today

LIMIT = 6
HORIZONS = {"4 weeks": 28, "8 weeks": 56, "12 weeks": 84}


def observe_timeline(journey, text):
    workspace = journey.workspace
    match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text)
    target = None
    if match:
        try:
            target = date.fromisoformat(match[1])
        except ValueError:
            return
    elif match := re.search(
        r"\b(?:in|within|over|next)\s+(\d{1,2})\s*(week|month)s?\b", text, re.IGNORECASE
    ):
        days = int(match[1]) * (7 if match[2].lower() == "week" else 30)
        if 1 <= days <= 730:
            target = local_today(journey) + timedelta(days=days)
    if target and target >= local_today(journey):
        journey.context.target_date = target.isoformat()
        workspace.timeline_note = "Requested date: " + target.isoformat()
    elif re.search(r"no (?:fixed )?(?:deadline|time limit)|no rush|ongoing", text, re.IGNORECASE):
        journey.context.target_date = ""
        workspace.timeline_note = "No fixed deadline"


def timeline_question(journey):
    workspace = journey.workspace
    if (
        workspace.assessment_complete
        or workspace.timeline_note
        or journey.context.target_date
        or "timeline" in workspace.answered_keys
    ):
        return None
    return GoalQuestion(
        key="timeline",
        text="What would meaningful progress look like, and what is your timeframe?",
        why="Your goal and deadline shape the weekly programme and realistic review points. A deadline is a preference, not a promised result.",
        choices=[*HORIZONS, "No fixed deadline"],
        text_fields=["goal_outcome", "target_date"],
    )


def apply_text(journey, request, question):
    if len(request.text_values) > 2 or any(
        key not in (question.text_fields if question else []) for key in request.text_values
    ):
        raise HTTPException(422, "Use the goal and date fields in the current question.")
    values = {key: value.strip() for key, value in request.text_values.items()}
    if any(len(value) > 1000 for value in values.values()):
        raise HTTPException(422, "Keep the goal description under 1000 characters.")
    target = values.get("target_date", "")
    if target:
        try:
            parsed = date.fromisoformat(target)
            if parsed < local_today(journey):
                raise ValueError()
        except ValueError:
            raise HTTPException(422, "Choose today or a future target date.") from None
    horizons = [
        choice for choice in request.choices if choice in HORIZONS or choice == "No fixed deadline"
    ]
    if target and horizons:
        raise HTTPException(422, "Choose a timeframe or a specific date, rather than both.")
    if (
        question
        and question.key == "timeline"
        and not request.skipped
        and request.action != "plan"
        and not target
        and not horizons
    ):
        observe_timeline(journey, request.message)
        if not journey.workspace.timeline_note and not journey.context.target_date:
            raise HTTPException(
                422, "Choose a timeframe, date or No fixed deadline, or skip this question."
            )
    lines = []
    if values.get("goal_outcome"):
        journey.workspace.outcome = values["goal_outcome"]
        lines.append("Desired outcome: " + values["goal_outcome"])
    if target:
        journey.context.target_date = target
        journey.workspace.timeline_note = "Requested date: " + target
        lines.append("Target date: " + target)
    elif horizons:
        choice = horizons[0]
        journey.workspace.timeline_note = choice
        journey.context.target_date = (
            (local_today(journey) + timedelta(days=HORIZONS[choice])).isoformat()
            if choice in HORIZONS
            else ""
        )
    return lines


def next_question(journey, context):
    workspace = journey.workspace
    if workspace.assessment_complete or workspace.assessment_count >= LIMIT:
        workspace.assessment_complete = True
        return None
    # One short coach request, no plan generation/reviewer in a question round.
    decision = workflow.stage(
        "coach",
        files("app").joinpath("prompts/assessment.md").read_text(encoding="utf-8"),
        {
            **context,
            "assessment": {
                "answered_keys": workspace.answered_keys,
                "questions_used": workspace.assessment_count,
                "questions_remaining": LIMIT - workspace.assessment_count,
                "outcome": workspace.outcome or workspace.objective,
                "target_date": journey.context.target_date,
                "timeline_note": workspace.timeline_note,
            },
            "_max_output_tokens": 1800,
        },
        AssessmentDecision,
    )
    workflow.absorb(journey, decision, context)
    question = decision.question
    if question and (
        question.key in workspace.answered_keys
        or (
            question.fields
            and all(getattr(journey.body, key) is not None for key in question.fields)
        )
    ):
        # Avoid repeated model questions; move on safely with explicit unknowns.
        question = None
    if question and journey.context.goals == ["body"]:
        question.photo_mode = "none"
        if question.key == "products":
            question = None
    if question:
        workspace.question = question
        workspace.reply = decision.reply
        workspace.phase = "needs_input"
        return question
    workspace.assessment_complete = True
    return None
