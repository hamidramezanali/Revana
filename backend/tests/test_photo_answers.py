import base64
import json
from io import BytesIO

import httpx
import pytest
from fastapi import HTTPException
from PIL import Image, PngImagePlugin
from test_agent import agent as agent_fixture
from test_agent import example_plan, plan, start

from app import agent_provider, agent_store
from app.agent_models import PhotoReading, Plan
from app.config import get_settings
from app.photo_inputs import sanitized_photos

agent = agent_fixture


def photo():
    output = BytesIO()
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("Location", "synthetic-private-metadata")
    Image.new("RGB", (20, 30), "blue").save(output, format="PNG", pnginfo=metadata)
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()


def visual_question(client):
    headers, _journey = start(client)
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    saved.decision.questions[0].photo_mode = "products"
    agent_store.save(access, saved, saved.revision)
    return headers, client.get("/v1/agent/session", headers=headers).json()


def submit(client, headers, journey, **extra):
    return client.post(
        "/v1/agent/answers",
        headers=headers,
        json={
            "revision": journey["revision"],
            "question_id": journey["decision"]["questions"][0]["id"],
            "photos": [photo()],
            "photo_consent": True,
            **extra,
        },
    )


def fake_reading(monkeypatch, captured):
    original = agent_provider.generate

    def generate(task, context, output, **kwargs):
        if output is PhotoReading:
            captured.append((context, kwargs["images"]))
            return PhotoReading(
                observations=["The label appears to say Example cleanser."],
                uncertainties=["Actual use and frequency cannot be established from this photo."],
            )
        return original(task, context, output)

    monkeypatch.setattr(agent_provider, "generate", generate)


def review(client, headers, journey, **extra):
    return client.post(
        "/v1/agent/photo-notes",
        headers=headers,
        json={
            "revision": journey["revision"],
            "event_index": len(journey["events"]) - 1,
            "observations": ["Example cleanser; label checked by me."],
            **extra,
        },
    )


def test_photo_only_answer_is_temporary_and_requires_review_before_plan(agent, monkeypatch):
    client, _ = agent
    headers, journey = visual_question(client)
    captured = []
    fake_reading(monkeypatch, captured)
    result = submit(client, headers, journey)
    assert result.status_code == 200, result.text
    journey = result.json()
    assert journey["assessment_count"] == 1
    assert journey["decision"]["questions"] == []
    assert journey["decision"]["ready"] is False
    assert journey["events"][-1]["photo_count"] == 1
    assert journey["events"][-1]["photo_notes"]["confirmed"] is False
    assert "data:image" not in result.text and "synthetic-private-metadata" not in result.text
    assert plan(client, headers, journey).status_code == 409
    assert "data:image/jpeg;base64," in captured[0][1][0]
    stored = agent_store.read(headers["Authorization"].split()[1]).model_dump_json()
    assert "data:image" not in stored and photo() not in stored
    result = review(client, headers, journey)
    assert result.status_code == 200, result.text
    journey = result.json()
    assert journey["events"][-1]["photo_notes"]["confirmed"] is True
    assert journey["events"][-1]["photo_notes"]["observations"] == [
        "Example cleanser; label checked by me."
    ]
    assert journey["decision"]["questions"]
    assert review(client, headers, journey).status_code == 409
    assert plan(client, headers, journey).status_code == 200


def test_photos_with_choices_and_text_and_discard_past_old_question_cap(agent, monkeypatch):
    client, _ = agent
    headers, journey = visual_question(client)
    access = headers["Authorization"].split()[1]
    saved = agent_store.read(access)
    saved.assessment_count = 5
    agent_store.save(access, saved, saved.revision)
    journey = client.get("/v1/agent/session", headers=headers).json()
    captured = []
    fake_reading(monkeypatch, captured)
    selected = journey["decision"]["questions"][0]["options"][0]["id"]
    result = submit(
        client,
        headers,
        journey,
        photos=[photo()] * 3,
        selected_option_ids=[selected],
        answer="Used occasionally.",
    )
    assert result.status_code == 200
    journey = result.json()
    assert len(captured[0][1]) == 3
    assert captured[0][0]["answer"] == "Used occasionally."
    assert captured[0][0]["selected_answers"] == ["Cleanser"]
    journey = review(client, headers, journey, discard=True, observations=[]).json()
    assert journey["assessment_count"] == 6 and journey["decision"]["questions"]
    assert journey["events"][-1]["photo_notes"] is None
    assert journey["events"][-1]["answer"] == "Used occasionally."


@pytest.mark.parametrize(
    "invalid",
    ["consent", "unsupported", "corrupt", "too_many", "skipped", "oversize"],
)
def test_invalid_photo_answers_never_call_provider_or_save(agent, invalid):
    client, calls = agent
    headers, journey = visual_question(client)
    extras = {}
    if invalid == "consent":
        extras = {"photo_consent": False}
    if invalid == "unsupported":
        extras = {"photos": ["https://example.com/photo.png"]}
    if invalid == "corrupt":
        extras = {"photos": ["data:image/png;base64,bm90LWFuLWltYWdl"]}
    if invalid == "too_many":
        extras = {"photos": [photo()] * 4}
    if invalid == "skipped":
        extras = {"skipped": True}
    if invalid == "oversize":
        extras = {"photos": ["x" * 2_000_001]}
    before = len(calls)
    result = submit(client, headers, journey, **extras)
    assert result.status_code == 422
    assert "base64" not in result.text and "example.com" not in result.text
    assert len(calls) == before
    assert client.get("/v1/agent/session", headers=headers).json() == journey


def test_photo_metadata_removed_and_animation_and_mime_mismatch_rejected():
    output = sanitized_photos([photo()])[0]
    raw = base64.b64decode(output.split(",")[1])
    assert b"synthetic-private-metadata" not in raw
    with Image.open(BytesIO(raw)) as image:
        assert not image.getexif() and image.size == (20, 30)
    with pytest.raises(HTTPException):
        sanitized_photos([photo().replace("image/png", "image/jpeg")])
    stream = BytesIO()
    Image.new("RGB", (10, 10), "blue").save(
        stream, format="PNG", save_all=True, append_images=[Image.new("RGB", (10, 10), "red")]
    )
    with pytest.raises(HTTPException):
        sanitized_photos(["data:image/png;base64," + base64.b64encode(stream.getvalue()).decode()])


def test_failed_photo_reading_and_stale_confirmation_do_not_lose_data(agent, monkeypatch):
    client, _ = agent
    headers, journey = visual_question(client)

    def fail(*args, **kwargs):
        raise HTTPException(502, "Unavailable")

    original = agent_provider.generate
    monkeypatch.setattr(agent_provider, "generate", fail)
    assert submit(client, headers, journey).status_code == 502
    assert client.get("/v1/agent/session", headers=headers).json() == journey
    monkeypatch.setattr(agent_provider, "generate", original)
    fake_reading(monkeypatch, [])
    pending = submit(client, headers, journey).json()
    assert review(client, headers, journey, event_index=0).status_code == 409
    monkeypatch.setattr(agent_provider, "generate", fail)
    assert review(client, headers, pending).status_code == 502
    assert client.get("/v1/agent/session", headers=headers).json() == pending


def test_provider_uses_multimodal_content_without_file_uploads(monkeypatch):
    monkeypatch.setenv("REVANA_OPENAI_API_KEY", "synthetic-key-not-real")
    monkeypatch.setenv("REVANA_OPENAI_MODEL", "gpt-6.1-terra")
    get_settings.cache_clear()
    original_client = httpx.Client
    captured = []

    def transport(request):
        payload = json.loads(request.content)
        captured.append(payload)
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {"type": "output_text", "text": example_plan().model_dump_json()}
                        ],
                    }
                ],
            },
        )

    monkeypatch.setattr(
        httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(transport))
    )
    agent_provider.generate("Synthetic image test", {"answer": "Example"}, Plan, images=[photo()])
    assert captured[0]["store"] is False
    assert captured[0]["input"][0]["content"][1]["type"] == "input_image"
    assert captured[0]["input"][0]["content"][0]["type"] == "input_text"
    get_settings.cache_clear()


def test_body_limit_and_deleted_profile_cannot_be_restored(agent):
    client, calls = agent
    headers, _journey = start(client)
    count = len(calls)
    response = client.post("/v1/agent/answers", headers=headers, content=b"x" * 6_100_001)
    assert response.status_code == 413
    assert len(calls) == count
    assert client.delete("/v1/agent/session", headers=headers).status_code == 204
    assert client.get("/v1/agent/session", headers=headers).status_code == 404
    assert client.get("/v1/agent/status").status_code == 200
    fresh_headers, fresh = start(client)
    assert fresh_headers != headers and fresh["events"] == [] and fresh["plans"] == []


@pytest.mark.parametrize("with_text", [False, True])
def test_photos_allowed_on_every_question_including_legacy_none(agent, monkeypatch, with_text):
    client, _ = agent
    headers, journey = start(client)
    assert journey["decision"]["questions"][0]["photo_mode"] == "none"
    captured = []
    fake_reading(monkeypatch, captured)
    response = submit(client, headers, journey, answer="My skin feels tight." if with_text else "")
    assert response.status_code == 200, response.text
    assert response.json()["events"][-1]["photo_count"] == 1
    assert response.json()["events"][-1]["photo_notes"]["confirmed"] is False
    assert captured[0][0]["photo_mode"] == "none"
    assert captured[0][0]["answer"] == ("My skin feels tight." if with_text else "")
