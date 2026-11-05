"""Server-side structured Responses API adapter; never logs user/provider bodies."""

import json
from importlib.resources import files

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from app.config import get_settings

POLICY = files("app").joinpath("prompts/coach.md").read_text(encoding="utf-8")


def generate[T: BaseModel](task: str, context: dict, output: type[T]) -> T:
    settings = get_settings()
    if not settings.openai_api_key or not settings.openai_model:
        raise HTTPException(503, "Configure the backend OpenAI key and model to use the agent.")
    try:
        with httpx.Client(timeout=45) as client:
            response = client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.openai_api_key.get_secret_value()}"},
                json={
                    "model": settings.openai_model,
                    "store": False,
                    "max_output_tokens": 4500,
                    "instructions": POLICY + "\n" + task,
                    "input": json.dumps(context, ensure_ascii=False),
                    "text": {
                        "format": {
                            "type": "json_schema",
                            "name": output.__name__,
                            "strict": True,
                            "schema": output.model_json_schema(),
                        }
                    },
                },
            )
            response.raise_for_status()
            body = response.json()
        if body.get("status") != "completed":
            raise ValueError("Incomplete generation")
        parts = [
            content["text"]
            for item in body.get("output", [])
            if item.get("type") == "message"
            for content in item.get("content", [])
            if content.get("type") == "output_text"
        ]
        return output.model_validate_json("".join(parts))
    except (httpx.HTTPError, ValidationError, ValueError, KeyError, TypeError):
        raise HTTPException(
            502,
            "The agent could not complete this request. Your saved journey is unchanged; retry.",
        ) from None
