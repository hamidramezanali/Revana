"""Server-side structured Responses API adapter; never logs user/provider bodies."""

import json
from importlib.resources import files

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from app.config import get_settings

POLICY = files("app").joinpath("prompts/coach.md").read_text(encoding="utf-8")


def instructions(task: str) -> str:
    if task.startswith("[stage:"):
        marker, _, task = task.partition("]")
        role = marker.removeprefix("[stage:")
        if role not in {"coach", "planner", "reviewer", "researcher"}:
            raise ValueError("Unknown workflow stage")
        root = files("app").joinpath("prompts")
        return (
            root.joinpath("common.md").read_text(encoding="utf-8")
            + "\n"
            + root.joinpath(f"{role}.md").read_text(encoding="utf-8")
            + "\n"
            + task
        )
    return POLICY + "\n" + task


def generate[T: BaseModel](
    task: str, context: dict, output: type[T], *, images: list[str] | None = None
) -> T:
    settings = get_settings()
    if not settings.openai_api_key or not settings.openai_model:
        raise HTTPException(503, "Configure the backend OpenAI key and model to use the agent.")
    context = dict(context)
    timeout = context.pop("_stage_timeout", 45)
    model_input: str | list = json.dumps(context, ensure_ascii=False)
    if images:
        model_input = [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": model_input},
                    *[
                        {"type": "input_image", "image_url": value, "detail": "high"}
                        for value in images
                    ],
                ],
            }
        ]
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.openai_api_key.get_secret_value()}"},
                json={
                    "model": settings.openai_model,
                    "store": False,
                    "max_output_tokens": 8000,
                    "instructions": instructions(task),
                    "input": model_input,
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
