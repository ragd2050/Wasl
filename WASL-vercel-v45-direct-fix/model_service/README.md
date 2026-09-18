# WASL real model service

This service loads the three supplied trained artifacts and exposes a server-side screening API. The browser never receives Python model files.

## Included artifacts

- `speech_dysarthria_model.pkl`
- `stuttering_model.pkl`
- `voice_disorders_generalized_xgboost_model.pkl`
- `backend/feature_extraction.py`

The service verifies that every artifact exposes its expected model and feature-column metadata. All three models require 115 features.

## Tested runtime

- Python 3.11.9
- scikit-learn 1.9.0
- XGBoost 3.2.0
- Librosa 0.11.0
- Praat-Parselmouth 0.4.7

Install the complete locked set from `requirements.txt`. Do not use an untrusted Pickle artifact.

## Start

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn model_service.api:app --host 127.0.0.1 --port 8001
```

On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1`.

Verify:

```text
http://127.0.0.1:8001/health
```

The response must report all three model flags as `true`, 115 features per model, and the current `model_bundle_id`.

## Smoke-test samples

```bash
python smoke_test.py /path/to/audio --output results.csv
```

This is an engineering smoke test. It confirms execution and output shape; it does not measure accuracy unless the samples have independently verified labels.

## Compatibility safeguard

Librosa 0.11 routes local-maximum detection through a Numba gufunc. A process-level crash was reproduced during Chroma extraction with the installed NumPy/Numba combination. `backend/feature_extraction.py` now uses a NumPy implementation of the same local-maximum rule. Five repeated extractions and all 20 supplied samples completed with identical feature counts and no extraction warnings.
