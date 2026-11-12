"""Explicit coach -> optional real retrieval -> planner -> reviewer orchestration."""

from contextvars import ContextVar
from datetime import UTC, datetime
from time import monotonic
from uuid import uuid4

from fastapi import HTTPException

from app import agent_provider as provider
from app.agent_models import (
    ActionCheck,
    CoachResponse,
    CoachTurn,
    Journey,
    ProfileFact,
    ResearchIntent,
    ReviewResult,
    SuggestionBoard,
    WorkflowState,
)
from app.config import get_settings
from app.research import retrieve

_event_sink: ContextVar[object | None] = ContextVar("workspace_events", default=None)

_deadline: ContextVar[float | None] = ContextVar("workflow_deadline", default=None)


def reports(journey: Journey) -> dict[str, str]:
    result = {"opening": journey.context.description}
    for fact in journey.profile:
        if (
            fact.active
            and fact.confirmed
            and fact.source_kind == "report"
            and fact.quote not in result.get(fact.source_id, "")
        ):
            result[fact.source_id] = result.get(fact.source_id, "") + "\n" + fact.quote
    for event in journey.events:
        if not event.skipped:
            result[f"event-{event.source_id}"] = "\n".join([*event.selected_options, event.answer])
    if journey.suggestion_board:
        for turn in journey.suggestion_board.conversation:
            if not turn.skipped:
                result[f"turn-{turn.source_id}"] = "\n".join([*turn.selected_answers, turn.message])
    if journey.preferences:
        result["preferences"] = "\n".join(
            [
                *journey.preferences.sensitivities,
                journey.preferences.limitations,
                journey.preferences.budget,
                journey.preferences.effort,
            ]
        )
    return result


def context_for(journey: Journey, context: dict) -> dict:
    context = {
        key: value
        for key, value in context.items()
        if key not in {"workflow", "profile", "research_intent"}
    }
    from app.coaching_tools import body_guidance, progress_context

    return {
        **context,
        "body_context": journey.body.model_dump(mode="json"),
        "body_guidance": body_guidance(journey),
        "progress_review": progress_context(journey),
        "reported_profile": [
            fact.model_dump(mode="json") for fact in journey.profile if fact.active
        ],
        "profile_conflicts": journey.profile_conflicts,
        "reports_by_source": reports(journey),
    }


def stage(role: str, task: str, context: dict, output):
    stage_limit = {"planner": 120, "reviewer": 60}.get(role, 45)
    remaining = (_deadline.get() - monotonic()) if _deadline.get() is not None else stage_limit
    if remaining < 2:
        raise HTTPException(
            502, "The response took too long. Your saved choices remain available; retry."
        )
    sink = _event_sink.get()
    if sink:
        sink({"type": "stage", "role": role, "status": "working"})
    result = provider.generate(
        f"[stage:{role}] {task}", {**context, "_stage_timeout": min(stage_limit, remaining)}, output
    )
    if sink:
        sink({"type": "stage", "role": role, "status": "done"})
    return result


def absorb(journey: Journey, result, context: dict) -> None:
    sources = context.get("reports_by_source", {})
    changed = False
    for candidate in getattr(result, "facts", []):
        if (
            candidate.source_id not in sources
            or candidate.quote not in sources[candidate.source_id]
        ):
            continue  # Untraceable extraction never becomes a profile fact.
        if any(
            f.category == candidate.category and f.value.casefold() == candidate.value.casefold()
            for f in journey.profile
        ):
            continue
        if (
            candidate.supersedes_id
            and candidate.status == "reported"
            and candidate.category in {"goal", "preference"}
        ):
            for fact in journey.profile:
                if fact.id == candidate.supersedes_id and fact.category == candidate.category:
                    fact.active = False
        journey.profile.append(
            ProfileFact(
                id=uuid4().hex,
                category=candidate.category,
                value=candidate.value,
                source_id=candidate.source_id,
                quote=candidate.quote,
                status=candidate.status,
                updated_at=datetime.now(UTC),
            )
        )
        changed = True
    journey.profile_conflicts = list(
        dict.fromkeys(getattr(result, "conflicts", journey.profile_conflicts))
    )
    if changed:
        journey.profile_revision += 1


def begin(journey: Journey) -> None:
    journey.workflow = WorkflowState()
    _deadline.set(monotonic() + get_settings().workflow_timeout_seconds)


def research(journey: Journey, intent: ResearchIntent | None) -> None:
    from app.guidance import library

    journey.workflow.research = library(journey.context.goals)
    if intent and intent.needed:
        journey.workflow.stages.append("researcher")
        if _deadline.get() is not None and _deadline.get() - monotonic() < 30:
            journey.workflow.research.status = "unavailable"
            journey.workflow.research.summary = "Research could not finish within this response's time budget. No sources were verified."
            return
        journey.workflow.research = retrieve(intent)


def quarantine(journey: Journey, reason: str) -> None:
    actions = visible_actions(journey)
    journey.workflow.status = "needs_review"
    journey.workflow.review = ReviewResult(
        approved=False,
        public_summary=reason,
        issues=[reason],
        correction="",
        limitations=[reason],
        action_checks=[
            ActionCheck(action_id=a.id, status="needs_review", reason=reason, source_ids=[])
            for a in actions
        ],
        suggested_starts=[],
    )


def visible_actions(journey: Journey) -> list:
    actions = []
    if journey.plans:
        actions.extend(journey.plans[-1].plan.actions)
    if journey.suggestion_board:
        actions.extend([*journey.suggestion_board.suggestions, *journey.suggestion_board.kept])
    return list({a.id: a for a in actions}.values())


def review(journey: Journey, context: dict, draft) -> ReviewResult:
    actions = {a.id: a for a in visible_actions(journey)}
    actions.update({a.id: a for a in getattr(draft, "actions", [])})
    review_context = {
        **context_for(journey, context),
        "draft": draft.model_dump(mode="json"),
        "actions_to_check": [a.model_dump() for a in actions.values()],
        "research_context": journey.workflow.research.model_dump(mode="json"),
    }
    journey.workflow.stages.append("reviewer")
    result = stage(
        "reviewer",
        "Review usefulness, request/deadline coverage, constraints and factual support. Check every supplied action ID.",
        review_context,
        ReviewResult,
    )
    source_ids = {s.id for s in journey.workflow.research.sources}
    checks = {item.action_id: item for item in result.action_checks if item.action_id in actions}
    for action_id in actions:
        if action_id not in checks:
            checks[action_id] = ActionCheck(
                action_id=action_id,
                status="needs_review",
                reason="This action has not been checked against your current context.",
                source_ids=[],
            )
        check = checks[action_id]
        if any(value not in source_ids for value in check.source_ids):
            check.source_ids = [value for value in check.source_ids if value in source_ids]
            check.status = "needs_review"
            check.reason = "The proposed source support could not be verified."
    result.action_checks = list(checks.values())
    result.suggested_starts = [
        value
        for value in result.suggested_starts
        if value in {a.id for a in getattr(draft, "actions", [])}
        and checks[value].status == "compatible"
    ][:2]
    journey.workflow.review = result
    if not result.approved or any(item.status != "compatible" for item in result.action_checks):
        journey.workflow.status = "needs_review"
    return result


def plan(journey: Journey, task: str, context: dict, output):
    from app.coaching_graph import plan as graph_plan

    return graph_plan(journey, task, context, output)


def require_usable_plan(journey: Journey, draft):
    from app.coaching_graph import plan_issues

    problems = plan_issues(journey, draft)
    if problems:
        raise HTTPException(
            502,
            "The combined plan needs adjustment: "
            + " ".join(problems)
            + " Your accepted plan is unchanged.",
        )
    if journey.workflow.review:
        unsafe = {
            c.action_id for c in journey.workflow.review.action_checks if c.status != "compatible"
        }
        # Immutable kept/history stays stored, but never accept a newly unsafe draft.
        if any(a.id in unsafe for a in draft.actions):
            raise HTTPException(
                502,
                "The draft still needs constraint review. Your accepted plan is unchanged; clarify your limits or retry.",
            )
    return draft


def remap_checks(journey: Journey, mapping: dict[str, str]) -> None:
    if journey.workflow.review:
        for check in journey.workflow.review.action_checks:
            check.action_id = mapping.get(check.action_id, check.action_id)
        journey.workflow.review.suggested_starts = [
            mapping.get(value, value) for value in journey.workflow.review.suggested_starts
        ]


def intake_revision(journey: Journey, context: dict, message: str):
    begin(journey)
    enriched = context_for(journey, context)
    enriched["current_request"] = {"message": message, "selected_answers": [], "skipped": False}
    source_id = uuid4().hex
    enriched["reports_by_source"][f"turn-{source_id}"] = message
    journey.workflow.stages.append("coach")
    response = stage(
        "coach",
        "Understand this plan revision request. Extract only explicit sourced reports; ask a focused question only if needed for a safe useful revision. The planner will construct the revision.",
        enriched,
        CoachResponse,
    )
    board = journey.suggestion_board or SuggestionBoard()
    board.conversation.append(
        CoachTurn(
            source_id=source_id,
            event_count=len(journey.events),
            created_at=datetime.now(UTC),
            message=message,
            selected_answers=[],
            skipped=False,
            reply=getattr(response, "reply", "Your revision request is recorded."),
        )
    )
    board.pending_question = response.questions[0] if getattr(response, "questions", []) else None
    if board.pending_question:
        board.pending_question.id = uuid4().hex
        for option in board.pending_question.options:
            option.id = uuid4().hex
    journey.suggestion_board = board
    absorb(journey, response, enriched)
    journey.research_intent = getattr(response, "research", None)
    research(journey, journey.research_intent)
    return response, enriched


def consolidate_memory(journey: Journey) -> None:
    """After explicit profile/plan approval, retain relevant facts, not a transcript.

    Legacy records are converted only at that explicit approval boundary. This does
    not purge historical backups or change the AI provider's retention policy.
    """
    for event in journey.events:
        if event.photo_notes and event.photo_notes.confirmed:
            for observation in event.photo_notes.observations:
                if not any(
                    f.active and f.source_kind == "visual_observation" and f.value == observation
                    for f in journey.profile
                ):
                    journey.profile.append(
                        ProfileFact(
                            id=uuid4().hex,
                            category="observation",
                            value=observation[:400],
                            source_id=f"photo-{event.source_id}",
                            quote=observation[:400],
                            status="needs_review",
                            active=True,
                            confirmed=True,
                            source_kind="visual_observation",
                            updated_at=datetime.now(UTC),
                        )
                    )
    for fact in journey.profile:
        if fact.active:
            fact.quote = fact.quote[:400]
            if fact.status == "reported":
                fact.confirmed = True
    journey.profile = [fact for fact in journey.profile if fact.active]
    journey.events = []
    if journey.suggestion_board:
        journey.suggestion_board.conversation = []
        journey.suggestion_board.pending_question = None
    journey.research_intent = None
    journey.profile_confirmed_revision = journey.profile_revision
    journey.memory_consolidated = True
