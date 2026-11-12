"""Bounded contracts for the adaptive beauty-agent workflow."""

from datetime import date, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


Goal = Literal["skin", "hair", "body", "energy", "other"]


class Context(Model):
    goals: list[Goal] = Field(min_length=1, max_length=5)
    description: str = Field(max_length=2000)
    target_date: str = Field(max_length=10)


class Preferences(Model):
    limitations: str = Field(default="", max_length=800)
    sensitivities: list[str]
    budget: str = Field(max_length=100)
    effort: str = Field(max_length=100)


class StartRequest(Model):
    context: Context
    consent: Literal[True]


class AnswerOption(Model):
    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    exclusive: bool


class Question(Model):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=500)
    why: str = Field(min_length=1, max_length=500)
    # Defaults preserve saved journeys from before selectable questions were added.
    options: list[AnswerOption] = Field(default_factory=list)
    selection_mode: Literal["single", "multiple"] = "multiple"
    photo_mode: Literal["none", "products", "skin", "hair"] = "none"
    input_kind: Literal["options", "number", "date", "text"] = "options"
    unit: Literal["kg", "cm", "years", "minutes", "SEK", ""] = ""
    number_min: float | None = None
    number_max: float | None = None
    profile_key: (
        Literal[
            "age",
            "height_cm",
            "weight_kg",
            "target_weight_kg",
            "daily_minutes",
            "monthly_budget_sek",
        ]
        | None
    ) = None

    @model_validator(mode="after")
    def distinct_options(self):
        if len({option.id for option in self.options}) != len(self.options):
            raise ValueError("Option IDs must be unique.")
        labels = {option.label.strip().casefold() for option in self.options}
        if "" in labels or len(labels) != len(self.options):
            raise ValueError("Option labels must be distinct and nonempty.")
        return self


class Decision(Model):
    summary: str = Field(min_length=1, max_length=1500)
    ready: bool
    questions: list[Question] = Field(max_length=1)


class GeneratedQuestion(Question):
    # All output properties must be required for the strict provider schema.
    options: list[AnswerOption] = Field(default_factory=list)
    selection_mode: Literal["single", "multiple"] = Field(...)
    photo_mode: Literal["none", "products", "skin", "hair"] = Field(...)


class GeneratedDecision(Decision):
    questions: list[GeneratedQuestion] = Field(max_length=1)


FactCategory = Literal[
    "goal",
    "allergy",
    "limitation",
    "preference",
    "concern",
    "routine",
    "measurement",
    "observation",
    "health_context",
]
FactStatus = Literal["reported", "hypothesis", "unknown", "needs_review"]


class FactCandidate(Model):
    category: FactCategory
    value: str = Field(min_length=1, max_length=400)
    source_id: str
    quote: str = Field(min_length=1, max_length=2000)
    status: FactStatus
    supersedes_id: str | None


class ProfileFact(Model):
    id: str
    category: FactCategory
    value: str
    source_id: str
    quote: str
    status: FactStatus
    active: bool = True
    updated_at: datetime | None = None
    confirmed: bool = False
    source_kind: Literal["report", "visual_observation"] = "report"


class ProfileEdit(Model):
    revision: int = Field(ge=0)
    fact_id: str | None = None
    category: FactCategory
    value: str = Field(min_length=1, max_length=400)
    status: FactStatus = "reported"
    active: bool = True


class ResearchIntent(Model):
    needed: bool
    query: str = Field(max_length=200)
    kind: Literal["evidence", "product", "service"]


class CoachDecision(GeneratedDecision):
    facts: list[FactCandidate]
    conflicts: list[str]
    research: ResearchIntent


class AnswerRequest(Model):
    revision: int = Field(ge=0)
    # Editing is limited to answers in the active, unfinished question cycle.
    event_index: int | None = Field(default=None, ge=0)
    question_id: str = Field(min_length=1, max_length=80)
    answer: str = Field(default="", max_length=2000)
    selected_option_ids: list[str] = Field(default_factory=list)
    skipped: bool = False
    photos: list[str] = Field(default_factory=list, max_length=3)
    photo_consent: bool = False

    @model_validator(mode="after")
    def meaningful_answer(self):
        if self.skipped:
            if self.answer.strip() or self.selected_option_ids or self.photos:
                raise ValueError("A skipped question cannot include answers.")
        elif not self.answer.strip() and not self.selected_option_ids and not self.photos:
            raise ValueError("Choose an option or add an answer.")
        if self.photos and (not self.photo_consent or any(len(p) > 1_200_000 for p in self.photos)):
            raise ValueError("Photo consent and supported size are required.")
        if len(set(self.selected_option_ids)) != len(self.selected_option_ids):
            raise ValueError("Selected option IDs must be distinct.")
        return self


class RevisionRequest(Model):
    revision: int = Field(ge=0)


class AcceptRequest(RevisionRequest):
    confirm_profile: bool = False


class FitOptions(Model):
    options: list[str]
    limitations_hint: str = Field(min_length=1, max_length=300)

    @model_validator(mode="after")
    def distinct_options(self):
        labels = {item.strip().casefold() for item in self.options}
        if "" in labels or len(labels) != len(self.options):
            raise ValueError("Fit options must be distinct and nonempty.")
        if any(len(item) > 120 for item in self.options):
            raise ValueError("Fit options must be short.")
        return self


class PhotoReading(Model):
    observations: list[str] = Field(max_length=6)
    uncertainties: list[str] = Field(min_length=1, max_length=4)


class PhotoNotes(PhotoReading):
    confirmed: bool = False


class PhotoNotesRequest(RevisionRequest):
    event_index: int = Field(ge=0)
    observations: list[str] = Field(default_factory=list, max_length=6)
    discard: bool = False

    @model_validator(mode="after")
    def bounded_notes(self):
        if any(not item.strip() or len(item) > 500 for item in self.observations):
            raise ValueError("Use up to six short nonempty observations.")
        return self


class PlanRequest(RevisionRequest):
    preferences: Preferences
    confirm_profile: bool = False


class CheckInRequest(RevisionRequest):
    message: str = Field(min_length=1, max_length=2000)


class ActionPreferenceRequest(RevisionRequest):
    action_id: str = Field(min_length=1, max_length=80)
    choice: Literal["keep", "not_for_me", "clear"]


class ReshuffleRequest(RevisionRequest):
    message: str = Field(default="", max_length=1000)


class SuggestionRequest(RevisionRequest):
    message: str = Field(default="", max_length=2000)
    question_id: str | None = Field(default=None, min_length=1, max_length=80)
    selected_option_ids: list[str] = Field(default_factory=list)
    skipped: bool = False

    @model_validator(mode="after")
    def valid_answer(self):
        if len(set(self.selected_option_ids)) != len(self.selected_option_ids):
            raise ValueError("Selected option IDs must be distinct.")
        if self.selected_option_ids and self.question_id is None:
            raise ValueError("Choose from an active question.")
        if self.skipped and (
            self.question_id is None or self.message.strip() or self.selected_option_ids
        ):
            raise ValueError("A skip needs a question and cannot contain an answer.")
        if self.question_id and not (
            self.skipped or self.message.strip() or self.selected_option_ids
        ):
            raise ValueError("Choose an option, add an answer or skip.")
        return self


class ActionPreference(Model):
    plan_version: int
    action_id: str
    choice: Literal["keep", "not_for_me"]


class PlanFeedback(Model):
    plan_version: int
    kept_action_ids: list[str]
    rejected_action_ids: list[str]
    message: str
    created_at: datetime


class Exercise(Model):
    name: str = Field(min_length=1, max_length=100)
    sets: int | None = Field(default=None, ge=1, le=10)
    repetitions: str = Field(default="", max_length=80)
    duration_minutes: int | None = Field(default=None, ge=1, le=180)
    rest_seconds: int | None = Field(default=None, ge=0, le=600)
    instructions: str = Field(min_length=1, max_length=500)
    easier_alternative: str = Field(min_length=1, max_length=300)


class Action(Model):
    id: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=150)
    detail: str = Field(min_length=1, max_length=1000)
    why: str = Field(min_length=1, max_length=1000)
    timing: str = Field(min_length=1, max_length=300)
    cost: str = Field(min_length=1, max_length=200)
    effort: str = Field(min_length=1, max_length=100)
    observation: str = Field(min_length=1, max_length=500)
    minutes: int | None = Field(default=None, ge=0, le=240)
    monthly_cost_sek: float | None = Field(default=None, ge=0, le=100000)
    days: list[int] = Field(default_factory=lambda: list(range(7)), max_length=7)
    time_of_day: Literal["morning", "midday", "evening", "flexible"] = "flexible"
    exercises: list[Exercise] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def valid_days(self):
        if any(day not in range(7) for day in self.days) or len(set(self.days)) != len(self.days):
            raise ValueError("Use distinct weekday numbers from zero to six.")
        return self


class Milestone(Model):
    day: int = Field(ge=1, le=84)
    label: Literal["Observe", "Review", "Too early to assess", "Seek assessment"]
    description: str = Field(min_length=1, max_length=400)
    assumptions: str = Field(max_length=400)


class BodyContext(Model):
    age: int | None = Field(default=None, ge=18, le=120)
    height_cm: float | None = Field(default=None, ge=100, le=250)
    weight_kg: float | None = Field(default=None, ge=25, le=400)
    target_weight_kg: float | None = Field(default=None, ge=25, le=400)
    equation_coefficient: Literal["female", "male", "not_specified"] = "not_specified"
    pregnancy: Literal["unknown", "not_applicable", "pregnant_or_breastfeeding"] = "unknown"
    activity: Literal["unknown", "mostly_seated", "some_activity", "regular_training"] = "unknown"
    daily_minutes: int | None = Field(default=None, ge=1, le=240)
    monthly_budget_sek: float | None = Field(default=None, ge=0, le=100000)
    city: str = Field(default="", max_length=100)
    timezone: str = "Europe/Stockholm"

    @model_validator(mode="after")
    def valid_timezone(self):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Choose a supported timezone.") from None
        return self


class GoalEdit(RevisionRequest):
    goals: list[Literal["skin", "hair", "body"]] = Field(min_length=1, max_length=3)
    target_date: str = Field(default="", max_length=10)

    @model_validator(mode="after")
    def valid_goals(self):
        if len(set(self.goals)) != len(self.goals):
            raise ValueError("Choose distinct goals.")
        if self.target_date:
            date.fromisoformat(self.target_date)
        return self


class BodyEdit(RevisionRequest):
    body: BodyContext


class ProgressRequest(RevisionRequest):
    meal_key: str | None = Field(default=None, max_length=30)
    action_id: str | None = Field(default=None, max_length=80)
    status: Literal["not_attempted", "inconsistent", "followed", "improved", "unchanged", "worse"]
    note: str = Field(default="", max_length=1000)
    observed_on: date


class ProgressEntry(Model):
    meal_key: str | None = None
    id: str
    plan_version: int
    action_id: str | None
    status: Literal["not_attempted", "inconsistent", "followed", "improved", "unchanged", "worse"]
    note: str
    observed_on: date
    recorded_at: datetime


class MealIngredient(Model):
    food_id: int = Field(ge=1)
    grams: float = Field(gt=0, le=2000)


class MealNutrition(Model):
    available: bool
    kcal: float | None
    protein_g: float | None
    missing_food_ids: list[int]
    source: str


class Meal(Model):
    day: int = Field(ge=0, le=6)
    slot: Literal["breakfast", "lunch", "dinner", "snack"]
    title: str = Field(min_length=1, max_length=150)
    ingredients: list[MealIngredient] = Field(min_length=1, max_length=12)
    instructions: str = Field(min_length=1, max_length=1000)
    preparation_minutes: int = Field(ge=0, le=180)
    substitution_note: str = Field(max_length=400)

    @model_validator(mode="before")
    @classmethod
    def recompute_saved_totals(cls, value):
        if isinstance(value, dict):
            value = {key: item for key, item in value.items() if key != "nutrition"}
        return value

    @computed_field
    @property
    def nutrition(self) -> MealNutrition:
        from app.nutrition import meal_totals

        return MealNutrition(**meal_totals(self.ingredients))


class MealSwap(RevisionRequest):
    day: int = Field(ge=0, le=6)
    slot: Literal["breakfast", "lunch", "dinner", "snack"]
    source_day: int = Field(ge=0, le=6)
    source_slot: Literal["breakfast", "lunch", "dinner", "snack"]


class Plan(Model):
    summary: str = Field(min_length=1, max_length=2000)
    priority: str = Field(default="", max_length=400)
    deferred: list[str] = Field(default_factory=list, max_length=6)
    milestones: list[Milestone] = Field(default_factory=list, max_length=6)
    meals: list[Meal] = Field(default_factory=list, max_length=28)
    reported: list[str] = Field(max_length=8)
    hypotheses: list[str] = Field(max_length=8)
    uncertainties: list[str] = Field(max_length=8)
    safety_notes: list[str] = Field(min_length=1, max_length=8)
    actions: list[Action] = Field(min_length=1)
    review_days: int = Field(ge=1, le=30)
    changes: str = Field(min_length=1, max_length=1500)

    @model_validator(mode="after")
    def unique_actions(self):
        if len({action.id for action in self.actions}) != len(self.actions):
            raise ValueError("Action IDs must be unique.")
        slots = [(meal.day, meal.slot) for meal in self.meals]
        if len(set(slots)) != len(slots):
            raise ValueError("Each day and meal slot must be unique.")
        return self


class ReplacementAction(Action):
    replaces_action_id: str = Field(min_length=1, max_length=80)


class ReshuffleDraft(Plan):
    actions: list[ReplacementAction]


class SuggestionBatch(Model):
    reply: str = Field(min_length=1, max_length=4000)
    questions: list[GeneratedQuestion] = Field(max_length=1)
    actions: list[Action]
    safety_notes: list[str] = Field(min_length=1, max_length=8)


class CoachResponse(SuggestionBatch):
    facts: list[FactCandidate]
    conflicts: list[str]
    research: ResearchIntent
    ready_for_plan: bool


class ResearchSource(Model):
    id: str
    title: str
    url: str
    retrieved_at: datetime
    kind: Literal["evidence", "product", "service"]
    applicability: str
    uncertainty: str


class ResearchResult(Model):
    status: Literal["not_needed", "retrieved", "unavailable", "limited"] = "not_needed"
    summary: str = "No web research requested."
    sources: list[ResearchSource] = Field(default_factory=list)


class ActionCheck(Model):
    action_id: str
    status: Literal["compatible", "incompatible", "needs_review"]
    reason: str
    source_ids: list[str]


class ReviewResult(Model):
    approved: bool
    public_summary: str = Field(min_length=1, max_length=4000)
    issues: list[str]
    correction: str
    limitations: list[str]
    action_checks: list[ActionCheck]
    suggested_starts: list[str]

    @model_validator(mode="before")
    @classmethod
    def migrate_previous_review(cls, data):
        if isinstance(data, dict) and "public_summary" not in data:
            data = {
                **data,
                "public_summary": "This saved review predates the public explanation. Check the listed limitations and action checks.",
            }
        return data


class WorkflowState(Model):
    stages: list[str] = Field(default_factory=list)
    research: ResearchResult = Field(default_factory=ResearchResult)
    review: ReviewResult | None = None
    status: Literal["ready", "needs_review", "retry"] = "ready"
    message: str = ""
    report_source: str = ""


class CoachTurn(Model):
    source_id: str = Field(default_factory=lambda: uuid4().hex)
    event_count: int | None = None
    purpose: Literal["conversation", "preferences"] = "conversation"
    created_at: datetime
    message: str
    selected_answers: list[str]
    skipped: bool
    reply: str
    # Display/replay metadata only; unselected options never become model facts.
    question: Question | None = None


class SuggestionBoard(Model):
    # Separate from accepted plan versions; defaults migrate existing journeys lazily.
    suggestions: list[Action] = Field(default_factory=list)
    kept: list[Action] = Field(default_factory=list)
    seen: list[Action] = Field(default_factory=list)
    rejected_ids: list[str] = Field(default_factory=list)
    rounds: int = Field(default=0, ge=0)
    safety_notes: list[str] = Field(default_factory=list, max_length=8)
    conversation: list[CoachTurn] = Field(default_factory=list)
    pending_question: Question | None = None


class Completion(Model):
    plan_version: int
    action_id: str
    completed_at: datetime


class CompletionRequest(RevisionRequest):
    action_id: str = Field(min_length=1, max_length=80)
    completed: bool


class PlanVersion(Model):
    version: int
    created_at: datetime
    plan: Plan
    research: ResearchResult = Field(default_factory=ResearchResult)
    review: ReviewResult | None = None


class Event(Model):
    source_id: str = Field(default_factory=lambda: uuid4().hex)
    kind: Literal["answer", "checkin"]
    question: str
    answer: str
    created_at: datetime
    selected_options: list[str] = Field(default_factory=list)
    skipped: bool = False
    photo_count: int = Field(default=0, ge=0, le=3)
    photo_notes: PhotoNotes | None = None
    question_snapshot: Question | None = None


class GoalQuestion(Model):
    id: str = Field(default_factory=lambda: uuid4().hex)
    key: Literal["baseline", "goal", "constraints", "routine", "products", "progress", "other"]
    text: str = Field(min_length=1, max_length=300)
    why: str = Field(max_length=300)
    choices: list[str] = Field(default_factory=list, max_length=6)
    fields: list[
        Literal["height_cm", "weight_kg", "age", "daily_minutes", "monthly_budget_sek"]
    ] = Field(default_factory=list, max_length=3)
    multiple: bool = False
    photo_mode: Literal["none", "products", "skin", "hair"] = "none"


class RunStep(Model):
    id: str
    label: str
    status: Literal["working", "done", "failed"]


class GoalRun(Model):
    id: str
    status: Literal["running", "complete", "cancelled", "failed"]
    started_at: datetime
    steps: list[RunStep] = Field(default_factory=list)
    error: str = ""


class WorkingMessage(Model):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=4000)


class IdeaFeedback(Model):
    action: Action
    choice: Literal["keep", "remove"]


class IdeaEdit(Model):
    base: Plan
    action_id: str
    intent: Literal["details", "improve"]


class IdeaChoiceRequest(RevisionRequest):
    action_id: str = Field(min_length=1, max_length=80)
    choice: Literal["keep", "remove", "clear"]


class GoalWorkspace(Model):
    title: str = Field(max_length=120)
    objective: str = Field(max_length=2000)
    phase: Literal["idle", "needs_input", "running", "review", "ready", "error", "cancelled"] = (
        "idle"
    )
    reply: str = ""
    question: GoalQuestion | None = None
    answered_keys: list[str] = Field(default_factory=list)
    messages: list[WorkingMessage] = Field(default_factory=list)
    run: GoalRun | None = None
    pending_draft: Plan | None = None
    idea_feedback: list[IdeaFeedback] = Field(default_factory=list, max_length=100)
    idea_edit: IdeaEdit | None = None


class WorkspaceDraft(Plan):
    reply: str = Field(min_length=1, max_length=1800)
    facts: list[FactCandidate] = Field(max_length=12)
    conflicts: list[str] = Field(max_length=6)
    clarification: GoalQuestion | None = None


class CreateGoal(Model):
    message: str = Field(min_length=1, max_length=2000)
    consent: Literal[True]
    goals: list[Literal["skin", "hair", "body"]] = Field(default_factory=list, max_length=3)
    reuse_profile: bool = True


class WorkRequest(RevisionRequest):
    message: str = Field(default="", max_length=2000)
    question_id: str | None = None
    choices: list[str] = Field(default_factory=list, max_length=6)
    values: dict[str, float] = Field(default_factory=dict)
    skipped: bool = False
    photos: list[str] = Field(default_factory=list, max_length=3)
    photo_consent: bool = False
    action: Literal["continue", "plan", "retry"] = "continue"
    action_id: str | None = Field(default=None, max_length=80)
    idea_intent: Literal["details", "improve"] | None = None


class Journey(Model):
    revision: int = 0
    context: Context
    preferences: Preferences | None = None
    events: list[Event] = Field(default_factory=list)
    decision: Decision
    mode: Literal["assessment", "checkin"] = "assessment"
    assessment_count: int = 0
    checkin_count: int = 0
    plans: list[PlanVersion] = Field(default_factory=list)
    proposal: Plan | None = None
    completions: list[Completion] = Field(default_factory=list)
    action_preferences: list[ActionPreference] = Field(default_factory=list)
    plan_feedback: list[PlanFeedback] = Field(default_factory=list)
    suggestion_board: SuggestionBoard | None = None
    profile: list[ProfileFact] = Field(default_factory=list)
    profile_revision: int = 0
    profile_conflicts: list[str] = Field(default_factory=list)
    workflow: WorkflowState = Field(default_factory=WorkflowState)
    research_intent: ResearchIntent | None = None
    body: BodyContext = Field(default_factory=BodyContext)
    progress: list[ProgressEntry] = Field(default_factory=list)
    profile_confirmed_revision: int | None = None
    memory_consolidated: bool = False
    workspace: GoalWorkspace | None = None


class SessionCreated(Model):
    token: str
    journey: Journey


class AgentStatus(Model):
    configured: bool
    max_questions: int | None
    max_checkin_questions: int | None
    mode: Literal["single-user-local", "hosted"] = "single-user-local"
