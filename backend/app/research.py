"""Real optional retrieval. Only tool-returned citations can become sources."""

import re
from datetime import UTC, datetime
from urllib.parse import urlsplit

import httpx

from app.agent_models import ResearchIntent, ResearchResult, ResearchSource
from app.agent_provider import instructions
from app.config import get_settings


def public_url(value: str) -> bool:
    try:
        parsed = urlsplit(value)
        return (
            parsed.scheme == "https"
            and bool(parsed.hostname)
            and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
            and not parsed.username
            and not parsed.password
        )
    except ValueError:
        return False


def retrieve(intent: ResearchIntent, *, allowed_domains: list[str] | None = None) -> ResearchResult:
    if not intent.needed:
        return ResearchResult()
    settings = get_settings()
    unavailable = ResearchResult(
        status="unavailable", summary="Live research is unavailable; no sources were verified."
    )
    # Reject potentially identifying strings instead of sending the raw questionnaire.
    query = intent.query.strip()
    if not query or re.search(r"[\d@\n\r]", query):
        return unavailable
    if not settings.research_enabled or not settings.openai_api_key:
        return unavailable
    search_tool = {"type": "web_search"}
    if allowed_domains:
        search_tool["filters"] = {"allowed_domains": allowed_domains}
    try:
        with httpx.Client(timeout=30) as client:
            response = client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.openai_api_key.get_secret_value()}"},
                json={
                    "model": settings.research_model or settings.openai_model,
                    "store": False,
                    "max_output_tokens": 1800,
                    "instructions": instructions(
                        "[stage:researcher] Return concise findings with cited sources and limitations."
                    )
                    + (
                        " For this Bokadirekt search, find individual public provider listing pages under /places/ matching the category and location. Category pages alone are not provider results. Do not claim qualifications, prices or available appointments."
                        if allowed_domains == ["bokadirekt.se"]
                        else ""
                    ),
                    "input": query,
                    "tools": [search_tool],
                    "tool_choice": "required",
                    "include": ["web_search_call.action.sources"],
                },
            )
            response.raise_for_status()
            data = response.json()
        output = data.get("output", [])
        if not any(
            item.get("type") == "web_search_call" and item.get("status") == "completed"
            for item in output
        ):
            return unavailable
        sources = []
        texts = []
        for item in output:
            if item.get("type") != "message":
                continue
            for content in item.get("content", []):
                if content.get("type") != "output_text":
                    continue
                texts.append(content.get("text", ""))
                for citation in content.get("annotations", []):
                    url = citation.get("url", "")
                    if citation.get("type") != "url_citation" or not public_url(url):
                        continue
                    host = urlsplit(url).hostname or ""
                    if allowed_domains and not any(
                        host == domain or host.endswith("." + domain) for domain in allowed_domains
                    ):
                        continue
                    if any(source.url == url for source in sources):
                        continue
                    sources.append(
                        ResearchSource(
                            id=f"source-{len(sources) + 1}",
                            title=citation.get("title") or url,
                            url=url,
                            retrieved_at=datetime.now(UTC),
                            kind=intent.kind,
                            applicability=f"Retrieved for: {query}",
                            uncertainty="A listing is not efficacy evidence; personal suitability and current availability require confirmation."
                            if intent.kind == "service"
                            else "Applicability to this person is not established by retrieval alone.",
                        )
                    )
        return ResearchResult(
            status="retrieved" if sources and data.get("status") == "completed" else "limited",
            summary="\n".join(texts)[:8000]
            if sources
            else "Search ran but returned no usable cited sources.",
            sources=sources,
        )
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return unavailable
