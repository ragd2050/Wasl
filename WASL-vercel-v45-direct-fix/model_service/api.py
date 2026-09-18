import hashlib
import logging
import platform
from pathlib import Path
import tempfile
import warnings

from importlib.metadata import PackageNotFoundError, version

import joblib
import numpy as np

from fastapi import FastAPI, File, HTTPException, UploadFile

from .backend.feature_extraction import extract_audio_features


API_VERSION = "3.2.0"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
LOGGER = logging.getLogger("wasl.model_service")


# =========================================================
# Paths
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

DYSARTHRIA_MODEL_PATH = (
    BASE_DIR / "speech_dysarthria_model.pkl"
)

STUTTERING_MODEL_PATH = (
    BASE_DIR / "stuttering_model.pkl"
)

VOICE_DISORDER_MODEL_PATH = (
    BASE_DIR
    / "voice_disorders_generalized_xgboost_model.pkl"
)


def package_version(package_name: str) -> str:
    """Return an installed package version for audit metadata."""

    try:
        return version(package_name)
    except PackageNotFoundError:
        return "unknown"


def sha256_file(path: Path) -> str:
    """Create a stable identifier for a trusted model artifact."""

    digest = hashlib.sha256()

    with path.open("rb") as model_file:
        while chunk := model_file.read(1024 * 1024):
            digest.update(chunk)

    return digest.hexdigest()


# =========================================================
# Load model files
# =========================================================

def load_model_data(
    model_path: Path,
    model_name: str,
) -> dict:

    if not model_path.exists():
        raise FileNotFoundError(
            f"{model_name} model not found at: "
            f"{model_path}"
        )

    model_data = joblib.load(
        model_path
    )

    if "model" not in model_data:
        raise ValueError(
            f"{model_name} model file does not "
            f"contain 'model'."
        )

    if "feature_columns" not in model_data:
        raise ValueError(
            f"{model_name} model file does not "
            f"contain 'feature_columns'."
        )

    return model_data


dysarthria_model_data = load_model_data(
    DYSARTHRIA_MODEL_PATH,
    "Dysarthria",
)

stuttering_model_data = load_model_data(
    STUTTERING_MODEL_PATH,
    "Stuttering",
)

voice_disorder_model_data = load_model_data(
    VOICE_DISORDER_MODEL_PATH,
    "Voice disorder",
)


# =========================================================
# Extract model objects + metadata
# =========================================================

dysarthria_model = (
    dysarthria_model_data["model"]
)

dysarthria_feature_columns = (
    dysarthria_model_data[
        "feature_columns"
    ]
)


stuttering_model = (
    stuttering_model_data["model"]
)

stuttering_feature_columns = (
    stuttering_model_data[
        "feature_columns"
    ]
)


voice_disorder_model = (
    voice_disorder_model_data["model"]
)

voice_disorder_feature_columns = (
    voice_disorder_model_data[
        "feature_columns"
    ]
)

voice_disorder_threshold = float(
    voice_disorder_model_data.get(
        "threshold",
        0.55,
    )
)


# =========================================================
# Fixed thresholds for current models
# =========================================================

DYSARTHRIA_THRESHOLD = 0.50
STUTTERING_THRESHOLD = 0.50


MODEL_ARTIFACTS = {
    "dysarthria": {
        "file": DYSARTHRIA_MODEL_PATH.name,
        "sha256": sha256_file(
            DYSARTHRIA_MODEL_PATH
        ),
        "model_type": type(
            dysarthria_model
        ).__name__,
    },
    "stuttering": {
        "file": STUTTERING_MODEL_PATH.name,
        "sha256": sha256_file(
            STUTTERING_MODEL_PATH
        ),
        "model_type": type(
            stuttering_model
        ).__name__,
    },
    "voice_disorder": {
        "file": VOICE_DISORDER_MODEL_PATH.name,
        "sha256": sha256_file(
            VOICE_DISORDER_MODEL_PATH
        ),
        "model_type": type(
            voice_disorder_model
        ).__name__,
    },
}

MODEL_BUNDLE_ID = (
    "wasl-"
    + hashlib.sha256(
        "".join(
            item["sha256"]
            for item in MODEL_ARTIFACTS.values()
        ).encode("ascii")
    ).hexdigest()[:16]
)

RUNTIME_METADATA = {
    "python": platform.python_version(),
    "scikit_learn": package_version(
        "scikit-learn"
    ),
    "xgboost": package_version(
        "xgboost"
    ),
    "librosa": package_version(
        "librosa"
    ),
    "praat_parselmouth": package_version(
        "praat-parselmouth"
    ),
}


# =========================================================
# FastAPI application
# =========================================================

app = FastAPI(
    title=(
        "WASL Multi-Disorder "
        "Speech Screening API"
    ),
    description=(
        "AI-powered preliminary screening "
        "for speech and voice disorder "
        "indicators."
    ),
    version=API_VERSION,
)


# =========================================================
# Helpers
# =========================================================

def prepare_model_input(
    features: np.ndarray,
    feature_columns: list[str],
    model_name: str,
) -> np.ndarray:

    expected_feature_count = len(
        feature_columns
    )

    actual_feature_count = len(
        features
    )

    if (
        actual_feature_count
        != expected_feature_count
    ):
        raise ValueError(
            f"Feature count mismatch for "
            f"{model_name}. "
            f"Expected "
            f"{expected_feature_count}, "
            f"received "
            f"{actual_feature_count}."
        )

    return np.asarray(
        features,
        dtype=np.float32,
    ).reshape(
        1,
        -1,
    )


def get_positive_probability(
    model,
    model_input: np.ndarray,
) -> float:

    if hasattr(
        model,
        "predict_proba",
    ):
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message=(
                    "X does not have valid "
                    "feature names.*"
                ),
                category=UserWarning,
            )

            probabilities = (
                model.predict_proba(
                    model_input
                )[0]
            )

        classes = list(
            model.classes_
        )

        if 1 in classes:
            positive_index = (
                classes.index(1)
            )

            return float(
                probabilities[
                    positive_index
                ]
            )

        if len(probabilities) == 2:
            return float(
                probabilities[1]
            )


    if hasattr(
        model,
        "decision_function",
    ):
        score = float(
            model.decision_function(
                model_input
            )[0]
        )

        return float(
            1.0
            / (
                1.0
                + np.exp(-score)
            )
        )


    prediction = int(
        model.predict(
            model_input
        )[0]
    )

    return float(
        prediction
    )


async def save_upload(
    upload: UploadFile,
    destination: Path,
) -> int:
    """Save one upload with a strict size limit."""

    total_bytes = 0

    with destination.open("wb") as output:
        while chunk := await upload.read(
            64 * 1024
        ):
            total_bytes += len(chunk)

            if total_bytes > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail={
                        "code": "AUDIO_TOO_LARGE",
                        "message": (
                            "The audio file exceeds "
                            "the 25 MB limit."
                        ),
                    },
                )

            output.write(chunk)

    if total_bytes == 0:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "AUDIO_EMPTY",
                "message": (
                    "The uploaded audio file is empty."
                ),
            },
        )

    return total_bytes


def classify_screening_result(
    probability: float,
    threshold: float = 0.50,
) -> bool:

    return (
        probability
        >= threshold
    )


def build_result(
    probability: float,
    positive_message: str,
    negative_message: str,
    threshold: float = 0.50,
) -> dict:

    detected = (
        classify_screening_result(
            probability,
            threshold,
        )
    )

    return {
        "detected": detected,

        "probability": round(
            probability,
            4,
        ),

        "percentage": round(
            probability * 100,
            2,
        ),

        "threshold": round(
            threshold,
            2,
        ),

        "result": (
            positive_message
            if detected
            else negative_message
        ),
    }


# =========================================================
# Routes
# =========================================================

@app.get("/")
def home():

    return {
        "status": "online",

        "system": "WASL AI",

        "version": API_VERSION,

        "model_bundle_id": MODEL_BUNDLE_ID,

        "models": [
            "Dysarthria screening",
            "Stuttering screening",
            (
                "Voice disorder / "
                "Reinke edema indicators"
            ),
        ],

        "message": (
            "Multi-disorder speech "
            "screening API is running."
        ),
    }


# =========================================================
# Health
# =========================================================

@app.get("/health")
def health_check():

    return {
        "status": "healthy",

        "api_version": API_VERSION,

        "model_bundle_id": MODEL_BUNDLE_ID,

        "dysarthria_model_loaded": (
            True
        ),

        "stuttering_model_loaded": (
            True
        ),

        "voice_disorder_model_loaded": (
            True
        ),

        "feature_count": {
            "dysarthria": len(
                dysarthria_feature_columns
            ),

            "stuttering": len(
                stuttering_feature_columns
            ),

            "voice_disorder": len(
                voice_disorder_feature_columns
            ),
        },

        "threshold": {
            "dysarthria": (
                DYSARTHRIA_THRESHOLD
            ),

            "stuttering": (
                STUTTERING_THRESHOLD
            ),

            "voice_disorder": (
                voice_disorder_threshold
            ),
        },

        "runtime": RUNTIME_METADATA,
    }


# =========================================================
# Analyze audio
# =========================================================

@app.post("/analyze")
async def analyze_audio(
    audio: UploadFile = File(...),
):

    allowed_extensions = {
        ".wav",
        ".mp3",
        ".flac",
        ".ogg",
        ".m4a",
        ".mp4",
    }

    if not audio.filename:
        raise HTTPException(
            status_code=400,
            detail=(
                "No audio filename "
                "was provided."
            ),
        )


    file_extension = Path(
        audio.filename
    ).suffix.lower()


    if (
        file_extension
        not in allowed_extensions
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported audio format. "
                "Use WAV, MP3, FLAC, OGG, "
                "M4A, or MP4."
            ),
        )


    temp_path = None


    try:

        # =================================================
        # Save uploaded audio temporarily
        # =================================================

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=file_extension,
        ) as temp_file:
            temp_path = temp_file.name

        await save_upload(
            audio,
            Path(temp_path),
        )


        # =================================================
        # Feature extraction
        # =================================================

        features, feature_metadata = (
            extract_audio_features(
                temp_path,
                return_metadata=True,
            )
        )


        # =================================================
        # Prepare model inputs
        # =================================================

        dysarthria_input = (
            prepare_model_input(
                features,
                dysarthria_feature_columns,
                "Dysarthria",
            )
        )


        stuttering_input = (
            prepare_model_input(
                features,
                stuttering_feature_columns,
                "Stuttering",
            )
        )


        voice_disorder_input = (
            prepare_model_input(
                features,
                voice_disorder_feature_columns,
                "Voice disorder",
            )
        )


        # =================================================
        # Probabilities
        # =================================================

        dysarthria_probability = (
            get_positive_probability(
                dysarthria_model,
                dysarthria_input,
            )
        )


        stuttering_probability = (
            get_positive_probability(
                stuttering_model,
                stuttering_input,
            )
        )


        voice_disorder_probability = (
            get_positive_probability(
                voice_disorder_model,
                voice_disorder_input,
            )
        )


        # =================================================
        # Independent screening results
        # =================================================

        results = {

            "dysarthria": build_result(
                probability=(
                    dysarthria_probability
                ),

                positive_message=(
                    "Potential dysarthria "
                    "indicators detected."
                ),

                negative_message=(
                    "No strong dysarthria "
                    "indicators detected."
                ),

                threshold=(
                    DYSARTHRIA_THRESHOLD
                ),
            ),


            "stuttering": build_result(
                probability=(
                    stuttering_probability
                ),

                positive_message=(
                    "Potential stuttering "
                    "indicators detected."
                ),

                negative_message=(
                    "No strong stuttering "
                    "indicators detected."
                ),

                threshold=(
                    STUTTERING_THRESHOLD
                ),
            ),


            "voice_disorder": build_result(
                probability=(
                    voice_disorder_probability
                ),

                positive_message=(
                    "Potential Reinke "
                    "edema-related voice "
                    "disorder indicators "
                    "detected."
                ),

                negative_message=(
                    "No strong Reinke "
                    "edema-related voice "
                    "indicators detected."
                ),

                threshold=(
                    voice_disorder_threshold
                ),
            ),
        }


        # =================================================
        # Display ordering only
        #
        # Important:
        # These model probabilities should not be treated
        # as directly comparable diagnostic probabilities.
        # =================================================

        ranked_results = sorted(
            [
                {
                    "condition": (
                        condition
                    ),

                    "percentage": (
                        result[
                            "percentage"
                        ]
                    ),

                    "detected": (
                        result[
                            "detected"
                        ]
                    ),
                }

                for condition, result
                in results.items()
            ],

            key=lambda item: (
                item[
                    "percentage"
                ]
            ),

            reverse=True,
        )


        # =================================================
        # Response
        # =================================================

        return {

            "filename": (
                audio.filename
            ),

            "api_version": API_VERSION,

            "model_metadata": {
                "bundle_id": MODEL_BUNDLE_ID,
                "artifacts": MODEL_ARTIFACTS,
                "runtime": RUNTIME_METADATA,
            },

            "feature_extraction": (
                feature_metadata
            ),

            "results": (
                results
            ),

            "ranking": (
                ranked_results
            ),

            "ranking_note": (
                "The screening scores are "
                "produced by independent "
                "models trained on different "
                "datasets. Higher percentage "
                "does not represent a final "
                "diagnosis or prove that one "
                "condition is more likely "
                "than another."
            ),

            "screening_scope": {

                "dysarthria": (
                    "Preliminary "
                    "dysarthria screening."
                ),

                "stuttering": (
                    "Preliminary "
                    "stuttering screening."
                ),

                "voice_disorder": (
                    "Preliminary screening "
                    "for Reinke edema-related "
                    "voice disorder indicators. "
                    "The current model was "
                    "trained using SVD healthy "
                    "voices, SVD Reinke edema "
                    "recordings, and external "
                    "non-dysarthria controls."
                ),
            },

            "thresholds": {
                "dysarthria": (
                    DYSARTHRIA_THRESHOLD
                ),

                "stuttering": (
                    STUTTERING_THRESHOLD
                ),

                "voice_disorder": (
                    voice_disorder_threshold
                ),
            },

            "disclaimer": (
                "These outputs are "
                "preliminary AI screening "
                "indicators, not a medical "
                "diagnosis. Results must be "
                "reviewed by a qualified "
                "speech-language pathologist "
                "or physician."
            ),
        }


    except HTTPException:
        raise


    except Exception as error:
        LOGGER.exception(
            "Audio analysis failed: %s",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "AUDIO_ANALYSIS_FAILED",
                "message": (
                    "The recording could not be "
                    "analyzed."
                ),
            },
        )


    finally:

        if (
            temp_path
            and Path(
                temp_path
            ).exists()
        ):
            Path(
                temp_path
            ).unlink(
                missing_ok=True
            )

        await audio.close()
