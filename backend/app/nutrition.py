"""Ingredient arithmetic over an attributed food snapshot; no LLM totals."""

import json
from functools import lru_cache
from importlib.resources import files


@lru_cache
def catalog():
    return json.loads(files("app").joinpath("data/foods.json").read_text(encoding="utf-8"))


def meal_totals(ingredients) -> dict:
    foods = {food["id"]: food for food in catalog()["foods"]}
    missing = [
        ingredient.food_id
        for ingredient in ingredients
        if ingredient.food_id not in foods
        or foods[ingredient.food_id]["kcal_per_100g"] is None
        or foods[ingredient.food_id]["protein_per_100g"] is None
    ]
    available = not missing
    return {
        "available": available,
        "kcal": round(
            sum(foods[i.food_id]["kcal_per_100g"] * i.grams / 100 for i in ingredients), 1
        )
        if available
        else None,
        "protein_g": round(
            sum(foods[i.food_id]["protein_per_100g"] * i.grams / 100 for i in ingredients), 1
        )
        if available
        else None,
        "missing_food_ids": missing,
        "source": "Livsmedelsverket, CC BY 4.0; approximate ingredient totals, not product-specific measurements.",
    }


def shopping_list(plan):
    from collections import defaultdict

    amounts = defaultdict(float)
    for meal in plan.meals:
        for ingredient in meal.ingredients:
            amounts[ingredient.food_id] += ingredient.grams
    foods = {food["id"]: food for food in catalog()["foods"]}
    return [
        {
            "food_id": food_id,
            "name": foods.get(food_id, {}).get("name", "Unverified ingredient"),
            "grams": round(grams, 1),
        }
        for food_id, grams in sorted(amounts.items())
    ]
