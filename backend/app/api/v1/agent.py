from datetime import UTC, datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import agent_provider as provider
from app import agent_store as store
from app.agent_models import (
    AgentStatus,
    AnswerRequest,
    CheckInRequest,
    Completion,
    CompletionRequest,
    Decision,
    Event,
    Journey,
    Plan,
    PlanRequest,
    PlanVersion,
    RevisionRequest,
    SessionCreated,
    StartRequest,
)
from app.config import get_settings
from app.errors import ErrorResponse

router = APIRouter(
    prefix="/agent",
    tags=["agent"],
    responses={code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422, 502, 503)},
)
# Keep the generated contract stable across Python HTTPStatus wording changes.
router.responses[422]["description"] = "Unprocessable Content"
security = HTTPBearer(auto_error=False)
MAX_QUESTIONS = 6
MAX_CHECKIN_QUESTIONS = 3


def token(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)]) -> str:
    if credentials is None or not 20 <= len(credentials.credentials) <= 200:
        raise HTTPException(401, "A journey access token is required.")
    return credentials.credentials


Access = Annotated[str, Depends(token)]


def load(access: str, revision: int) -> Journey:
    journey = store.read(access)
    if revision != journey.revision:
        raise HTTPException(409, "Journey changed. Reload it before trying again.")
    return journey


def decide(journey: Journey) -> Decision:
    limit = MAX_QUESTIONS if journey.mode == "assessment" else MAX_CHECKIN_QUESTIONS
    count = journey.assessment_count if journey.mode == "assessment" else journey.checkin_count
    if count >= limit:
        return Decision(
            summary="Question limit reached. Ready to build or update your plan.",
            ready=True,
            questions=[],
        )
    decision = provider.generate(
        f"Decide the next question or finish now. {limit - count} questions remain in this "
        "cycle. Return ready=true with no questions when enough is known. Otherwise ask "
        "exactly one question. Use a concise summary of what the user actually reported.",
        journey.model_dump(mode="json"),
        Decision,
    )
    if decision.ready:
        decision.questions = []
    elif not decision.questions:
        raise HTTPException(502, "The agent returned no next question. Please retry.")
    previous = {
        event.question.strip().casefold() for event in journey.events if event.kind == "answer"
    }
    for question in decision.questions:
        if question.text.strip().casefold() in previous:
            raise HTTPException(502, "The agent repeated an answered question. Please retry.")
        question.id = uuid4().hex
    return decision


@router.get("/status", response_model=AgentStatus, operation_id="getAgentStatus")
def status() -> AgentStatus:
    settings = get_settings()
    return AgentStatus(
        configured=bool(settings.openai_api_key and settings.openai_model),
        max_questions=MAX_QUESTIONS,
        max_checkin_questions=MAX_CHECKIN_QUESTIONS,
    )


@router.post("/sessions", response_model=SessionCreated, operation_id="startAgentSession")
def start(body: StartRequest) -> SessionCreated:
    journey = Journey(
        context=body.context,
        decision=Decision(summary="Starting assessment.", ready=False, questions=[]),
    )
    journey.decision = decide(journey)
    return SessionCreated(token=store.create(journey), journey=journey)


@router.get("/session", response_model=Journey, operation_id="getAgentSession")
def get_session(access: Access) -> Journey:
    return store.read(access)


@router.post("/answers", response_model=Journey, operation_id="answerAgentQuestion")
def answer(body: AnswerRequest, access: Access) -> Journey:
    journey = load(access, body.revision)
    if len(journey.events) >= 104:
        raise HTTPException(409, "This journey is full. Export it before starting another.")
    if not journey.decision.questions or journey.decision.questions[0].id != body.question_id:
        raise HTTPException(409, "This question is no longer active.")
    question = journey.decision.questions[0]
    journey.events.append(
        Event(
            kind="answer", question=question.text, answer=body.answer, created_at=datetime.now(UTC)
        )
    )
    if journey.mode == "assessment":
        journey.assessment_count += 1
    else:
        journey.checkin_count += 1
    journey.decision = decide(journey)
    return store.save(access, journey, body.revision)


@router.post("/plan", response_model=Journey, operation_id="generateAgentPlan")
def plan(body: PlanRequest, access: Access) -> Journey:
    journey = load(access, body.revision)
    if len(journey.plans) >= 25:
        raise HTTPException(409, "Plan version limit reached. Export your journey first.")
    if journey.plans and journey.mode != "checkin":
        raise HTTPException(409, "Start a check-in before updating your plan.")
    journey.preferences = body.preferences
    if journey.proposal is not None:
        raise HTTPException(409, "Accept or start another check-in before generating again.")
    generated = provider.generate(
        "Create an overall personal plan from this journey. Respect skipped/unknown answers. "
        "For a revision, explain changes from the latest accepted plan. Do not fabricate facts. "
        "If safety constraints prevent specific advice, prioritize professional guidance.",
        journey.model_dump(mode="json"),
        Plan,
    )
    if journey.plans:
        journey.proposal = generated
    else:
        journey.plans.append(PlanVersion(version=1, created_at=datetime.now(UTC), plan=generated))
    journey.decision = Decision(summary=generated.summary, ready=True, questions=[])
    return store.save(access, journey, body.revision)


@router.post("/checkins", response_model=Journey, operation_id="startAgentCheckIn")
def checkin(body: CheckInRequest, access: Access) -> Journey:
    journey = load(access, body.revision)
    if not journey.plans:
        raise HTTPException(409, "Create your initial plan first.")
    if len(journey.events) >= 100 or len(journey.plans) >= 25:
        raise HTTPException(
            409, "This local journey has reached its storage limit. Export it first."
        )
    journey.mode = "checkin"
    journey.checkin_count = 0
    journey.proposal = None
    journey.events.append(
        Event(
            kind="checkin",
            question="What changed or needs adjusting?",
            answer=body.message,
            created_at=datetime.now(UTC),
        )
    )
    journey.decision = decide(journey)
    return store.save(access, journey, body.revision)


@router.post("/accept", response_model=Journey, operation_id="acceptAgentPlan")
def accept(body: RevisionRequest, access: Access) -> Journey:
    journey = load(access, body.revision)
    if journey.proposal is None:
        raise HTTPException(409, "There is no proposed plan to accept.")
    journey.plans.append(
        PlanVersion(
            version=len(journey.plans) + 1, created_at=datetime.now(UTC), plan=journey.proposal
        )
    )
    journey.proposal = None
    journey.mode = "assessment"
    return store.save(access, journey, body.revision)


@router.delete("/session", status_code=204, operation_id="deleteAgentSession")
def delete_session(access: Access) -> Response:
    store.delete(access)
    return Response(status_code=204)


@router.post("/actions", response_model=Journey, operation_id="setAgentActionCompletion")
def complete_action(body: CompletionRequest, access: Access) -> Journey:
    journey = load(access, body.revision)
    if not journey.plans:
        raise HTTPException(409, "Create a plan before recording progress.")
    current = journey.plans[-1]
    if body.action_id not in {action.id for action in current.plan.actions}:
        raise HTTPException(422, "This action is not part of your current plan.")
    journey.completions = [
        item
        for item in journey.completions
        if not (item.plan_version == current.version and item.action_id == body.action_id)
    ]
    if body.completed:
        journey.completions.append(
            Completion(
                plan_version=current.version,
                action_id=body.action_id,
                completed_at=datetime.now(UTC),
            )
        )
    return store.save(access, journey, body.revision)
