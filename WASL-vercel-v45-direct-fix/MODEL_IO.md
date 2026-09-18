# Model input and output mapping

## Input

Each accepted WASL speaking task is sent separately as 16-bit PCM WAV to `POST /analyze`. The connector preserves the decoded sample rate and channels; the model service then loads mono audio at 16 kHz, trims edge silence, and extracts 115 ordered features.

The five supported task keys are:

- `picture_naming`
- `picture_description`
- `story_narration`
- `reading`
- `connected_speech`

Questionnaire answers, pointing trials, hearing screening, and safety rules remain contextual evidence for the specialist. The three current audio models do not consume those inputs.

## Feature groups

The 115 values contain MFCC summaries, delta-MFCC summaries, zero-crossing rate, RMS, spectral centroid, spectral bandwidth, spectral rolloff, spectral contrast, chroma, tempo, duration, and 13 Praat clinical voice features including F0, jitter, shimmer, and HNR.

## Model-service response

```json
{
  "api_version": "3.2.0",
  "model_metadata": {
    "bundle_id": "wasl-45b8170ceccadfbb"
  },
  "feature_extraction": {
    "sample_rate_hz": 16000,
    "trimmed_duration_seconds": 4.696,
    "clinical_voice_features": "available",
    "feature_count": 115,
    "warnings": []
  },
  "results": {
    "dysarthria": {
      "detected": true,
      "probability": 0.57,
      "threshold": 0.5
    },
    "stuttering": {
      "detected": false,
      "probability": 0.39,
      "threshold": 0.5
    },
    "voice_disorder": {
      "detected": true,
      "probability": 0.6856,
      "threshold": 0.55
    }
  }
}
```

Every score and threshold must be finite and between 0 and 1. Missing conditions, malformed flags, or invalid numbers fail the job. The connector never inserts zero or a fake score.

If Praat clinical-feature extraction falls back to zeros, `clinical_voice_features` becomes `fallback_zero` and `warnings` contains `CLINICAL_FEATURES_UNAVAILABLE`. The specialist interface presents this as a warning.

## Result shown to the specialist

The connection service creates one `sample_results` entry per recording with:

- task key;
- audio SHA-256;
- decoded duration, rate, and channels;
- feature-extraction status;
- model bundle identifier;
- the three scores, thresholds, flags, and scopes.

The initial result deliberately contains:

```json
{
  "source": "model_api",
  "confidence": null,
  "priority": {
    "level": "pending"
  },
  "recommended_service": {
    "code": "CLINICIAN_REVIEW"
  },
  "requires_manual_routing": true,
  "requires_clinician_review": true
}
```

The scores come from separate models trained on different datasets. They must not be added, averaged, or interpreted as comparable disease probabilities. A specialist reviews the recordings and context, then selects a priority and care pathway.

## Visibility

- The specialist sees model scores, thresholds, extraction warnings, and the original local recordings.
- The guardian never sees raw model scores, thresholds, hashes, or unreviewed results.
- The model does not issue a diagnosis.
