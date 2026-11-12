"""Deterministic, non-diagnostic planning context. No invented clinical forecasts."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.agent_models import Journey


def local_today(journey: Journey) -> date:
    return datetime.now(ZoneInfo(journey.body.timezone)).date()


def body_guidance(journey: Journey) -> dict:
    body = journey.body
    missing = [name for name in ("age", "height_cm", "weight_kg") if getattr(body, name) is None]
    reasons = []
    bmi = None
    if body.height_cm and body.weight_kg:
        raw_bmi = body.weight_kg / (body.height_cm / 100) ** 2
        bmi = round(raw_bmi, 1)
        if raw_bmi < 18.5:
            reasons.append(
                "Current measurements do not support weight-loss coaching; offer non-restrictive support and professional review."
            )
        if body.target_weight_kg and body.target_weight_kg / (body.height_cm / 100) ** 2 < 18.5:
            reasons.append(
                "The requested target falls below the adult BMI screening range. Do not pursue that target."
            )
    if body.pregnancy != "not_applicable":
        reasons.append(
            "Pregnancy/breastfeeding context is unknown or requires individualized care. Do not set a calorie deficit."
        )
    if missing:
        reasons.append(
            "Missing measurements: "
            + ", ".join(missing)
            + ". Do not infer measurements or calorie targets."
        )
    # Always provide maintenance estimates only; no automatic deficit prescription.
    estimate = None
    if (
        not missing
        and body.equation_coefficient != "not_specified"
        and body.activity != "unknown"
        and not reasons
    ):
        resting = (
            10 * body.weight_kg
            + 6.25 * body.height_cm
            - 5 * body.age
            + (5 if body.equation_coefficient == "male" else -161)
        )
        # A broad scenario interval, not measured expenditure or a confidence interval.
        factors = {
            "mostly_seated": (1.2, 1.4),
            "some_activity": (1.35, 1.6),
            "regular_training": (1.5, 1.8),
        }
        low, high = factors[body.activity]
        estimate = {
            "resting_kcal": round(resting),
            "maintenance_kcal": [round(resting * low / 50) * 50, round(resting * high / 50) * 50],
            "method": "Mifflin–St Jeor with broad activity-factor scenarios",
            "source": "https://pubmed.ncbi.nlm.nih.gov/2305711/",
            "limitations": "Estimate for adults, not a measured requirement or a diet prescription. Activity multipliers are approximate scenarios; individual needs vary.",
        }
    if body.target_weight_kg and body.weight_kg and journey.context.target_date:
        try:
            days = (date.fromisoformat(journey.context.target_date) - local_today(journey)).days
            if body.weight_kg > body.target_weight_kg and (
                days <= 0 or (body.weight_kg - body.target_weight_kg) * 7 / days > 1
            ):
                reasons.append(
                    "Rapid loss request: do not promise this result or prescribe restriction, dehydration or compensatory exercise."
                )
                estimate = None
        except ValueError:
            pass
    weight_discussion = bool(
        bmi is not None
        and bmi >= 25
        and not missing
        and body.pregnancy == "not_applicable"
        and not reasons
    )
    return {
        "weight_management_appropriate_to_discuss": weight_discussion,
        "energy_strategy": "A modest energy deficit can be discussed with balanced meals; no numerical calorie prescription is authorized."
        if weight_discussion
        else "Use balanced, satisfying meals. Resolve missing health context or seek individualized advice before pursuing a deficit.",
        "bmi_screening_only": bmi,
        "constraints": reasons,
        "maintenance_estimate": estimate,
        "calorie_deficit_allowed": False,
    }


def progress_context(journey: Journey) -> dict:
    entries = journey.progress[-30:]
    return {
        "entries": [entry.model_dump(mode="json") for entry in entries],
        "worsening_reported": any(entry.status == "worse" for entry in entries[-5:]),
        "rules": "Not attempted is not failure. Inconsistent use does not prove ineffectiveness. Worsening needs review before continuing. Completion is not evidence of benefit.",
    }


def validate_question_answer(question, answer, skipped, selected, photos):
    from math import isfinite

    from fastapi import HTTPException

    if skipped or question.input_kind == "options":
        return
    if selected or photos:
        raise HTTPException(422, "Use the requested input or skip this question.")
    if question.input_kind == "number":
        try:
            value = float(answer.replace(",", "."))
            if (
                not isfinite(value)
                or (question.number_min is not None and value < question.number_min)
                or (question.number_max is not None and value > question.number_max)
            ):
                raise ValueError()
        except ValueError:
            raise HTTPException(
                422, "Enter a valid number within the shown range, or skip."
            ) from None
    if question.input_kind == "date":
        try:
            date.fromisoformat(answer)
        except ValueError:
            raise HTTPException(422, "Enter a date in YYYY-MM-DD format, or skip.") from None
