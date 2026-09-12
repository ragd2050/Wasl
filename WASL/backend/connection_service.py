"""Local WASL connection to the supplied screening API.

Run from root: python -m uvicorn backend.connection_service:app --port 8080
Drafts remain in IndexedDB. Temporary server audio is deleted after analysis.
This process is a local integration environment, not production authentication.
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from .model_gateway import ModelError, ModelGateway, STAGES, assemble_result, audio_hash, convert_to_wav


ROOT = Path(__file__).resolve().parent.parent
TASKS = {"picture_naming", "picture_description", "story_narration", "reading", "connected_speech"}
TYPES = {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac", "audio/x-m4a"}
MAX_BYTES = 25 * 1024 * 1024
ERRORS = {
    "CONSENT_REQUIRED": ("يجب إكمال موافقة ولي الأمر قبل إرسال التسجيلات للتحليل.", "Guardian consent must be complete before recordings are sent for analysis."),
    "ASSESSMENT_NOT_FOUND": ("انتهت جلسة التحليل. التسجيلات محفوظة على جهازك؛ أعد المحاولة.", "The analysis session expired. Recordings remain on this device; please retry."),
    "ASSESSMENT_BUSY": ("التقييم قيد المعالجة الآن. انتظر قليلًا ثم أعد المحاولة.", "The assessment is currently being processed. Wait briefly and try again."),
    "TASKS_INVALID": ("قائمة مهام التسجيل غير صالحة.", "The recording task list is invalid."),
    "RECORDINGS_INCOMPLETE": ("لم تُرفع جميع التسجيلات المطلوبة. التسجيلات المحلية لم تُحذف.", "Not all required recordings were uploaded. Local recordings were not deleted."),
    "AUDIO_TYPE_INVALID": ("صيغة التسجيل غير مدعومة.", "The recording format is not supported."),
    "AUDIO_TOO_LARGE": ("حجم التسجيل أكبر من الحد المسموح.", "The recording exceeds the allowed size."),
    "AUDIO_EMPTY": ("ملف التسجيل فارغ.", "The recording file is empty."),
    "AUDIO_DURATION_INVALID": ("مدة التسجيل غير صالحة للتحليل.", "The recording duration is invalid for analysis."),
    "CLINICAL_SELECTION_REQUIRED": ("يجب على المختص تحديد الأولوية والمسار السريري.", "The specialist must select a priority and clinical pathway."),
    "CLINICAL_NOTE_REQUIRED": ("يجب إضافة ملاحظة سريرية تشرح القرار.", "A clinical note explaining the decision is required."),
    "MODEL_UNAVAILABLE": ("خدمة تحليل الصوت غير متاحة الآن. التسجيلات محفوظة على جهازك ويمكن إعادة المحاولة.", "Audio analysis is unavailable. Recordings are saved on this device; please retry."),
    "MODEL_NOT_READY": ("خدمة تحليل الصوت ليست جاهزة بعد. يرجى العودة إلى الموظف.", "Audio analysis is not ready yet. Please return to staff."),
    "MODEL_TIMEOUT": ("استغرق التحليل وقتًا أطول من المتوقع. يرجى إعادة المحاولة.", "Analysis took too long. Please retry."),
    "MODEL_RESPONSE_INVALID": ("تعذّر التحقق من نتيجة التحليل. لم تُصدر نتيجة.", "The analysis response could not be validated. No result was issued."),
    "AUDIO_CONVERSION_FAILED": ("تعذّرت قراءة التسجيل. يرجى إعادة تسجيل العينة.", "The recording could not be decoded. Please record it again."),
    "AUDIO_CONVERTER_UNAVAILABLE": ("تعذّر تجهيز التسجيلات للتحليل. يرجى العودة إلى الموظف.", "Audio preparation is unavailable. Please return to staff."),
}


def problem(code: str, status: int = 503):
    ar, en = ERRORS.get(code, ("تعذّر إكمال التحليل. التسجيلات محفوظة لإعادة المحاولة.", "Analysis could not finish. Recordings are saved for retry."))
    return HTTPException(status, detail={"code": code, "error_ar": ar, "error_en": en})


def check_id(value: str):
    if not re.fullmatch(r"[A-Za-z0-9_-]{4,100}", value):
        raise problem("ASSESSMENT_ID_INVALID", 400)


class Consent(BaseModel):
    answers: bool = False
    audio: bool = False
    share: bool = False


class Context(BaseModel):
    model_config = ConfigDict(extra="forbid")
    consent: Consent
    expected_tasks: list[str] = Field(min_length=1, max_length=5)
    answers: dict = Field(default_factory=dict)
    hearing: dict = Field(default_factory=dict)
    pointing_trials: list = Field(default_factory=list)
    red_flags: dict = Field(default_factory=dict)


class ClinicalReview(BaseModel):
    model_config = ConfigDict(extra="ignore")
    decision: str
    priority: str
    service: str
    notes: str = ""
    care_plan: str = ""
    in_person: bool = False
    reviewer: str = "specialist"


class Retake(BaseModel):
    task: str
    reason: str = ""


def create_app(provider=None):
    records = {}
    running = set()
    lock = asyncio.Lock()

    @asynccontextmanager
    async def lifespan(app):
        if provider is not None:
            app.state.provider = provider
            app.state.model_mode = "test_provider"
            app.state.model_client = None
        else:
            remote_url = os.getenv("WASL_MODEL_URL", "").strip()

            if remote_url:
                client = httpx.AsyncClient(
                    base_url=remote_url,
                    timeout=httpx.Timeout(90, connect=5),
                    follow_redirects=False,
                    trust_env=False,
                )
                app.state.model_mode = "remote_model_api"
            else:
                from model_service.api import app as local_model_app

                client = httpx.AsyncClient(
                    transport=httpx.ASGITransport(
                        app=local_model_app,
                    ),
                    base_url="http://wasl-model.local",
                    timeout=httpx.Timeout(90, connect=5),
                    follow_redirects=False,
                    trust_env=False,
                )
                app.state.model_mode = "embedded_model_api"

            app.state.model_client = client
            app.state.provider = ModelGateway(client)

        app.state.capacity = asyncio.Semaphore(2)

        try:
            yield
        finally:
            for task in list(running):
                task.cancel()
            await asyncio.gather(*running, return_exceptions=True)
            for value in records.values():
                value["temp"].cleanup()
            if app.state.model_client is not None:
                await app.state.model_client.aclose()

    app = FastAPI(
        title="WASL model connection",
        version="33.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=(
            r"https?://(127\.0\.0\.1|localhost)(:\d+)?"
        ),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    def item(aid):
        check_id(aid)
        if aid not in records:
            raise problem("ASSESSMENT_NOT_FOUND", 404)
        return records[aid]

    def active(value):
        return value.get("job", {}).get("status") in ("queued", "processing")

    def expire():
        for aid, value in list(records.items()):
            if not active(value) and not value["uploading"] and time.time() - value["updated_at"] > 3600:
                value["temp"].cleanup()
                del records[aid]

    @app.get("/api/health")
    async def health():
        try:
            status = await app.state.provider.health()
            return {
                **status,
                "mode": app.state.model_mode,
                "api_contract_version": status.get(
                    "api_version",
                    "3.2.0",
                ),
                "audio_conversion": {
                    "browser_wav": True,
                    "ffmpeg_available": bool(
                        shutil.which("ffmpeg")
                    ),
                },
            }
        except ModelError as error:
            raise problem(error.code) from None

    @app.put("/api/assessments/{aid}")
    async def prepare(aid: str, context: Context):
        check_id(aid)
        if not all((context.consent.answers, context.consent.audio, context.consent.share)):
            raise problem("CONSENT_REQUIRED", 403)
        if len(set(context.expected_tasks)) != len(context.expected_tasks) or not set(context.expected_tasks) <= TASKS:
            raise problem("TASKS_INVALID", 400)
        async with lock:
            expire()
            if aid in records and (active(records[aid]) or records[aid]["uploading"]):
                raise problem("ASSESSMENT_BUSY", 409)
            if aid not in records and len(records) >= 20:
                raise problem("CAPACITY_REACHED", 429)
            if aid in records:
                records[aid]["temp"].cleanup()
            records[aid] = {
                "context": context.model_dump(),
                "recordings": {},
                "uploading": set(),
                "temp": tempfile.TemporaryDirectory(prefix="wasl-audio-"),
                "updated_at": time.time(),
            }
        return {"assessment_id": aid, "status": "collecting"}

    @app.post("/api/assessments/{aid}/recordings")
    async def upload(aid: str, task: str = Form(...), audio: UploadFile = File(...)):
        value = item(aid)
        if task not in value["context"]["expected_tasks"]:
            raise problem("TASKS_INVALID", 400)
        if (audio.content_type or "").split(";")[0].strip() not in TYPES:
            raise problem("AUDIO_TYPE_INVALID", 415)
        async with lock:
            if active(value) or task in value["uploading"] or value.get("job"):
                raise problem("ASSESSMENT_BUSY", 409)
            value["uploading"].add(task)
        path = Path(value["temp"].name) / (uuid.uuid4().hex + ".audio")
        size = 0
        try:
            with path.open("wb") as output:
                while chunk := await audio.read(64 * 1024):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise problem("AUDIO_TOO_LARGE", 413)
                    output.write(chunk)
            if not size:
                raise problem("AUDIO_EMPTY", 400)
            previous = value["recordings"].get(task)
            value["recordings"][task] = {"path": path, "sha256": audio_hash(path), "size": size}
            if previous:
                previous["path"].unlink(missing_ok=True)
            value["updated_at"] = time.time()
            return {"ok": True, "stored": True, "task": task, "size": size}
        except BaseException:
            path.unlink(missing_ok=True)
            raise
        finally:
            value["uploading"].discard(task)
            await audio.close()

    async def run_job(aid, value):
        job = value["job"]
        try:
            async with app.state.capacity:
                async with asyncio.timeout(600):
                    job.update(status="processing", stage_index=1, progress=0.1)
                    await app.state.provider.health()
                    samples = []
                    count = len(value["context"]["expected_tasks"])
                    for index, task in enumerate(value["context"]["expected_tasks"]):
                        record = value["recordings"][task]
                        wav = Path(value["temp"].name) / (task + ".wav")
                        info = await convert_to_wav(record["path"], wav)
                        job.update(stage_index=2, current_task=task, completed_samples=index)
                        prediction = await app.state.provider.predict(
                            wav
                        )
                        samples.append(
                            {
                                "task": task,
                                "audio_sha256": record[
                                    "sha256"
                                ],
                                **info,
                                **prediction,
                            }
                        )
                        wav.unlink(missing_ok=True)
                        job.update(progress=0.15 + 0.75 * (index + 1) / count, completed_samples=index + 1)
                    job.update(stage_index=3, progress=0.95)
                    value["result"] = assemble_result(aid, samples)
                    job.update(status="completed", stage_index=4, progress=1)
        except (ModelError, TimeoutError) as error:
            code = error.code if isinstance(error, ModelError) else "MODEL_TIMEOUT"
            job.update(status="failed", **problem(code).detail)
        except asyncio.CancelledError:
            job.update(status="failed", **problem("ANALYSIS_INTERRUPTED").detail)
            raise
        except Exception:
            job.update(status="failed", **problem("MODEL_REQUEST_FAILED").detail)
        finally:
            value["updated_at"] = time.time()
            value["temp"].cleanup()
            value["recordings"] = {}

    @app.post("/api/assessments/{aid}/analyze", status_code=202)
    async def analyze(aid: str):
        value = item(aid)
        async with lock:
            if active(value):
                return {"job_id": value["job"]["job_id"], "status": "accepted"}
            if value["uploading"] or set(value["recordings"]) != set(value["context"]["expected_tasks"]):
                raise problem("RECORDINGS_INCOMPLETE", 409)
            job = {
                "job_id": "job_" + uuid.uuid4().hex,
                "status": "queued",
                "stage_index": 0,
                "n_stages": len(STAGES),
                "progress": 0,
                "started_at": time.time(),
            }
            value["job"] = job
            work = asyncio.create_task(run_job(aid, value))
            running.add(work)
            work.add_done_callback(running.discard)
        return {"job_id": job["job_id"], "status": "accepted"}

    @app.get("/api/assessments/{aid}/analysis-status")
    async def status(aid: str, job_id: str = ""):
        job = item(aid).get("job")
        if not job or (job_id and job_id != job["job_id"]):
            raise problem("JOB_NOT_FOUND", 404)
        return {
            **job,
            "stage": STAGES[job["stage_index"]] if job["stage_index"] < len(STAGES) else None,
        }

    @app.get("/api/assessments/{aid}/result")
    async def result(aid: str):
        value = item(aid)
        if value.get("job", {}).get("status") != "completed" or "result" not in value:
            raise problem("RESULT_NOT_AVAILABLE", 409)
        return value["result"]

    @app.post("/api/assessments/{aid}/clinical-review")
    async def review(aid: str, body: ClinicalReview):
        value = item(aid)
        if "result" not in value or value.get("retake_requests"):
            raise problem("RESULT_NOT_AVAILABLE", 409)
        if body.decision != "approved" or body.priority not in {"low", "medium", "high"} or body.service not in {"SPEECH_LANGUAGE_ASSESSMENT", "AUDIOLOGY_ASSESSMENT"}:
            raise problem("CLINICAL_SELECTION_REQUIRED", 422)
        if not body.notes.strip():
            raise problem("CLINICAL_NOTE_REQUIRED", 422)
        value["clinical_review"] = {
            **body.model_dump(),
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
        return {"ok": True, "review": value["clinical_review"]}

    @app.post("/api/assessments/{aid}/request-retake")
    async def retake(aid: str, body: Retake):
        value = item(aid)
        if body.task not in value["context"]["expected_tasks"]:
            raise problem("TASKS_INVALID", 400)
        value.setdefault("retake_requests", []).append(body.model_dump())
        value.pop("clinical_review", None)
        return {"ok": True, "task": body.task}

    app.mount("/assets", StaticFiles(directory=ROOT / "assets"), name="assets")

    @app.get("/")
    async def home():
        return FileResponse(ROOT / "index.html")

    @app.get("/{page}")
    async def page_file(page: str):
        if page not in {p.name for p in ROOT.glob("*.html")}:
            raise HTTPException(404)
        return FileResponse(ROOT / page)

    return app


app = create_app()
