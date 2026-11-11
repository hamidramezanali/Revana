"""External navigation only: no marketplace scraping, private queries or bookings."""

from app.agent_models import Journey


def discovery_links(journey: Journey) -> dict:
    goals = set(journey.context.goals)
    categories = []
    for goal, category in [
        ("skin", "Skincare consultation"),
        ("hair", "Hair-care consultation"),
        ("body", "Nutrition or activity consultation"),
    ]:
        if goal in goals:
            categories.append(
                {
                    "category": category,
                    "url": "https://www.bokadirekt.se/",
                    "instruction": "Search this category and your preferred location on Bokadirekt. Confirm qualifications, suitability and prices directly.",
                }
            )
    return {
        "mode": "external_links",
        "live_search": False,
        "pricing": False,
        "availability": False,
        "booking": False,
        "message": "No live providers or appointments are verified. Cosmetic services do not replace medical assessment. No profile information is sent by Revana when displaying these links.",
        "links": categories[:3],
    }
