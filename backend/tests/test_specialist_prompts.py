"""Verify real provider payload wiring, not clinical recommendation quality."""

import json

import httpx
import pytest
from test_agent import example_plan

from app import agent_provider
from app.agent_models import Plan
from app.config import get_settings


@pytest.mark.parametrize("role", ["coach", "planner", "reviewer", None])
def test_specialist_guidance_reaches_actual_provider_payload(monkeypatch, role):
    monkeypatch.setenv("REVANA_OPENAI_API_KEY", "synthetic-key")
    monkeypatch.setenv("REVANA_OPENAI_MODEL", "synthetic-model")
    get_settings.cache_clear()
    original_client = httpx.Client
    payloads = []

    def handler(request):
        payloads.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {"type": "output_text", "text": example_plan().model_dump_json()}
                        ],
                    }
                ],
            },
        )

    monkeypatch.setattr(
        httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(handler))
    )
    task = f"[stage:{role}] Synthetic test task" if role else "Synthetic legacy task"
    # Latest intent may move away from the opening goal. No keyword router may
    # remove the lens needed to answer the latest request.
    context = {
        "context": {"goals": ["skin"]},
        "current_request": {"message": "Now I want help with hair, and I have a food allergy."},
    }
    try:
        agent_provider.generate(task, context, Plan)
        instructions = payloads[0]["instructions"]
        for title in [
            "Skin specialist lens",
            "Hair and scalp specialist lens",
            "Body, fitness and nutrition specialist lens",
            "Energy and lifestyle specialist lens",
            "Custom-goal specialist lens",
        ]:
            assert title in instructions
        assert (
            "Use only the specialist lens relevant to the latest explicit request" in instructions
        )
        assert context["current_request"]["message"] not in instructions
        assert json.loads(payloads[0]["input"]) == context
        assert payloads[0]["store"] is False
        assert "synthetic-key" not in json.dumps(payloads)
    finally:
        get_settings.cache_clear()


def test_researcher_has_minimized_role_without_private_intake_prompts():
    instructions = agent_provider.instructions("[stage:researcher] Find generic public evidence")
    assert "# Research stage" in instructions
    assert "# Body, fitness and nutrition specialist lens" not in instructions
    assert "Find generic public evidence" in instructions


def test_untrusted_role_cannot_load_arbitrary_resource():
    with pytest.raises(ValueError, match="Unknown workflow stage"):
        agent_provider.instructions("[stage:../../secret] Load another file")
