"""Cited alternatives and public listings; no private queries, scraping or booking."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from importlib.resources import files
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import HTTPException

from app import research, workflow
from app.agent_models import MethodReport, MethodSynthesis, ResearchIntent

# Query text is application-owned. Questionnaire text, photos and measurements NEVER enter web queries.
TOPICS = {
    "nutrition": (
        "body",
        "Meal preparation & nutrition",
        "balanced meal preparation portions satiety energy balance dietitian guidance",
        "kostrådgivning",
        "https://www.bokadirekt.se/kostradgivning/hela-sverige",
    ),
    "body_composition": (
        "body",
        "Body-composition approaches",
        "body composition resistance training nutrition body contouring is not weight loss evidence",
        "kostrådgivning",
        "https://www.bokadirekt.se/kostradgivning/hela-sverige",
    ),
    "skin_options": (
        "skin",
        "Skin-care alternatives",
        "skin irritation acne redness topical care professional assessment treatment evidence",
        "hudvård",
        "https://www.bokadirekt.se/hudvard/nara-mig",
    ),
    "laser_skin": (
        "skin",
        "Laser & light treatments",
        "laser intense pulsed light skin treatment evidence burns pigmentation contraindications dermatologist",
        "laserbehandling",
        "https://www.bokadirekt.se/laserbehandling/hela-sverige",
    ),
    "pigmentation": (
        "skin",
        "Pigmentation approaches",
        "skin pigmentation melasma topical laser light treatment risks dermatologist evidence",
        "pigmentfläckar",
        "https://www.bokadirekt.se/pigmentflackar/hela-sverige",
    ),
    "hair_options": (
        "hair",
        "Hair-loss approaches",
        "hair shedding thinning topical low level light treatment evidence dermatologist assessment",
        "hårbottenbehandling",
        "https://www.bokadirekt.se/harbottenbehandling/hela-sverige",
    ),
    "scalp_care": (
        "hair",
        "Scalp-care approaches",
        "scalp itching flaking care treatments dermatologist assessment evidence",
        "hårbottenbehandling",
        "https://www.bokadirekt.se/harbottenbehandling/hela-sverige",
    ),
    "hair_removal": (
        "skin",
        "Hair-removal approaches",
        "laser hair removal safety skin types contraindications dermatologist evidence",
        "laserbehandling",
        "https://www.bokadirekt.se/laserbehandling/hela-sverige",
    ),
}
EVIDENCE_DOMAINS = [
    "1177.se",
    "livsmedelsverket.se",
    "aad.org",
    "nhs.uk",
    "fda.gov",
    "pubmed.ncbi.nlm.nih.gov",
    "nice.org.uk",
]


def topic_domains(topic):
    domains = {TOPICS[topic][0]}
    if topic == "hair_removal":
        domains.add("hair")
    return domains


def validate_topic(journey, topic):
    if topic not in TOPICS or not topic_domains(topic).intersection(journey.context.goals):
        raise HTTPException(422, "Choose a research topic relevant to this saved goal.")


def discover(journey, topic, city, services, publish):
    validate_topic(journey, topic)
    _, title, query, category, browse = TOPICS[topic]
    publish({"type": "stage", "role": "researcher", "status": "working"})
    with ThreadPoolExecutor(max_workers=2) as pool:
        evidence_job = pool.submit(
            research.retrieve,
            ResearchIntent(needed=True, query=query, kind="evidence"),
            allowed_domains=EVIDENCE_DOMAINS,
        )
        service_job = (
            pool.submit(
                research.retrieve,
                ResearchIntent(
                    needed=True,
                    query=f"public Bokadirekt {category} consultations in {city or 'Sweden'} listed providers",
                    kind="service",
                ),
                allowed_domains=["bokadirekt.se"],
            )
            if services
            else None
        )
        evidence = evidence_job.result()
        listings = service_job.result() if service_job else None
    publish({"type": "stage", "role": "researcher", "status": "done"})
    report_id = uuid4().hex
    evidence_sources = [
        s.model_copy(update={"id": f"method-{report_id}-evidence-{i + 1}"})
        for i, s in enumerate(evidence.sources)
    ]
    listing_sources = [
        s.model_copy(update={"id": f"method-{report_id}-listing-{i + 1}"})
        for i, s in enumerate(listings.sources if listings else [])
        if (urlsplit(s.url).hostname or "").removeprefix("www.") == "bokadirekt.se"
        and urlsplit(s.url).path.startswith("/places/")
    ]
    limitations = [
        "Listings establish a publicly indexed page, not qualification, medical suitability, current prices or appointment availability. No booking has been made."
    ]
    if not evidence_sources:
        limitations.append(
            "No usable primary evidence was retrieved. Treatment alternatives cannot be assessed from marketplace advertising."
        )
    if services and not listing_sources:
        limitations.append(
            "No individual Bokadirekt provider listing was verified. The category link remains available for manual discovery."
        )
    report = MethodReport(
        id=report_id,
        topic=topic,
        city=city,
        created_at=datetime.now(UTC),
        status="limited" if evidence_sources or listing_sources else "unavailable",
        summary="Research returned sources to review."
        if evidence_sources
        else "Evidence search was unavailable or returned no usable primary citations. No suitability recommendation was generated.",
        evidence=evidence_sources,
        listings=listing_sources,
        limitations=limitations,
        browse_url=browse,
        services_searched=services,
    )
    if not evidence_sources:
        return report
    context = workflow.context_for(
        journey,
        {
            "research_topic": title,
            "evidence_findings": evidence.summary,
            "evidence_sources": [s.model_dump(mode="json") for s in evidence_sources],
            "listing_sources": [s.model_dump(mode="json") for s in listing_sources],
            "goal": journey.workspace.outcome or journey.context.description,
            "_max_output_tokens": 3500,
        },
    )
    try:
        result = workflow.stage(
            "reviewer",
            files("app").joinpath("prompts/methods.md").read_text(encoding="utf-8"),
            context,
            MethodSynthesis,
        )
    except HTTPException:
        report.limitations.append(
            "The evidence interpretation could not finish. Sources and listings are available for manual review; no new plan actions were added."
        )
        return report
    valid_ids = {s.id for s in evidence_sources}
    for option in result.alternatives:
        references = [value for value in option.evidence_ids if value in valid_ids]
        if not references:
            continue  # Never present an unsupported generated method as sourced advice.
        option.evidence_ids = references
        if option.approach == "professional" and option.suitability == "consider":
            option.suitability = "assessment_required"
        if topic == "body_composition" and option.approach == "professional":
            option.suitability = "assessment_required"
            option.risks = list(
                dict.fromkeys(
                    [*option.risks, "Cosmetic contouring is not a weight-loss treatment."]
                )
            )[:8]
        report.alternatives.append(option)
    report.summary = result.summary
    report.limitations = [*report.limitations, *result.limitations][:12]
    report.status = "ready" if report.alternatives and evidence.status == "retrieved" else "limited"
    return report
