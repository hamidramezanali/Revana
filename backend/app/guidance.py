"""Small development-reviewed public guidance library, not clinical validation."""

from datetime import UTC, datetime

from app.agent_models import ResearchResult, ResearchSource

PAGES = {
    "skin": (
        "1177: Dry skin and itching",
        "https://www.1177.se/Dalarna/sjukdomar--besvar/hud-har-och-naglar/klada-utslag-och-eksem/torr-hud-och-klada/",
        "General dry-skin self-care and when to seek assessment. It does not diagnose facial redness or prove a particular product is suitable.",
    ),
    "hair": (
        "1177: Hair loss",
        "https://www.1177.se/sjukdomar--besvar/hud-har-och-naglar/harbotten-och-harsackar/haravfall/",
        "Hair loss has different patterns and causes; general information on when to seek assessment. It does not establish a cause from a photo or support a regrowth forecast.",
    ),
    "body": (
        "1177: Eating for wellbeing",
        "https://www.1177.se/liv--halsa/ata-for-att-ma-bra/",
        "General food-habit guidance, not a personalized calorie or weight-loss prescription.",
    ),
}


def library(goals) -> ResearchResult:
    sources = [
        ResearchSource(
            id=f"guidance-{goal}",
            title=PAGES[goal][0],
            url=PAGES[goal][1],
            retrieved_at=datetime(2026, 11, 11, tzinfo=UTC),
            kind="evidence",
            applicability=PAGES[goal][2],
            uncertainty="Development-reviewed reference, not a comprehensive evidence review or a clinical endorsement of the generated plan.",
        )
        for goal in dict.fromkeys(goals)
        if goal in PAGES
    ]
    return ResearchResult(
        status="limited",
        summary="Limited public guidance references are available. Claims outside their stated scope need additional evidence or explicit uncertainty.",
        sources=sources,
    )
