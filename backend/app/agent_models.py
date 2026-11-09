"""Bounded contracts for the adaptive beauty-agent workflow."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    options: list[AnswerOption] = Field(min_length=1)
    selection_mode: Literal["single", "multiple"] = Field(...)
    photo_mode: Literal["none", "products", "skin", "hair"] = Field(...)


class GeneratedDecision(Decision):
    questions: list[GeneratedQuestion] = Field(max_length=1)


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


class Plan(Model):
    summary: str = Field(min_length=1, max_length=2000)
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


class CoachTurn(Model):
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


class Event(Model):
    kind: Literal["answer", "checkin"]
    question: str
    answer: str
    created_at: datetime
    selected_options: list[str] = Field(default_factory=list)
    skipped: bool = False
    photo_count: int = Field(default=0, ge=0, le=3)
    photo_notes: PhotoNotes | None = None
    question_snapshot: Question | None = None


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


class SessionCreated(Model):
    token: str
    journey: Journey


class AgentStatus(Model):
    configured: bool
    max_questions: int | None
    max_checkin_questions: int | None
    mode: Literal["single-user-local", "hosted"] = "single-user-local"
