from pathlib import Path

import librosa
import numpy as np
import parselmouth
from parselmouth.praat import call


SAMPLE_RATE = 16000


def _numpy_localmax(values, *, axis=0):
    """
    Compute Librosa-compatible local maxima without Numba.

    Librosa 0.11 delegates this small operation to a Numba gufunc. Some
    supported NumPy/Numba combinations can terminate the process while
    Chroma estimates tuning. This implementation preserves the same
    comparisons and edge behavior using NumPy operations only.
    """

    values = np.asarray(values)
    rotated = values.swapaxes(-1, axis)
    result = np.zeros_like(values, dtype=bool)
    rotated_result = result.swapaxes(-1, axis)

    if rotated.shape[-1] < 2:
        return result

    rotated_result[..., 1:-1] = (
        (rotated[..., 1:-1] > rotated[..., :-2])
        & (rotated[..., 1:-1] >= rotated[..., 2:])
    )
    rotated_result[..., -1] = (
        rotated[..., -1] > rotated[..., -2]
    )

    return result


# Compatibility safeguard for Librosa's pitch-tracking path. This changes
# only the implementation of local-maximum detection, not its mathematical
# rule or the 115-feature order expected by the trained models.
librosa.util.localmax = _numpy_localmax


def clean_numeric_values(values):
    """
    Replace NaN and infinite values with 0.0.
    """

    return np.nan_to_num(
        np.asarray(values, dtype=np.float32),
        nan=0.0,
        posinf=0.0,
        neginf=0.0,
    )


def extract_voice_clinical_features(audio_path):
    """
    Extract clinical voice features using Praat/Parselmouth.

    Features:
    - Mean fundamental frequency (F0)
    - F0 standard deviation
    - Minimum F0
    - Maximum F0
    - Local jitter
    - Local absolute jitter
    - RAP jitter
    - PPQ5 jitter
    - Local shimmer
    - Local dB shimmer
    - APQ3 shimmer
    - APQ5 shimmer
    - Mean harmonic-to-noise ratio (HNR)
    """

    sound = parselmouth.Sound(str(audio_path))

    if sound.duration <= 0:
        raise ValueError(
            "The audio file has no valid duration."
        )

    pitch = call(
        sound,
        "To Pitch",
        0.0,
        75,
        500,
    )

    mean_f0 = call(
        pitch,
        "Get mean",
        0,
        0,
        "Hertz",
    )

    std_f0 = call(
        pitch,
        "Get standard deviation",
        0,
        0,
        "Hertz",
    )

    minimum_f0 = call(
        pitch,
        "Get minimum",
        0,
        0,
        "Hertz",
        "Parabolic",
    )

    maximum_f0 = call(
        pitch,
        "Get maximum",
        0,
        0,
        "Hertz",
        "Parabolic",
    )

    point_process = call(
        sound,
        "To PointProcess (periodic, cc)",
        75,
        500,
    )

    jitter_local = call(
        point_process,
        "Get jitter (local)",
        0,
        0,
        0.0001,
        0.02,
        1.3,
    )

    jitter_local_absolute = call(
        point_process,
        "Get jitter (local, absolute)",
        0,
        0,
        0.0001,
        0.02,
        1.3,
    )

    jitter_rap = call(
        point_process,
        "Get jitter (rap)",
        0,
        0,
        0.0001,
        0.02,
        1.3,
    )

    jitter_ppq5 = call(
        point_process,
        "Get jitter (ppq5)",
        0,
        0,
        0.0001,
        0.02,
        1.3,
    )

    shimmer_local = call(
        [sound, point_process],
        "Get shimmer (local)",
        0,
        0,
        0.0001,
        0.02,
        1.3,
        1.6,
    )

    shimmer_local_db = call(
        [sound, point_process],
        "Get shimmer (local_dB)",
        0,
        0,
        0.0001,
        0.02,
        1.3,
        1.6,
    )

    shimmer_apq3 = call(
        [sound, point_process],
        "Get shimmer (apq3)",
        0,
        0,
        0.0001,
        0.02,
        1.3,
        1.6,
    )

    shimmer_apq5 = call(
        [sound, point_process],
        "Get shimmer (apq5)",
        0,
        0,
        0.0001,
        0.02,
        1.3,
        1.6,
    )

    harmonicity = call(
        sound,
        "To Harmonicity (cc)",
        0.01,
        75,
        0.1,
        1.0,
    )

    mean_hnr = call(
        harmonicity,
        "Get mean",
        0,
        0,
    )

    clinical_features = [
        mean_f0,
        std_f0,
        minimum_f0,
        maximum_f0,
        jitter_local,
        jitter_local_absolute,
        jitter_rap,
        jitter_ppq5,
        shimmer_local,
        shimmer_local_db,
        shimmer_apq3,
        shimmer_apq5,
        mean_hnr,
    ]

    return clean_numeric_values(
        clinical_features
    )


def extract_audio_features(
    audio_path,
    *,
    return_metadata=False,
):
    """
    Extract general acoustic features and specialized
    clinical voice features from an audio file.
    """

    audio_path = Path(audio_path)

    if not audio_path.exists():
        raise FileNotFoundError(
            f"Audio file not found: {audio_path}"
        )

    # Load as mono at a fixed sample rate.
    y, sr = librosa.load(
        str(audio_path),
        sr=SAMPLE_RATE,
        mono=True,
    )

    if y is None or len(y) == 0:
        raise ValueError(
            "The audio file is empty."
        )

    # Remove silence from the beginning and end.
    y, _ = librosa.effects.trim(
        y,
        top_db=30,
    )

    if len(y) == 0:
        raise ValueError(
            "The audio file contains only silence."
        )

    features = []
    metadata = {
        "sample_rate_hz": int(sr),
        "trimmed_duration_seconds": round(
            float(
                librosa.get_duration(
                    y=y,
                    sr=sr,
                )
            ),
            4,
        ),
        "clinical_voice_features": "available",
        "warnings": [],
    }

    # =====================================================
    # 1. MFCC
    # 13 means + 13 standard deviations
    # =====================================================

    mfcc = librosa.feature.mfcc(
        y=y,
        sr=sr,
        n_mfcc=13,
    )

    features.extend(
        np.mean(
            mfcc,
            axis=1,
        )
    )

    features.extend(
        np.std(
            mfcc,
            axis=1,
        )
    )

    # =====================================================
    # 2. Delta MFCC
    # =====================================================

    mfcc_delta = librosa.feature.delta(
        mfcc
    )

    features.extend(
        np.mean(
            mfcc_delta,
            axis=1,
        )
    )

    features.extend(
        np.std(
            mfcc_delta,
            axis=1,
        )
    )

    # =====================================================
    # 3. Zero Crossing Rate
    # =====================================================

    zero_crossing_rate = (
        librosa.feature.zero_crossing_rate(
            y
        )
    )

    features.append(
        np.mean(
            zero_crossing_rate
        )
    )

    features.append(
        np.std(
            zero_crossing_rate
        )
    )

    # =====================================================
    # 4. RMS Energy
    # =====================================================

    rms_energy = librosa.feature.rms(
        y=y
    )

    features.append(
        np.mean(
            rms_energy
        )
    )

    features.append(
        np.std(
            rms_energy
        )
    )

    # =====================================================
    # 5. Spectral Centroid
    # =====================================================

    spectral_centroid = (
        librosa.feature.spectral_centroid(
            y=y,
            sr=sr,
        )
    )

    features.append(
        np.mean(
            spectral_centroid
        )
    )

    features.append(
        np.std(
            spectral_centroid
        )
    )

    # =====================================================
    # 6. Spectral Bandwidth
    # =====================================================

    spectral_bandwidth = (
        librosa.feature.spectral_bandwidth(
            y=y,
            sr=sr,
        )
    )

    features.append(
        np.mean(
            spectral_bandwidth
        )
    )

    features.append(
        np.std(
            spectral_bandwidth
        )
    )

    # =====================================================
    # 7. Spectral Rolloff
    # =====================================================

    spectral_rolloff = (
        librosa.feature.spectral_rolloff(
            y=y,
            sr=sr,
        )
    )

    features.append(
        np.mean(
            spectral_rolloff
        )
    )

    features.append(
        np.std(
            spectral_rolloff
        )
    )

    # =====================================================
    # 8. Spectral Contrast
    # =====================================================

    spectral_contrast = (
        librosa.feature.spectral_contrast(
            y=y,
            sr=sr,
        )
    )

    features.extend(
        np.mean(
            spectral_contrast,
            axis=1,
        )
    )

    features.extend(
        np.std(
            spectral_contrast,
            axis=1,
        )
    )

    # =====================================================
    # 9. Chroma
    # =====================================================

    chroma = librosa.feature.chroma_stft(
        y=y,
        sr=sr,
    )

    features.extend(
        np.mean(
            chroma,
            axis=1,
        )
    )

    features.extend(
        np.std(
            chroma,
            axis=1,
        )
    )

    # =====================================================
    # 10. Tempo
    # =====================================================

    tempo_array = librosa.feature.tempo(
        y=y,
        sr=sr,
    )

    tempo = (
        float(tempo_array[0])
        if len(tempo_array) > 0
        else 0.0
    )

    features.append(
        tempo
    )

    # =====================================================
    # 11. Duration
    # =====================================================

    duration_seconds = librosa.get_duration(
        y=y,
        sr=sr,
    )

    features.append(
        duration_seconds
    )

    # =====================================================
    # 12. Clinical voice features
    # =====================================================

    try:
        clinical_features = (
            extract_voice_clinical_features(
                audio_path
            )
        )

    except Exception:
        metadata[
            "clinical_voice_features"
        ] = "fallback_zero"
        metadata["warnings"].append(
            "CLINICAL_FEATURES_UNAVAILABLE"
        )

        # 13 clinical features
        clinical_features = np.zeros(
            13,
            dtype=np.float32,
        )

    features.extend(
        clinical_features
    )

    clean_features = clean_numeric_values(
        features
    )

    metadata["feature_count"] = int(
        len(clean_features)
    )

    if return_metadata:
        return clean_features, metadata

    return clean_features


if __name__ == "__main__":
    print(
        "Audio feature extraction module is ready."
    )
