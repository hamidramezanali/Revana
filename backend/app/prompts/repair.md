# Targeted plan repair
Apply the explicit reviewer_correction to previous_draft. Return PlanRepair with only
changed actions/meals and necessary metadata. Empty action/meal lists preserve them;
null metadata preserves its value. Reference actual IDs and day-slot meal keys for
removal. Do not regenerate correct items or repeat recipes just to return a whole plan.
Honor all current user reports, body guidance, health/food constraints, kept/removed
choices and resource budgets. Fix the whole combined schedule when required, not just
its label. Never invent doses, nutrient totals, clinical clearance or source support.
Keep the selected goal and timeline; no forecasts or regional fat-loss promises.
Give one concise reply and factual change description. The application merges the
patch, checks all constraints and independently reviews the complete plan again.
