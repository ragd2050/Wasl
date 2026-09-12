# WASL — Test Report v37

## Educational stuttering case

- Python syntax compilation: PASS
- Browser client JavaScript syntax: PASS
- Demo case JavaScript syntax: PASS
- Specialist case-list JavaScript syntax: PASS
- Positive stuttering output mapping: PASS
- Fluency-service recommendation contract: PASS
- Six-item specialist plan contract: PASS

Date: 2026-09-09

## Runtime verified

- Python 3.11.9
- scikit-learn 1.9.0
- XGBoost 3.2.0
- Librosa 0.11.0
- Praat-Parselmouth 0.4.7
- Model bundle: `wasl-45b8170ceccadfbb`

## Checks passed

- All three trusted artifacts loaded successfully.
- Each artifact declares exactly 115 feature columns.
- Python syntax compilation passed for the model service, feature extractor, connection service, gateway, and tests.
- Five repeated feature extractions produced 115 finite values without a process crash.
- All 20 supplied WAV samples completed extraction and inference.
- No sample used the zero fallback for clinical Praat features.
- `GET /health` reported all models loaded and their runtime versions.
- `POST /analyze` returned three independently validated outputs plus model and feature metadata.
- The complete live HTTP path passed:
  1. guardian consent and assessment preparation;
  2. multipart audio upload;
  3. temporary WAV conversion;
  4. call to the real model service;
  5. asynchronous status completion;
  6. specialist result retrieval;
  7. rejection of approval without a clinical note;
  8. successful specialist approval with priority, pathway, and rationale.
- Three automated connection tests passed.
- The browser recording path now stores PCM16 mono WAV before upload, so current recordings do not depend on FFmpeg.
- The website and supplied model API now start in one Python process through an in-process ASGI transport.
- Python and JavaScript syntax checks passed after the v33 connection changes.
- Static route, API-contract, model-artifact, responsive-CSS, and bilingual-text checks passed for the updated package.
- Non-audio pointing activities and hearing-report attachments are excluded from the model recording plan, preventing completed assessments from being reported as missing audio.

## Smoke-test output distribution

| Output | Mean score | Minimum | Maximum | Above threshold |
|---|---:|---:|---:|---:|
| Dysarthria indicator | 0.5132 | 0.4233 | 0.5700 | 14/20 |
| Stuttering indicator | 0.3830 | 0.3233 | 0.4300 | 0/20 |
| Voice-disorder indicator | 0.1359 | 0.0071 | 0.6856 | 1/20 |

The row-level output is in `MODEL-SMOKE-TEST.csv`.

## Interpretation boundary

The 20 audio files did not include a verified sample-to-diagnosis label map. These results prove that the integration runs and returns stable, well-formed output; they do not prove clinical accuracy. No sensitivity, specificity, fairness, or calibration claim can be made from this smoke test.

## Remaining validation

1. Compare these API scores with the original training/evaluation environment on the same files.
2. Validate on a held-out speaker-level pediatric Arabic dataset.
3. Review the dysarthria threshold because many smoke-test scores cluster close to `0.50`.
4. Test microphone capture, WAV encoding, and upload on physical Safari iOS and Chrome Android devices.
5. Complete clinical, privacy, security, and regulatory review before patient use.
