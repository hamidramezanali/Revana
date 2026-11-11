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


def strict_schema(schema: dict) -> dict:
    """All output fields required by the provider; defaults still migrate saved data."""
    schema = json.loads(json.dumps(schema))

    def visit(value):
        if isinstance(value, dict):
            value.pop("default", None)
            if value.get("type") == "object" and "properties" in value:
                value["required"] = list(value["properties"])
                value["additionalProperties"] = False
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(schema)
    return schema


def generate[T: BaseModel](
    task: str, context: dict, output: type[T], *, images: list[str] | None = None
) -> T:
    settings = get_settings()
    if not settings.openai_api_key or not settings.openai_model:
        raise HTTPException(503, "Configure the backend OpenAI key and model to use the agent.")
    context = dict(context)
    timeout = context.pop("_stage_timeout", 45)
    try:
        model_input: str | list = json.dumps(context, ensure_ascii=False)
    except (TypeError, ValueError):
        raise HTTPException(
            502, "The coach could not prepare this request. Your saved journey is unchanged; retry."
        ) from None
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
                            "schema": strict_schema(output.model_json_schema()),
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
    except httpx.HTTPStatusError as error:
        status = error.response.status_code
        if status == 429:
            try:
                kind = error.response.json().get("error", {}).get("type")
            except (ValueError, AttributeError, TypeError):
                kind = None
            message = (
                "OpenAI API credits or a usage limit are preventing coaching. Check the API project's billing and limits; your saved journey is unchanged."
                if kind == "insufficient_quota"
                else "OpenAI is temporarily limiting requests. Please wait and retry; your saved journey is unchanged."
            )
        elif status in (401, 403):
            message = "OpenAI rejected this deployment's credentials or permissions. Check the server configuration; your saved journey is unchanged."
        else:
            message = (
                "OpenAI could not complete this request. Your saved journey is unchanged; retry."
            )
        raise HTTPException(502, message) from None
    except httpx.TimeoutException:
        raise HTTPException(
            502, "The coach took too long. Your saved journey is unchanged; retry."
        ) from None
    except (httpx.HTTPError, ValidationError, ValueError, KeyError, TypeError):
        raise HTTPException(
            502,
            "The agent could not complete this request. Your saved journey is unchanged; retry.",
        ) from None
