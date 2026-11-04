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
    sensitivities: list[str] = Field(max_length=10)
    budget: str = Field(max_length=100)
    effort: str = Field(max_length=100)


class StartRequest(Model):
    context: Context
    consent: Literal[True]


class Question(Model):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=500)
    why: str = Field(min_length=1, max_length=500)


class Decision(Model):
    summary: str = Field(min_length=1, max_length=1500)
    ready: bool
    questions: list[Question] = Field(max_length=1)


class AnswerRequest(Model):
    revision: int = Field(ge=0)
    question_id: str = Field(min_length=1, max_length=80)
    answer: str = Field(min_length=1, max_length=2000)


class RevisionRequest(Model):
    revision: int = Field(ge=0)


class PlanRequest(RevisionRequest):
    preferences: Preferences


class CheckInRequest(RevisionRequest):
    message: str = Field(min_length=1, max_length=2000)


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
    actions: list[Action] = Field(min_length=1, max_length=4)
    review_days: int = Field(ge=1, le=30)
    changes: str = Field(min_length=1, max_length=1500)

    @model_validator(mode="after")
    def unique_actions(self):
        if len({action.id for action in self.actions}) != len(self.actions):
            raise ValueError("Action IDs must be unique.")
        return self


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


class SessionCreated(Model):
    token: str
    journey: Journey


class AgentStatus(Model):
    configured: bool
    max_questions: int
    max_checkin_questions: int
    mode: Literal["single-user-local"] = "single-user-local"
