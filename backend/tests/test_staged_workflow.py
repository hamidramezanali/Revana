from copy import deepcopy

import pytest
from fastapi import HTTPException
from test_agent import agent as agent_fixture
from test_agent import example_plan, plan

from app import agent_provider, agent_store, workflow
from app.agent_models import (
    ActionCheck,
    CoachDecision,
    CoachResponse,
    FactCandidate,
    GeneratedQuestion,
    ResearchIntent,
    ReviewResult,
    SuggestionBatch,
)

agent = agent_fixture
REAL_REVIEW = workflow.review


def question():
    return GeneratedQuestion(
        id="provider-question",
        text="What would make the next step fit your day?",
        why="Focus on the missing practical constraint.",
        options=[
            {"id": "a", "label": "A short routine", "exclusive": False},
            {"id": "b", "label": "A flexible routine", "exclusive": False},
        ],
        selection_mode="multiple",
        photo_mode="none",
    )


def install_pipeline(monkeypatch, *, clarify=False, deny=False, needs_research=False):
    calls = []
    monkeypatch.setattr(workflow, "review", REAL_REVIEW)

    def generate(task, context, output):
        calls.append((task, deepcopy(context)))
        facts = []
        for source, text in context.get("reports_by_source", {}).items():
            if "synthetic allergy" in text:
                facts.append(
                    FactCandidate(
                        category="allergy",
                        value="synthetic allergy",
                        source_id=source,
                        quote="synthetic allergy",
                        status="reported",
                        supersedes_id=None,
                    )
                )
        none = ResearchIntent(
            needed=needs_research,
            query="generic activity guidance" if needs_research else "",
            kind="evidence",
        )
        if output is CoachDecision:
            next_question = question()
            next_question.text += f" ({len(context.get('events', [])) + 1})"
            return CoachDecision(
                summary="I understand your goal. What practical constraint matters next?",
                ready=False,
                questions=[next_question],
                facts=facts,
                conflicts=[],
                research=none,
            )
        if output is CoachResponse:
            return CoachResponse(
                reply="I’ve taken your latest constraint into account.",
                questions=[question()] if clarify else [],
                actions=[],
                safety_notes=["Choose what fits."],
                facts=facts,
                conflicts=[],
                research=none,
                ready_for_plan=not clarify,
            )
        if output is ReviewResult:
            constrained = any(
                f["value"] == "synthetic allergy" for f in context["reported_profile"]
            )
            checks = [
                ActionCheck(
                    action_id=a["id"],
                    status="incompatible" if constrained and a["id"] == "observe" else "compatible",
                    reason="Conflicts with the newly reported constraint."
                    if constrained and a["id"] == "observe"
                    else "Fits the synthetic request.",
                    source_ids=[],
                )
                for a in context["actions_to_check"]
            ]
            return ReviewResult(
                approved=not deny,
                public_summary="I understand your current goal and constraints. The remaining useful routes are alternatives, with individual suitability still uncertain.",
                issues=["The alternatives do not meaningfully address the requested goal."]
                if deny
                else [],
                correction="Replace trivial alternatives with useful actions tied to the requested goal."
                if deny
                else "",
                limitations=[],
                action_checks=checks,
                suggested_starts=[a["id"] for a in context["draft"].get("actions", [])][:2],
            )
        if output is SuggestionBatch:
            action = (
                example_plan()
                .actions[0]
                .model_copy(
                    update={
                        "id": "temporary",
                        "title": "A practical alternative",
                        "detail": "Synthetic action detail",
                    }
                )
            )
            return SuggestionBatch(
                reply="Choose a starting point that fits.",
                questions=[],
                actions=[action],
                safety_notes=["Choose what fits."],
            )
        return example_plan()

    monkeypatch.setattr(agent_provider, "generate", generate)
    return calls


def start(client, description="A synthetic goal"):
    result = client.post(
        "/v1/agent/sessions",
        json={
            "context": {"goals": ["body"], "description": description, "target_date": ""},
            "consent": True,
        },
    )
    assert result.status_code == 200, result.text
    body = result.json()
    return {"Authorization": f"Bearer {body['token']}"}, body["journey"]


def send(client, headers, journey, message, **extra):
    return client.post(
        "/v1/agent/coach",
        headers=headers,
        json={"revision": journey["revision"], "message": message, **extra},
    )


def test_actual_stages_use_profile_and_recheck_existing_kept_actions_during_clarification(
    agent, monkeypatch
):
    client, _ = agent
    calls = install_pipeline(monkeypatch)
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    journey = client.post(
        "/v1/agent/suggestion-choice",
        headers=headers,
        json={"revision": journey["revision"], "action_id": "observe", "choice": "keep"},
    ).json()
    accepted = deepcopy(journey["plans"])
    kept = deepcopy(journey["suggestion_board"]["kept"])
    calls = install_pipeline(monkeypatch, clarify=True)
    response = send(client, headers, journey, "I have a synthetic allergy; ask a useful question.")
    assert response.status_code == 200
    journey = response.json()
    assert [task.split("]")[0] for task, _ in calls] == ["[stage:coach", "[stage:reviewer"]
    assert journey["suggestion_board"]["pending_question"]
    assert journey["plans"] == accepted and journey["suggestion_board"]["kept"] == kept
    fact = next(f for f in journey["profile"] if f["value"] == "synthetic allergy")
    assert fact["source_id"].startswith("turn-")
    check = next(
        c for c in journey["workflow"]["review"]["action_checks"] if c["action_id"] == "observe"
    )
    assert check["status"] == "incompatible"
    reviewer_context = calls[-1][1]
    assert any(f["quote"] == "synthetic allergy" for f in reviewer_context["reported_profile"])
    assert reviewer_context["current_request"]["message"].startswith("I have")
    assert "options" not in str(reviewer_context["suggestion_request"]["conversation"])


def test_one_enforced_repair_and_second_disapproval_cannot_pass_as_compatible(agent, monkeypatch):
    client, _ = agent
    install_pipeline(monkeypatch)
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    calls = install_pipeline(monkeypatch, deny=True)
    result = send(client, headers, journey, "Give useful alternatives for the actual goal")
    assert result.status_code == 200
    journey = result.json()
    assert [t.split("]")[0] for t, _ in calls] == [
        "[stage:coach",
        "[stage:planner",
        "[stage:reviewer",
        "[stage:planner",
        "[stage:reviewer",
    ]
    assert "reviewer_correction" in calls[3][1]
    assert not journey["workflow"]["review"]["approved"]
    ids = {a["id"] for a in journey["suggestion_board"]["suggestions"]}
    assert ids <= {
        c["action_id"]
        for c in journey["workflow"]["review"]["action_checks"]
        if c["status"] == "needs_review"
    }
    assert journey["workflow"]["review"]["suggested_starts"] == []
    assert "could not" in journey["suggestion_board"]["conversation"][-1]["reply"]


def test_successful_review_ids_survive_action_assignment_and_initial_plan_is_routed(
    agent, monkeypatch
):
    client, _ = agent
    calls = install_pipeline(monkeypatch)
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    assert any(task.startswith("[stage:planner]") for task, _ in calls)
    assert any(task.startswith("[stage:reviewer]") for task, _ in calls)
    journey = send(client, headers, journey, "Give practical alternatives").json()
    action = journey["suggestion_board"]["suggestions"][0]
    assert action["id"] != "temporary"
    assert action["id"] in journey["workflow"]["review"]["suggested_starts"]
    assert any(
        c["action_id"] == action["id"] and c["status"] == "compatible"
        for c in journey["workflow"]["review"]["action_checks"]
    )


def test_untraceable_extraction_and_goal_change_cannot_erase_allergy():
    from app.agent_models import Context, Decision, Journey, ProfileFact

    journey = Journey(
        context=Context(goals=["body"], description="A new goal", target_date=""),
        decision=Decision(summary="Ready", ready=True, questions=[]),
        profile=[
            ProfileFact(
                id="allergy",
                category="allergy",
                value="Existing allergy",
                source_id="explicit-edit",
                quote="Existing allergy",
                status="reported",
            )
        ],
    )
    result = CoachDecision(
        summary="Ready",
        ready=True,
        questions=[],
        conflicts=[],
        research=ResearchIntent(needed=False, query="", kind="evidence"),
        facts=[
            FactCandidate(
                category="goal",
                value="New goal",
                source_id="opening",
                quote="A new goal",
                status="reported",
                supersedes_id="allergy",
            ),
            FactCandidate(
                category="allergy",
                value="Invented",
                source_id="opening",
                quote="not actually supplied",
                status="reported",
                supersedes_id=None,
            ),
        ],
    )
    workflow.absorb(journey, result, workflow.context_for(journey, {}))
    assert journey.profile[0].active
    assert [f.value for f in journey.profile] == ["Existing allergy", "New goal"]


def test_profile_edit_quarantines_without_rewriting_kept_or_accepted_actions(agent, monkeypatch):
    client, _ = agent
    install_pipeline(monkeypatch)
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    before = deepcopy(journey["plans"])
    response = client.post(
        "/v1/agent/profile",
        headers=headers,
        json={
            "revision": journey["revision"],
            "category": "allergy",
            "value": "A newly reported allergy",
        },
    )
    assert response.status_code == 200
    journey = response.json()
    assert journey["plans"] == before
    assert journey["workflow"]["status"] == "needs_review"
    assert all(
        c["status"] == "needs_review" for c in journey["workflow"]["review"]["action_checks"]
    )
    assert any(f["source_id"].startswith("profile-edit-") for f in journey["profile"])


def test_failed_coach_saves_report_and_withholds_previous_suggestions(agent, monkeypatch):
    client, _ = agent
    install_pipeline(monkeypatch)
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    before = deepcopy(journey["plans"])

    def fail(*args):
        raise HTTPException(502, "Synthetic failure")

    monkeypatch.setattr(agent_provider, "generate", fail)
    response = send(client, headers, journey, "New constraints must be remembered")
    assert response.status_code == 200
    journey = response.json()
    assert journey["plans"] == before and journey["workflow"]["status"] == "retry"
    assert (
        journey["suggestion_board"]["conversation"][-1]["message"]
        == "New constraints must be remembered"
    )
    assert all(
        c["status"] == "needs_review" for c in journey["workflow"]["review"]["action_checks"]
    )


def test_editing_question_invalidates_derived_facts_and_does_not_reuse_source_ids(
    agent, monkeypatch
):
    client, _ = agent
    install_pipeline(monkeypatch)
    headers, journey = start(client)
    q = journey["decision"]["questions"][0]
    journey = send(
        client, headers, journey, "I report a synthetic allergy", question_id=q["id"]
    ).json()
    old_source = journey["events"][0]["source_id"]
    assert any(f["active"] for f in journey["profile"])
    q = journey["events"][0]["question_snapshot"]
    result = client.post(
        "/v1/agent/answers",
        headers=headers,
        json={
            "revision": journey["revision"],
            "event_index": 0,
            "question_id": q["id"],
            "answer": "Corrected: this answer described something else",
        },
    )
    assert result.status_code == 200
    journey = result.json()
    assert journey["events"][0]["source_id"] != old_source
    assert not any(
        f["active"] and f["source_id"] == f"event-{old_source}" for f in journey["profile"]
    )
    assert all(
        f["quote"]
        not in workflow.reports(agent_store.read(headers["Authorization"].split()[1])).get(
            f["source_id"], ""
        )
        for f in journey["profile"]
        if not f["active"]
    )


def test_retrieval_result_is_routed_into_planner_and_reviewer_without_full_profile_in_search(
    agent, monkeypatch
):
    from datetime import UTC, datetime

    from app.agent_models import ResearchResult, ResearchSource

    client, _ = agent
    calls = install_pipeline(monkeypatch, needs_research=True)
    searched = []

    def retrieve(intent):
        searched.append(intent.model_dump())
        return ResearchResult(
            status="retrieved",
            summary="A retrieved finding, with limits.",
            sources=[
                ResearchSource(
                    id="source-1",
                    title="Synthetic retrieved source",
                    url="https://example.org/source",
                    retrieved_at=datetime.now(UTC),
                    kind="evidence",
                    applicability="Generic guidance only",
                    uncertainty="Individual suitability is unknown.",
                )
            ],
        )

    monkeypatch.setattr(workflow, "retrieve", retrieve)
    headers, journey = start(client, "A synthetic goal with private schedule details")
    response = plan(client, headers, journey)
    assert response.status_code == 200
    journey = response.json()
    assert searched == [{"needed": True, "query": "generic activity guidance", "kind": "evidence"}]
    assert journey["workflow"]["stages"] == ["researcher", "planner", "reviewer"]
    assert calls[-2][1]["research_context"]["sources"][0]["id"] == "source-1"
    assert calls[-1][1]["research_context"]["status"] == "retrieved"


def test_revision_keeps_history_and_remaps_reviewer_ids_after_assembly(agent, monkeypatch):
    from app.agent_models import ReplacementAction, ReshuffleDraft

    client, _ = agent
    install_pipeline(monkeypatch)
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    saved.plans[-1].plan.actions.append(
        saved.plans[-1]
        .plan.actions[0]
        .model_copy(
            update={"id": "editable", "title": "Another action", "detail": "Another detail"}
        )
    )
    agent_store.save(access, saved, saved.revision)
    journey = client.get("/v1/agent/session", headers=headers).json()
    journey = client.post(
        "/v1/agent/action-preferences",
        headers=headers,
        json={"revision": journey["revision"], "action_id": "observe", "choice": "keep"},
    ).json()
    original = deepcopy(journey["plans"])
    original_generate = agent_provider.generate

    def generate(task, context, output):
        if output is ReshuffleDraft:
            base = example_plan().model_dump()
            base["actions"] = [
                ReplacementAction(
                    **{
                        **base["actions"][0],
                        "id": "temporary-replacement",
                        "title": "Revised useful alternative",
                        "detail": "Updated synthetic detail",
                        "replaces_action_id": "editable",
                    }
                )
            ]
            return ReshuffleDraft(**base)
        return original_generate(task, context, output)

    monkeypatch.setattr(agent_provider, "generate", generate)
    response = client.post(
        "/v1/agent/reshuffle",
        headers=headers,
        json={
            "revision": journey["revision"],
            "message": "Make the editable action fit my current goal",
        },
    )
    assert response.status_code == 200, response.text
    journey = response.json()
    assert journey["plans"] == original
    assert journey["proposal"]["actions"][0] == original[0]["plan"]["actions"][0]
    replacement = journey["proposal"]["actions"][1]
    assert replacement["id"] != "temporary-replacement"
    checks = journey["workflow"]["review"]["action_checks"]
    assert any(c["action_id"] == replacement["id"] and c["status"] == "compatible" for c in checks)
    assert not any(c["action_id"] == "temporary-replacement" for c in checks)


def test_expired_workflow_budget_does_not_start_another_model_call(monkeypatch):
    from time import monotonic

    from app.agent_models import Plan

    token = workflow._deadline.set(monotonic() - 1)
    monkeypatch.setattr(
        agent_provider,
        "generate",
        lambda *args: pytest.fail("No model call may start after deadline"),
    )
    try:
        with pytest.raises(HTTPException) as error:
            workflow.stage("planner", "Synthetic task", {}, Plan)
        assert error.value.status_code == 502
    finally:
        workflow._deadline.reset(token)


def test_partial_batch_preserves_safe_narrative_and_reports_actual_available_count(
    agent, monkeypatch
):
    client, _ = agent
    install_pipeline(monkeypatch)
    headers, journey = start(client)
    journey = plan(client, headers, journey).json()
    original_generate = agent_provider.generate

    def generate(task, context, output):
        result = original_generate(task, context, output)
        if output is SuggestionBatch:
            result.reply = "Choose from these ten alternatives."
            result.actions.append(
                result.actions[0].model_copy(
                    update={
                        "id": "second-temporary",
                        "title": "Another alternative",
                        "detail": "A different useful detail",
                    }
                )
            )
        if output is ReviewResult and "reply" in context["draft"]:
            result.public_summary = "I understand the deadline you gave. The useful remaining route fits the reported limit; evidence applicability remains uncertain."
            hidden_id = context["draft"]["actions"][-1]["id"]
            next(
                c for c in result.action_checks if c.action_id == hidden_id
            ).status = "needs_review"
            result.correction = ""
        return result

    monkeypatch.setattr(agent_provider, "generate", generate)
    result = send(client, headers, journey, "Give me practical alternatives")
    assert result.status_code == 200
    journey = result.json()
    reply = journey["suggestion_board"]["conversation"][-1]["reply"]
    assert "deadline you gave" in reply and "evidence applicability" in reply
    assert "1 reviewed alternatives" in reply and "1 additional options" in reply
    assert "ten alternatives" not in reply
    assert len(journey["workflow"]["review"]["suggested_starts"]) == 1


def test_all_staged_output_schemas_require_every_property():
    from app.agent_models import Plan, ReshuffleDraft

    for output in [
        CoachDecision,
        CoachResponse,
        ReviewResult,
        SuggestionBatch,
        Plan,
        ReshuffleDraft,
    ]:
        from app.agent_provider import strict_schema

        schema = strict_schema(output.model_json_schema())
        for definition in [schema, *schema.get("$defs", {}).values()]:
            assert set(definition.get("required", [])) == set(definition.get("properties", {}))
            assert definition.get("additionalProperties") is False
