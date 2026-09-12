import asyncio
import io
import wave

import httpx

from backend.connection_service import create_app
from backend.model_gateway import ModelError, validate_response


class FakeProvider:
    async def health(self):
        return {"ready": True, "feature_count": {"dysarthria": 12}}

    async def predict(self, audio_path):
        assert audio_path.suffix == ".wav"
        return {
            "api_version": "3.2.0",
            "model_metadata": {
                "bundle_id": "wasl-test-bundle",
            },
            "feature_extraction": {
                "feature_count": 115,
                "clinical_voice_features": "available",
                "warnings": [],
            },
            "results": {
                "dysarthria": {
                    "detected": True,
                    "probability": 0.71,
                    "threshold": 0.5,
                    "scope": "test",
                },
                "stuttering": {
                    "detected": False,
                    "probability": 0.22,
                    "threshold": 0.6,
                    "scope": "test",
                },
                "voice_disorder": {
                    "detected": False,
                    "probability": 0.31,
                    "threshold": 0.7,
                    "scope": "test",
                },
            },
        }


def wav_bytes(seconds=0.12, rate=16000):
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(b"\x00\x00" * int(rate * seconds))
    return output.getvalue()


def context(consent=True):
    return {
        "consent": {
            "answers": consent,
            "audio": consent,
            "share": consent,
        },
        "expected_tasks": ["picture_naming"],
        "answers": {},
        "hearing": {},
        "pointing_trials": [],
        "red_flags": {},
    }


def test_full_model_connection_and_clinical_gate():
    async def scenario():
        app = create_app(FakeProvider())
        transport = httpx.ASGITransport(app=app)

        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(
                transport=transport,
                base_url="http://test",
            ) as client:
                await run_full_model_scenario(client)

    asyncio.run(scenario())


async def run_full_model_scenario(client):
    assessment_id = "WSL-TEST-1001"
    prepared = await client.put(
        f"/api/assessments/{assessment_id}",
        json=context(),
    )
    assert prepared.status_code == 200
    uploaded = await client.post(
        f"/api/assessments/{assessment_id}/recordings",
        data={"task": "picture_naming"},
        files={
            "audio": (
                "sample.wav",
                wav_bytes(),
                "audio/wav",
            )
        },
    )
    assert uploaded.status_code == 200
    accepted = await client.post(
        f"/api/assessments/{assessment_id}/analyze"
    )
    assert accepted.status_code == 202

    status = None
    for _ in range(100):
        response = await client.get(
            f"/api/assessments/{assessment_id}/analysis-status"
        )
        status = response.json()
        if status["status"] in {
            "completed",
            "failed",
        }:
            break
        await asyncio.sleep(0.02)
    assert status["status"] == "completed", status

    result = await client.get(
        f"/api/assessments/{assessment_id}/result"
    )
    assert result.status_code == 200
    payload = result.json()
    assert payload["source"] == "model_api"
    assert payload["model_version"] == (
        "wasl-test-bundle"
    )
    assert payload["priority"]["level"] == "pending"
    assert payload["confidence"] is None
    assert (
        payload["sample_results"][0]
        ["results"]["dysarthria"]
        ["probability"]
        == 0.71
    )

    no_note = await client.post(
        f"/api/assessments/{assessment_id}/clinical-review",
        json={
            "decision": "approved",
            "priority": "medium",
            "service": (
                "SPEECH_LANGUAGE_ASSESSMENT"
            ),
            "notes": "",
        },
    )
    assert no_note.status_code == 422
    approved = await client.post(
        f"/api/assessments/{assessment_id}/clinical-review",
        json={
            "decision": "approved",
            "priority": "medium",
            "service": (
                "SPEECH_LANGUAGE_ASSESSMENT"
            ),
            "notes": (
                "Reviewed audio and independent "
                "model outputs."
            ),
        },
    )
    assert approved.status_code == 200


def test_consent_and_complete_recordings_are_required():
    async def scenario():
        app = create_app(FakeProvider())
        transport = httpx.ASGITransport(app=app)

        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(
                transport=transport,
                base_url="http://test",
            ) as client:
                await run_consent_scenario(client)

    asyncio.run(scenario())


async def run_consent_scenario(client):
    assessment_id = "WSL-TEST-1002"
    denied = await client.put(
        f"/api/assessments/{assessment_id}",
        json=context(False),
    )
    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == (
        "CONSENT_REQUIRED"
    )

    prepared = await client.put(
        f"/api/assessments/{assessment_id}",
        json=context(),
    )
    assert prepared.status_code == 200
    incomplete = await client.post(
        f"/api/assessments/{assessment_id}/analyze"
    )
    assert incomplete.status_code == 409
    assert incomplete.json()["detail"]["code"] == (
        "RECORDINGS_INCOMPLETE"
    )


def test_provider_response_rejects_missing_or_invalid_scores():
    invalid = {
        "results": {
            "dysarthria": {"detected": True, "probability": 1.2, "threshold": 0.5},
        },
    }
    try:
        validate_response(invalid)
    except ModelError as error:
        assert error.code == "MODEL_RESPONSE_INVALID"
    else:
        raise AssertionError("Invalid provider output was accepted")
