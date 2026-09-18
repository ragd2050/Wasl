# WASL model-connection API

The browser and API are served from the same origin by `backend.connection_service`. By default, the supplied model API runs inside the same Python process through an in-process ASGI transport. Set `WASL_MODEL_URL` only when a separately deployed model service is required.

## Endpoints

### Health

```http
GET /api/health
```

Fails unless all three model-service health flags are true. The response also reports whether FFmpeg is available for legacy non-WAV recordings; current browser recordings are uploaded as WAV and do not require it.

### Prepare an assessment

```http
PUT /api/assessments/{assessment_id}
Content-Type: application/json
```

```json
{
  "consent": { "answers": true, "audio": true, "share": true },
  "expected_tasks": ["picture_naming", "story_narration"],
  "answers": {},
  "hearing": {},
  "pointing_trials": [],
  "red_flags": {}
}
```

Full consent is enforced before the server accepts recordings.

### Upload each recording

```http
POST /api/assessments/{assessment_id}/recordings
Content-Type: multipart/form-data
```

Fields: `task`, `audio`. Maximum size: 25 MB per recording. Allowed task keys are `picture_naming`, `picture_description`, `story_narration`, `reading`, and `connected_speech`.

### Start analysis

```http
POST /api/assessments/{assessment_id}/analyze
```

Returns `202` with `{ "job_id": "...", "status": "accepted" }` only when all expected recordings are present.

### Poll status

```http
GET /api/assessments/{assessment_id}/analysis-status?job_id=...
```

Status is `queued`, `processing`, `completed`, or `failed`. Failures return a stable `code`, `error_ar`, and `error_en`.

### Get result

```http
GET /api/assessments/{assessment_id}/result
```

Available only after completion. See `MODEL_IO.md`.

### Submit the specialist decision

```http
POST /api/assessments/{assessment_id}/clinical-review
Content-Type: application/json
```

```json
{
  "decision": "approved",
  "priority": "medium",
  "service": "SPEECH_LANGUAGE_ASSESSMENT",
  "notes": "Clinical rationale is required.",
  "care_plan": "",
  "in_person": false,
  "reviewer": "specialist"
}
```

The server rejects missing priority, pathway, or clinical notes.

### Request a retake

```http
POST /api/assessments/{assessment_id}/request-retake
Content-Type: application/json
```

Body: `{ "task": "picture_naming", "reason": "clarity" }`.

## Model-service contract

The connector calls the supplied model API through its embedded ASGI transport by default:

```http
GET  /health
POST /analyze
```

When `WASL_MODEL_URL` is configured, the same calls are sent to that external base URL instead.

The current model-service contract is version `3.2.0`. Its health response includes the model bundle identifier, feature counts, thresholds, and runtime package versions. Its analysis response includes the feature-extraction status, artifact metadata, and all three independent outputs.

The model service accepts at most 25 MB per audio file. The connector never substitutes a score when the service fails or returns malformed data, and internal server paths or exception text are not returned to the browser.
