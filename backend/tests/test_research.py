import json

import httpx
import pytest

from app import agent_provider, research
from app.agent_models import ResearchIntent, ReviewResult
from app.config import get_settings


@pytest.mark.parametrize("mode", ["retrieved", "no_tool", "no_citation", "failed"])
def test_real_retrieval_requires_actual_tool_call_and_usable_citations(monkeypatch, mode):
    monkeypatch.setenv("REVANA_OPENAI_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("REVANA_RESEARCH_ENABLED", "true")
    get_settings.cache_clear()
    captured = []
    original = httpx.Client

    def handler(request):
        captured.append(json.loads(request.content))
        if mode == "failed":
            return httpx.Response(503)
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    *(
                        [{"type": "web_search_call", "status": "completed"}]
                        if mode != "no_tool"
                        else []
                    ),
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": "A retrieved finding with limitations.",
                                "annotations": []
                                if mode == "no_citation"
                                else [
                                    {
                                        "type": "url_citation",
                                        "url": "https://example.org/source",
                                        "title": "Actual tool citation",
                                    },
                                    {
                                        "type": "url_citation",
                                        "url": "javascript:alert(1)",
                                        "title": "Not usable",
                                    },
                                ],
                            }
                        ],
                    },
                ],
            },
        )

    monkeypatch.setattr(
        research.httpx,
        "Client",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = research.retrieve(
        ResearchIntent(needed=True, query="generic activity guidance", kind="evidence")
    )
    assert captured[0]["input"] == "generic activity guidance"
    assert captured[0]["tools"] == [{"type": "web_search"}]
    assert captured[0]["tool_choice"] == "required"
    assert "questionnaire" in captured[0]["instructions"]
    if mode == "retrieved":
        assert result.status == "retrieved" and len(result.sources) == 1
        assert result.sources[0].url == "https://example.org/source"
        assert result.sources[0].retrieved_at.tzinfo is not None
    else:
        assert result.status in {"limited", "unavailable"} and not result.sources
    get_settings.cache_clear()


def test_disabled_unneeded_or_identifying_search_does_not_make_http_call(monkeypatch):
    monkeypatch.setenv("REVANA_RESEARCH_ENABLED", "false")
    get_settings.cache_clear()

    def forbidden(*args, **kwargs):
        pytest.fail("No HTTP request should be made")

    monkeypatch.setattr(research.httpx, "Client", forbidden)
    assert (
        research.retrieve(ResearchIntent(needed=False, query="", kind="evidence")).status
        == "not_needed"
    )
    assert (
        research.retrieve(
            ResearchIntent(needed=True, query="generic guidance", kind="evidence")
        ).status
        == "unavailable"
    )
    assert (
        research.retrieve(
            ResearchIntent(needed=True, query="a person 35 years old", kind="evidence")
        ).status
        == "unavailable"
    )
    get_settings.cache_clear()


def test_roles_reach_actual_provider_instructions_and_context(monkeypatch):
    monkeypatch.setenv("REVANA_OPENAI_API_KEY", "synthetic-test-key")
    get_settings.cache_clear()
    captured = []
    original = httpx.Client
    result = ReviewResult(
        approved=True,
        issues=[],
        correction="",
        limitations=[],
        action_checks=[],
        suggested_starts=[],
    )

    def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [{"type": "output_text", "text": result.model_dump_json()}],
                    }
                ],
            },
        )

    monkeypatch.setattr(
        agent_provider.httpx,
        "Client",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    for role in ["coach", "planner", "reviewer"]:
        agent_provider.generate(
            f"[stage:{role}] Synthetic stage request",
            {"current_request": "Synthetic request", "reported_profile": []},
            ReviewResult,
        )
    assert "Conversation comes first" in captured[0]["instructions"]
    assert (
        "# Planner stage" in captured[1]["instructions"]
        and "# Revana coaching role" not in captured[1]["instructions"]
    )
    assert (
        "# Reviewer stage" in captured[2]["instructions"]
        and "actions_to_check" in captured[2]["instructions"]
    )
    assert all(
        json.loads(call["input"])["current_request"] == "Synthetic request" for call in captured
    )
    get_settings.cache_clear()
