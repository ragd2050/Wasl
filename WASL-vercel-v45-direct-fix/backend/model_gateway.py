"""Adapter for supplied model artifacts through API v3.2.0."""

from __future__ import annotations

import asyncio
import hashlib
import math
import shutil
import wave
from datetime import datetime, timezone
from pathlib import Path

import httpx


CONDITIONS = {
    "dysarthria": ("مؤشرات عسر التلفظ", "Dysarthria indicators"),
    "stuttering": ("مؤشرات التأتأة", "Stuttering indicators"),
    "voice_disorder": (
        "مؤشرات اضطراب الصوت ضمن نطاق نموذج Reinke",
        "Voice indicators within the Reinke model scope",
    ),
}
STAGES = [
    {"label_ar": "التحقق من التسجيلات", "label_en": "Checking recordings", "component": "Audio validation"},
    {"label_ar": "تجهيز الصوت للتحليل", "label_en": "Preparing audio", "component": "PCM conversion"},
    {"label_ar": "تحليل التسجيلات", "label_en": "Analyzing recordings", "component": "WASL screening API"},
    {"label_ar": "تجهيز نتائج الأخصائي", "label_en": "Preparing specialist results", "component": "Evidence mapping"},
]


class ModelError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def validate_response(payload: dict) -> dict:
    """Preserve independent outputs; reject missing scores instead of using zero."""
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), dict):
        raise ModelError("MODEL_RESPONSE_INVALID")
    clean = {}
    for key in CONDITIONS:
        item = payload["results"].get(key)
        if not isinstance(item, dict) or type(item.get("detected")) is not bool:
            raise ModelError("MODEL_RESPONSE_INVALID")
        for field in ("probability", "threshold"):
            value = item.get(field)
            if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1:
                raise ModelError("MODEL_RESPONSE_INVALID")
        # Provider rounds scores to 4 decimals and thresholds to 2. Keep its flag.
        clean[key] = {
            "detected": item["detected"], "probability": item["probability"],
            "threshold": item["threshold"],
            "scope": str((payload.get("screening_scope") or {}).get(key, ""))[:1500],
        }
    raw_feature_metadata = payload.get(
        "feature_extraction"
    )
    feature_metadata = {}

    if isinstance(raw_feature_metadata, dict):
        feature_metadata = {
            "sample_rate_hz": raw_feature_metadata.get(
                "sample_rate_hz"
            ),
            "trimmed_duration_seconds": raw_feature_metadata.get(
                "trimmed_duration_seconds"
            ),
            "clinical_voice_features": str(
                raw_feature_metadata.get(
                    "clinical_voice_features",
                    "unknown",
                )
            )[:50],
            "feature_count": raw_feature_metadata.get(
                "feature_count"
            ),
            "warnings": [
                str(item)[:100]
                for item in raw_feature_metadata.get(
                    "warnings",
                    [],
                )
                if isinstance(item, str)
            ][:10],
        }

    raw_model_metadata = payload.get(
        "model_metadata"
    )
    model_metadata = {}

    if isinstance(raw_model_metadata, dict):
        model_metadata = {
            "bundle_id": str(
                raw_model_metadata.get(
                    "bundle_id",
                    "not_reported",
                )
            )[:100],
            "runtime": raw_model_metadata.get(
                "runtime",
                {},
            ),
            "artifacts": raw_model_metadata.get(
                "artifacts",
                {},
            ),
        }

    return {
        "results": clean,
        "api_version": str(
            payload.get(
                "api_version",
                "3.1.0",
            )
        )[:30],
        "feature_extraction": feature_metadata,
        "model_metadata": model_metadata,
    }


async def convert_to_wav(source: Path, destination: Path) -> dict:
    """Preserve rate/channels: training-specific extraction stays in user's API."""

    try:
        with source.open("rb") as stream:
            header = stream.read(12)
    except OSError:
        raise ModelError("AUDIO_CONVERSION_FAILED") from None

    if header[:4] == b"RIFF" and header[8:12] == b"WAVE":
        try:
            shutil.copyfile(source, destination)
            with wave.open(str(destination), "rb") as wav:
                duration = wav.getnframes() / wav.getframerate()
                info = {
                    "duration_sec": round(duration, 4),
                    "sample_rate": wav.getframerate(),
                    "channels": wav.getnchannels(),
                }
        except (OSError, wave.Error, EOFError, ZeroDivisionError):
            destination.unlink(missing_ok=True)
            raise ModelError("AUDIO_CONVERSION_FAILED") from None

        if not 0 < duration <= 240:
            destination.unlink(missing_ok=True)
            raise ModelError("AUDIO_DURATION_INVALID")

        return info

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise ModelError("AUDIO_CONVERTER_UNAVAILABLE")
    process = await asyncio.create_subprocess_exec(
        ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error",
        "-protocol_whitelist", "file,pipe", "-i", str(source),
        "-map", "0:a:0", "-vn", "-c:a", "pcm_s16le",
        "-fs", str(64 * 1024 * 1024), "-y", str(destination),
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        await asyncio.wait_for(process.wait(), timeout=30)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        raise ModelError("AUDIO_CONVERSION_FAILED")
    except asyncio.CancelledError:
        process.kill()
        await process.wait()
        raise
    if process.returncode or not destination.exists():
        raise ModelError("AUDIO_CONVERSION_FAILED")
    if destination.stat().st_size >= 64 * 1024 * 1024:
        raise ModelError("AUDIO_TOO_LARGE")
    try:
        with wave.open(str(destination), "rb") as wav:
            duration = wav.getnframes() / wav.getframerate()
            info = {"duration_sec": round(duration, 4), "sample_rate": wav.getframerate(), "channels": wav.getnchannels()}
    except (wave.Error, EOFError, ZeroDivisionError):
        raise ModelError("AUDIO_CONVERSION_FAILED") from None
    if not 0 < duration <= 240:
        raise ModelError("AUDIO_DURATION_INVALID")
    return info


class ModelGateway:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def health(self) -> dict:
        try:
            response = await self.client.get("/health", timeout=5)
            response.raise_for_status()
            data = response.json()
            if not all(data.get(key + "_model_loaded") is True for key in CONDITIONS):
                raise ModelError("MODEL_NOT_READY")
            return {
                "ready": True,
                "api_version": str(
                    data.get(
                        "api_version",
                        "3.1.0",
                    )
                )[:30],
                "model_bundle_id": str(
                    data.get(
                        "model_bundle_id",
                        "not_reported",
                    )
                )[:100],
                "feature_count": data.get(
                    "feature_count",
                    {},
                ),
                "threshold": data.get(
                    "threshold",
                    {},
                ),
                "runtime": data.get(
                    "runtime",
                    {},
                ),
            }
        except (httpx.HTTPError, ValueError, AttributeError):
            raise ModelError("MODEL_UNAVAILABLE") from None

    async def predict(self, audio_path: Path) -> dict:
        try:
            with audio_path.open("rb") as audio:
                response = await self.client.post(
                    "/analyze", files={"audio": ("sample.wav", audio, "audio/wav")}
                )
            response.raise_for_status()
            return validate_response(response.json())
        except httpx.TimeoutException:
            raise ModelError("MODEL_TIMEOUT") from None
        except (httpx.HTTPError, ValueError):
            raise ModelError("MODEL_REQUEST_FAILED") from None


def assemble_result(assessment_id: str, samples: list[dict]) -> dict:
    """Map returned outputs to evidence. Do not invent diagnoses or triage scores."""
    indicators, reasons = [], []
    for sample in samples:
        for key, value in sample["results"].items():
            if not value["detected"]:
                continue
            ar, en = CONDITIONS[key]
            indicators.append({"code": key.upper(), "label_ar": ar, "label_en": en, "evidence_sources": [sample["task"]]})
            reasons.append({
                "code": key.upper(), "sources": [sample["task"]],
                "text_ar": f"أبلغ نموذج «{ar}» عن إشارة في هذه العينة؛ وتتطلب الإشارة مراجعة الدرجة والحد والتسجيل.",
                "text_en": f"The {en} model flagged this sample; review its score, threshold and recording.",
            })
    first_sample = samples[0] if samples else {}
    model_metadata = first_sample.get(
        "model_metadata",
        {},
    )
    feature_warnings = [
        sample["task"]
        for sample in samples
        if sample.get(
            "feature_extraction",
            {},
        ).get("warnings")
    ]

    stuttering_scores = [
        sample["results"]["stuttering"]["probability"]
        for sample in samples
        if "stuttering" in sample.get("results", {})
    ]
    stuttering_flags = [
        sample["results"]["stuttering"]["detected"]
        for sample in samples
        if "stuttering" in sample.get("results", {})
    ]
    highest_stuttering_score = (
        max(stuttering_scores)
        if stuttering_scores
        else None
    )
    flagged_stuttering_samples = sum(
        1
        for detected in stuttering_flags
        if detected
    )
    stuttering_indicator_present = flagged_stuttering_samples > 0

    if stuttering_indicator_present:
        preliminary_summary = {
            "code": "STUTTERING_INDICATORS_PRESENT",
            "label_ar": "ظهرت مؤشرات تستدعي تقييم طلاقة الكلام",
            "label_en": "Indicators warrant a speech-fluency assessment",
        }
        suggested_priority = {
            "level": "medium",
            "label_ar": "متوسطة — مقترحة للمراجعة",
            "label_en": "Medium — suggested for review",
        }
        recommended_service = {
            "code": "SPEECH_FLUENCY_ASSESSMENT",
            "label_ar": "تقييم طلاقة الكلام لدى أخصائي نطق ولغة",
            "label_en": "Speech-fluency assessment by an SLP",
        }
        next_step_ar = (
            "مراجعة العينات، وقياس نسبة المقاطع المتأتأة يدويًا، "
            "ثم إجراء تقييم شامل للطلاقة قبل اختيار العلاج."
        )
        next_step_en = (
            "Review the samples, measure percent syllables stuttered "
            "clinically, and complete a fluency assessment before "
            "selecting treatment."
        )
    else:
        preliminary_summary = {
            "code": "NO_STRONG_STUTTERING_INDICATOR",
            "label_ar": "لم تظهر إشارة قوية للتأتأة في العينات المرفوعة",
            "label_en": "No strong stuttering signal was found in the uploaded samples",
        }
        suggested_priority = {
            "level": "low",
            "label_ar": "منخفضة — مع استكمال المراجعة",
            "label_en": "Low — complete clinical review",
        }
        recommended_service = {
            "code": "SPEECH_LANGUAGE_ASSESSMENT",
            "label_ar": "تقييم النطق واللغة عند استمرار قلق الأسرة",
            "label_en": "Speech-language assessment if concerns persist",
        }
        next_step_ar = (
            "مقارنة نتيجة النموذج مع ملاحظات الأسرة وعينة كلام أطول، "
            "وإحالة الطفل للتقييم إذا استمر القلق."
        )
        next_step_en = (
            "Compare the model output with caregiver observations and "
            "a longer speech sample, and refer if concerns persist."
        )

    proposed_plan = {
        "title_ar": "خطة مقترحة للأخصائي",
        "title_en": "Suggested specialist plan",
        "items_ar": [
            "مراجعة جودة التسجيل والاستماع إلى العينة كاملة.",
            "تحليل نوع وتكرار عدم الطلاقة وقياس نسبة المقاطع المتأتأة (%SS).",
            "استكمال التاريخ النمائي والعائلي وتحديد مدة ظهور الأعراض.",
            "التأكد من نتيجة فحص السمع وتقييم اللغة الاستقبالية والتعبيرية.",
            "تحديد ملاءمة برنامج Lidcombe بحسب العمر والتقييم السريري.",
            "توثيق خط أساس ومتابعة التغير في الطلاقة خلال الجلسات.",
        ],
        "items_en": [
            "Review recording quality and listen to the complete sample.",
            "Classify disfluencies and clinically measure percent syllables stuttered (%SS).",
            "Complete developmental and family history and establish symptom duration.",
            "Confirm hearing status and assess receptive and expressive language.",
            "Determine Lidcombe Program suitability based on age and clinical assessment.",
            "Document a baseline and monitor fluency across sessions.",
        ],
        "treatment_note_ar": (
            "برنامج Lidcombe خيار علاجي مدعوم للأطفال الصغار، لكنه لا يبدأ "
            "إلا بعد تقييم أخصائي نطق ولغة وتدريب ولي الأمر تحت إشرافه."
        ),
        "treatment_note_en": (
            "The Lidcombe Program is an evidence-supported option for young "
            "children, but it should begin only after SLP assessment and "
            "clinician-supervised caregiver training."
        ),
    }

    return {
        "assessment_id": assessment_id, "status": "completed", "source": "model_api",
        "api_contract_version": first_sample.get("api_version", "3.1.0"),
        "model_version": model_metadata.get("bundle_id", "not_reported_by_provider"),
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "requires_clinician_review": True, "requires_retake": False,
        "requires_manual_routing": True, "confidence": None,
        "preliminary_summary": preliminary_summary,
        "priority": suggested_priority,
        "recommended_service": recommended_service,
        "proposed_plan": proposed_plan,
        "stuttering_summary": {
            "highest_model_score": highest_stuttering_score,
            "flagged_samples": flagged_stuttering_samples,
            "total_samples": len(stuttering_scores),
            "interpretation_ar": (
                "هذه درجة فرز من النموذج وليست نسبة شدة التأتأة أو تشخيصًا."
            ),
            "interpretation_en": (
                "This is a model screening score, not stuttering severity or a diagnosis."
            ),
        },
        "matched_facilities": [],
        "audio_quality": {
            "overall": "feature_warning" if feature_warnings else "decoded",
            "samples_requiring_retake": [],
            "samples_with_feature_warnings": feature_warnings,
        },
        "detected_indicators": indicators, "reasons": reasons, "sample_results": samples,
        "evidence": {
            "speech_features": {}, "explanation_kind": "model_score_and_threshold",
            "next_recommended_step_ar": next_step_ar,
            "next_recommended_step_en": next_step_en,
        },
        "limitations": {
            "ar": (
                "الدرجات صادرة عن ثلاثة نماذج مستقلة، ولا تمثل "
                "احتمالات تشخيصية قابلة للمقارنة. لم تُرفق أدلة "
                "اعتماد سريري للأطفال الناطقين بالعربية. نموذج "
                "اضطراب الصوت ضمن نطاق بيانات Reinke، ولا تقيس "
                "النماذج فهم اللغة أو التعبير أو السمع. القرار "
                "النهائي للأخصائي."
            ),
            "en": (
                "Scores come from three independent models and are not "
                "comparable diagnostic probabilities. Clinical validation "
                "for Arabic-speaking children was not supplied. The voice "
                "model is limited to its Reinke-data scope, and the models "
                "do not assess language comprehension, expression, or "
                "hearing. The specialist makes the final decision."
            ),
        },
    }


def audio_hash(path: Path) -> str:
    with path.open("rb") as data:
        return hashlib.file_digest(data, "sha256").hexdigest()
